# ADR-004: CAD platform — Autodesk APS vs Speckle

- Status: **Proposed — decided by Phase 0 spike (task 0.2 / 0.5)**
- Date: 2026-08-07
- Deciders: Tech lead + client stakeholder

## Context

We must convert client CAD/BIM files (formats unknown until discovery) into a browser-viewable building shell with room metadata. Both candidates hide the true build-vs-buy monster (CAD parsing); they differ in cost model, workflow, and control. The adapter interface (`CadConversionProvider`) makes this decision reversible-ish, but conversion quality characteristics leak into UX, so we decide deliberately.

## Options considered

### Autodesk APS (Model Derivative)
- **Pros**: broadest format coverage uploaded as-is (RVT/IFC/DWG/DXF); no software required on the engineer's machine — pure upload; enterprise-grade; rich metadata (rooms/levels from RVT); mature docs.
- **Cons**: per-translation Flex-token cost; geometry extraction for R3F goes through derivative exports with some fidelity loss; terms around serving derivatives need verification; vendor lock gravity.

### Speckle
- **Pros**: open source, self-hostable, no per-conversion fees; clean object model; webhooks/GraphQL pleasant to build on.
- **Cons**: requires connectors installed and used correctly by the client's engineers (adoption risk — the failure mode is silent: "it worked on my Revit"); conversion fidelity depends on source-app connectors; we own more of the geometry-assembly work.

## Decision criteria (scored in the spike, weighted)

1. Fidelity on the client's actual files (40%)
2. Room/space metadata quality (20%)
3. Engineer workflow friction (20%)
4. Cost per project at projected volume (10%)
5. Implementation effort to first working pipeline (10%)

## Decision

Pending spike. Default lean: **APS** if the client's files are Revit/IFC and translation costs are acceptable at volume — the zero-friction upload workflow protects the funnel's entry point. Speckle wins if the client's engineers already live in connector-friendly tools or if per-project costs at volume dominate.

## Consequences (either way)

- The chosen provider is wrapped by `CadConversionProvider`; the loser's adapter is deleted, not maintained speculatively.
- Update docs 01/04/06 and the cost model in 11 upon acceptance.
