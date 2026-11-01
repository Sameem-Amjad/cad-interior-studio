import * as THREE from "three";
import { finishById } from "../../data/catalog";
import type { BuildingModel } from "../ingest/types";
import { LAYER } from "../ingest/types";

/**
 * Applying a finish = swapping the material on the shell meshes tagged with
 * that room. Ingest writes `userData.roomId` / `userData.part`; for pseudo-rooms
 * there is no per-room tagging, so the swap lands on the whole storey — the
 * accepted shortcut in poc/docs/03 § Materials.
 */

const made = new Map<string, THREE.MeshStandardMaterial>();

function materialFor(finishId: string) {
  let m = made.get(finishId);
  if (!m) {
    const finish = finishById.get(finishId);
    if (!finish) return null;
    m = finish.make();
    made.set(finishId, m);
  }
  return m;
}

export function applyFinish(model: BuildingModel, roomId: string, kind: "floor" | "wall", finishId: string) {
  const material = materialFor(finishId);
  if (!material) return;
  const wantLayer = kind === "floor" ? LAYER.FLOOR : LAYER.WALL;
  const room = model.rooms.find((r) => r.id === roomId);
  const untagged = room?.pseudo ?? false;

  model.shell.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.userData.part === "floor-proxy") return;
    if (!mesh.layers.isEnabled(wantLayer)) return;
    // Exterior structure keeps its own material — painting the outside of the
    // building when someone picks a wall colour looks like a bug.
    if (mesh.userData.part === "exterior") return;
    const tagged = mesh.userData.roomId as string | undefined;
    if (tagged ? tagged === roomId : untagged) mesh.material = material;
  });
}

/** Re-apply every finish in the document — used after load and after undo. */
export function syncFinishes(model: BuildingModel, rooms: Record<string, { floorFinishId?: string; wallFinishId?: string }>) {
  for (const [roomId, room] of Object.entries(rooms)) {
    if (room.floorFinishId) applyFinish(model, roomId, "floor", room.floorFinishId);
    if (room.wallFinishId) applyFinish(model, roomId, "wall", room.wallFinishId);
  }
}
