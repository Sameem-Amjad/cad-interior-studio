import * as THREE from "three";
import { LAYER, tagLayer, type BuildingModel, type ProgressFn, type RoomInfo } from "./types";

/**
 * IFC → three, entirely in the browser (poc/docs/03-core-engine.md § Ingest).
 *
 * Three things that eat a day if you get them wrong, all handled here:
 *
 *  1. COORDINATE_TO_ORIGIN — IFC files are routinely georeferenced kilometres
 *     from the origin, which destroys depth precision and framing.
 *  2. **web-ifc already hands back Y-up geometry.** The IFC *schema* is Z-up, so
 *     the obvious move is to rotate the root by -90° about X — and that lays the
 *     building on its side. Verified against a real file: a 2.2 m ceiling comes
 *     out of `flatTransformation` as a 2.2 m extent on **y**. Do not rotate.
 *  3. Spatial containers carry geometry. `IfcSpatialZone` ("gross volume") and
 *     `IfcSite` stream as solid boxes enclosing the building; render them and the
 *     user sees a featureless block. They are filtered out of the shell.
 */

// web-ifc's generated types are heavy; we need a narrow slice of the surface.
type IfcApi = {
  SetWasmPath: (p: string, absolute?: boolean) => void;
  Init: () => Promise<void>;
  OpenModel: (data: Uint8Array, settings?: Record<string, unknown>) => number;
  CloseModel: (id: number) => void;
  StreamAllMeshes: (id: number, cb: (mesh: FlatMesh) => void) => void;
  StreamMeshes: (id: number, expressIDs: number[], cb: (mesh: FlatMesh) => void) => void;
  GetGeometry: (id: number, expressID: number) => IfcGeometry;
  GetVertexArray: (ptr: number, size: number) => Float32Array;
  GetIndexArray: (ptr: number, size: number) => Uint32Array;
  GetLineIDsWithType: (id: number, type: number) => { size: () => number; get: (i: number) => number };
  GetLine: (id: number, expressID: number, flatten?: boolean) => Record<string, unknown>;
};
type FlatMesh = { expressID: number; geometries: { size: () => number; get: (i: number) => PlacedGeometry } };
type PlacedGeometry = {
  geometryExpressID: number;
  color: { x: number; y: number; z: number; w: number };
  flatTransformation: number[];
};
type IfcGeometry = {
  GetVertexData: () => number;
  GetVertexDataSize: () => number;
  GetIndexData: () => number;
  GetIndexDataSize: () => number;
  delete?: () => void;
};

const IFCSPACE = 3856911033;
const IFCBUILDINGSTOREY = 3124254112;
/** Spatial containers: they have geometry, but it is a volume marker, not fabric. */
const NON_FABRIC = new Set([IFCSPACE, 463610769 /* IFCSPATIALZONE */, 4097777520 /* IFCSITE */]);

let apiPromise: Promise<IfcApi> | null = null;

async function getApi(): Promise<IfcApi> {
  apiPromise ??= (async () => {
    const WebIFC = await import("web-ifc");
    const api = new WebIFC.IfcAPI() as unknown as IfcApi;
    api.SetWasmPath("/wasm/", true);
    await api.Init();
    return api;
  })();
  return apiPromise;
}

/** Read one placed geometry into a three BufferGeometry, already transformed. */
function readGeometry(api: IfcApi, modelId: number, placed: PlacedGeometry, m: THREE.Matrix4) {
  const geo = api.GetGeometry(modelId, placed.geometryExpressID);
  const verts = api.GetVertexArray(geo.GetVertexData(), geo.GetVertexDataSize());
  const idx = api.GetIndexArray(geo.GetIndexData(), geo.GetIndexDataSize());

  // web-ifc interleaves position(3) + normal(3) per vertex.
  const count = verts.length / 6;
  const position = new Float32Array(count * 3);
  const normal = new Float32Array(count * 3);
  for (let v = 0; v < count; v++) {
    position[v * 3] = verts[v * 6];
    position[v * 3 + 1] = verts[v * 6 + 1];
    position[v * 3 + 2] = verts[v * 6 + 2];
    normal[v * 3] = verts[v * 6 + 3];
    normal[v * 3 + 1] = verts[v * 6 + 4];
    normal[v * 3 + 2] = verts[v * 6 + 5];
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(position, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
  m.fromArray(placed.flatTransformation);
  g.applyMatrix4(m);
  geo.delete?.();
  return g;
}

/** Bucket by quantised colour so the whole shell merges into a handful of draw calls. */
const colorKey = (c: PlacedGeometry["color"]) =>
  [c.x, c.y, c.z, c.w].map((n) => Math.round(n * 16)).join(",");

/**
 * Merged meshes are also bucketed by a coarse spatial cell, not by colour alone.
 *
 * Colour-only merging collapses the whole building into a handful of meshes
 * whose bounds span everything, which destroys every downstream feature that
 * reasons about *where* a mesh is: the dollhouse cutaway, per-room finishes,
 * and frustum culling all stop working. Cell size is a trade — smaller means
 * more draw calls but finer cutaway granularity.
 */
const CELL = 4; // metres, in the IFC (Z-up) frame

function cellKey(g: THREE.BufferGeometry) {
  g.computeBoundingBox();
  const c = g.boundingBox!.getCenter(new THREE.Vector3());
  return `${Math.floor(c.x / CELL)},${Math.floor(c.y / CELL)},${Math.floor(c.z / CELL)}`;
}

export async function loadIfc(buffer: ArrayBuffer, name: string, onProgress: ProgressFn): Promise<BuildingModel> {
  const t0 = performance.now();
  onProgress(0.02, "Starting the IFC engine…");
  const api = await getApi();

  onProgress(0.08, "Opening model…");
  const modelId = api.OpenModel(new Uint8Array(buffer), { COORDINATE_TO_ORIGIN: true, USE_FAST_BOOLS: true });

  onProgress(0.15, "Reading walls and rooms…");

  type Bucket = { color: THREE.Color; opacity: number; parts: THREE.BufferGeometry[] };
  const buckets = new Map<string, Bucket>();
  const m = new THREE.Matrix4();
  let streamed = 0;

  api.StreamAllMeshes(modelId, (flat) => {
    // Spatial containers stream as solid volumes that would hide the building.
    const type = (api.GetLine(modelId, flat.expressID, false) as { type?: number })?.type;
    if (type !== undefined && NON_FABRIC.has(type)) return;

    const n = flat.geometries.size();
    for (let i = 0; i < n; i++) {
      const placed = flat.geometries.get(i);
      const g = readGeometry(api, modelId, placed, m);
      const key = `${colorKey(placed.color)}@${cellKey(g)}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { color: new THREE.Color(placed.color.x, placed.color.y, placed.color.z), opacity: placed.color.w, parts: [] };
        buckets.set(key, bucket);
      }
      bucket.parts.push(g);
    }
    if (++streamed % 200 === 0) onProgress(Math.min(0.15 + streamed / 4000, 0.78), "Reading walls and rooms…");
  });

  onProgress(0.82, "Merging geometry…");

  const content = new THREE.Group();
  content.name = "ifc-content";
  for (const bucket of buckets.values()) {
    const merged = mergeGeometries(bucket.parts);
    for (const p of bucket.parts) p.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(
      merged,
      new THREE.MeshStandardMaterial({
        color: bucket.color,
        roughness: 0.85,
        metalness: 0.02,
        transparent: bucket.opacity < 0.99,
        opacity: bucket.opacity,
        side: THREE.DoubleSide,
      }),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // IFC gives no cheap floor/wall split, so shell geometry is all WALL layer;
    // placement uses the synthesised floor proxies below instead.
    tagLayer(mesh, LAYER.WALL);
    content.add(mesh);
  }

  onProgress(0.9, "Finding rooms…");
  const { rooms, realRooms } = extractRooms(api, modelId, content, m);

  api.CloseModel(modelId);

  // No axis conversion: web-ifc's flatTransformation is already Y-up (see the
  // header comment). The root stays world-aligned so anything attached to it —
  // the floor proxies below — shares the frame the rest of the app assumes.
  const shell = new THREE.Group();
  shell.name = "shell";
  shell.add(content);
  shell.updateMatrixWorld(true);

  // Sit the building on y=0 so placement maths starts from a sane origin.
  const worldBox = new THREE.Box3().setFromObject(shell);
  const lift = -worldBox.min.y;
  content.position.y += lift;
  const up = new THREE.Vector3(0, lift, 0);
  for (const r of rooms) {
    r.box.translate(up);
    r.floorY = r.box.min.y;
  }
  shell.updateMatrixWorld(true);

  // Invisible slab per room on the FLOOR layer — IFC slabs are unreliable
  // raycast targets, and pseudo-rooms have no slab at all.
  for (const r of rooms) shell.add(floorProxy(r));

  let meshes = 0;
  let triangles = 0;
  content.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshes++;
    const g = mesh.geometry as THREE.BufferGeometry;
    triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });

  onProgress(1, "Done");
  return {
    kind: "ifc",
    name,
    shell,
    rooms,
    stats: { meshes, triangles: Math.round(triangles), ingestMs: Math.round(performance.now() - t0), realRooms },
  };
}

/** Minimal merge — avoids pulling the addons build in for one function. */
function mergeGeometries(parts: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (parts.length === 0) return null;
  let vertexCount = 0;
  let indexCount = 0;
  for (const p of parts) {
    vertexCount += p.attributes.position.count;
    indexCount += p.index ? p.index.count : p.attributes.position.count;
  }
  const position = new Float32Array(vertexCount * 3);
  const normal = new Float32Array(vertexCount * 3);
  const index = new Uint32Array(indexCount);

  let vOff = 0;
  let iOff = 0;
  for (const p of parts) {
    const pos = p.attributes.position.array as Float32Array;
    const nor = (p.attributes.normal?.array as Float32Array) ?? new Float32Array(pos.length);
    position.set(pos, vOff * 3);
    normal.set(nor, vOff * 3);
    const n = p.attributes.position.count;
    if (p.index) {
      const src = p.index.array;
      for (let i = 0; i < src.length; i++) index[iOff + i] = src[i] + vOff;
      iOff += src.length;
    } else {
      for (let i = 0; i < n; i++) index[iOff + i] = i + vOff;
      iOff += n;
    }
    vOff += n;
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(position, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/**
 * Rooms from real IFCSPACE volumes where the file has them, storey pseudo-rooms
 * where it doesn't. No middle ground: poc/docs/03 forbids room-detection
 * cleverness, and a *guessed* room labelled "Kitchen" is worse than an honest
 * "Whole floor".
 */
function extractRooms(
  api: IfcApi,
  modelId: number,
  content: THREE.Group,
  m: THREE.Matrix4,
): { rooms: RoomInfo[]; realRooms: boolean } {
  // Boxes here are already Y-up and in world space — see the header comment.
  const named = new Map<number, string>();
  try {
    const ids = api.GetLineIDsWithType(modelId, IFCSPACE);
    for (let i = 0; i < ids.size(); i++) {
      const expressID = ids.get(i);
      const line = api.GetLine(modelId, expressID, true) as {
        Name?: { value?: string };
        LongName?: { value?: string };
      };
      named.set(expressID, line?.LongName?.value || line?.Name?.value || `Space ${i + 1}`);
    }
  } catch {
    /* no spaces in this file */
  }

  const rooms: RoomInfo[] = [];
  if (named.size > 0) {
    // Spaces are excluded from StreamAllMeshes; ask for their volumes explicitly.
    const boxes = new Map<number, THREE.Box3>();
    try {
      api.StreamMeshes(modelId, [...named.keys()], (flat) => {
        const box = new THREE.Box3();
        for (let i = 0; i < flat.geometries.size(); i++) {
          const g = readGeometry(api, modelId, flat.geometries.get(i), m);
          g.computeBoundingBox();
          if (g.boundingBox) box.union(g.boundingBox);
          g.dispose();
        }
        if (!box.isEmpty()) boxes.set(flat.expressID, box);
      });
    } catch {
      /* geometry for spaces unavailable — fall through to storeys */
    }

    for (const [expressID, box] of boxes) {
      rooms.push({
        id: `space-${expressID}`,
        name: named.get(expressID) ?? `Space ${expressID}`,
        level: 0,
        box,
        floorY: box.min.y,
        pseudo: false,
      });
    }
    // Biggest rooms first — the demo should open on the living space.
    rooms.sort((a, b) => b.box.getSize(new THREE.Vector3()).length() - a.box.getSize(new THREE.Vector3()).length());
    if (rooms.length > 0) return { rooms, realRooms: true };
  }

  // Fallback: one pseudo-room per storey (poc/docs/03 § Rooms).
  const shellBox = new THREE.Box3().setFromObject(content);
  let storeyCount = 1;
  try {
    storeyCount = Math.max(1, api.GetLineIDsWithType(modelId, IFCBUILDINGSTOREY).size());
  } catch {
    /* keep 1 */
  }
  const size = shellBox.getSize(new THREE.Vector3());
  const perStorey = size.y / storeyCount; // Y-up: storeys stack vertically
  const pseudo: RoomInfo[] = [];
  for (let s = 0; s < storeyCount; s++) {
    const floorY = shellBox.min.y + s * perStorey;
    pseudo.push({
      id: `storey-${s}`,
      name: storeyCount === 1 ? "Whole floor" : `Level ${s}`,
      level: s,
      box: new THREE.Box3(
        new THREE.Vector3(shellBox.min.x, floorY, shellBox.min.z),
        new THREE.Vector3(shellBox.max.x, floorY + perStorey, shellBox.max.z),
      ),
      floorY,
      pseudo: true,
    });
  }
  return { rooms: pseudo, realRooms: false };
}

function floorProxy(r: RoomInfo) {
  const size = r.box.getSize(new THREE.Vector3());
  const center = r.box.getCenter(new THREE.Vector3());
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.max(size.x, 0.5), Math.max(size.z, 0.5)),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(center.x, r.floorY + 0.01, center.z);
  tagLayer(mesh, LAYER.FLOOR);
  mesh.userData = { roomId: r.id, part: "floor-proxy" };
  return mesh;
}
