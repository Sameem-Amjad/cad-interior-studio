# 02 — PoC Architecture

One Next.js app. No database, no queue, no backend framework. Server code exists only where a secret must not reach the browser (AI API keys).

```
┌──────────────────────────────────────────────────────────┐
│  Next.js app (deployed on Vercel)                        │
│                                                          │
│  Browser (everything runs here)                          │
│  ├─ Ingest: web-ifc (WASM) → three geometry              │
│  │          GLTFLoader for .glb                          │
│  ├─ Engine: R3F scene — shell / furniture / selection    │
│  ├─ State:  zustand store (scene doc) + zundo (undo)     │
│  ├─ Persist: localStorage + JSON file export/import      │
│  └─ Result: before/after, screenshot export              │
│                                                          │
│  API routes (server-side, stateless)                     │
│  ├─ POST /api/style-concepts  → image-gen provider       │
│  └─ POST /api/auto-style      → Claude API (stretch)     │
└──────────────────────────────────────────────────────────┘
```

## Stack (final for PoC — do not bikeshed)

| Concern | Choice | Note |
|---|---|---|
| App | Next.js (App Router), TypeScript strict | single app, `ssr:false` dynamic import for the 3D page |
| 3D | three + @react-three/fiber + @react-three/drei | PivotControls, PointerLockControls, Environment |
| IFC parsing | `web-ifc` (WASM) | in-browser, free, no accounts — the PoC's CAD engine |
| State | zustand + zundo | one store = the scene document |
| Validation | zod (scene schema only) | same shape philosophy as production [/docs/02](../../docs/02-data-model.md) |
| Styling | Tailwind v4 (`@theme` tokens in `app/globals.css`) + ~10 hand-rolled primitives in `components/ui.tsx` | Not shadcn: six screens need six components, and hand-rolling keeps the Stitch tokens in one file instead of spread across generated ones. |
| AI images | **Adapter for both, selected by env var** — `OPENAI_API_KEY` → `gpt-image-1` edits, `GOOGLE_API_KEY` → `gemini-2.5-flash-image`; neither set → labelled local style-grade fallback | via API route. The day-1 spike could not run (no keys were available), so rather than guess we wrote both adapters — the choice is now one env var and a measurement, not a rewrite. |
| AI auto-style | Claude API `claude-opus-5` (stretch) | via API route, structured output |
| Assets | **Parametric three.js geometry + canvas-generated textures** (`data/furniture.ts`, `data/materials.ts`) | Replaces the CC0 GLB pack: no download step, no licence audit, deterministic across reloads, and every item trivially inside the 2 MB / 30k-tri budget. Real GLBs can be swapped in by changing `data/catalog.ts` alone. See [FINDINGS §2](FINDINGS.md) for the draw-call cost of this choice. |
| Deploy | Vercel | env vars hold the AI keys |

## Folder layout

```
poc/
├── docs/                    # this documentation
└── app/                     # the Next.js app (created in W1D1)
    ├── app/
    │   ├── page.tsx         # landing: drop zone + sample button
    │   ├── studio/page.tsx  # the whole PoC UI (client-only)
    │   └── api/
    │       ├── style-concepts/route.ts
    │       └── auto-style/route.ts        # stretch
    ├── engine/              # ← the salvageable core. NO react imports of app UI,
    │   ├── ingest/          #   no fetch, pure three + zustand
    │   │   ├── ifc.ts       #   web-ifc → {shell, rooms[]}
    │   │   ├── glb.ts       #   GLTFLoader + optional rooms.json sidecar
    │   │   ├── sample.ts    #   the procedural five-room demo building
    │   │   └── types.ts     #   BuildingModel, RoomInfo, raycast layers, camera poses
    │   ├── scene/
    │   │   ├── store.ts     #   zustand scene document + actions + undo (zundo)
    │   │   └── schema.ts    #   zod scene schema (mirrors production shape)
    │   ├── editor/          #   placement maths (unit-tested) + finish application
    │   └── render/          #   screenshot capture, catalog thumbnails
    ├── components/          # Landing, Studio, TopBar, sidebars, Viewport, ResultView…
    ├── lib/                 # client AI plumbing: prompts, concept cache, auto-style
    ├── data/                # catalog.ts (12 items + 6 finishes), furniture.ts, materials.ts
    └── public/
        ├── wasm/            # web-ifc WASM, copied from node_modules on install
        └── assets/          # SOURCES.md — where pre-converted demo files go
```

**The one engineering rule that matters here:** `engine/` stays clean (typed, no UI imports, meters/Y-up/radians like production). Everything under `components/` and `app/` is allowed to be quick-and-dirty. When the PoC dies, `engine/` moves to `packages/three-kit`.

## PoC-grade decisions (accepted shortcuts, on purpose)

| Decision | Production equivalent |
|---|---|
| IFC parsed **in the browser** with web-ifc; RVT/DWG demo files pre-converted offline once (APS trial or Blender) and shipped as GLB | Production uses the server-side pipeline per [/docs/04](../../docs/04-cad-3d-pipeline.md) + ADR-004 |
| Scene saved to localStorage / downloadable JSON | Postgres `DesignVersion` with immutability |
| Catalog is a TS constant, prices omitted entirely | Catalog schema + admin + BOM engine |
| AI calls direct from API route, no queue | BullMQ workers, quotas, cost accounting |
| Single hardcoded "roomization" heuristic if IFC spaces missing (floor-polygon per storey) | Proper space extraction + guided modeling tool |
| No tests except engine-math unit tests + the demo script | Full pyramid per [/docs/09](../../docs/09-testing-strategy.md) |

## Scene document (deliberately the same *shape* as production)

The zod schema in `engine/scene/schema.ts` mirrors production scene JSON v1 (rooms → items with `variantId`-style ids, transforms in meters/radians, finishes per room). This costs nothing now and makes the PoC's saved designs conceptually portable — and keeps the demo narrative honest: *what you place is a real, identifiable product, which is exactly what a quotation would be computed from.*
