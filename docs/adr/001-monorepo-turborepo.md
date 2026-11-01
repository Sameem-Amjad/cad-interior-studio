# ADR-001: Turborepo monorepo with pnpm

- Status: Accepted
- Date: 2026-08-07
- Deciders: Tech lead

## Context

The product spans a Next.js web app, a NestJS API, BullMQ workers, and several shared libraries — most critically a pricing engine that must run identically in the browser (live price HUD) and on the server (quotation of record). Type and schema drift between frontend and backend is the classic failure mode of split repos.

## Options considered

1. **Separate repos (web/api)** — clear ownership boundaries, but shared types require publishing packages; the isomorphic pricing engine becomes a versioning headache; cross-cutting changes need coordinated PRs.
2. **Nx monorepo** — powerful, but heavier mental model and configuration surface than the team needs.
3. **Turborepo + pnpm workspaces** — thin layer over standard package.json workspaces; remote caching; trivial to eject.

## Decision

Option 3. The decisive factor is the isomorphic `packages/quotation` and shared zod schemas: one repo makes "one schema, both sides" enforceable in a single PR and testable in one CI run.

## Consequences

- Easier: atomic cross-stack changes, shared config, single CI, the golden rule that scene schema + pricing logic exist exactly once.
- Harder: repo-wide tooling discipline needed (turbo cache correctness, no cross-package deep imports — enforced by eslint boundaries).
- Watch: CI time as the repo grows — mitigate with turbo remote cache and affected-only test runs.
