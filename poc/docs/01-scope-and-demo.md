# 01 — Scope & Demo

## The one user journey (everything in scope, nothing else)

**Actor: one person** (us, or the client clicking along). No login.

1. **Load a building**
   - Drag-and-drop an **IFC** file → converted in-browser → 3D shell appears; *or*
   - Drag-and-drop a **GLB** (pre-converted model) → appears instantly; *or*
   - Click a bundled **sample building** (always works, demo safety net).
2. **Explore**
   - Orbit/zoom the whole building; click a room in the room list → camera flies in; toggle first-person walkthrough mode (WASD + mouse).
3. **Edit the interior**
   - Open the catalog panel (~12 items: sofas, tables, chairs, lamps, rug, plant — each with style tags).
   - Click to place on the floor; drag to move; rotate; delete. Snapping on by default.
   - Change floor material and wall paint from swatches.
   - Undo/redo. Save/load the design locally.
4. **AI optimize**
   - Pick a style (Modern / Japandi / Scandinavian / Luxury).
   - **Concepts**: current room view → 4 AI-generated styled concept images (~30–60 s, progress shown).
   - **Auto-style (stretch goal)**: AI re-picks furniture/materials for the chosen style *from the demo catalog* and applies it to the actual 3D scene — the "it changed my real room" moment.
5. **See the result**
   - Before/after compare (saved snapshot vs current).
   - Concept image gallery.
   - Export a high-res screenshot of the final room.

## Explicit non-goals (repeat of README, because scope creep starts here)

No prices anywhere in the UI. No user accounts. No server-side persistence. No consultant/anything workflow. No DWG/RVT conversion inside the PoC app itself (see [03](03-core-engine.md) — RVT/DWG demo files are pre-converted once, offline).

## The 10-minute demo script (this IS the acceptance test)

| Min | Beat | What the client sees |
|---|---|---|
| 0–1 | Drop the client's building file (or sample) | "Your drawing became a 3D house in the browser" |
| 1–3 | Orbit → click "Living Room" → walkthrough mode | "Your customer walks through it" |
| 3–6 | Place sofa, table, lamp; move/rotate; swap floor to oak, walls to warm white | "They design it themselves — it's easy" |
| 6–8 | Style = Japandi → generate concepts → 4 images appear | "AI shows them what it could look like" |
| 8–9 | (Stretch) Auto-style applies Japandi to the real 3D room | "And AI can apply it to the actual room" |
| 9–10 | Before/after toggle → export screenshot | "This is the output — imagine a quote button here" |

The last line is the bridge to the production pitch — the PoC ends exactly where the quotation engine would begin.

## Acceptance criteria

Verified by an automated browser run of the demo script (Chrome, 1440×900 @ DPR 2,
Apple Silicon). Numbers in [FINDINGS §2](FINDINGS.md).

- [x] Sample building loads to first visible shell in **< 4 s** — measured **1.2 s**
- [x] A real third-party IFC4 export converts in-browser with a progress bar — `architecture_building.ifc` (225 kB, buildingSMART/SketchUp) ingests in **326 ms** with 2 real named rooms
- [ ] …but **~50 MB is still unmeasured** — the largest file to hand is 225 kB. See [FINDINGS §1](FINDINGS.md)
- [x] Editor holds **≥ 30 fps** with 30 placed items — **60 fps with 35 items** across five rooms, no dips while orbiting
- [x] Place → move → rotate → delete → undo → redo never corrupts the scene — one undo entry per gesture; placement maths covered by unit tests (`npm test`)
- [x] Material swap visibly changes floor/walls in the clicked room only — each room owns its floor slab and inner wall skin
- [x] Concept generation never blocks the editor — non-blocking progress card, cancellable, and a provider failure degrades to a labelled local preview in ~3 s instead of dead-ending
- [ ] **< 60 s p90 still unmeasured** — the supplied OpenAI key authenticates but the account has no credits, so no image was ever produced. See [FINDINGS §4](FINDINGS.md)
- [x] Save → reload browser → load returns the identical design — `localStorage` per building, plus JSON export/import
- [x] Full demo script runs twice back-to-back without refresh or restart
- [ ] Deployed on a URL the client can open themselves after the meeting — needs a Vercel account; `npm run build` is green and the app has no server dependencies beyond the two API routes

## Demo-day risk kit

- Bundled sample building + pre-generated concept images cached for it (if the venue Wi-Fi dies, the AI beat still shows something).
- Local fallback: everything except AI generation works fully offline.
