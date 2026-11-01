# ADR-002: Prisma as the ORM

- Status: Accepted
- Date: 2026-08-07
- Deciders: Tech lead, backend engineer

## Context

PostgreSQL is fixed ([01](../01-architecture.md)). We need migrations-as-code, strong TypeScript types, and good NestJS ergonomics. The schema is relational and moderately complex (≈ 20 tables) with a few JSONB documents (scene, transforms).

## Options considered

1. **Prisma** — schema-first, generated types, mature migration tooling, first-class JSONB. Cons: query builder limits for exotic SQL (escape hatch: `$queryRaw`), engine binary weight.
2. **TypeORM** — long NestJS association, but weaker type inference and a history of migration foot-guns.
3. **Drizzle** — excellent types and SQL-closeness; younger migration story and fewer team-familiarity hours at decision time.
4. **Knex/raw SQL + kysely** — maximal control, highest ongoing discipline cost for a small team.

## Decision

Prisma. Migration safety and generated types across a 20-table schema matter more to this project than exotic query power; the few complex queries (catalog search, diff) fit `$queryRaw` with tagged templates.

## Consequences

- Easier: schema evolution (expand-contract), onboarding, type-safe includes.
- Harder: very dynamic queries; N+1 risk if `include` discipline slips (covered in [07](../07-coding-guidelines.md) and review checklist).
- Watch: engine cold-start size on the worker image; revisit only if measurable.
