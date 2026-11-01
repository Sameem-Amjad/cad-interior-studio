import { NextResponse } from "next/server";
import { CONCEPT_PROMPT } from "../../../lib/prompts";
import type { StyleId } from "../../../engine/scene/store";

/**
 * POST /api/style-concepts — image-to-image concept generation.
 *
 * One provider, chosen by which key is present (poc/docs/02: "pick in day 1
 * spike"). Both adapters are here so the choice is an env var, not a rewrite.
 *
 * When no key is configured the route returns `configured: false` rather than
 * failing. The client then renders style-graded variants of the screenshot
 * locally, so the AI beat of the demo still shows something on a dead Wi-Fi —
 * the risk kit in poc/docs/01. Those variants are labelled "demo mode" in the
 * UI; we never pass off a colour grade as a generated concept.
 */

export const maxDuration = 120;

type Body = { image?: string; style?: StyleId; prompt?: string; n?: number };

const STYLES: StyleId[] = ["modern", "japandi", "scandinavian", "luxury"];

export async function POST(req: Request) {
  const t0 = Date.now();
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const style = body.style && STYLES.includes(body.style) ? body.style : null;
  if (!style) return NextResponse.json({ error: "Unknown style." }, { status: 400 });
  if (!body.image?.startsWith("data:image/")) {
    return NextResponse.json({ error: "Expected a data-URL screenshot." }, { status: 400 });
  }

  const n = Math.min(Math.max(body.n ?? 4, 1), 4);
  const prompt = CONCEPT_PROMPT(style, body.prompt);

  // Providers are tried in order, so a key that authenticates but can't serve —
  // an exhausted balance, a quota trip — falls through to the next one instead
  // of ending the demo. `IMAGE_PROVIDER` pins a single provider when you want
  // to test one deliberately.
  const pinned = process.env.IMAGE_PROVIDER?.trim().toLowerCase();
  const image = body.image;
  type Provider = { name: string; key?: string; run: (k: string) => Promise<string[]> };
  const chain: Provider[] = [
    { name: "gemini", key: process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY, run: (k: string) => geminiEdit(k, image, prompt, n) },
    { name: "openai", key: process.env.OPENAI_API_KEY, run: (k: string) => openAiEdit(k, image, prompt, n) },
  ].filter((p) => p.key && (!pinned || p.name === pinned));

  const failures: string[] = [];
  for (const provider of chain) {
    try {
      const images = await provider.run(provider.key!);
      if (images.length === 0) throw new Error("provider returned no images");
      return NextResponse.json({
        configured: true,
        provider: provider.name,
        images,
        ms: Date.now() - t0,
        ...(failures.length ? { recoveredFrom: failures } : {}),
      });
    } catch (err) {
      console.error(`[style-concepts] ${provider.name}:`, err);
      failures.push(`${provider.name}: ${readableProviderError(err)}`);
    }
  }

  if (failures.length) {
    return NextResponse.json({ error: failures.join(" "), configured: true }, { status: 502 });
  }

  return NextResponse.json({
    configured: false,
    reason: "No image-generation key configured (set GOOGLE_API_KEY or OPENAI_API_KEY).",
    prompt,
  });
}

/**
 * Provider errors reach a room full of people, so say what happened in one line.
 * Billing and rate limits are the two that actually occur on demo day.
 */
function readableProviderError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/insufficient_quota|credit_balance_exhausted|no credits/i.test(raw))
    return "The image provider account has no credits left.";
  if (/\b401\b|invalid_api_key|Incorrect API key/i.test(raw)) return "The image provider rejected the API key.";
  // "limit: 0" is a billing gate, not a burst limit — waiting will never help,
  // so don't tell a room full of people that we are being rate-limited.
  if (/limit:\s*0\b/.test(raw)) return "Image generation isn’t enabled on this provider account (free tier excludes it).";
  if (/\b429\b|rate.?limit|RESOURCE_EXHAUSTED/i.test(raw)) return "The image provider is rate-limiting us.";
  if (/abort|timeout|timed out/i.test(raw)) return "The image provider timed out.";
  return raw.slice(0, 200);
}

// ── providers ──────────────────────────────────────────────────────────────

function dataUrlToBlob(dataUrl: string) {
  const [header, b64] = dataUrl.split(",", 2);
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? "image/png";
  return new Blob([Buffer.from(b64, "base64")], { type: mime });
}

async function openAiEdit(key: string, image: string, prompt: string, n: number): Promise<string[]> {
  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append("prompt", prompt);
  form.append("n", String(n));
  form.append("size", "1024x1024");
  form.append("image", dataUrlToBlob(image), "room.png");

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`Image provider returned ${res.status}: ${(await res.text()).slice(0, 800)}`);
  const json = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
  return (json.data ?? [])
    .map((d) => (d.b64_json ? `data:image/png;base64,${d.b64_json}` : d.url))
    .filter((u): u is string => Boolean(u));
}

/** Overridable so a newer image model can be tried without a code change. */
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";

async function geminiEdit(key: string, image: string, prompt: string, n: number): Promise<string[]> {
  const [header, b64] = image.split(",", 2);
  const mimeType = /data:([^;]+)/.exec(header)?.[1] ?? "image/png";

  // Gemini returns one image per call; fan out for the 2×2 grid.
  const one = async (variantHint: string) => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${prompt} ${variantHint}` }, { inline_data: { mime_type: mimeType, data: b64 } }] }],
        }),
        signal: AbortSignal.timeout(90_000),
      },
    );
    if (!res.ok) throw new Error(`Image provider returned ${res.status}: ${(await res.text()).slice(0, 800)}`);
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
    };
    const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    return part?.inlineData?.data
      ? `data:${part.inlineData.mimeType ?? "image/png"};base64,${part.inlineData.data}`
      : null;
  };

  const hints = [
    "Daylight, wide view.",
    "Golden-hour light, slightly warmer palette.",
    "Evening, layered lamp lighting.",
    "Overcast daylight, cooler and calmer.",
  ];
  // Fan out, but keep whatever comes back: three concepts beat an exception.
  const settled = await Promise.allSettled(hints.slice(0, n).map(one));
  const images = settled
    .filter((r): r is PromiseFulfilledResult<string | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((u): u is string => Boolean(u));
  if (images.length === 0) {
    const firstError = settled.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    throw firstError ? firstError.reason : new Error("provider returned no images");
  }
  return images;
}
