# ADR-003: Scene stored as immutable JSONB snapshots + projection table

- Status: Accepted
- Date: 2026-08-07
- Deciders: Tech lead

## Context

A design is a document (rooms → items → transforms) edited interactively, but it must also be queryable ("which designs use variant X?"), priceable, diffable, and legally traceable once quoted. Two natural shapes collide: document (great for the editor) and normalized rows (great for queries and integrity).

## Options considered

1. **Fully normalized rows only** — editor saves become dozens of row mutations; versioning/undo requires event sourcing or copy-on-write of many rows; scene shape evolution = painful migrations.
2. **JSONB document only** — perfect editor fit, but weak integrity (dangling variantIds), poor cross-design queries, and pricing reads big blobs.
3. **JSONB snapshot as source of truth + `DesignItem` projection rebuilt on save** — document ergonomics with relational queryability; FK integrity on the projection catches dangling variants at save time.

## Decision

Option 3, with these invariants: `sceneJson` is validated against a versioned zod schema on every write; versions with status ≠ DRAFT are immutable; the projection is derived data — rebuilt, never edited; quotations are computed from the frozen snapshot.

## Consequences

- Easier: undo/versioning/compare (document diff), quotation traceability, schema evolution (`schemaVersion` + explicit migration scripts).
- Harder: the projection must never drift — rebuild is transactional with the save, and a nightly consistency check compares projections against snapshots.
- Watch: scene size (cap 2 MB; ~200 items is far below it); if concurrent multi-user editing ever lands, this ADR must be revisited (CRDT/event log).
