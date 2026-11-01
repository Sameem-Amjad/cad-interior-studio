# 05 — AI Integration

Three AI features, strictly separated by purpose:

| Feature | Track | Provider | Output |
|---|---|---|---|
| Style concepts | A — inspiration | Image-gen adapter (OpenAI Images / Gemini) | Images only |
| Design assistant | support | Claude API (`claude-opus-5`) | Chat + catalog references |
| Product suggestions | B — buildable | Tags + Claude re-rank | Catalog variant ids |

**The invariant from [00](00-project-brief.md):** Track A output is never quotable, never placed in the scene, never mapped to a SKU. UI copy must label concepts as inspiration.

## Track A — Style concept generation

Flow (worker job `ai.styleConcept`):

1. Client captures the current room render (R3F `gl.domElement.toDataURL`, downscaled to ≤ 1536px) and POSTs `{versionId, roomId, style}`.
2. Worker builds the prompt from a **versioned template** (below), calls the image provider's image-to-image/edit endpoint, requests 4 variants.
3. Outputs → R2; `AiGeneration` row records provider, full prompt, params, and cost; client notified via WebSocket.

Prompt templates live in `packages/shared/ai/prompts/` as code (typed, versioned, reviewed in PRs — not in the DB):

```ts
export const styleConceptPrompt = (p: { style: StyleKey; roomKind: RoomKind }) => `
Interior design concept for a ${p.roomKind} in ${STYLE_DESCRIPTORS[p.style]} style.
Preserve the room's architecture: wall positions, windows, and doors must not move.
Photorealistic, natural daylight, eye-level wide-angle view.`;
```

Controls:
- **Quota**: 20 generations/user/day (config), enforced in Redis; HTTP 429 with a friendly typed error beyond it.
- **Cache**: identical `(roomRenderHash, style, templateVersion)` within 24 h returns cached results.
- **Moderation**: provider safety settings on; generations for rooms are low-risk, but outputs are still stored privately (signed URLs) and reportable.

## Design assistant (Claude)

Backend module `ai/assistant` using the official TypeScript SDK (`@anthropic-ai/sdk`). Model: **`claude-opus-5`** (default; do not silently downgrade — model id is config, changes go through review). Responses are streamed to the client over SSE.

Architecture: the assistant is a **tool-using agent scoped to read-only project context**. It cannot mutate anything — it answers questions and proposes; the user acts.

```ts
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

const searchCatalog = betaZodTool({
  name: "search_catalog",
  description:
    "Search the product catalog. Call this whenever the user asks about furniture, " +
    "materials, prices, or alternatives — do not answer catalog questions from memory.",
  inputSchema: z.object({
    query: z.string(),
    category: z.enum(CATEGORIES).optional(),
    maxPriceCents: z.number().int().optional(),
  }),
  run: async (input) => JSON.stringify(await catalogService.search(input)),
});

const getRoomState = betaZodTool({
  name: "get_room_state",
  description: "Get the current design state of a room: placed items, finishes, running total.",
  inputSchema: z.object({ roomId: z.string() }),
  run: async ({ roomId }) => JSON.stringify(await designService.roomSummary(versionId, roomId)),
});

const runner = client.beta.messages.toolRunner({
  model: "claude-opus-5",
  max_tokens: 4096,
  system: [{ type: "text", text: ASSISTANT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
  tools: [searchCatalog, getRoomState],
  messages: history,
  stream: true,
});
```

Rules for this integration:

- **System prompt is frozen and cached.** Volatile context (project name, room, budget) is injected into the *user* turn, never interpolated into `system` — keeps the prompt-cache prefix stable. Verify with `usage.cache_read_input_tokens` in logs.
- **Tools over context-stuffing.** Don't paste the whole catalog into the prompt; the assistant fetches what it needs. Tool descriptions state *when* to call, not just what they do.
- **Grounding**: the system prompt instructs the assistant to only reference products returned by `search_catalog` and to include `variantId`s; the frontend renders those as product cards. An answer inventing a product is a prompt bug — covered by the eval set ([09](09-testing-strategy.md)).
- **Error handling**: typed exception chain (`RateLimitError` → backoff message to user; `APIStatusError` → generic failure) — never string-match error messages.
- **History**: conversation stored per user+version; append full `response.content` blocks back (tool_use blocks included) per SDK contract.
- **Cost**: token usage from `response.usage` logged per message into `AiGeneration`-style accounting; alert when a day's spend crosses budget ([11](11-performance-observability.md)).

## Product suggestions (Track B)

Deliberately simple for MVP: candidate generation is `styleTags` + category + dimension-fit SQL; Claude re-ranks the top 30 candidates for the room context and returns ordered `variantId`s with one-line reasons (structured output via `output_config.format` with a JSON schema — guaranteed parseable). No embeddings infrastructure until the catalog outgrows tags.

## Provider adapter boundary

```ts
// packages/shared/ai/types.ts
export interface ImageGenProvider {
  generateStyleConcepts(input: {
    baseImage: Buffer; prompt: string; count: number;
  }): Promise<{ images: Buffer[]; providerRef: string; costCents: number }>;
}
// apps/worker/src/ai/providers/openai-images.ts / gemini.ts implement it.
// Provider selection is config (env), per-environment. Claude assistant has its own
// module and does NOT hide behind this interface — chat+tools semantics differ too much
// to abstract prematurely.
```

## Evaluation & guardrails

- **Golden prompt tests**: fixture conversations with recorded responses; assert tool-call shape, grounding (all `variantId`s exist), and refusal behavior on off-topic requests. Run nightly against the live model (small set), on every PR against fixtures.
- **UI guardrails**: concept images carry a permanent "AI concept — for inspiration" badge; the "apply this look" action opens Track B suggestions, never pretends to apply the image.
- **Prompt changes are code changes**: template edits require the eval set green + one human review of sample outputs.
