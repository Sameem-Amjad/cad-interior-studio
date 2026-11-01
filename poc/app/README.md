# Studio PoC — the app

The proof of concept from [`../docs`](../docs/README.md), built. One Next.js app,
no database, no backend framework.

```bash
npm install       # also copies web-ifc's WASM into public/wasm
npm run dev       # http://localhost:3000
npm test          # engine placement maths
npm run typecheck
npm run build
```

Open `/`, drop an **IFC** or **GLB** file, or click **Open sample building** — the
sample is generated in code, so it always works and needs no network.

## Environment variables

Everything runs with none of these set. Each one upgrades a beat of the demo
from "honest local fallback" to "real model output".

| Variable | Effect when set |
|---|---|
| `OPENAI_API_KEY` | Concept images via `gpt-image-1` image-to-image |
| `GOOGLE_API_KEY` (or `GEMINI_API_KEY`) | Concept images via `gemini-2.5-flash-image` |
| `ANTHROPIC_API_KEY` | Auto-style picks the layout with `claude-opus-5` structured output |

With no image key, `/api/style-concepts` reports `configured: false` and the
client renders four style-graded views of your own 3D render instead. They are
labelled **demo** in the grid and **"Demo render — style grade, not AI"** in the
lightbox. We never present a colour grade as generated output.

With no Anthropic key, auto-style falls back to a deterministic planner that
picks catalog items by style tag and lays them out with the same placement
maths the editor uses. The toast says which one ran.

## Layout

```
app/          routes — landing, studio, and the two API routes
engine/       the salvageable core: ingest, scene document, editor maths, render
components/   panels and the R3F viewport (quick-and-dirty by design)
data/         the 12-item catalog, 6 finishes, procedural furniture + materials
lib/          client-side AI plumbing (concept cache, auto-style application)
```

`engine/` holds the rule that matters: typed, no UI imports, meters / Y-up /
radians. When the PoC dies it moves to `packages/three-kit`.

## Keyboard

| Key | Action |
|---|---|
| `1` / `2` | Orbit / walkthrough |
| `R` / `Shift+R` | Rotate selection ±15° |
| `Delete` | Remove selection |
| `Esc` | Close lightbox → close result → cancel placing → leave walk → deselect |
| `⌘Z` / `⇧⌘Z` | Undo / redo |
| `⌘S` | Save to this browser |
| `Shift`-click | Place several of the same item in a row |

## Deviations from the plan

Recorded here rather than discovered later. Rationale in
[`../docs/FINDINGS.md`](../docs/FINDINGS.md).

| Plan said | Built | Why |
|---|---|---|
| ~12 CC0 GLBs + 6 PBR texture sets | Parametric three.js geometry + canvas-generated textures | No download step, no licence audit, every asset trivially inside the 2 MB / 30k-tri budget. Swapping in real GLBs touches `data/catalog.ts` only. |
| shadcn/ui | ~10 hand-rolled primitives in `components/ui.tsx` | Six screens need six components; hand-rolling keeps the Stitch tokens in one file instead of spread across generated ones. |
| drei `PivotControls` for manipulation | Click-and-drag the object itself, plus an inspector and `R` | Fewer moving parts, and "drag the sofa" is the interaction the demo script actually describes. |
| `<Environment preset="apartment">` | Local `<Lightformer>` rig | The preset fetches an HDRI from a CDN; the demo has to survive dead venue Wi-Fi. |
