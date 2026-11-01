import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { CATALOG, FINISHES } from "../../../data/catalog";
import { STYLE_PROMPTS } from "../../../lib/prompts";
import type { StyleId } from "../../../engine/scene/store";

/**
 * POST /api/auto-style — the bridge-to-production moment: AI editing the *real*
 * scene document, not a picture (poc/docs/03 § Auto-style).
 *
 * Claude picks items and finishes **from the demo catalog only**; the client
 * re-validates with the same zod schema before applying, so a hallucinated
 * catalog id can never reach the scene. How well the catalog constraint holds
 * is one of the five things poc/docs/04 wants written into FINDINGS.md.
 */

export const maxDuration = 120;

const Plan = z.object({
  rationale: z.string().describe("One sentence a designer would say about this layout."),
  floorFinishId: z.string().describe("Id of a floor finish from the finishes list."),
  wallFinishId: z.string().describe("Id of a wall finish from the finishes list."),
  items: z
    .array(
      z.object({
        catalogId: z.string().describe("Id of an item from the catalog list."),
        // Positions are optional: the client places anything the model leaves
        // out using the deterministic layout heuristic in engine/editor.
        x: z.number().nullable().describe("Metres from the room's west edge, or null to auto-place."),
        z: z.number().nullable().describe("Metres from the room's north edge, or null to auto-place."),
        rotationDegrees: z.number().nullable().describe("Yaw in degrees, or null to auto-orient."),
      }),
    )
    .describe("Between 4 and 8 items. Do not repeat large items such as sofas."),
});

export type StylePlan = z.infer<typeof Plan>;

type Body = { style?: StyleId; room?: { name?: string; width?: number; depth?: number } };

const STYLES: StyleId[] = ["modern", "japandi", "scandinavian", "luxury"];

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const style = body.style && STYLES.includes(body.style) ? body.style : null;
  if (!style) return NextResponse.json({ error: "Unknown style." }, { status: 400 });

  const width = body.room?.width ?? 5;
  const depth = body.room?.depth ?? 4;
  const roomName = body.room?.name ?? "Living Room";

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ source: "local", plan: localPlan(style) });
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 8000,
      // Furnishing one small room from a fixed catalog is a scoped task; low
      // effort keeps the demo beat under a few seconds without hurting picks.
      output_config: { effort: "low", format: zodOutputFormat(Plan) },
      system:
        "You are an interior designer laying out a single room. You may only use items and finishes " +
        "from the supplied catalog — never invent an id. Place items so they do not overlap, keep " +
        "walkways clear, and put sofas and storage against walls facing into the room.",
      messages: [
        {
          role: "user",
          content: [
            `Style: ${style} — ${STYLE_PROMPTS[style]}`,
            `Room: "${roomName}", ${width.toFixed(1)} m wide (x, west→east) by ${depth.toFixed(1)} m deep (z, north→south).`,
            "The room origin (0,0) is its north-west corner; x and z are metres from that corner.",
            "Rotation 0° faces south (+z). Leave a coordinate null if you'd rather the app place that item.",
            "",
            "Catalog:",
            ...CATALOG.map(
              (i) =>
                `- ${i.id} · ${i.name} · ${i.category} · suits ${i.styles.join("/")} · footprint ${i.footprint.w}×${i.footprint.d} m${i.wallHugging ? " · goes against a wall" : ""}`,
            ),
            "",
            "Finishes:",
            ...FINISHES.map((f) => `- ${f.id} · ${f.name} · ${f.kind} · suits ${f.styles.join("/")}`),
          ].join("\n"),
        },
      ],
    });

    // Opus 5 can decline a request outright; treat it as a content outcome and
    // fall through to the deterministic planner rather than failing the demo.
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return NextResponse.json({ source: "local", plan: localPlan(style) });
    }

    return NextResponse.json({ source: "claude", plan: sanitise(response.parsed_output, style) });
  } catch (err) {
    console.error("[auto-style]", err);
    return NextResponse.json({ source: "local", plan: localPlan(style), warning: "AI unavailable — used a local plan." });
  }
}

/** Drop anything that isn't a real catalog/finish id before it leaves the server. */
function sanitise(plan: StylePlan, style: StyleId): StylePlan {
  const ids = new Set(CATALOG.map((i) => i.id));
  const floors = new Set(FINISHES.filter((f) => f.kind === "floor").map((f) => f.id));
  const walls = new Set(FINISHES.filter((f) => f.kind === "wall").map((f) => f.id));
  const fallback = localPlan(style);

  const seenLarge = new Set<string>();
  const items = plan.items.filter((i) => {
    if (!ids.has(i.catalogId)) return false;
    const spec = CATALOG.find((c) => c.id === i.catalogId)!;
    if (spec.footprint.w * spec.footprint.d > 1.4) {
      if (seenLarge.has(spec.category)) return false;
      seenLarge.add(spec.category);
    }
    return true;
  });

  return {
    rationale: plan.rationale,
    floorFinishId: floors.has(plan.floorFinishId) ? plan.floorFinishId : fallback.floorFinishId,
    wallFinishId: walls.has(plan.wallFinishId) ? plan.wallFinishId : fallback.wallFinishId,
    items: items.length >= 3 ? items : fallback.items,
  };
}

/**
 * Deterministic planner: pick the best-matching catalog entries by style tag.
 * Used with no API key, on refusal, and on any error — the "auto-style" beat of
 * the demo always does something.
 */
function localPlan(style: StyleId): StylePlan {
  const pick = (category: string, n = 1) =>
    CATALOG.filter((i) => i.category === category && i.styles.includes(style)).slice(0, n);

  const items = [
    ...pick("Sofas"),
    ...pick("Tables"),
    ...pick("Seating", 2),
    ...pick("Lighting"),
    ...pick("Decor", 2),
    ...pick("Storage"),
  ].map((i) => ({ catalogId: i.id, x: null, z: null, rotationDegrees: null }));

  const floor = FINISHES.find((f) => f.kind === "floor" && f.styles.includes(style)) ?? FINISHES[0];
  const wall = FINISHES.find((f) => f.kind === "wall" && f.styles.includes(style)) ?? FINISHES[3];

  return {
    rationale: `A ${style} layout assembled from the demo catalog.`,
    floorFinishId: floor.id,
    wallFinishId: wall.id,
    items,
  };
}
