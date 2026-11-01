"use client";

import { STYLE_GRADE } from "./prompts";
import type { Concept, StyleId } from "../engine/scene/store";

/**
 * Client side of the concept flow: cache → provider → offline fallback.
 *
 * The localStorage cache is keyed by (designHash, style) so a re-demo is
 * instant (poc/docs/03 § Style concepts, point 3).
 */

const cacheKey = (hash: string, style: StyleId) => `poc:concepts:${style}:${hash}`;

export function readCache(hash: string, style: StyleId): Concept[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(hash, style));
    return raw ? (JSON.parse(raw) as Concept[]) : null;
  } catch {
    return null;
  }
}

function writeCache(hash: string, style: StyleId, concepts: Concept[]) {
  try {
    localStorage.setItem(cacheKey(hash, style), JSON.stringify(concepts));
  } catch {
    // A 4-image cache blows past the 5 MB quota quickly. Evict oldest and retry once.
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith("poc:concepts:")) localStorage.removeItem(k);
      localStorage.setItem(cacheKey(hash, style), JSON.stringify(concepts));
    } catch {
      /* give up quietly — the cache is an optimisation, not a feature */
    }
  }
}

export type GenerateResult = { concepts: Concept[]; placeholder: boolean; note?: string };

export async function generateConcepts(
  image: string,
  style: StyleId,
  hash: string,
  extraPrompt?: string,
  signal?: AbortSignal,
): Promise<GenerateResult> {
  const res = await fetch("/api/style-concepts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ image, style, prompt: extraPrompt, n: 4 }),
    signal,
  });

  // A provider outage must not dead-end the demo. Fall back to the same local
  // renderer used when no key is configured, and say plainly why — the images
  // are labelled "demo" either way, so nobody is misled about what they are.
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: string } | null;
    const reason = detail?.error ?? `the provider returned ${res.status}`;
    const concepts = await gradeLocally(image, style, hash);
    return {
      concepts,
      placeholder: true,
      note: `${reason} Showing style-graded views of your own render instead — these are not AI output.`,
    };
  }

  const json = (await res.json()) as { configured: boolean; images?: string[]; provider?: string };

  if (json.configured && json.images?.length) {
    const concepts: Concept[] = json.images.map((url, i) => ({
      id: `${hash}-${style}-${i}`,
      url,
      style,
      label: `${styleLabel(style)} · Concept ${i + 1} of ${json.images!.length}`,
      placeholder: false,
    }));
    writeCache(hash, style, concepts);
    return { concepts, placeholder: false };
  }

  // No provider key — render style-graded variants of the actual room instead.
  const concepts = await gradeLocally(image, style, hash);
  writeCache(hash, style, concepts);
  return {
    concepts,
    placeholder: true,
    note: "Demo mode: no image-generation key is configured, so these are style-graded views of your own render — not AI output.",
  };
}

const styleLabel = (s: StyleId) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Offline concept generator. Applies the style's colour grade to the captured
 * render at four exposures, so the beat still lands with no network. Clearly
 * flagged as demo mode everywhere it surfaces — we never pass a grade off as a
 * generated concept.
 */
async function gradeLocally(image: string, style: StyleId, hash: string): Promise<Concept[]> {
  const img = await loadImage(image);
  const grade = STYLE_GRADE[style];
  const variants = [
    { name: "Daylight", exposure: 1.0 },
    { name: "Golden hour", exposure: 1.12 },
    { name: "Evening", exposure: 0.82 },
    { name: "Overcast", exposure: 0.95 },
  ];

  return variants.map((variant, i) => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;
    for (let p = 0; p < px.length; p += 4) {
      for (let c = 0; c < 3; c++) {
        let v = px[p + c] / 255;
        v = (v - 0.5) * grade.contrast + 0.5 + grade.lift;
        v *= grade.tint[c] * variant.exposure;
        px[p + c] = Math.max(0, Math.min(255, v * 255));
      }
      const lum = (px[p] * 0.299 + px[p + 1] * 0.587 + px[p + 2] * 0.114) / 255;
      for (let c = 0; c < 3; c++) {
        px[p + c] = Math.max(0, Math.min(255, lum * 255 + (px[p + c] - lum * 255) * grade.saturation));
      }
    }
    ctx.putImageData(data, 0, 0);

    // Vignette, drawn after the pixel pass so it isn't double-graded.
    const r = Math.hypot(canvas.width, canvas.height) / 2;
    const vg = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, r * 0.45, canvas.width / 2, canvas.height / 2, r);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, `rgba(0,0,0,${grade.vignette})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    return {
      id: `${hash}-${style}-local-${i}`,
      url: canvas.toDataURL("image/webp", 0.86),
      style,
      label: `${styleLabel(style)} · ${variant.name}`,
      placeholder: true,
    };
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn’t read the viewport capture."));
    img.src = src;
  });
}
