# Proof of Concept — Core Engine Only

A standalone, single-user app that proves the platform's core loop end-to-end:

```
Upload CAD ──▶ 3D model ──▶ View & walk through ──▶ Edit interior ──▶ AI optimize ──▶ See the result
```

Nothing else. No estimation, no quotation, no roles, no reviews, no payments.

## Why this exists

1. **De-risk**: CAD→3D→editable-interior is the hardest technical chain in the product. Prove it with real files before committing to the full build.
2. **Design testing**: iterate on the editor UX fast, without production plumbing slowing us down.
3. **Client demo**: show the main output the client wants, live, in a browser.

## Relationship to the production plan

- The production documentation in [/docs](../../docs/README.md) is untouched and remains the plan of record for the full platform.
- This PoC is **evidence for** production ADR-004/ADR-005 (CAD path, shell rendering) and effectively executes Phase-0 spikes 0.2–0.4 as one coherent app instead of separate throwaways.
- Code here is *salvage-grade*, not production-grade: the 3D editor core (`engine/`) is written cleanly enough to lift into `packages/three-kit` later; everything else may be discarded without regret.

## What it deliberately does NOT have

| Skipped | Why it's safe to skip |
|---|---|
| Auth / roles | One person drives the whole demo |
| Database | Scene state lives in the browser (localStorage + file export) |
| Backend framework | A single Next.js app; API routes only where a secret must stay server-side |
| Catalog admin / real pricing | ~12 hardcoded demo assets with style tags |
| Quotation / BOM / orders | Explicitly out of PoC scope per client direction |
| Tests beyond smoke | Manual demo script is the acceptance test |
| Multi-project / persistence | One model, one session at a time |

## Documents

| Doc | Contents |
|---|---|
| [01-scope-and-demo.md](01-scope-and-demo.md) | The single user journey, demo script, acceptance criteria |
| [02-architecture.md](02-architecture.md) | Minimal stack, folder layout, PoC-grade decisions |
| [03-core-engine.md](03-core-engine.md) | Implementation detail: ingest, viewer, editor, AI optimize, result view |
| [04-development-plan.md](04-development-plan.md) | 3-week day-by-day build plan with milestones |
| [05-design-stitch.md](05-design-stitch.md) | Google Stitch prompts, and the screen → component map for what was built |
| [FINDINGS.md](FINDINGS.md) | **What the build actually taught us** — measured numbers, engine gotchas, what still needs evidence |
| [../DEMO.md](../DEMO.md) | Demo-day cheat sheet: the 10 minutes, and what to do when something breaks |
| [../app/README.md](../app/README.md) | How to run it, env vars, and where the build deviates from this plan |

## Success =

The 10-minute demo script in [01](01-scope-and-demo.md) runs start-to-finish on a real (or realistic) client building file, live, without a restart, on a normal laptop.

**Status:** the app is built and the script runs end to end on the bundled
sample at 60 fps. Two things are still owed before the go/no-go: a real client
IFC through the ingest lane, and one run of each AI beat against a live provider
key. Both paths are implemented; only the evidence is missing. See
[FINDINGS.md](FINDINGS.md).
