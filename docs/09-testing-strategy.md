# 09 — Testing Strategy

Test effort is allocated by risk, not by coverage vanity. The riskiest code in this product is (1) the quotation engine — wrong money is fatal to trust, (2) state machines around approval/payment, (3) the scene schema, (4) the 3D editor's correctness under interaction. That's where the depth goes.

## The pyramid, per layer

| Layer | Tool | What lives here | Target |
|---|---|---|---|
| Unit | Vitest | `packages/quotation`, `packages/shared` (money, scene validation), services with mocked repos | Quotation engine ~100% branch; shared ≥ 90% |
| API integration | Vitest + supertest + Testcontainers (Postgres, Redis) | Full HTTP → DB paths: auth guards, state machines, idempotency, webhooks | Every endpoint's happy path + every 4xx contract |
| E2E | Playwright | The four canonical journeys (below) against a deployed preview | All four green on main |
| 3D visual/behavioral | Playwright + WebGL screenshots; scene-state assertions | Editor loads fixture building, place/move/delete, price HUD, undo | Smoke set on PRs touching studio code |
| AI evals | Vitest fixtures + nightly live set | Assistant grounding, tool-call shape, refusals; concept-gen contract | Fixture set on every PR; live nightly |

## Quotation engine: golden files (the crown jewels)

`packages/quotation/__tests__/golden/` contains scene + catalog + tax fixtures and their expected quotation output, committed as JSON:

```
golden/
├── 01-single-room-basics/        {scene,catalog,expected}.json
├── 02-area-based-flooring/       # sqm quantities, unit rounding
├── 03-mixed-tax-rates/
├── 04-delivery-install-fees/
├── 05-empty-rooms-ignored/
└── 06-large-project-200-items/
```

- Rounding rules are asserted to the cent; any diff fails loudly and the fix requires updating the golden file **in the same PR with a reviewer explicitly approving the money change**.
- Property tests (fast-check) on invariants: line totals sum to subtotal; totals are order-independent; quantity 0 items never appear.
- The same engine runs client-side for the live price HUD — golden tests run in both node and jsdom to catch environment drift.

## API integration tests

- Testcontainers spin real Postgres+Redis per suite; Prisma migrations applied; per-test transaction rollback for speed.
- Must-cover contracts: RBAC (each role × each endpoint class — forbidden gets 403, not 404-leak or 200), state-machine 409s, `Idempotency-Key` replay returns the original result, Stripe webhook duplicate/out-of-order handling, presigned upload flow (mocked S3 via minio container).
- Vendor boundaries are faked at the adapter interface — never `nock`-ing vendor URLs deep in tests.

## E2E: the four canonical journeys

1. **Engineer**: login → create project → upload CAD fixture → conversion (fake provider) completes → publish.
2. **Customer design**: open project → walkthrough → place 3 items + floor finish → price HUD matches server → save → submit.
3. **Consultant**: review queue → comment on an item → approve → quotation PDF exists with correct total.
4. **Order**: customer accepts quote → Stripe test checkout → webhook → order PAID → visible in admin.

These four ARE the product. They run on every merge to main and before every release; a red journey blocks release, no exceptions.

## 3D testing (pragmatic, not dogmatic)

- **Scene-state assertions over pixels** wherever possible: drive the editor via UI, then assert on the Zustand store / saved scene JSON (item count, transforms, price). Deterministic and fast.
- **Screenshot tests** for a small set (empty shell, furnished fixture room, selection outline) with a perceptual diff threshold (~1.5%) — WebGL rendering varies across GPUs, so these run on a pinned CI runner with software rendering (SwiftShader) for stability.
- **Perf smoke**: scripted scene with 150 items must hold ≥ 30 fps median over 10 s on the CI baseline; regression fails the PR that caused it.
- Unit-test placement math (snapping, AABB collision, raycast targets) in `three-kit` without a browser — pure functions by design.

## AI testing

- **Fixture tests (every PR)**: recorded assistant conversations replayed against the tool-calling harness with a mocked model client; assert tool-call arguments, that every referenced `variantId` exists, and that responses parse.
- **Nightly live evals (small, budgeted)**: ~20 prompts against the real model; grade grounding + refusal behavior; alert on regression. Prompt-template changes require this green.
- Image-gen: contract tests on the adapter (sizes, count, cost accounting); quality is reviewed by humans in discovery/staging, not asserted in CI.

## Flake policy

A flaky test is quarantined (skipped with an issue) within one day and fixed or deleted within one week. A quarantine list longer than 5 entries blocks new feature merges — flakes are treated as outages of the safety system.

## What we deliberately don't test

- Vendor SDK internals; visual pixel-perfection of marketing pages; Next.js/Prisma framework behavior; generated code. Snapshot tests of large React trees are banned (noise, not signal).
