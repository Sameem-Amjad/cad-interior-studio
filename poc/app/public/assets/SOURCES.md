# Asset sources

Nothing in this PoC is downloaded, so there is nothing to attribute — every
asset is generated in code at runtime:

| Asset | Where it comes from |
|---|---|
| 12 catalog items | `data/furniture.ts` — parametric three.js geometry |
| 6 finishes + furniture materials | `data/materials.ts` — canvas-drawn textures, seeded so they are identical every reload |
| Sample building | `engine/ingest/sample.ts` — a five-room floor plan with doors, windows and glazing |
| Catalog thumbnails | `engine/render/thumbnails.ts` — rendered once from the same geometry the viewport uses |

## If you pre-convert a real client file

Convert **once, by hand, before demo day** (Revit → IFC export, or APS trial
translate → glTF, with Blender cleanup as needed) and drop the result here. The
app itself never talks to APS. Record each conversion below: source file, tool,
version, date, and anything you had to fix manually.

A `.glb` may ship with a sidecar `<name>.rooms.json` to get named rooms instead
of the "Whole floor" fallback:

```json
{ "rooms": [{ "id": "living", "name": "Living Room", "min": [0,0,0], "max": [6.6,2.75,5.6] }] }
```

| File | Source | Tool | Date | Notes |
|---|---|---|---|---|
| `samples/architecture_building.ifc` | buildingSMART sample scene ("ifc silly sample scene") | IFC manager for SketchUp 5.3.3 / SketchUp 2024 | 2024-11-14 | IFC4, 225 kB, 12 elements, 2 `IFCSPACE` volumes ("living room", "entry hall"). Used to validate the IFC lane — see [FINDINGS §1](../../docs/FINDINGS.md). Contains a stray geo-reference marker 35 m from the building. |
