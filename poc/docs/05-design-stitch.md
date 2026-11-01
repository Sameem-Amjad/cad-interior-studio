# 05 — Visual Design with Google Stitch

Purpose: generate the PoC's UI design in **Google Stitch** (stitch.withgoogle.com) *before* building, so we have visuals to (a) align on internally, (b) show the client alongside the plan, and (c) export to Figma as the reference for implementation.

## How to work with Stitch (read first)

1. **One screen per prompt.** Generate each screen separately; don't ask for the whole app at once.
2. **Paste the Design Language block first**, then the screen prompt below it — every time. Consistency across generations comes from repeating the same style words and hex values.
3. **Web mode**, desktop-first (the PoC is a laptop demo). 1440-width frames.
4. Iterate with short follow-ups ("make the right panel narrower", "darken the viewport area") rather than regenerating from scratch.
5. When a screen looks right → **export to Figma**, name the frame exactly as the screen name here (`S1-Landing`, `S2-Studio`, …).
6. Stitch output is a *reference*, not a contract — we implement with shadcn/ui + Tailwind, matching layout, hierarchy, and tokens, not pixel-for-pixel.

---

## Design Language block (prepend to every prompt)

```
Design language for all screens:
A professional 3D interior-design studio web app, dark theme, calm and premium —
closer to Figma/Spline than to a consumer app. Desktop web, 1440px wide.

Colors:
- App background: #0F1115 (near-black charcoal)
- Panel surfaces: #171A21 with 1px borders #262B36
- Primary text: #E8EAF0, secondary text: #8A93A6
- Accent (buttons, active states, selection): #3B82F6 (blue)
- Success: #10B981, warning: #F59E0B, danger: #EF4444
- The 3D viewport area is a plain dark surface #0B0D10 (a 3D render will live there —
  show a subtle placeholder of a modern living-room 3D scene)

Typography: Inter; 14px base UI text; 12px labels, uppercase tracking for panel titles.
Shape: 8px corner radius on panels and cards, 6px on buttons and inputs.
Density: compact but breathable — 12–16px padding in panels; thin 1px dividers.
Icons: simple line icons (Lucide style).
No marketing content, no stock photos of people. This is a working tool UI.
```

---

## S1 — Landing / Load a building

```
Screen: minimal landing page for loading a building model.
Centered column on the dark app background:
- Small logo mark + app name "Studio PoC" top-left of the page.
- Hero area in the center: a large drag-and-drop zone (dashed 1px border #262B36,
  radius 12px, ~720px wide) with an upload-cloud icon, title "Drop your building file",
  subtitle "IFC or GLB — converted in your browser, nothing is uploaded to a server".
- Under the drop zone, a row with two secondary options: an outlined button
  "Browse files" and a card-style button "Open sample building" with a tiny 3D house
  thumbnail.
- Footer line, very subdued: "Proof of concept — no account needed".
State variant (second frame): the same screen while converting an IFC file —
the drop zone is replaced by a progress card: file name "villa-27.ifc", a progress bar
at 64%, caption "Reading walls and rooms…", and a cancel text-button.
```

## S2 — Studio (the main screen; spend the most iterations here)

```
Screen: the main 3D design studio. Three-region layout:

LEFT SIDEBAR (240px, panel surface):
- Panel title "ROOMS", then a vertical list of rooms: "Living Room" (active, accent
  left-bar), "Kitchen", "Bedroom 1", "Bedroom 2", "Bath". Each row: room icon, name,
  small item-count badge.
- Below a divider, panel title "DESIGN", with rows: "Placed items (12)" and
  "Finishes", each expandable.

CENTER: the 3D viewport filling all remaining space (dark #0B0D10, subtle placeholder
render of a modern living room). Overlaid on the viewport:
- Top-center floating pill toolbar: icon buttons for Orbit (active), Walkthrough,
  and a separator, then Undo, Redo.
- Bottom-left: small semi-transparent hint chip "Click floor to place · Shift = free move".
- Bottom-right: zoom controls and a tiny fps/debug chip "60 fps".

RIGHT SIDEBAR (300px, panel surface):
- Tab row at top: "Catalog" (active) | "Style".
- Catalog tab content: a search input; filter chips "All, Sofas, Tables, Lighting,
  Decor"; a 2-column grid of product cards (rounded thumbnail of a furniture 3D
  render, name "Oslo Sofa", small style tag chip "Japandi"). 8 cards visible.
- One card is in a "placing" state with an accent border.

TOP BAR (full width, 56px, above all three regions):
- Left: back arrow + building name "villa-27.ifc" with a subtle "IFC" badge.
- Right: ghost buttons "Save design", "Load", then a primary accent button
  "AI Optimize ✦", and an avatar-less overflow menu icon.
```

## S2b — Studio with selection & inspector (variant of S2)

```
Same studio screen, but: a sofa in the viewport is selected — show a subtle accent
outline around it and a small floating gizmo hint. The right sidebar shows an
INSPECTOR panel instead of the catalog:
- Selected item card: thumbnail, "Oslo Sofa", style tag.
- Fields: Position (X, Z numeric inputs), Rotation (slider with 15° ticks),
  a "Snap to grid" toggle (on).
- Danger ghost button "Remove item" at the bottom.
- Above the inspector, a breadcrumb "Living Room / Oslo Sofa" and an X to deselect.
```

## S3 — AI Optimize flow (Style tab)

```
Same studio layout; the right sidebar shows the STYLE tab:
- Panel title "AI OPTIMIZE".
- A 2x2 grid of style cards: "Modern", "Japandi" (selected, accent border),
  "Scandinavian", "Luxury" — each with a tiny moodboard thumbnail.
- Primary button full-width: "Generate 4 concepts".
- Below, a generation card in progress state: skeleton 2x2 image grid with a progress
  bar "Generating Japandi concepts… 24s", and a note "You can keep editing meanwhile".
- Secondary outlined button, slightly muted: "Auto-style this room (beta)".
Second frame variant: generation finished — the 2x2 grid shows four interior concept
images; each image has a small corner watermark chip "AI concept". A caption under the
grid: "Inspiration only — items shown are not products." One image hovered with a
zoom icon.
```

## S4 — Concept lightbox

```
Modal over a dimmed studio: a large AI concept image (Japandi living room) centered,
watermark chip "AI concept — inspiration" bottom-left of the image.
Right side of the modal: a narrow column with the style name "Japandi · Concept 2 of 4",
prev/next arrows, and two buttons: primary "Use as reference" and ghost "Download".
Close X top-right.
```

## S5 — Result / Before & After

```
Screen: result view, reached after designing. Same top bar.
Center: a large before/after comparison of the same living room — one image split by
a draggable vertical slider handle (left label chip "Before", right label chip
"After"). Below it, a thumbnail rail: "Empty room", "Your design", "Japandi concept 1–4".
Right sidebar (300px): panel "RESULT",
- Summary rows: "Room: Living Room", "Items placed: 12", "Finishes: Oak floor,
  Warm-white walls", "Style: Japandi".
- Primary button "Export screenshot (2x)".
- Ghost button "Back to studio".
Note: deliberately NO prices, NO totals anywhere on this screen.
```

## S6 — Error & empty states (one frame, four small cards)

```
A single frame showing four toast/state components on the dark background, for the
component library:
1) Error toast: "Couldn't read this file — is it a valid IFC?" with a "Try sample
   building" action link.
2) Warning toast: "This IFC has no room data — showing whole floors instead."
3) AI failure card: "Concept generation failed. Your design is safe." with Retry button.
4) Empty catalog search state: magnifier icon, "No items match — try 'sofa'".
```

---

## After Stitch: handoff checklist

- [x] Frames generated and exported — they live in `stitch_stitch_design_system/`, one directory per screen with `code.html` + `screen.png`
- [x] Tokens extracted. **Tailwind v4 has no `tailwind.config.ts`** — they are `@theme` custom properties at the top of [`../app/app/globals.css`](../app/app/globals.css), lifted from `studio_poc/DESIGN.md` (Stitch wins over the prose block above where they differ)
- [x] Region → component map filled in below
- [ ] Screenshot S2 + S3 + S5 into the client deck
- [x] Divergences recorded rather than left silent — see the table below and [`../app/README.md`](../app/README.md#deviations-from-the-plan)

### Screen → implementation map

Not shadcn. Six screens need about ten components, and hand-rolling them keeps
every token in `globals.css` instead of spread across generated files.

| Stitch screen | Built as | Notes |
|---|---|---|
| S1 Landing / upload | [`components/Landing.tsx`](../app/components/Landing.tsx) | Drop zone, Browse, Open sample |
| S1 Converting | same file, `ConvertingCard` | Real `onProgress` from the IFC lane, cancellable |
| S2 Studio | `Studio` → `TopBar` + `LeftSidebar` + `ViewportFrame` + `RightSidebar` | 240 / fluid / 300 under a 56px bar, as specified |
| S2 viewport furniture | `ViewportFrame` | Pill toolbar, hint chip, fps chip, zoom — all `.glass` (80% surface + blur) |
| S2b Inspector | `RightSidebar` → `InspectorPanel` | Appears as a third tab when something is selected |
| S3 AI Optimize | [`components/StylePanel.tsx`](../app/components/StylePanel.tsx) | Style grid, progress card, 2×2 results, watermark chips |
| S4 Concept lightbox | [`components/ConceptLightbox.tsx`](../app/components/ConceptLightbox.tsx) | Prev/next, download, arrow keys, `Esc` |
| S5 Result / before-after | [`components/ResultView.tsx`](../app/components/ResultView.tsx) | Live 3D captures, not stills. No prices anywhere |
| S6 Error & empty states | `Toasts.tsx`, `EmptyState` in `ui.tsx`, the AI failure card in `StylePanel` | All four states are wired to real failure paths |
| Primitives | [`components/ui.tsx`](../app/components/ui.tsx) | Button, IconButton, Chip, Badge, Toggle, ProgressBar, PanelTitle, EmptyState |

### Where the build diverges from the frames

| Frame shows | Built | Why |
|---|---|---|
| S3 left sidebar as Scene / Catalog / Layers / Inspector / History nav | Rooms + Design, as in S2 | S2 and S3 disagreed with each other; S2 matches the scope in [01](01-scope-and-demo.md) |
| S3 right tabs `DATA / STYLE / RENDER` | `Catalog / Style / Inspector` | Same reason — S2 is the contract |
| Concept images as photographs | Same layout, plus a `demo` chip when no provider key is set | The fallback grades your own render; the label makes that unambiguous |
| Solid room walls in the viewport | Walls between the camera and the active room are hidden | Otherwise you orbit the outside of a closed box — see [FINDINGS §3](FINDINGS.md) |

## Scope guard

Stitch will happily invent extra screens (settings, login, dashboards). Don't keep them. The PoC has exactly the six screens above — anything else is production scope and lives in [/docs](../../docs/README.md).
