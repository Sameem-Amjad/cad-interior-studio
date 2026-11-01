import * as THREE from "three";
import type { CatalogItem } from "../../data/catalog";
import type { PlacedItem, Vec3 } from "../scene/schema";
import type { RoomInfo } from "../ingest/types";

/**
 * Placement maths. Pure functions, no three scene access, no React — this is
 * the part of the editor that has unit tests (poc/docs/04 D7).
 */

export const GRID = 0.05; // 5 cm
export const ROT_STEP = Math.PI / 12; // 15°

export const snapPosition = (p: Vec3, enabled: boolean): Vec3 =>
  enabled ? [Math.round(p[0] / GRID) * GRID, p[1], Math.round(p[2] / GRID) * GRID] : p;

export const snapRotation = (r: number, enabled: boolean): number =>
  enabled ? Math.round(r / ROT_STEP) * ROT_STEP : r;

/** Axis-aligned footprint after yaw. Good enough for a demo warning. */
export function footprintBox(item: CatalogItem, position: Vec3, rotationY: number): THREE.Box2 {
  const c = Math.abs(Math.cos(rotationY));
  const s = Math.abs(Math.sin(rotationY));
  const w = item.footprint.w * c + item.footprint.d * s;
  const d = item.footprint.w * s + item.footprint.d * c;
  return new THREE.Box2(
    new THREE.Vector2(position[0] - w / 2, position[2] - d / 2),
    new THREE.Vector2(position[0] + w / 2, position[2] + d / 2),
  );
}

/**
 * Does this placement overlap something already in the room? Rugs are ignored
 * on both sides — furniture is *supposed* to sit on a rug.
 */
export function collides(
  candidate: { item: CatalogItem; position: Vec3; rotationY: number },
  placed: PlacedItem[],
  lookup: (id: string) => CatalogItem | undefined,
  ignoreItemId?: string,
): boolean {
  if (isFlat(candidate.item)) return false;
  const a = footprintBox(candidate.item, candidate.position, candidate.rotationY);
  for (const p of placed) {
    if (p.id === ignoreItemId) continue;
    const other = lookup(p.catalogId);
    if (!other || isFlat(other)) continue;
    const b = footprintBox(other, p.position, p.rotationY);
    // Touching edges are fine; require real overlap.
    if (a.max.x - b.min.x > 0.02 && b.max.x - a.min.x > 0.02 && a.max.y - b.min.y > 0.02 && b.max.y - a.min.y > 0.02)
      return true;
  }
  return false;
}

const isFlat = (i: CatalogItem) => i.height < 0.1;

/** Keep a footprint fully inside the room, with a small skirting clearance. */
export function clampToRoom(item: CatalogItem, position: Vec3, rotationY: number, room: RoomInfo): Vec3 {
  const c = Math.abs(Math.cos(rotationY));
  const s = Math.abs(Math.sin(rotationY));
  const halfW = (item.footprint.w * c + item.footprint.d * s) / 2 + 0.06;
  const halfD = (item.footprint.w * s + item.footprint.d * c) / 2 + 0.06;
  const min = room.box.min;
  const max = room.box.max;
  // A room smaller than the item would invert the clamp range — centre instead.
  const x = max.x - min.x < halfW * 2 ? (min.x + max.x) / 2 : clamp(position[0], min.x + halfW, max.x - halfW);
  const z = max.z - min.z < halfD * 2 ? (min.z + max.z) / 2 : clamp(position[2], min.z + halfD, max.z - halfD);
  return [x, room.floorY, z];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Where AI auto-style drops an item when it doesn't say. Wall-hugging pieces go
 * against the longest free wall facing in; everything else spirals out from the
 * room centre. Deterministic — same room, same layout, every time.
 */
export function suggestPlacement(
  item: CatalogItem,
  room: RoomInfo,
  existing: { item: CatalogItem; position: Vec3; rotationY: number }[],
  seed = 0,
): { position: Vec3; rotationY: number } {
  const min = room.box.min;
  const max = room.box.max;
  const center: Vec3 = [(min.x + max.x) / 2, room.floorY, (min.z + max.z) / 2];

  const candidates: { position: Vec3; rotationY: number }[] = [];

  if (item.wallHugging) {
    const inset = item.footprint.d / 2 + 0.14;
    // North / south / west / east, each facing into the room.
    candidates.push(
      { position: [center[0], room.floorY, min.z + inset], rotationY: 0 },
      { position: [center[0], room.floorY, max.z - inset], rotationY: Math.PI },
      { position: [min.x + inset, room.floorY, center[2]], rotationY: Math.PI / 2 },
      { position: [max.x - inset, room.floorY, center[2]], rotationY: -Math.PI / 2 },
    );
  }

  // Spiral outward from the centre, offset by seed so successive items don't stack.
  for (let i = 0; i < 64; i++) {
    const t = (i + seed) * 2.399963; // golden angle
    const r = 0.5 + 0.26 * Math.sqrt(i + seed);
    candidates.push({
      position: [center[0] + Math.cos(t) * r, room.floorY, center[2] + Math.sin(t) * r],
      rotationY: snapRotation(t % (Math.PI * 2), true),
    });
  }

  // Last resort before giving up: sweep the room on a coarse lattice. The
  // spiral is cheap and produces natural-looking layouts, but in a room that is
  // already half full it can miss a gap that plainly exists.
  for (let z = min.z + 0.3; z < max.z; z += 0.25) {
    for (let x = min.x + 0.3; x < max.x; x += 0.25) {
      candidates.push({ position: [x, room.floorY, z], rotationY: 0 });
      candidates.push({ position: [x, room.floorY, z], rotationY: Math.PI / 2 });
    }
  }

  const placed = existing.map((e, i) => ({
    id: `existing-${i}`,
    catalogId: e.item.id,
    position: e.position,
    rotationY: e.rotationY,
    scale: 1,
  }));
  const lookup = (id: string) => existing.find((e) => e.item.id === id)?.item;

  let best: { position: Vec3; rotationY: number; overlap: number } | null = null;

  for (const candidate of candidates) {
    // Snap *before* testing: snapping afterwards can nudge a just-clear
    // placement back into its neighbour, which is how this bug was found.
    const position = snapPosition(clampToRoom(item, candidate.position, candidate.rotationY, room), true);
    const pose = { position, rotationY: candidate.rotationY };
    if (!collides({ item, ...pose }, placed, lookup)) return pose;

    const overlap = overlapArea(item, pose, existing);
    if (!best || overlap < best.overlap) best = { ...pose, overlap };
  }

  // Nothing fits cleanly — return the least-bad spot rather than stacking at
  // the centre. Overlap is a warning in this app, never a hard failure.
  return best ? { position: best.position, rotationY: best.rotationY } : { position: center, rotationY: 0 };
}

/** Total overlapping floor area, used to rank fallback placements. */
function overlapArea(
  item: CatalogItem,
  pose: { position: Vec3; rotationY: number },
  existing: { item: CatalogItem; position: Vec3; rotationY: number }[],
) {
  if (isFlat(item)) return 0;
  const a = footprintBox(item, pose.position, pose.rotationY);
  let total = 0;
  for (const e of existing) {
    if (isFlat(e.item)) continue;
    const b = footprintBox(e.item, e.position, e.rotationY);
    const w = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x);
    const d = Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y);
    if (w > 0 && d > 0) total += w * d;
  }
  return total;
}
