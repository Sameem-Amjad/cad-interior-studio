import { z } from "zod";

/**
 * The scene document.
 *
 * Deliberately the same *shape* as the production scene JSON v1 (see
 * poc/docs/02-architecture.md): rooms → items carrying a catalog id, transforms
 * in meters / radians / Y-up, finishes per room. Costs nothing now, keeps saved
 * PoC designs conceptually portable, and keeps the demo narrative honest — what
 * you place is an identifiable product, which is what a quotation would price.
 */

export const Vec3 = z.tuple([z.number(), z.number(), z.number()]);
export type Vec3 = z.infer<typeof Vec3>;

export const PlacedItem = z.object({
  id: z.string(),
  /** Points at an entry in data/catalog.ts — the PoC's stand-in for `variantId`. */
  catalogId: z.string(),
  position: Vec3,
  /** Radians, Y-up. Only yaw is editable in the PoC. */
  rotationY: z.number(),
  scale: z.number().default(1),
});
export type PlacedItem = z.infer<typeof PlacedItem>;

export const RoomState = z.object({
  floorFinishId: z.string().optional(),
  wallFinishId: z.string().optional(),
  items: z.array(PlacedItem).default([]),
});
export type RoomState = z.infer<typeof RoomState>;

export const SceneDoc = z.object({
  schemaVersion: z.literal(1),
  source: z.object({
    kind: z.enum(["ifc", "glb", "sample"]),
    name: z.string(),
  }),
  rooms: z.record(z.string(), RoomState),
});
export type SceneDoc = z.infer<typeof SceneDoc>;

export const SCHEMA_VERSION = 1 as const;

export function emptyDoc(source: SceneDoc["source"], roomIds: string[]): SceneDoc {
  return {
    schemaVersion: SCHEMA_VERSION,
    source,
    rooms: Object.fromEntries(roomIds.map((id) => [id, { items: [] } satisfies RoomState])),
  };
}

/** Stable-ish hash of a room's contents — used to key the concept-image cache. */
export function hashRoom(room: RoomState | undefined): string {
  if (!room) return "empty";
  const parts = [
    room.floorFinishId ?? "-",
    room.wallFinishId ?? "-",
    ...[...room.items]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(
        (i) =>
          `${i.catalogId}@${i.position.map((n) => n.toFixed(2)).join(",")}:${i.rotationY.toFixed(2)}`,
      ),
  ];
  let h = 2166136261;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
