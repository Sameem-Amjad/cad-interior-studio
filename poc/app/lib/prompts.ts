import type { StyleId } from "../engine/scene/store";

/**
 * Style prompt templates, shared by both AI routes.
 *
 * poc/docs/04 § FINDINGS asks us to record which templates worked — keep them
 * here, in one place, so the answer is a diff rather than an archaeology dig.
 */

export const STYLE_PROMPTS: Record<StyleId, string> = {
  modern:
    "modern contemporary interior: clean lines, monochrome palette of charcoal, warm grey and off-white, one sculptural statement light, polished concrete or large-format stone floor, minimal styling, crisp shadows",
  japandi:
    "Japandi interior: warm light oak, low-profile furniture, sage and clay accents against warm white walls, natural linen textiles, paper lantern lighting, a single ceramic vessel, quiet and uncluttered, soft diffused daylight",
  scandinavian:
    "Scandinavian interior: pale oak floors, soft neutral upholstery, white walls, wool throws, a few plants, generous natural light, airy and bright, functional simplicity",
  luxury:
    "luxury interior: deep emerald velvet upholstery, brushed brass details, dark stained timber, marble surfaces, layered warm lighting, rich contrast, editorial styling",
};

export const CONCEPT_PROMPT = (style: StyleId, extra?: string) =>
  [
    `Restyle this interior render as a photorealistic ${style} interior design concept.`,
    STYLE_PROMPTS[style],
    "Keep the room's architecture, camera angle, window positions and proportions exactly as in the source image.",
    "Change only furniture, materials, finishes and lighting mood.",
    "Architectural visualisation quality, natural light, no people, no text, no watermarks.",
    extra?.trim() ? `Additional direction: ${extra.trim()}` : "",
  ]
    .filter(Boolean)
    .join(" ");

/** Per-style colour grade used by the offline concept generator. */
export const STYLE_GRADE: Record<
  StyleId,
  { tint: [number, number, number]; lift: number; contrast: number; saturation: number; vignette: number }
> = {
  modern: { tint: [0.94, 0.97, 1.06], lift: -0.02, contrast: 1.18, saturation: 0.82, vignette: 0.4 },
  japandi: { tint: [1.09, 1.02, 0.9], lift: 0.05, contrast: 1.02, saturation: 0.92, vignette: 0.28 },
  scandinavian: { tint: [1.05, 1.05, 1.02], lift: 0.12, contrast: 0.94, saturation: 0.86, vignette: 0.18 },
  luxury: { tint: [1.04, 0.98, 0.92], lift: -0.05, contrast: 1.3, saturation: 1.12, vignette: 0.55 },
};
