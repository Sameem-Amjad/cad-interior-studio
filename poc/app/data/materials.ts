import * as THREE from "three";

/**
 * Procedural material library.
 *
 * poc/docs/02-architecture.md budgets ~12 CC0 GLBs and 6 PBR texture sets. We
 * generate both instead: canvas textures + parametric geometry. Same visual
 * job, no download step, no licence audit, and every asset is trivially inside
 * the ≤2 MB / ≤30k-tri budget. Swapping in real GLBs later only touches
 * data/catalog.ts — nothing in engine/ knows the difference.
 */

const cache = new Map<string, THREE.Texture>();

function canvasTexture(key: string, size: number, draw: (c: CanvasRenderingContext2D, s: number) => void) {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  cache.set(key, tex);
  return tex;
}

/** Deterministic value noise so textures look identical on every reload. */
function rand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function grain(ctx: CanvasRenderingContext2D, size: number, seed: number, amount: number) {
  const r = rand(seed);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * amount;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

export function woodTexture(base: string, dark: string, seed = 7) {
  return canvasTexture(`wood:${base}:${dark}`, 512, (ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    const r = rand(seed);
    // Plank seams.
    const planks = 4;
    for (let p = 0; p <= planks; p++) {
      const y = (p * s) / planks;
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(0, y - 1, s, 2);
    }
    // Grain streaks, kept inside each plank.
    for (let i = 0; i < 900; i++) {
      const plank = Math.floor(r() * planks);
      const y = (plank * s) / planks + r() * (s / planks);
      const len = 30 + r() * 180;
      ctx.strokeStyle = r() > 0.5 ? `rgba(0,0,0,${0.03 + r() * 0.07})` : `rgba(255,255,255,${0.02 + r() * 0.05})`;
      ctx.lineWidth = 0.6 + r() * 1.6;
      ctx.beginPath();
      ctx.moveTo(r() * s, y);
      ctx.bezierCurveTo(r() * s, y + 3, r() * s, y - 3, r() * s + len, y);
      ctx.stroke();
    }
    ctx.fillStyle = dark;
    ctx.globalAlpha = 0.12;
    ctx.fillRect(0, 0, s, s);
    ctx.globalAlpha = 1;
    grain(ctx, s, seed, 10);
  });
}

export function tileTexture(base: string, groutColor: string) {
  return canvasTexture(`tile:${base}`, 512, (ctx, s) => {
    ctx.fillStyle = groutColor;
    ctx.fillRect(0, 0, s, s);
    const n = 4;
    const gap = 4;
    const cell = s / n;
    const r = rand(21);
    for (let x = 0; x < n; x++)
      for (let y = 0; y < n; y++) {
        const shade = 1 + (r() - 0.5) * 0.06;
        ctx.fillStyle = shadeHex(base, shade);
        ctx.fillRect(x * cell + gap / 2, y * cell + gap / 2, cell - gap, cell - gap);
      }
    grain(ctx, s, 33, 6);
  });
}

export function concreteTexture(base: string) {
  return canvasTexture(`concrete:${base}`, 512, (ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    const r = rand(99);
    for (let i = 0; i < 260; i++) {
      const x = r() * s;
      const y = r() * s;
      const rad = 8 + r() * 80;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      const a = 0.02 + r() * 0.05;
      g.addColorStop(0, r() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    grain(ctx, s, 5, 14);
  });
}

export function fabricTexture(base: string, seed = 3) {
  return canvasTexture(`fabric:${base}`, 256, (ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    const r = rand(seed);
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
      ctx.fillRect(r() * s, r() * s, 2, 1);
    }
    grain(ctx, s, seed + 1, 8);
  });
}

export function rugTexture(base: string, accent: string) {
  return canvasTexture(`rug:${base}:${accent}`, 256, (ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(0, 30 + i * 50);
      ctx.lineTo(s, 30 + i * 50);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(20 + i * 40, 0);
      ctx.lineTo(20 + i * 40 + 30, s);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    grain(ctx, s, 12, 12);
  });
}

function shadeHex(hex: string, mul: number) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(mul);
  return `#${c.getHexString()}`;
}

// ── Furniture material palette ─────────────────────────────────────────────
const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(key: string, make: () => THREE.MeshStandardMaterial) {
  let m = matCache.get(key);
  if (!m) {
    m = make();
    matCache.set(key, m);
  }
  return m;
}

export const PALETTE = {
  fabricGrey: () =>
    mat("fabricGrey", () => new THREE.MeshStandardMaterial({ map: fabricTexture("#8b8f97"), roughness: 0.92 })),
  fabricCream: () =>
    mat("fabricCream", () => new THREE.MeshStandardMaterial({ map: fabricTexture("#d6cec1", 9), roughness: 0.9 })),
  fabricSage: () =>
    mat("fabricSage", () => new THREE.MeshStandardMaterial({ map: fabricTexture("#93a08c", 15), roughness: 0.9 })),
  velvet: () =>
    mat(
      "velvet",
      () => new THREE.MeshStandardMaterial({ map: fabricTexture("#2f5d52", 27), roughness: 0.62, metalness: 0.06 }),
    ),
  oak: () => mat("oak", () => new THREE.MeshStandardMaterial({ map: woodTexture("#b58a53", "#6d4a24"), roughness: 0.7 })),
  walnut: () =>
    mat("walnut", () => new THREE.MeshStandardMaterial({ map: woodTexture("#6b4a33", "#33200f", 19), roughness: 0.62 })),
  blackMetal: () => mat("blackMetal", () => new THREE.MeshStandardMaterial({ color: "#1b1d21", roughness: 0.42, metalness: 0.75 })),
  brass: () => mat("brass", () => new THREE.MeshStandardMaterial({ color: "#c9a227", roughness: 0.3, metalness: 0.9 })),
  paper: () => mat("paper", () => new THREE.MeshStandardMaterial({ color: "#f2ece0", roughness: 1, emissive: "#3a3325" })),
  ceramic: () => mat("ceramic", () => new THREE.MeshStandardMaterial({ color: "#e9e5dd", roughness: 0.35 })),
  leaf: () => mat("leaf", () => new THREE.MeshStandardMaterial({ color: "#3e6b45", roughness: 0.75, side: THREE.DoubleSide })),
  glass: () =>
    mat("glass", () => new THREE.MeshStandardMaterial({ color: "#9fd0e3", roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.28 })),
};
