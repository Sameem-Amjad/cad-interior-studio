# ADR-005: Building shell rendering — glTF-in-R3F vs APS Viewer embed

- Status: **Proposed — decided by Phase 0 spike (task 0.2 / 0.5)**
- Date: 2026-08-07
- Deciders: Tech lead + 3D engineer

## Context

The design studio needs the building shell and our furniture layer in one interactive scene. If APS is chosen (ADR-004), there are two ways to get the shell on screen; if Speckle is chosen, Option A is the only path (Speckle gives us geometry we assemble ourselves).

## Options considered

### A — Export geometry (OBJ/glTF derivative) → our pipeline → R3F scene
- **Pros**: one rendering world; furniture, selection, instancing, LOD, walkthrough all under our control with `three-kit`; shell served from our CDN; no viewer SDK constraints; identical architecture regardless of CAD provider.
- **Cons**: derivative export can lose materials/metadata fidelity; we own re-materializing the shell (acceptable: shells are mostly neutral surfaces we re-skin anyway); APS terms for redistributing derivatives must be verified.

### B — Embed Autodesk Viewer for the shell, overlay/synchronize our furniture layer
- **Pros**: highest fidelity to the translated model; measurements/metadata tooling for free; clearly within APS terms.
- **Cons**: two scene graphs (Viewer's internal Three.js + ours) — synchronizing cameras, picking, and z-buffers is chronic pain; Viewer version upgrades can break integrations; our LOD/instancing strategy doesn't apply inside the Viewer; harder to keep the 60 fps budget.

## Decision criteria

Fidelity of Option A on real client files (visual + scale + room bounds) is the gate: if A is acceptable, A wins on architectural simplicity. B remains the documented fallback for high-fidelity *verification* views (engineer checks the conversion in an embedded Viewer) even if A powers the studio — that hybrid is cheap and likely regardless.

## Decision

Pending spike. Default lean: **A for the studio, B only as an engineer-facing verification screen.**

## Consequences

- If A: the asset pipeline ([04](../04-cad-3d-pipeline.md) §2) gains a "shell" profile (larger budgets, room-split meshes).
- If B for the studio: revise perf budgets in [11](../11-performance-observability.md) and the studio architecture in [04](../04-cad-3d-pipeline.md) §3; expect slower feature velocity on 3D interactions.
