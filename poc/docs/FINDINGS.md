# FINDINGS

What the PoC taught us, written for whoever plans production. Structured around
the five questions in [04-development-plan.md](04-development-plan.md).

Measured on a 1440×900 viewport at DPR 2, Chrome / Apple Silicon, unless noted.

---

## 1. CAD ingest — evidence for ADR-004

**Status: run against a real IFC4 file and working.** Source:
`ifc_examples/architecture_building.ifc` — buildingSMART's sample scene, authored
in SketchUp via "IFC manager for SketchUp 5.3.3", 225 KB, IFC4, 12 streamed
elements, 2 `IFCSPACE` volumes. Small, but a genuine third-party export rather
than something we generated, and it surfaced four real bugs.

### `web-ifc` already returns Y-up geometry — do not rotate

The headline finding, and the one most likely to be re-introduced. The IFC
*schema* is Z-up, so the obvious move is to rotate the root by −90° about X.
That is wrong: `flatTransformation` from `web-ifc` is **already Y-up**, and
rotating lays the whole building on its side.

It fails quietly, which is what makes it expensive. Nothing errors; you get a
plausible-looking model, a camera inside a wall, and rooms whose "height" is
their depth. Verified against ground truth by reading the file with the
`web-ifc` Node build directly:

| | Reported by web-ifc | Interpreted as |
|---|---|---|
| `IFCSPACE` "living room" | extent `[5.0, 2.2, 3.8]` | 5.0 m × 3.8 m floor, **2.2 m ceiling on `y`** |
| `IfcSlab` "floor" | extent `[5.2, 0.3, 5.8]` | 0.3 m slab thickness on `y` |

A 2.2 m ceiling and a 0.3 m slab both land on `y`. That is Y-up. **Assert this,
don't assume it** — a one-line sanity check (is the smallest extent of a floor
slab on `y`?) would have caught it in seconds.

### Spatial containers carry geometry, and it is not fabric

`IfcSpatialZone` ("house — gross volume", 5.6 × 6 × 6 m) and `IfcSite` stream
through `StreamAllMeshes` as solid boxes enclosing the building. Render them and
the user sees a featureless block where their house should be. `IFCSPACE` is
excluded by web-ifc's default settings; these are not. Filter by type code.

### Merge by colour **and** by space, never colour alone

Merging the shell by material colour is the standard trick for getting draw
calls down, and on its own it destroys everything downstream that reasons about
*where* a mesh is. One merged mesh spans the whole building, so:

- the dollhouse cutaway hid the entire building or nothing;
- `mesh.position` is the model origin for every merged mesh, so any code using
  object position as a proxy for location is silently wrong;
- frustum culling stops doing useful work.

Bucketing by `(quantised colour × 4 m spatial cell)` fixes all three and cost 6
draw calls on this file (8 meshes instead of 6). **Production should merge per
storey per material at minimum.** If the production engine ever wants
element-level selection — and a quotation flow will — it needs per-element
meshes with an id map, not merged buckets.

### Real files contain stray geometry far from the building

This file has a 1.6 m "geo-reference" marker **35 m** from the house and an
"origin" marker 5 m away. They are legitimate content, and they inflate the
model bounding box from ~6 m to 38.5 m. Framing the camera on raw model bounds
put the building in a corner of the screen at 3 % of the viewport.

The rule that works: **when the file declares real rooms, frame the rooms**;
otherwise frame tagged floor/wall geometry, which at least excludes decoration.
Never frame raw bounds.

### What held up without changes

- `COORDINATE_TO_ORIGIN: true` — still not optional, and this file proves the
  case: its geo-reference marker is exactly the kind of content that drags a
  model away from the origin.
- `IFCSPACE` → rooms worked exactly as designed. Both spaces came back with
  `LongName` ("living room", "entry hall") and correct volumes via
  `StreamMeshes`, giving real named rooms with no heuristics.
- The storey fallback was exercised separately, by rewriting the file's two
  `IFCSPACE` declarations into proxies. Result: one pseudo-room "Whole floor",
  the warning toast *"This file has no room data — showing whole floors
  instead"*, and a persistent `no room data` badge in the top bar. Worth keeping
  both signals — the toast is missed if the client is talking, the badge isn't.
- Ingest is fast: **326 ms** for the whole pipeline.

**Recommendation for ADR-004: browser-side `web-ifc` is viable.** Nothing found
here is a reason to move ingest server-side. But this file is 225 KB and 12
elements; the ~50 MB / thousands-of-elements case is still unmeasured, and that
is where the argument will actually be decided. Get a real project file next.

## 2. Numbers — replaces the guesses in /docs/11

Read live from the `?debug=1` overlay (open `/?debug=1`, then load a building).

| Measurement | Value | Target in [01](01-scope-and-demo.md) |
|---|---|---|
| Sample building → first visible shell | **1.2 s** | < 4 s ✅ |
| Sample shell build (`ingestMs`) | **19 ms** | — |
| Sample shell | **100 meshes / 1,200 tris** | — |
| Draw calls, empty building | **70** | < 100 ✅ |
| Draw calls, 5 rooms auto-styled (35 items) | **654** | ⚠️ see below |
| Triangles drawn, same scene | 18,142 | — |
| fps orbiting that scene | **60 fps, no dips** | ≥ 30 fps with 30 items ✅ |
| First Load JS | 104 kB shared + ~1.3 kB/route | — |
| **IFC** `architecture_building.ifc` (225 kB, 12 elements) | drop → studio **0.6–0.8 s**, of which **326 ms** is ingest | — |
| — its merged shell | 8 meshes / 1,106 tris / 8 draw calls | < 100 ✅ |
| IFC of ~50 MB | **still not measured** — the largest file to hand is 225 kB | < 60 s ❓ |

**The draw-call number is the interesting one.** The shell is comfortably inside
budget at 70 calls, but 35 pieces of furniture add ~580 more — roughly 17 draw
calls per item, because each parametric piece is a group of small meshes and
nothing is instanced or merged. It still holds 60 fps on Apple Silicon, and the
triangle count is trivial, so this never became a problem for the PoC. On a weak
integrated GPU it would be the first thing to bite.

Two fixes, in order of value, if production keeps parametric geometry: merge
each catalog item's meshes by material at prototype-build time (one call per
material per item instead of per mesh), then `<Instances>` for repeated items.
Neither was needed to hit the acceptance target, so neither was built — but the
measurement says which lever to pull first.

The fps result also deserves a caveat: parametric furniture with shared
prototypes is far lighter per item than real GLB assets. Treat 60 fps as "the
engine and React layer are not the bottleneck", not as a prediction for a
catalog of real scanned products.

## 3. Editor interactions — for the Phase-2 epic

- **The dollhouse cutaway is the single biggest readability win.** Hiding wall
  pieces between the camera and the active room turns "orbiting the outside of a
  box" into a usable editor. It is ~20 lines and should be in the production
  engine on day one, not deferred as polish.
- **Fly-to must approach from outside the building.** Framing a room from a fixed
  `+x, +z` offset means looking at it through three other rooms. Direction from
  the building centroid outward through the room fixes it.
- **Semantic raycast layers must not start at layer 0.** In three, `layers` gates
  rendering and lighting as well as raycasting, so a mesh moved off layer 0 stops
  being drawn *and* stops being lit. Every mesh keeps layer 0 and gains its
  semantic layer on top. This cost real debugging time and will cost it again in
  `packages/three-kit` if it isn't written down.
- **Snap after the collision check is a bug.** Snapping a just-clear placement to
  a 5 cm grid can push it back into its neighbour. Snap first, then test. Found
  by the placement unit tests, not by using the app.
- **Drag-the-object beat the gizmo.** We dropped `PivotControls` for direct
  dragging plus an inspector. Nobody has to learn what the arrows mean, and it
  matches how the demo script describes the interaction.
- **One store commit per gesture.** Per-frame commits during a drag make undo
  useless. Mutate the object, commit on pointer-up.
- **Warn, never block.** Overlap tints the placement ring red and places anyway.
- **Cutaway must use geometry bounds, not object position.** Ingest bakes
  transforms into merged geometry, so `mesh.position` is the model origin for
  every merged mesh. A cutaway keyed on object position hid the entire IFC
  building; keyed on the world-space geometry centre it works. Same class of
  mistake as the layers one: an assumption that holds for hand-built geometry
  and quietly fails on ingested geometry.
- **Never cut away a mesh that spans most of the model.** With merged buckets one
  mesh can be half the building, and hiding it removes a storey rather than a
  wall. Skipping meshes above ~60 % of the model span is a cheap guard.

## 4. Concept images — seeds /docs/05 templates

Prompt templates live in [`../app/lib/prompts.ts`](../app/lib/prompts.ts), one per
style, so tuning them is a diff.

The template that works keeps the architecture and changes only the dressing:

> Restyle this interior render as a photorealistic {style} interior design
> concept. {style palette and materials}. **Keep the room's architecture, camera
> angle, window positions and proportions exactly as in the source image. Change
> only furniture, materials, finishes and lighting mood.** Architectural
> visualisation quality, natural light, no people, no text, no watermarks.

**Auth proven on two providers; not one image generated.** Both keys
authenticate and both are then refused for billing reasons — different reasons,
same outcome:

| Provider | Auth check | Generation | Refusal |
|---|---|---|---|
| OpenAI `gpt-image-1` | `/v1/models` → **200** | `/v1/images/edits` → **429** | `insufficient_quota` / `credit_balance_exhausted` — account balance is zero |
| Gemini `gemini-2.5-flash-image` | `/v1beta/models` → **200**, model is listed | `:generateContent` → **429** | `generate_content_free_tier_requests, limit: 0` |

**The Gemini result is the one worth writing down: image generation is not on
the Gemini free tier at all.** `limit: 0` is a billing gate, not a burst limit —
the free tier covers text models, and image models require billing enabled on
the project. Waiting, retrying or backing off will never succeed. Anyone
planning to "just use the Gemini free tier" for image work should know this
before they build around it.

That distinction matters in the UI too. The generic 429 handler reported *"the
provider is rate-limiting us"*, which is wrong and would have someone on demo
day waiting for a quota that is never coming back. A `limit: 0` in the body now
maps to *"Image generation isn't enabled on this provider account"*. Note the
provider error body has to be kept long enough to classify — the quota detail
sits ~400 characters in, past the original 300-character truncation, so the
check silently never fired until the slice was widened.

So: transport, auth, provider fan-out, error classification and the fallback are
all proven. **Image quality and the < 60 s p90 target remain unmeasured**, and so
do both request bodies, since billing is checked before body validation. Roughly
$5 of credit on either provider closes this out.

Two adapters are implemented, tried in order, with `IMAGE_PROVIDER` to pin one.
Gemini returns one image per call, so the 2×2 grid fans out four calls with
different lighting hints and keeps whatever succeeds; OpenAI takes `n=4` in one
call. A provider that authenticates but cannot serve falls through to the next
rather than ending the run.

**A provider outage must not dead-end the demo.** The credit failure originally
produced the S6 failure card — correct, but a dead end in front of a client. It
now degrades to the same local renderer used when no key is set, with the real
reason stated: *"The image provider account has no credits left. Showing
style-graded views of your own render instead — these are not AI output."*
Three seconds, four images, still badged **demo**. Honest and recoverable beats
correct and stuck.

Product decision worth keeping: **when no provider is configured, generate
something honest rather than nothing.** The client renders four style-graded
views of the user's own screenshot, labelled "demo" in the grid and "style
grade, not AI" in the lightbox. The demo beat still lands on dead venue Wi-Fi,
and nobody is misled. Concepts are cached in `localStorage` keyed by
(room contents hash, style), so a re-demo is instant.

## 5. Auto-style — evidence for the Track-B suggestion design

**Not yet validated against Claude** — no key was available; every run so far
used the deterministic fallback. The Claude path is implemented with
`claude-opus-5` and zod-derived structured output (`output_config.format`), at
`effort: "low"` since furnishing one room from a fixed list is a scoped task.

The design decision that should survive to production regardless: **validate the
catalog constraint twice.** The route sanitises the plan against the real catalog
before it leaves the server, and `lib/autostyle.ts` re-validates before touching
the scene. A hallucinated `catalogId` therefore cannot reach the document, and
the question "does the model respect the catalog?" becomes a measurement rather
than a risk. Instrument the drop rate when a key is available — that number is
the actual answer for Track B.

Two smaller shapes worth reusing:

- **Let the model omit coordinates.** `x`, `z` and `rotationDegrees` are nullable;
  anything left out is placed by the same deterministic layout heuristic the
  editor uses. The model does what it's good at (what goes in the room) and not
  what it's bad at (metric layout).
- **A refusal is a content outcome, not an error.** Opus 5 can decline; the route
  checks `stop_reason` and falls through to the local planner, so the demo beat
  never dies on a classifier.

---

## Recommendation for Phase 1

The core loop is proven end to end on generated geometry: load → explore → edit
→ AI → result runs twice back-to-back at 60 fps without a restart. What is **not**
proven is the part the client's money rides on — `web-ifc` against their real
files. Two things should happen before the Phase-1 scope is fixed:

1. Run a real client IFC through the app and record the numbers in §1 and §2.
   This is hours of work and it decides ADR-004.
2. Add one image-provider key and one Anthropic key and re-run §4 and §5. Both
   integration paths are written; only the evidence is missing.

If (1) fails, the fallback is already documented in the M1 gate: GLB-only, with
offline pre-conversion for demo files. That is a scope decision, not a defeat —
but make it on evidence, once.
