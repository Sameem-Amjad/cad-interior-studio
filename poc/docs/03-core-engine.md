# 03 — Core Engine Implementation

Four subsystems: **Ingest → Viewer → Editor → Optimize/Result**. Build in that order; each is demoable on its own.

## 1. Ingest (CAD → 3D)

### IFC lane (the headline: "your CAD file, in the browser, free")

```ts
// engine/ingest/ifc.ts
import * as WebIFC from "web-ifc";

export async function loadIfc(buffer: ArrayBuffer, onProgress: (p: number) => void):
  Promise<{ shell: THREE.Group; rooms: RoomInfo[] }>
```

- Init `web-ifc` WASM once (`SetWasmPath` to `/wasm/`); `OpenModel` with `COORDINATE_TO_ORIGIN: true` (files are often georeferenced kilometers from origin — this bug will eat a day if skipped).
- Stream meshes via `ifcApi.StreamAllMeshes` → merge by material color into a handful of `BufferGeometry` groups (target: whole shell < 100 draw calls). Tag geometry by IFC storey.
- **Rooms**: read `IFCSPACE` entities → name + bounding box → `RoomInfo[]`. If the file has no spaces (common), fall back to one "Whole floor" pseudo-room per storey — do not build room-detection cleverness in a PoC.
- Convert IFC Z-up → three Y-up at the root group. Everything downstream assumes meters/Y-up.
- Runs in a worker if the main-thread hitch exceeds ~2 s on the sample file; otherwise keep it simple.

### GLB lane

`GLTFLoader` + meshopt/KTX2 decoders registered once. A GLB is treated as an already-ingested shell; rooms come from a sidecar `rooms.json` if present (our pre-converted samples ship with one), else the pseudo-room fallback.

### Pre-converted demo files (offline, once — not app code)

If the client's real file is RVT/DWG: convert it **once, by hand, before demo day** (APS trial translate → glTF, or Revit → IFC export → our IFC lane; Blender cleanup as needed). The PoC app itself never talks to APS. Document each conversion in `public/assets/SOURCES.md`.

## 2. Viewer

- `<Canvas>` with `dpr={[1, 2]}`, one directional light + `<Environment preset="apartment">`, soft contact shadows only.
- **Orbit mode**: drei `OrbitControls`, damped; double-click a room in the list → `flyTo(room.camera)` (tween camera + target to a pose computed from the room AABB).
- **Walkthrough mode**: `PointerLockControls` + WASD at 1.6 m eye height, simple capsule-vs-shell collision using the floor/wall raycast layers (good enough; no physics engine).
- Raycast **layers** from day one: `0=shell-floor`, `1=shell-walls`, `2=items`. Placement and walkthrough both depend on this being right.

## 3. Editor

### Scene store (`engine/scene/store.ts`)

```ts
type SceneDoc = {
  schemaVersion: 1;
  source: { kind: "ifc" | "glb" | "sample"; name: string };
  rooms: Record<string, {
    floorFinishId?: string; wallFinishId?: string;
    items: PlacedItem[];       // { id, catalogId, position:[x,y,z], rotationY, scale }
  }>;
};
// zustand + zundo (limit: 100). Actions: placeItem, moveItem, rotateItem,
// removeItem, setFinish, snapshot/restore (for before/after), load/save.
```

R3F components render *from* the store; three objects never own state. Per-frame drag updates mutate a ref and commit to the store on pointer-up (one undo entry per gesture, not per frame).

### Placement & manipulation

- Catalog click → ghost item follows floor raycast → click to commit. Footprint from the item's bounding box; tint ghost red when intersecting another item's AABB (warning only, never block — it's a demo).
- Selected item: drei `PivotControls` limited to XZ translate + Y rotate; `Delete` key removes; `Esc` deselects.
- Snapping: 5 cm grid + 15° rotation; `Shift` disables.
- Repeated catalog items use shared geometry via `useGLTF` caching; explicit `<Instances>` only if the demo scene ever exceeds draw-call comfort — measure first with `r3f-perf`.

### Materials

`data/catalog.ts` ships 6 finish sets (3 floors: oak, tile, polished concrete; 3 walls: warm white, sage, charcoal) as PBR texture sets. Applying a finish = swapping the material on the shell meshes belonging to that room (mesh→room mapping from ingest; for pseudo-rooms it applies to the whole storey — acceptable).

### Persistence

`save()` → zod-validate → localStorage (`poc:design:<sourceName>`) + "Download design.json"; `load()` accepts either. Corrupt/mismatched schema shows a toast and starts fresh — never a white screen.

## 4. Optimize & Result

### Style concepts (must-have)

1. `render/screenshot.ts`: render current view at 1024px to PNG (`preserveDrawingBuffer` only during capture).
2. `POST /api/style-concepts { image, style }` → provider (chosen day 1) image-to-image with a fixed prompt template per style, `n=4`. Timeout 90 s; return provider cost in the response for our own logging.
3. UI: non-blocking progress card in the StyleBar → 4-image gallery with lightbox. Images also cached in localStorage keyed by `(designHash, style)` so re-demos are instant.
4. Every concept image is watermark-labeled **"AI concept — inspiration"** (the Track A/B principle from [/docs/00](../../docs/00-project-brief.md) applies even in the PoC — this is part of the client education).

### Auto-style (stretch — build only if W3 is on schedule)

`POST /api/auto-style { sceneDoc, roomId, style }` → Claude (`claude-opus-5`, structured output with the scene zod schema converted to JSON schema) with the catalog + style tags in the prompt → returns a modified room (item swaps from the catalog + finish choices) → client validates with zod, applies via store action, one undo entry. This is the bridge-to-production moment: AI editing the *real* scene, not a picture.

### Result view

- **Before/after**: `snapshot()` on room entry; ResultView renders two `<View>`s (drei) of snapshot vs current store state with a slider.
- **Export**: 2× resolution screenshot download.

## Performance guardrails (PoC-sized)

Shell < 100 draw calls after merge; each catalog GLB ≤ 2 MB / ≤ 30k tris (enforced by a `pnpm assets:check` script); 30 fps floor with 30 items; `r3f-perf` overlay behind `?debug=1`.
