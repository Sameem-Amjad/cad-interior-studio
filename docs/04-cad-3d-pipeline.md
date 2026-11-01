# 04 — CAD & 3D Pipeline

This is the highest-technical-risk area of the project. It is split into three independent concerns:

1. **Ingest**: turning the client's CAD/BIM files into a normalized building shell (GLB + room metadata).
2. **Assets**: the furniture/material catalog pipeline (GLB intake, optimization, delivery).
3. **Runtime**: the R3F scene architecture that composes shell + assets into the design studio.

Concern 1 has a **`DECIDE-IN-DISCOVERY`** fork ([ADR-004](adr/004-cad-platform-aps-vs-speckle.md), [ADR-005](adr/005-building-shell-rendering.md)). Concerns 2 and 3 are stable regardless of that decision — build them first.

## 1. Ingest

### Input format reality check

| Input | 3D data present? | Pipeline |
|---|---|---|
| Revit (.rvt) | Yes, with semantics (rooms, levels) | Fully automatic (Path A) |
| IFC | Yes, with semantics | Fully automatic (Path A or B) |
| 3D DWG | Geometry yes, semantics weak | Automatic + engineer prep guidelines |
| 2D DWG/DXF floor plan | **No** | Guided modeling (Path C) — no automatic conversion exists |

Never promise automatic conversion of 2D plans. Detect it early: after upload, a quick geometry probe classifies the file; 2D inputs route to the guided-modeling queue with a clear status.

### Path A — Autodesk APS (primary candidate)

Flow implemented in the `cad.convert` worker:

1. **Auth**: 2-legged OAuth client-credentials (`POST /authentication/v2/token`), scopes `data:read data:write data:create bucket:create bucket:read`. Token cached in Redis with expiry margin.
2. **Storage**: one APS OSS bucket per environment (`viral-mvp-{env}`); upload via APS's signed-S3 upload endpoints (multipart for >100 MB).
3. **Translate**: `POST /modelderivative/v2/designdata/job` targeting **SVF2** (for the APS Viewer path) and/or **OBJ/glTF derivative** (for the R3F path). Include `x-ads-force: true` on retries.
4. **Poll manifest**: `GET .../:urn/manifest` with backoff until `status: success | failed`. Progress percentage is forwarded to the client over WebSocket.
5. **Extract metadata**: `GET .../:urn/metadata` → object tree + properties. From Revit/IFC we pull spaces/rooms, levels, and bounding boxes → `Room` rows.
6. **Persist**: derived geometry lands in R2 (never serve from APS directly to end users); `ModelConversion` updated.

Gotchas (learned the hard way — verify all in the discovery spike):
- Translation is billed in APS Flex tokens per job — track per-conversion cost in `ModelConversion`.
- SVF2 is viewable only in Autodesk's Viewer; extracting geometry for R3F requires the OBJ/glTF derivative route, which loses some materials. This trade is the heart of ADR-005.
- Viewer access tokens must be minted server-side with `viewables:read` scope only, short TTL, per project — never expose the app's client credentials.
- Manifest can report `success` with per-derivative failures — inspect children, not just the root status.

### Path B — Speckle (open-source alternative)

- Engineers push from Revit/Rhino/AutoCAD via Speckle connectors to a stream; our worker listens to stream webhooks, pulls objects through the GraphQL API, converts Speckle objects → GLB with the `@speckle/objectloader` + our own mesh assembly, extracts room data from object metadata.
- Pros: no per-conversion fees, self-hostable, developer-friendly data model. Cons: requires connector installation/discipline on the engineer's side; conversion quality depends on the source app's connector.

### Path C — 2D plans: guided modeling

An internal admin tool (Phase 1, minimal): upload the 2D plan as a reference image → admin traces walls/doors/windows on a 2D canvas → parametric extrusion generates the shell GLB + `Room` rows. Budget hours-per-project; it is a service cost, not an engineering research project. If discovery shows all client input is 3D BIM, this tool is deferred.

## 2. Furniture & material asset pipeline

Every `ProductVariant` that is placeable gets a GLB. **Intake spec (hard requirements, validated by an automated check on upload):**

| Requirement | Value |
|---|---|
| Format | .glb (glTF 2.0 binary), single file |
| Units / axes | Meters, Y-up, -Z forward |
| Pivot | Bottom-center at origin (objects sit on the floor at y=0) |
| Real dimensions | Must match `ProductVariant.dimensionsJson` ± 2% |
| Triangles | ≤ 50k (LOD0); LOD1 ≤ 12k auto-generated |
| Materials | PBR metallic-roughness only; no extensions beyond `KHR_materials_*` basics |
| Textures | ≤ 2048², will be KTX2-compressed in the pipeline |
| Licensing | `licensedFrom` provenance required — see [06](06-third-party-services.md#asset-licensing) |

**Optimization pipeline** (worker job on asset upload, using `gltf-transform`):

```bash
gltf-transform optimize in.glb out.glb \
  --compress meshopt \
  --texture-compress ktx2 \
  --simplify 0.75
# + custom step: generate LOD1, thumbnail render, validate pivot/units
```

Outputs (LOD0, LOD1, thumbnail) go to R2 behind the CDN with immutable cache headers (content-hashed keys).

## 3. Runtime — R3F scene architecture

```
<DesignStudio>
 ├─ <ShellLayer>        static building GLB, frozen matrices, raycast layer "walls/floor"
 ├─ <FurnitureLayer>    placed items; instanced meshes for repeated variants
 ├─ <SelectionLayer>    outline pass + transform gizmo (drei PivotControls)
 ├─ <HelpersLayer>      grid, measurements, room highlight — dev/consultant only
 └─ <CameraRig>         orbit mode + first-person walkthrough mode, room fly-to
```

Principles:

- **Scene state lives in Zustand, not in Three objects.** The store holds the scene document ([02](02-data-model.md)); R3F components render *from* it. Undo/redo = store history (zundo), capped at 100 entries.
- **Placement**: raycast against the floor mesh; footprint AABB (from `dimensionsJson`) is checked against walls and other items — soft warning, not a hard block. Snap: 1 cm grid + 15° rotation steps, `Shift` disables.
- **Loading**: `useGLTF` with meshopt/KTX2 decoders registered once; suspense boundaries per layer; room-based lazy loading — only the active room's furniture at LOD0, neighbors at LOD1.
- **Instancing**: repeated variants (chairs, tiles) render through `<Instances>`; target < 300 draw calls furnished.
- **Disposal**: leaving the studio route disposes geometries/textures explicitly; `useGLTF.clear` on catalog swaps. Memory leaks in the editor are release-blockers.
- **Everything 3D is client-only**: studio routes are `"use client"` and dynamically imported with `ssr: false`.

The **live price HUD** subscribes to the same store: any change to `items`/finishes recomputes locally against loaded catalog prices (pure function from `packages/quotation`), and reconciles with the server total on save. The client and server run the *same* pricing code — that package is isomorphic by design.

## Pipeline versioning

`ModelConversion.pipelineVersion` and the asset pipeline version are bumped whenever conversion/optimization logic changes materially. Old artifacts stay valid; reconversion is an explicit admin action, never automatic mass-reprocessing.
