# DEMO.md — demo-day cheat sheet

Print this. Everything below runs offline except the two AI beats, and both of
those degrade to a labelled local fallback rather than failing.

## Before you leave

- [ ] `npm run build && npm start` on **the weakest laptop that will be in the room**, not your dev machine
- [ ] Open the app once and click **Open sample building** — the first load compiles shaders and generates textures; do it before the client is watching
- [ ] Run the script below once end to end
- [ ] If you have API keys: run **Generate 4 concepts** once for each style you plan to show. Results are cached in `localStorage` per (room contents, style), so the live run is instant
- [ ] Know which build you are on: with a **working, funded** key the concept grid says **AI concept**; otherwise every image says **demo**. A key that authenticates but has no credits still shows **demo** — check by generating once, not by checking that the key is set
- [ ] Want to show a real CAD file? `app/public/assets/samples/architecture_building.ifc` is a third-party IFC4 export that loads with two real named rooms

## The 10 minutes

| Min | Do this | Say this |
|---|---|---|
| 0–1 | Drop the client's file, or click **Open sample building** | "Your drawing became a 3D building in the browser. Nothing was uploaded." |
| 1–3 | Click **Living Room** in the left list. Orbit. Then press `2` for walkthrough, click the viewport, walk with `WASD`. `Esc` to come back | "Your customer walks through it before anything is built." |
| 3–6 | Click **Oslo Sofa** → click the floor. Repeat for a table and a lamp. Drag the sofa. Press `R` to rotate. Open **Finishes** in the left panel and click the oak and warm-white swatches | "They design it themselves. This is not CAD — it's click and place." |
| 6–8 | **AI Optimize** → **Japandi** → **Generate 4 concepts**. Click one to open the lightbox | "AI shows them what it could look like." Say the words **"inspiration, not a product list"** — it's on screen too. |
| 8–9 | **Auto-style this room (beta)** | "And AI can restyle the actual 3D room — every item it chose is a real catalog product, not a picture." |
| 9–10 | **Result** → drag the before/after slider → **Export screenshot (2×)** | "This is the output. Now imagine a **Get a quote** button right here." |

That last line is the whole pitch. The PoC stops exactly where the quotation
engine begins — there are no prices anywhere in the UI, on purpose.

## If something goes wrong

| Symptom | Do |
|---|---|
| A dropped file fails to load | The error toast has a **Try sample building** link. Take it and carry on — the sample is the same demo. |
| IFC loads but rooms say "Whole floor" | Expected: that file has no `IFCSPACE` entities. Say so — it's a real finding about their data, not a bug. |
| Concepts come back as colour grades with a yellow note | The provider failed or no key is set — the note says which. You get four labelled **demo** images in ~3 s instead of an error. Say "this beat needs a funded provider key; here's the shape of it" and move on. |
| Concepts hang | The failure card says *"Your design is safe"* with a **Retry**. Skip to auto-style; it needs no image provider. |
| Editor feels slow | Check the fps chip, bottom right. It turns amber below 30. Switch to a single room and reload. |
| Total wipeout | Reload. Click **Open sample building** — your last design for that building is restored from this browser automatically. |

## Questions you will get

**"Is this our real building?"** — Yes if you dropped their file; the sample is
ours. IFC is parsed in the browser by `web-ifc`; nothing leaves the laptop.

**"Can it price this?"** — Not here, deliberately. Every placed item carries a
catalog id, which is exactly what a bill of materials would be computed from.
That's the next phase, not this one.

**"Where do the AI images come from?"** — An image model, from a screenshot of
*their* room. They're inspiration; the items in them are not orderable. The
auto-style button is the other thing: that one only ever uses our catalog.

**"How many products can it hold?"** — Twelve here, because this is a proof of
concept. The catalog is a data file, not a limit.
