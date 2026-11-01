# 12 — Development Plan

Timeline: ~22 weeks (Phase 0: 2, Phase 1: 8, Phase 2: 6, Phase 3: 6). Suggested team: 1 tech lead (full-stack), 1 frontend/3D engineer, 1 backend engineer, part-time designer, part-time QA from Phase 2. Smaller teams stretch the calendar, not the scope order.

## Phase 0 — Discovery & proof of concept (Weeks 1–2)

Goal: replace the two biggest assumptions with evidence, end with a demo and a fixed scope.

| # | Task | Exit criterion |
|---|---|---|
| 0.1 | Collect 3–5 real client CAD files + 50–100 catalog rows (SKU, price, supplier) | Files + spreadsheet in hand |
| 0.2 | Spike: files through APS (SVF2 + glTF derivative) and Speckle | Comparison note: fidelity, room metadata, cost, effort |
| 0.3 | Spike: fixture room in R3F — place/move/swap 3 GLBs + live price total | Runs in browser, demo-ready |
| 0.4 | Spike: one room render through both image-gen providers, 4 styles each | Side-by-side quality sheet, architecture-preservation verdict |
| 0.5 | Resolve ADR-004 (APS vs Speckle) and ADR-005 (shell rendering) | ADRs status → Accepted; docs 01/04/06 updated |
| 0.6 | Map catalog data → schema; identify gaps (missing 3D models, prices) | Import plan + asset sourcing list with licensing path |
| 0.7 | Feasibility report + fixed Phase 1–3 scope to client | Client sign-off |

**Kill/pivot criteria:** if client files are 2D-only AND guided modeling effort per project exceeds the client's tolerance → re-scope Phase 1 around the guided-modeling tool before committing.

## Phase 1 — Core platform (Weeks 3–10)

### Epic 1.1 Foundations (W3–4)
Monorepo scaffold, CI, docker-compose, seed data, Clerk auth + roles, projects + membership CRUD, deploy pipeline to staging.
*Accept:* all four roles can log in; project CRUD with RBAC integration tests green; CI < 10 min.

### Epic 1.2 CAD ingest (W4–7)
Presigned uploads, `cad.convert` worker with the chosen provider, progress over WebSocket, retry/error UX, room metadata extraction, (if needed) guided-modeling admin tool v0.
*Accept:* real client file upload → explorable model on staging with rooms listed; failure modes render actionable messages; conversion cost logged.

### Epic 1.3 3D viewer (W6–9, overlaps)
`three-kit` loaders/decoders, shell layer, orbit + walkthrough cameras, room navigation/fly-to, perf baseline instrumentation.
*Accept:* shell < 5 s load on staging fixture; 60 fps empty-shell orbit on mid hardware; perf smoke in CI.

### Epic 1.4 Designs & versions (W8–10)
Design/version model + API, scene schema v1 + validation, save/submit state machine, version list + thumbnails.
*Accept:* create → save → submit flow with audit rows; illegal transitions 409; scene validation rejects unknown variants.

**Milestone M1 (end W10):** engineer uploads a real file; customer walks through it and saves an (empty) design. Demo to client.

## Phase 2 — Design studio & AI (Weeks 11–16)

### Epic 2.1 Catalog (W11–12)
Catalog schema + admin CRUD + CSV import; asset pipeline (gltf-transform worker, intake validation); catalog browse UI with search/filters.
*Accept:* 60+ real products imported with GLBs passing intake spec; browse p95 < 300 ms.

### Epic 2.2 Placement editor (W11–14)
Furniture layer + instancing, selection + gizmo, floor/wall finishes with area computation, snapping/collision warnings, undo/redo, live price HUD (isomorphic quotation engine).
*Accept:* the CI perf budget scene (150 items ≥ 30 fps); price HUD equals server pricing to the cent in E2E; undo across 50 operations.

### Epic 2.3 AI features (W13–16)
Image-gen adapter + style concepts job + gallery UX with "inspiration" labeling; Claude assistant with catalog/room tools, streamed chat; suggestions endpoint; quotas + cost accounting + flags.
*Accept:* concept generation < 60 s p90 with progress; assistant grounding eval green; both features degrade to "off" cleanly by flag.

### Epic 2.4 Version compare (W15–16)
Item-level diff API + side-by-side compare UX with price delta.
*Accept:* compare highlights added/removed/changed items and totals correctly on golden fixtures.

**Milestone M2 (end W16):** full customer design session on real catalog — the "wow" demo.

## Phase 3 — Consultant workflow & commerce (Weeks 17–22)

### Epic 3.1 Review workflow (W17–19)
Review queue, room/item-pinned comments, request-changes → new-version flow, approve transition.
*Accept:* four-journey E2E #3 green; comments resolve; notifications sent.

### Epic 3.2 Quotation engine & PDF (W17–19)
`packages/quotation` hardened with golden suite, quotation creation on approval (transactional), PDF rendering worker, quotation viewer.
*Accept:* golden suite complete (≥ 6 scenarios) and green; PDF matches web totals; approval → quotation < 5 s.

### Epic 3.3 Orders & payments (W19–21)
Accept-quote → order, Stripe Checkout + webhook (idempotent), order timeline, admin order views, email notifications.
*Accept:* four-journey E2E #4 green incl. duplicate-webhook test; refund reconciliation documented.

### Epic 3.4 Hardening & launch (W21–22)
Security checklist ([10](10-security.md)) swept, load test (50 concurrent editors), backup-restore drill, observability dashboards + alerts, docs freshness pass, production cutover runbook.
*Accept:* launch checklist signed by tech lead; all four E2E journeys green on production config with test keys.

**Milestone M3 (end W22): market-ready MVP.**

## Risk register (top 6, reviewed weekly)

| Risk | L×I | Mitigation | Trigger to act |
|---|---|---|---|
| Client files are 2D-only | M×H | Phase 0 detects; guided-modeling path priced in | 0.2 spike result |
| Geometry extraction fidelity poor (materials/scale) | M×H | ADR-005 keeps APS-Viewer-embed fallback alive until M1 | Fixture fidelity check fails |
| Catalog lacks 3D models | H×M | Licensing plan in 0.6; commissioned modeling budget; ship with partial "priced but not placeable" items | Import gap > 40% |
| Editor perf on client's real hardware | M×M | Budgets in CI from W6; telemetry from M1; LOD pipeline | fps telemetry p50 < 30 |
| AI image quality disappoints stakeholders | M×M | Expectation-setting (Track A framing); provider swap is config | 0.4 quality sheet |
| Scope creep from demos | H×M | Flags + "roadmap, not MVP" list in [00](00-project-brief.md); change requests re-priced | Any un-ticketed ask |

## Working agreements

- Weekly demo on staging every Friday — no slide-only demos.
- The plan above sequences epics; inside an epic, the team breaks stories ≤ 2 dev-days each.
- Anything failing its Accept line does not count as done ([08 — Definition of Done](08-development-workflow.md)).
- Post-MVP backlog lives in the tracker, not in this doc: voice control, budget-mode redesign, auto room styling, lighting simulation upgrades, 2D-plan auto-reconstruction research, supplier marketplace.
