# 07 — Coding Guidelines

These rules exist to make the codebase boring: any engineer should be able to open any module and know where things are. Reviewers enforce this document; deviations need a comment in the PR, not silence.

## TypeScript (everywhere)

- `strict: true`, `noUncheckedIndexedAccess: true`. No `any` — use `unknown` + narrowing; a justified `any` requires an inline `// any-ok: <reason>`.
- **Validate at boundaries, trust inside.** Every external input (HTTP body, webhook, job payload, env var, file metadata) passes through a zod schema from `packages/shared`. Past the boundary, types are trusted — no defensive re-checking of internal invariants.
- Derive types from schemas (`z.infer`), never hand-write parallel interfaces.
- Env access only through a validated config module (`config.ts` with a zod schema, fail-fast at boot). No `process.env.X` in feature code.
- Prefer discriminated unions over boolean flags; prefer `readonly` arrays in public signatures.
- Errors: throw typed domain errors (`DesignVersionLockedError extends DomainError`); never throw strings; never swallow — either handle meaningfully or let it propagate to the layer that can.

## Naming & structure

| Thing | Convention |
|---|---|
| Files | `kebab-case.ts`; React components `PascalCase.tsx` |
| DB fields | `camelCase` in Prisma (maps to snake_case columns via `@map` only when needed) |
| Booleans | `is/has/can` prefixes |
| Functions | verb-first: `createQuotation`, `resolveRoomBounds` |
| Constants | `SCREAMING_SNAKE` only for true constants; config objects camelCase |
| Feature folders | web code grouped by feature (`features/design-studio/`), not by kind |

## Frontend (Next.js + React)

- **Server Components by default; `"use client"` only where interaction demands it.** The entire 3D studio is client-only, dynamically imported with `ssr: false`.
- Data fetching: TanStack Query against the generated API client. No hand-rolled `fetch` in components; no server data copied into local state.
- State: TanStack Query owns server state; **Zustand owns the editor scene** (single store per studio session, actions defined in the store, components never mutate state shapes directly); `useState` for trivial local UI.
- Forms: react-hook-form + the shared zod schema. The same schema the API validates with — error messages line up for free.
- Styling: Tailwind + shadcn/ui. No new component libraries; no CSS-in-JS. Design tokens in `packages/ui/tokens.ts`.
- Accessibility: every interactive 3D action has a non-3D equivalent (item list panel with the same add/remove/select operations); keyboard navigation in all panels; this is reviewed, not aspirational.

### R3F-specific rules (these prevent the classic 3D-app failures)

1. **No `setState` in `useFrame`.** Per-frame values go to refs / direct object mutation; React re-renders are for scene-document changes only.
2. Register GLTF/KTX2/meshopt loaders once at studio mount; always `useGLTF.preload` for the catalog panel's visible page.
3. Dispose on unmount: geometries, materials, textures, render targets. `three-kit` exports `useDisposable` — use it.
4. Repeated variants render through instancing (`<Instances>`); adding the 20th identical chair must not add 20 draw calls.
5. Raycasting uses explicit layers (floor / walls / items); never raycast the whole scene per pointer-move.
6. Suspense boundaries around every async 3D subtree with meaningful fallbacks (room skeleton, not a spinner over black).
7. All world units meters, Y-up, radians — the same convention as assets and scene JSON. Conversions happen only at import boundaries.

## Backend (NestJS)

- One module per domain (`projects`, `catalog`, `designs`, `review`, `quotations`, `orders`, `ai`, `cad`). A module exposes its **service**; other modules import the module, never reach into its repositories or Prisma models directly.
- Controllers: routing, guards, DTO validation, mapping to service calls — **nothing else**. If a controller has an `if` about business state, it's in the wrong layer.
- Services own transactions: `prisma.$transaction` at the service method level; state transitions + audit rows in the same transaction.
- The quotation engine (`packages/quotation`) stays pure: `(scene, catalogPrices, taxContext) → QuotationDraft`. No DB, no clock, no randomness — inputs in, deterministic output. This is what makes golden-file testing possible.
- Logging: pino via Nest logger; structured (`logger.info({ orderId, event: 'order.paid' })`), never string interpolation of objects; no `console.log` in committed code.
- Never return Prisma entities from controllers — map to response DTOs (prevents accidental field leaks when the schema grows).

## Comments & docs

Comment the *why* and the invariant, not the *what*:

```ts
// Prices are frozen onto lines here; catalog edits after approval must not
// change an issued quotation (see docs/02-data-model.md — Freezing rule).
```

No commented-out code in main. TODOs carry an owner and issue: `// TODO(#142, sameem): ...`.

## Git & PRs

- Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`); scope by module: `feat(quotation): area-based pricing for flooring`.
- PRs ≤ ~400 changed lines where feasible; one logical change per PR; description states *what + why + how verified*.
- **Review checklist** (reviewer confirms, author pre-checks):
  - [ ] Boundary inputs zod-validated; no `any` without `any-ok`
  - [ ] Money as integer minor units + currency; pricing changes covered by golden tests
  - [ ] State transitions legal + audited; authorization guard present on new endpoints
  - [ ] Async work in workers, not handlers; jobs idempotent
  - [ ] 3D: disposal, instancing, no per-frame setState
  - [ ] Docs updated when behavior/schema changed (02/03/04 especially)
  - [ ] Tests: new logic tested at the right layer ([09](09-testing-strategy.md))

## Tooling (single source in `packages/config`)

- ESLint (typescript-eslint strict + react-hooks + eslint-plugin-react-three-fiber rules where applicable), Prettier (no debates: default config + 100-col width), import sorting enforced.
- `pnpm lint && pnpm typecheck && pnpm test` must pass locally before push; CI repeats them ([08](08-development-workflow.md)).
- Husky pre-commit: lint-staged (eslint --fix + prettier) only — fast; the heavy gates live in CI.
