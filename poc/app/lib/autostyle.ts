"use client";

import { byId, finishById } from "../data/catalog";
import { useScene, type StyleId } from "../engine/scene/store";
import type { PlacedItem, RoomState, Vec3 } from "../engine/scene/schema";
import { clampToRoom, snapPosition, snapRotation, suggestPlacement } from "../engine/editor/placement";

/**
 * Applies an AI style plan to the actual scene document — one store action, so
 * one undo entry. Everything the server sent is re-validated here: a plan can
 * only ever reference catalog ids this build knows about.
 */

type PlanItem = { catalogId: string; x: number | null; z: number | null; rotationDegrees: number | null };
type Plan = { rationale: string; floorFinishId: string; wallFinishId: string; items: PlanItem[] };

export type AutoStyleOutcome = { applied: number; source: "claude" | "local"; rationale: string };

export async function autoStyleRoom(style: StyleId, signal?: AbortSignal): Promise<AutoStyleOutcome> {
  const state = useScene.getState();
  const roomId = state.activeRoomId;
  const room = state.model?.rooms.find((r) => r.id === roomId);
  if (!roomId || !room) throw new Error("No room selected.");

  const size = room.box.getSize(new (await import("three")).Vector3());

  const res = await fetch("/api/auto-style", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ style, room: { name: room.name, width: size.x, depth: size.z } }),
    signal,
  });
  if (!res.ok) throw new Error(`Auto-style failed (${res.status}).`);

  const { plan, source } = (await res.json()) as { plan: Plan; source: "claude" | "local" };

  const uid = () => Math.random().toString(36).slice(2, 10);
  const placed: { item: NonNullable<ReturnType<typeof byId.get>>; position: Vec3; rotationY: number }[] = [];
  const items: PlacedItem[] = [];

  for (const entry of plan.items) {
    const spec = byId.get(entry.catalogId);
    if (!spec) continue; // server already filtered, but never trust the wire

    let position: Vec3;
    let rotationY: number;

    if (entry.x !== null && entry.z !== null && Number.isFinite(entry.x) && Number.isFinite(entry.z)) {
      // Plan coordinates are relative to the room's north-west corner.
      rotationY = snapRotation((((entry.rotationDegrees ?? 0) * Math.PI) / 180) % (Math.PI * 2), true);
      position = clampToRoom(spec, [room.box.min.x + entry.x, room.floorY, room.box.min.z + entry.z], rotationY, room);
      position = snapPosition(position, true);
    } else {
      const suggestion = suggestPlacement(spec, room, placed, items.length);
      position = suggestion.position;
      rotationY = entry.rotationDegrees !== null ? snapRotation((entry.rotationDegrees * Math.PI) / 180, true) : suggestion.rotationY;
    }

    placed.push({ item: spec, position, rotationY });
    items.push({ id: uid(), catalogId: spec.id, position, rotationY, scale: 1 });
  }

  const next: RoomState = {
    floorFinishId: finishById.has(plan.floorFinishId) ? plan.floorFinishId : state.doc.rooms[roomId]?.floorFinishId,
    wallFinishId: finishById.has(plan.wallFinishId) ? plan.wallFinishId : state.doc.rooms[roomId]?.wallFinishId,
    items,
  };

  state.applyRoom(roomId, next);
  return { applied: items.length, source, rationale: plan.rationale };
}
