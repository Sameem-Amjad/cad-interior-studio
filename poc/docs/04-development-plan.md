# 04 — PoC Development Plan

**Timeline: 3 weeks (15 working days), one developer** (a second dev on assets/UI shaves ~4 days). Each week ends in something demoable; the order guarantees that if time runs out, what exists is still a coherent demo.

## Week 1 — Load & explore ("your file becomes a walkable 3D house")

| Day | Task | Done when |
|---|---|---|
| D1 | Scaffold Next.js app in `poc/app` (TS strict, Tailwind, shadcn, R3F); studio route client-only; deploy pipeline to Vercel working from day one. **Parallel spike**: run one room image through both image-gen providers, pick one, record choice in `02-architecture.md` | Deployed hello-scene URL; provider picked |
| D2 | GLB lane: loaders + decoders, drop-zone, sample building loads; raycast layers set up | Sample shell orbits at 60 fps |
| D3–4 | IFC lane: web-ifc init, mesh streaming + merge-by-material, Y-up/origin normalization, progress UI; `IFCSPACE` → rooms + pseudo-room fallback | A real IFC file (grab a public sample + request the client's) loads with room list |
| D5 | Camera rig: orbit + fly-to-room + walkthrough mode with collision; landing page polish | **M1: demo beat minutes 0–3 works** |

## Week 2 — Edit ("they design it themselves")

| Day | Task | Done when |
|---|---|---|
| D6 | Asset pack: source 12 CC0 GLBs + 6 finish sets, optimize (gltf-transform), style-tag in `data/catalog.ts`, `assets:check` script, `SOURCES.md` | All assets pass budget check |
| D7 | Scene store + zod schema + zundo; catalog panel renders | Store actions unit-tested (place/move/remove/undo) |
| D8 | Placement: ghost + floor raycast + snapping + collision tint; selection + PivotControls + delete | Place/move/rotate/delete smooth at 30+ fps |
| D9 | Materials: finish swatches, room mesh mapping, apply per room | Floor/wall swap visibly correct |
| D10 | Save/load (localStorage + file), inspector panel (item list per room), undo/redo UI, keyboard shortcuts | **M2: demo beats 0–6 work; survives reload** |

## Week 3 — Optimize & result ("AI shows and applies the look")

| Day | Task | Done when |
|---|---|---|
| D11 | Screenshot capture + `/api/style-concepts` route + provider integration + timeout/error toasts | 4 concepts return < 60 s for the sample room |
| D12 | StyleBar UX: style picker, progress card, gallery + lightbox, "AI concept" watermark, localStorage concept cache | Non-blocking; re-demo instant from cache |
| D13 | Result view: snapshot/before-after slider, 2× screenshot export | Demo beat 9–10 works |
| D14 | **Stretch (only if on schedule)**: `/api/auto-style` with Claude structured output → apply to scene. Otherwise: buffer day | Auto-style applies a coherent Japandi room, or buffer consumed |
| D15 | Hardening: run the full demo script ×3 on a mid laptop, fix the top annoyances; pre-generate demo-day concept cache; write `DEMO.md` cheat-sheet; final deploy | **M3: 10-min script runs twice back-to-back, deployed URL shared** |

## Milestone gates

- **M1 (D5)**: if IFC ingest is fundamentally broken on real files → fall back to "GLB-only PoC + offline pre-conversion for all demo files" and reclaim D3–4 effort for Week 2 polish. This is a *scope decision, made once, at M1* — not a lingering doubt.
- **M2 (D10)**: if editor perf misses 30 fps → D11 becomes an optimization day (merge/instancing) before any AI work starts. A slow editor kills the demo worse than missing AI does.
- **M3 (D15)**: demo readiness is judged only against the script in [01](01-scope-and-demo.md).

## What we learn for production (write down as we go, in `poc/docs/FINDINGS.md`)

1. web-ifc fidelity + performance on the client's real files → evidence for production ADR-004 (and possibly a cheaper Path A' the production docs don't currently assume).
2. Real numbers for shell size, draw calls, ingest time → replaces guesses in [/docs/11](../../docs/11-performance-observability.md).
3. Which editor interactions felt right/wrong → informs the Phase-2 editor epic.
4. Concept-image quality per style + prompt templates that worked → seeds [/docs/05](../../docs/05-ai-integration.md) templates.
5. If auto-style shipped: how well Claude respects the catalog constraint → evidence for the Track-B suggestion design.

## Budget notes

- Software cost during PoC ≈ image-gen API calls (cents per demo) + optional Claude calls. No APS spend unless we pre-convert an RVT (trial covers it).
- Hardware: test on the weakest laptop that will be in the demo room, not on our dev machines.

## Definition of done for the whole PoC

All acceptance boxes in [01-scope-and-demo.md](01-scope-and-demo.md) checked, `FINDINGS.md` written, demo delivered, and a go/no-go + scope recommendation for the production Phase 1 sent to the client.
