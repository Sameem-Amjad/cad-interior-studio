import * as THREE from "three";
import { concreteTexture, tileTexture, woodTexture } from "./materials";
import type { StyleId } from "../engine/scene/store";

/**
 * The demo catalog: 12 items and 6 finishes, style-tagged.
 *
 * NO PRICES ANYWHERE — poc/docs/01-scope-and-demo.md is explicit about this.
 * The PoC ends exactly where the quotation engine would begin.
 */

export type Category = "Sofas" | "Seating" | "Tables" | "Lighting" | "Storage" | "Decor";

export type CatalogItem = {
  id: string;
  name: string;
  category: Category;
  /** Human-facing single tag shown on the card. */
  tag: string;
  /** Styles this item suits — drives AI auto-style and the style filter. */
  styles: StyleId[];
  /** Footprint in meters, used for the placement ghost and collision AABB. */
  footprint: { w: number; d: number };
  height: number;
  /** Items that must sit against a wall read better when auto-placed there. */
  wallHugging?: boolean;
};

export const CATALOG: CatalogItem[] = [
  { id: "oslo-sofa", name: "Oslo Sofa", category: "Sofas", tag: "Japandi", styles: ["japandi", "scandinavian"], footprint: { w: 2.2, d: 0.9 }, height: 0.85, wallHugging: true },
  { id: "milan-sofa", name: "Milan Velvet Sofa", category: "Sofas", tag: "Luxury", styles: ["luxury", "modern"], footprint: { w: 2.6, d: 0.9 }, height: 0.85, wallHugging: true },
  { id: "kyoto-lounge", name: "Kyoto Lounge Chair", category: "Seating", tag: "Japandi", styles: ["japandi"], footprint: { w: 0.82, d: 0.78 }, height: 0.9 },
  { id: "aalto-armchair", name: "Aalto Armchair", category: "Seating", tag: "Scandinavian", styles: ["scandinavian", "modern"], footprint: { w: 0.76, d: 0.76 }, height: 0.9 },
  { id: "dining-chair", name: "Fjord Dining Chair", category: "Seating", tag: "Scandinavian", styles: ["scandinavian", "japandi", "modern"], footprint: { w: 0.46, d: 0.48 }, height: 0.92 },
  { id: "nora-table", name: "Nora Coffee Table", category: "Tables", tag: "Minimalist", styles: ["japandi", "scandinavian", "modern"], footprint: { w: 0.9, d: 0.9 }, height: 0.4 },
  { id: "bruno-dining", name: "Bruno Dining Table", category: "Tables", tag: "Modern", styles: ["modern", "luxury"], footprint: { w: 1.8, d: 0.9 }, height: 0.78 },
  { id: "sideboard", name: "Halden Sideboard", category: "Storage", tag: "Modern", styles: ["modern", "scandinavian", "luxury"], footprint: { w: 1.6, d: 0.42 }, height: 0.82, wallHugging: true },
  { id: "arc-lamp", name: "Arc Floor Lamp", category: "Lighting", tag: "Industrial", styles: ["modern", "luxury"], footprint: { w: 0.4, d: 0.4 }, height: 2.0 },
  { id: "lantern-lamp", name: "Washi Lantern Lamp", category: "Lighting", tag: "Japandi", styles: ["japandi", "scandinavian"], footprint: { w: 0.35, d: 0.35 }, height: 1.35 },
  { id: "beni-rug", name: "Beni Rug", category: "Decor", tag: "Textured", styles: ["japandi", "scandinavian", "modern", "luxury"], footprint: { w: 2.4, d: 1.6 }, height: 0.02 },
  { id: "monstera", name: "Monstera Plant", category: "Decor", tag: "Greenery", styles: ["japandi", "scandinavian", "modern", "luxury"], footprint: { w: 0.6, d: 0.6 }, height: 1.2 },
];

export const CATEGORIES: ("All" | Category)[] = ["All", "Sofas", "Seating", "Tables", "Lighting", "Storage", "Decor"];

export const byId = new Map(CATALOG.map((i) => [i.id, i]));
export const itemName = (id: string) => byId.get(id)?.name ?? id;

// ── Finishes ───────────────────────────────────────────────────────────────

export type Finish = {
  id: string;
  name: string;
  kind: "floor" | "wall";
  /** Colour used for the swatch chip in the UI. */
  swatch: string;
  styles: StyleId[];
  make: () => THREE.MeshStandardMaterial;
};

function repeat(t: THREE.Texture, x: number, y: number) {
  const c = t.clone();
  c.needsUpdate = true;
  c.wrapS = c.wrapT = THREE.RepeatWrapping;
  c.repeat.set(x, y);
  return c;
}

export const FINISHES: Finish[] = [
  {
    id: "floor-oak",
    name: "Oak plank",
    kind: "floor",
    swatch: "#b58a53",
    styles: ["japandi", "scandinavian", "modern"],
    make: () => new THREE.MeshStandardMaterial({ map: repeat(woodTexture("#b58a53", "#6d4a24"), 3, 3), roughness: 0.68 }),
  },
  {
    id: "floor-tile",
    name: "Stone tile",
    kind: "floor",
    swatch: "#9aa0a6",
    styles: ["modern", "luxury"],
    make: () => new THREE.MeshStandardMaterial({ map: repeat(tileTexture("#9aa0a6", "#5c6167"), 3, 3), roughness: 0.42 }),
  },
  {
    id: "floor-concrete",
    name: "Polished concrete",
    kind: "floor",
    swatch: "#6f7378",
    styles: ["modern", "luxury"],
    make: () => new THREE.MeshStandardMaterial({ map: repeat(concreteTexture("#6f7378"), 2, 2), roughness: 0.32, metalness: 0.05 }),
  },
  { id: "wall-warm-white", name: "Warm white", kind: "wall", swatch: "#ece7de", styles: ["japandi", "scandinavian", "modern", "luxury"], make: () => new THREE.MeshStandardMaterial({ color: "#ece7de", roughness: 0.95 }) },
  { id: "wall-sage", name: "Sage", kind: "wall", swatch: "#93a08c", styles: ["japandi", "scandinavian"], make: () => new THREE.MeshStandardMaterial({ color: "#93a08c", roughness: 0.95 }) },
  { id: "wall-charcoal", name: "Charcoal", kind: "wall", swatch: "#3a3d42", styles: ["modern", "luxury"], make: () => new THREE.MeshStandardMaterial({ color: "#3a3d42", roughness: 0.9 }) },
];

export const finishById = new Map(FINISHES.map((f) => [f.id, f]));
export const finishName = (id?: string) => (id ? finishById.get(id)?.name ?? id : "—");

export const DEFAULT_FLOOR = "floor-oak";
export const DEFAULT_WALL = "wall-warm-white";

// ── Styles ─────────────────────────────────────────────────────────────────

export const STYLES: { id: StyleId; name: string; blurb: string; swatches: [string, string, string] }[] = [
  { id: "modern", name: "Modern", blurb: "Clean lines, monochrome, statement lighting", swatches: ["#3a3d42", "#9aa0a6", "#1b1d21"] },
  { id: "japandi", name: "Japandi", blurb: "Warm wood, low profile, quiet palette", swatches: ["#b58a53", "#93a08c", "#ece7de"] },
  { id: "scandinavian", name: "Scandinavian", blurb: "Light oak, soft neutrals, airy", swatches: ["#d6cec1", "#b58a53", "#ffffff"] },
  { id: "luxury", name: "Luxury", blurb: "Velvet, brass, deep contrast", swatches: ["#2f5d52", "#c9a227", "#1b1d21"] },
];

export const styleName = (id: StyleId) => STYLES.find((s) => s.id === id)?.name ?? id;
