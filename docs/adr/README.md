# Architecture Decision Records

An ADR captures one significant, hard-to-reverse decision: the context, the options considered, the choice, and its consequences. ADRs are immutable once accepted — changing course means a new ADR that supersedes the old one.

## When to write one

Database/vendor/protocol choices, data-model invariants, anything a future engineer would ask "why on earth did they…" about. Small reversible choices don't need one.

## Template

```markdown
# ADR-NNN: Title
- Status: Proposed | Accepted | Superseded by ADR-XXX
- Date: YYYY-MM-DD
- Deciders: names

## Context
What forces are at play; what problem this solves.

## Options considered
Honest pros/cons of each, including the one not chosen.

## Decision
What we chose and the decisive reason.

## Consequences
What becomes easier, what becomes harder, what we must watch.
```

## Index

| ADR | Title | Status |
|---|---|---|
| [001](001-monorepo-turborepo.md) | Turborepo monorepo with pnpm | Accepted |
| [002](002-prisma-orm.md) | Prisma as the ORM | Accepted |
| [003](003-design-scene-storage.md) | Scene = immutable JSONB + projection table | Accepted |
| [004](004-cad-platform-aps-vs-speckle.md) | CAD platform: APS vs Speckle | **Proposed — decide in discovery** |
| [005](005-building-shell-rendering.md) | Building shell rendering strategy | **Proposed — decide in discovery** |
| [006](006-clerk-auth.md) | Clerk for authentication | Accepted |
