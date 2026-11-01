import * as THREE from "three";

/** Everything downstream assumes meters, Y-up, radians. Ingest normalises to this. */
export type RoomInfo = {
  id: string;
  name: string;
  /** Storey index, 0 = ground. */
  level: number;
  /** World-space AABB of the room volume. */
  box: THREE.Box3;
  /** Floor height (world Y) the placement raycast lands on. */
  floorY: number;
  /** True when synthesised from a storey because the file had no IFCSPACE. */
  pseudo: boolean;
};

export type BuildingModel = {
  kind: "ifc" | "glb" | "sample";
  name: string;
  /** The building shell. Already Y-up, origin-centred, layers assigned. */
  shell: THREE.Group;
  rooms: RoomInfo[];
  stats: {
    meshes: number;
    triangles: number;
    ingestMs: number;
    /** Rooms came from real IFCSPACE entities rather than the storey fallback. */
    realRooms: boolean;
  };
};

export type ProgressFn = (fraction: number, note?: string) => void;

/**
 * Raycast layers, fixed on day one because placement and walkthrough both
 * depend on them (poc/docs/03-core-engine.md § Viewer).
 *
 * They start at 1 on purpose. In three, `layers` gates *rendering* and
 * *lighting* as well as raycasting: a mesh moved off layer 0 stops being drawn
 * by the camera and stops being lit. So every mesh keeps layer 0 and gains its
 * semantic layer on top, and raycasters select on the semantic layer alone.
 * A mesh with no semantic layer (glass, the site slab) renders but is never hit.
 */
export const LAYER = { FLOOR: 1, WALL: 2, ITEM: 3 } as const;
export type Layer = (typeof LAYER)[keyof typeof LAYER];

/** Tag an object (and its descendants) as a raycast target of the given kind. */
export function tagLayer(object: THREE.Object3D, layer: Layer) {
  object.traverse((o) => o.layers.enable(layer));
}

/**
 * Camera pose that frames a room from a comfortable three-quarter angle.
 *
 * The approach direction points away from the rest of the building, so you look
 * *into* the room from outside rather than through three other rooms.
 */
export function poseForRoom(room: RoomInfo, buildingCenter?: THREE.Vector3): { position: THREE.Vector3; target: THREE.Vector3 } {
  const center = room.box.getCenter(new THREE.Vector3());
  const size = room.box.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.z, 2);

  const away = buildingCenter
    ? new THREE.Vector3(center.x - buildingCenter.x, 0, center.z - buildingCenter.z)
    : new THREE.Vector3();
  if (away.lengthSq() < 0.04) away.set(1, 0, 1); // room is the building centre
  away.normalize();

  const target = new THREE.Vector3(center.x, room.floorY + 1.0, center.z);
  const position = new THREE.Vector3(
    center.x + away.x * span * 1.15,
    room.floorY + Math.max(2.8, span * 0.85),
    center.z + away.z * span * 1.15,
  );
  return { position, target };
}

/** Eye-level pose just inside the room, used when entering walkthrough mode. */
export function walkPoseForRoom(room: RoomInfo): { position: THREE.Vector3; target: THREE.Vector3 } {
  const center = room.box.getCenter(new THREE.Vector3());
  const size = room.box.getSize(new THREE.Vector3());
  const position = new THREE.Vector3(center.x, room.floorY + 1.6, center.z + size.z * 0.3);
  return { position, target: new THREE.Vector3(center.x, room.floorY + 1.6, center.z - 1) };
}
