import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { LAYER, tagLayer, type BuildingModel, type ProgressFn, type RoomInfo } from "./types";

/**
 * GLB lane: a .glb is treated as an already-ingested shell.
 *
 * Rooms come from a sidecar `<name>.rooms.json` when the file ships with one
 * (our pre-converted demo files do), otherwise a single pseudo-room covering
 * the whole model — same rule as the IFC lane.
 */

export type RoomsSidecar = {
  rooms: { id: string; name: string; min: [number, number, number]; max: [number, number, number]; level?: number }[];
};

let loader: GLTFLoader | null = null;

function getLoader() {
  if (loader) return loader;
  loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);
  const ktx2 = new KTX2Loader().setTranscoderPath("https://cdn.jsdelivr.net/npm/three/examples/jsm/libs/basis/");
  loader.setKTX2Loader(ktx2);
  return loader;
}

export async function loadGlb(
  buffer: ArrayBuffer,
  name: string,
  onProgress: ProgressFn,
  sidecar?: RoomsSidecar,
): Promise<BuildingModel> {
  const t0 = performance.now();
  onProgress(0.1, "Reading model…");

  const gltf = await getLoader().parseAsync(buffer, "");
  onProgress(0.7, "Preparing scene…");

  const shell = new THREE.Group();
  shell.name = "shell";
  shell.add(gltf.scene);

  // Sit the model on y=0 and assign raycast layers by orientation: a mesh whose
  // normals point mostly up is walkable floor, everything else is wall.
  const box = new THREE.Box3().setFromObject(shell);
  gltf.scene.position.y -= box.min.y;
  shell.updateMatrixWorld(true);

  gltf.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    tagLayer(mesh, isFloorish(mesh) ? LAYER.FLOOR : LAYER.WALL);
  });

  const worldBox = new THREE.Box3().setFromObject(shell);
  const rooms: RoomInfo[] = sidecar
    ? sidecar.rooms.map((r) => ({
        id: r.id,
        name: r.name,
        level: r.level ?? 0,
        box: new THREE.Box3(new THREE.Vector3(...r.min), new THREE.Vector3(...r.max)),
        floorY: r.min[1],
        pseudo: false,
      }))
    : [
        {
          id: "whole-floor",
          name: "Whole floor",
          level: 0,
          box: worldBox.clone(),
          floorY: worldBox.min.y,
          pseudo: true,
        },
      ];

  // Placement target that always exists, regardless of what the GLB contains.
  for (const r of rooms) {
    const size = r.box.getSize(new THREE.Vector3());
    const center = r.box.getCenter(new THREE.Vector3());
    const proxy = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.max(size.x, 0.5), Math.max(size.z, 0.5)),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    proxy.rotation.x = -Math.PI / 2;
    proxy.position.set(center.x, r.floorY + 0.01, center.z);
    tagLayer(proxy, LAYER.FLOOR);
    proxy.userData = { roomId: r.id, part: "floor-proxy" };
    shell.add(proxy);
  }

  let meshes = 0;
  let triangles = 0;
  gltf.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshes++;
    const g = mesh.geometry as THREE.BufferGeometry;
    triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });

  onProgress(1, "Done");
  return {
    kind: "glb",
    name,
    shell,
    rooms,
    stats: {
      meshes,
      triangles: Math.round(triangles),
      ingestMs: Math.round(performance.now() - t0),
      realRooms: Boolean(sidecar),
    },
  };
}

/** Cheap orientation test: mostly-up normals and a flat-ish bounding box. */
function isFloorish(mesh: THREE.Mesh) {
  const g = mesh.geometry as THREE.BufferGeometry;
  g.computeBoundingBox();
  const size = g.boundingBox?.getSize(new THREE.Vector3()) ?? new THREE.Vector3();
  if (size.y > 0.5) return false;
  const normal = g.attributes.normal;
  if (!normal) return size.y < 0.5 && size.x > 1 && size.z > 1;
  let up = 0;
  const step = Math.max(1, Math.floor(normal.count / 200));
  let sampled = 0;
  for (let i = 0; i < normal.count; i += step) {
    if (Math.abs(normal.getY(i)) > 0.8) up++;
    sampled++;
  }
  return sampled > 0 && up / sampled > 0.6;
}

/** Try to fetch `<url>.rooms.json` beside a bundled GLB; absence is normal. */
export async function tryLoadSidecar(url: string): Promise<RoomsSidecar | undefined> {
  try {
    const res = await fetch(url.replace(/\.glb$/i, ".rooms.json"));
    if (!res.ok) return undefined;
    return (await res.json()) as RoomsSidecar;
  } catch {
    return undefined;
  }
}
