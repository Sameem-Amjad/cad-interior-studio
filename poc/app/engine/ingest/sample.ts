import * as THREE from "three";
import { LAYER, tagLayer, type BuildingModel, type RoomInfo } from "./types";
import { DEFAULT_FLOOR, DEFAULT_WALL, finishById } from "../../data/catalog";

/**
 * The bundled sample building — the demo safety net from
 * poc/docs/01-scope-and-demo.md ("always works"). Generated procedurally so it
 * loads instantly, needs no network, and is byte-identical every run.
 *
 * Five rooms on one storey. Each room owns its own inner wall skin so the
 * per-room paint swap has something to swap; shared partitions are two skins
 * back to back, which is also how they read visually.
 */

const WALL_H = 2.75;
const SKIN_T = 0.09;
const EXT_T = 0.22;

type Rect = { x0: number; z0: number; x1: number; z1: number };
type RoomDef = { id: string; name: string; rect: Rect; icon: string };

/** Openings live on the shared grid lines, so both neighbouring skins pick them up. */
type Opening = { axis: "x" | "z"; at: number; from: number; to: number; sill: number; height: number };

const ROOMS: RoomDef[] = [
  { id: "living", name: "Living Room", rect: { x0: 0, z0: 0, x1: 6.6, z1: 5.6 }, icon: "sofa" },
  { id: "kitchen", name: "Kitchen", rect: { x0: 6.6, z0: 0, x1: 12, z1: 5.6 }, icon: "utensils" },
  { id: "bed1", name: "Bedroom 1", rect: { x0: 0, z0: 5.6, x1: 4.6, z1: 9.4 }, icon: "bed" },
  { id: "bed2", name: "Bedroom 2", rect: { x0: 4.6, z0: 5.6, x1: 8.6, z1: 9.4 }, icon: "bed" },
  { id: "bath", name: "Bath", rect: { x0: 8.6, z0: 5.6, x1: 12, z1: 9.4 }, icon: "bath" },
];

const DOORS: Opening[] = [
  { axis: "z", at: 6.6, from: 3.4, to: 4.4, sill: 0, height: 2.1 }, // living ↔ kitchen
  { axis: "x", at: 5.6, from: 1.2, to: 2.2, sill: 0, height: 2.1 }, // living ↔ bed1
  { axis: "x", at: 5.6, from: 5.2, to: 6.2, sill: 0, height: 2.1 }, // living ↔ bed2
  { axis: "x", at: 5.6, from: 9.6, to: 10.6, sill: 0, height: 2.1 }, // kitchen ↔ bath
];

const WINDOWS: Opening[] = [
  { axis: "x", at: 0, from: 1.0, to: 3.4, sill: 0.5, height: 1.9 }, // living, south (big)
  { axis: "x", at: 0, from: 4.4, to: 5.8, sill: 0.9, height: 1.4 },
  { axis: "x", at: 0, from: 8.2, to: 10.4, sill: 0.9, height: 1.4 }, // kitchen, south
  { axis: "z", at: 12, from: 1.4, to: 3.6, sill: 0.9, height: 1.4 }, // kitchen, east
  { axis: "x", at: 9.4, from: 1.2, to: 3.2, sill: 0.9, height: 1.4 }, // bed1, north
  { axis: "x", at: 9.4, from: 5.6, to: 7.6, sill: 0.9, height: 1.4 }, // bed2, north
  { axis: "z", at: 0, from: 6.6, to: 8.4, sill: 0.9, height: 1.4 }, // bed1, west
];

const ALL_OPENINGS = [...DOORS, ...WINDOWS];

/** Split [from,to] by the openings that fall on this wall line, emitting solid spans. */
function spans(axis: "x" | "z", at: number, from: number, to: number) {
  const hits = ALL_OPENINGS.filter(
    (o) => o.axis === axis && Math.abs(o.at - at) < 0.35 && o.to > from && o.from < to,
  ).sort((a, b) => a.from - b.from);
  const out: { from: number; to: number; sill: number; height: number }[] = [];
  let cursor = from;
  for (const o of hits) {
    const a = Math.max(from, o.from);
    const b = Math.min(to, o.to);
    if (a > cursor) out.push({ from: cursor, to: a, sill: 0, height: WALL_H });
    if (o.sill > 0.01) out.push({ from: a, to: b, sill: 0, height: o.sill }); // below a window
    const headTop = o.sill + o.height;
    if (headTop < WALL_H - 0.01) out.push({ from: a, to: b, sill: headTop, height: WALL_H - headTop }); // lintel
    cursor = Math.max(cursor, b);
  }
  if (cursor < to) out.push({ from: cursor, to, sill: 0, height: WALL_H });
  return out;
}

function wallPieces(
  group: THREE.Group,
  axis: "x" | "z",
  at: number,
  from: number,
  to: number,
  thickness: number,
  material: THREE.Material,
  offset: number,
  meta: Record<string, unknown>,
) {
  for (const s of spans(axis, at, from, to)) {
    const len = s.to - s.from;
    if (len < 0.02 || s.height < 0.02) continue;
    const geo =
      axis === "x"
        ? new THREE.BoxGeometry(len, s.height, thickness)
        : new THREE.BoxGeometry(thickness, s.height, len);
    const mesh = new THREE.Mesh(geo, material);
    const mid = (s.from + s.to) / 2;
    if (axis === "x") mesh.position.set(mid, s.sill + s.height / 2, at + offset);
    else mesh.position.set(at + offset, s.sill + s.height / 2, mid);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    tagLayer(mesh, LAYER.WALL);
    Object.assign(mesh.userData, meta);
    group.add(mesh);
  }
}

function glazing(group: THREE.Group) {
  const glass = new THREE.MeshStandardMaterial({
    color: "#bcd8e6",
    roughness: 0.06,
    metalness: 0.1,
    transparent: true,
    opacity: 0.22,
  });
  for (const w of WINDOWS) {
    const len = w.to - w.from;
    const geo = w.axis === "x" ? new THREE.BoxGeometry(len, w.height, 0.03) : new THREE.BoxGeometry(0.03, w.height, len);
    const mesh = new THREE.Mesh(geo, glass);
    const mid = (w.from + w.to) / 2;
    if (w.axis === "x") mesh.position.set(mid, w.sill + w.height / 2, w.at);
    else mesh.position.set(w.at, w.sill + w.height / 2, mid);
    // No semantic layer: glazing is drawn but never a raycast target.
    group.add(mesh);
  }
}

export function buildSampleBuilding(): BuildingModel {
  const t0 = performance.now();
  const shell = new THREE.Group();
  shell.name = "shell";

  const floorMat = finishById.get(DEFAULT_FLOOR)!.make();
  const wallMat = finishById.get(DEFAULT_WALL)!.make();
  const structural = new THREE.MeshStandardMaterial({ color: "#4a4d53", roughness: 0.9 });

  const bounds = { x0: 0, z0: 0, x1: 12, z1: 9.4 };

  // Site slab — context under the building, never a placement target.
  const site = new THREE.Mesh(
    new THREE.BoxGeometry(30, 0.4, 30),
    new THREE.MeshStandardMaterial({ color: "#191c21", roughness: 1 }),
  );
  site.position.set(6, -0.32, 4.7);
  site.receiveShadow = true;
  shell.add(site);

  // Exterior structural shell (one material, one room-agnostic mesh set).
  wallPieces(shell, "x", bounds.z0, bounds.x0, bounds.x1, EXT_T, structural, -EXT_T / 2, { part: "exterior" });
  wallPieces(shell, "x", bounds.z1, bounds.x0, bounds.x1, EXT_T, structural, EXT_T / 2, { part: "exterior" });
  wallPieces(shell, "z", bounds.x0, bounds.z0, bounds.z1, EXT_T, structural, -EXT_T / 2, { part: "exterior" });
  wallPieces(shell, "z", bounds.x1, bounds.z0, bounds.z1, EXT_T, structural, EXT_T / 2, { part: "exterior" });

  const rooms: RoomInfo[] = [];

  for (const def of ROOMS) {
    const { x0, z0, x1, z1 } = def.rect;
    const w = x1 - x0;
    const d = z1 - z0;

    // Floor slab — one mesh per room, so a finish swap is a material swap.
    const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), floorMat.clone());
    floor.position.set((x0 + x1) / 2, -0.05, (z0 + z1) / 2);
    floor.receiveShadow = true;
    tagLayer(floor, LAYER.FLOOR);
    floor.userData = { roomId: def.id, part: "floor" };
    shell.add(floor);

    // Inner wall skin: four inward-facing panels carrying this room's paint.
    const skin = wallMat.clone();
    const meta = { roomId: def.id, part: "wall" };
    wallPieces(shell, "x", z0, x0, x1, SKIN_T, skin, SKIN_T / 2, meta);
    wallPieces(shell, "x", z1, x0, x1, SKIN_T, skin, -SKIN_T / 2, meta);
    wallPieces(shell, "z", x0, z0, z1, SKIN_T, skin, SKIN_T / 2, meta);
    wallPieces(shell, "z", x1, z0, z1, SKIN_T, skin, -SKIN_T / 2, meta);

    // Ceiling: hidden in orbit (it would roof over the dollhouse view) and
    // switched on for walkthrough, where an open sky reads as a bug.
    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.08, d),
      new THREE.MeshStandardMaterial({ color: "#f2efe9", roughness: 0.95 }),
    );
    ceiling.position.set((x0 + x1) / 2, WALL_H + 0.04, (z0 + z1) / 2);
    ceiling.visible = false;
    ceiling.userData = { roomId: def.id, part: "ceiling" };
    shell.add(ceiling);

    rooms.push({
      id: def.id,
      name: def.name,
      level: 0,
      box: new THREE.Box3(new THREE.Vector3(x0, 0, z0), new THREE.Vector3(x1, WALL_H, z1)),
      floorY: 0,
      pseudo: false,
    });
  }

  glazing(shell);

  let meshes = 0;
  let triangles = 0;
  shell.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      meshes++;
      const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry;
      triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
    }
  });

  return {
    kind: "sample",
    name: "sample-apartment",
    shell,
    rooms,
    stats: { meshes, triangles: Math.round(triangles), ingestMs: Math.round(performance.now() - t0), realRooms: true },
  };
}

/** Room icon hints, used by the left sidebar. Not part of the engine contract. */
export const SAMPLE_ROOM_ICONS: Record<string, string> = Object.fromEntries(ROOMS.map((r) => [r.id, r.icon]));
