# 03 — API Design

NestJS REST API + one WebSocket gateway. OpenAPI spec generated from decorators (`@nestjs/swagger`) and published at `/docs` in non-prod environments; the frontend consumes generated types from it.

## Conventions

| Topic | Rule |
|---|---|
| Base path | `/v1` — breaking changes require `/v2`, additive changes don't |
| Resources | Plural kebab-case nouns: `/cad-files`, `/design-versions` |
| IDs | Opaque cuid strings in paths |
| Bodies | JSON, `camelCase`. Validated with zod schemas from `packages/shared` via a `ZodValidationPipe` — the same schemas the frontend uses. One schema, both sides |
| Timestamps | ISO 8601 UTC strings |
| Money | `{ amountCents: number, currency: string }` objects — never bare numbers |
| Pagination | Cursor-based: `?cursor=<id>&limit=50` → `{ items, nextCursor }`. No offset pagination |
| Filtering | Whitelisted query params per endpoint; no generic query language |
| Partial update | `PATCH` with explicit field allowlists; no JSON-Patch |
| Idempotency | Mutating endpoints that can be retried (payments, order creation, job enqueue) accept an `Idempotency-Key` header, stored 24 h in Redis |
| Correlation | Every request gets/propagates `x-request-id`; it appears in all logs and error responses |

## Error envelope

RFC 7807-style, always this shape:

```json
{
  "type": "https://errors.platform.dev/design-version-locked",
  "title": "Design version is not editable",
  "status": 409,
  "detail": "Version dv_123 has status SUBMITTED and cannot be modified.",
  "requestId": "req_8f3a...",
  "errors": [{ "path": "sceneJson.rooms.r1.items[2].variantId", "message": "Unknown variant" }]
}
```

- 4xx = caller's problem, with actionable `detail`. 5xx = ours, with no internals leaked.
- Domain violations use specific `type` slugs; the frontend maps them to UX, never string-matches `detail`.

## Auth

- Clerk issues the session JWT; the web app sends it as `Authorization: Bearer`.
- `ClerkAuthGuard` verifies the token (JWKS, cached) and loads/creates the local `User` by `clerkId`.
- `@Roles('CONSULTANT', 'ADMIN')` guard for role gates; `ProjectAccessGuard` resolves `projectId` from the route and checks `ProjectMember`.
- Workers and webhooks do not use user auth: Stripe/APS webhooks are signature-verified ([10](10-security.md)); internal worker calls go through the DB/queue, not HTTP.

## Module and endpoint map

One NestJS module per domain. Controllers are thin; all logic in services; all cross-module calls go through services (never another module's repository).

### `projects`
```
GET    /v1/projects                     list (scoped to membership)
POST   /v1/projects                     create                      [ENGINEER, ADMIN]
GET    /v1/projects/:id
PATCH  /v1/projects/:id                 name/status                 [OWNER]
POST   /v1/projects/:id/members         invite                      [OWNER, ADMIN]
```

### `cad-files` & `conversions`
```
POST   /v1/projects/:id/cad-files            register upload → presigned URL
POST   /v1/cad-files/:id/complete            confirm upload, enqueue conversion
GET    /v1/cad-files/:id/conversions         conversion status + progress
POST   /v1/conversions/:id/retry             re-enqueue failed job    [ENGINEER, ADMIN]
GET    /v1/conversions/:id/model             signed GET URLs for GLB + metadata
```

### `catalog`
```
GET    /v1/catalog/products                  search: ?category=&style=&q=&cursor=
GET    /v1/catalog/variants/:id              variant + assets (signed asset URLs)
POST   /v1/catalog/products                  [ADMIN] — full CRUD under /v1/catalog/**
POST   /v1/catalog/import                    [ADMIN] CSV import job
```

### `designs` & `design-versions`
```
POST   /v1/projects/:id/designs              create design
GET    /v1/designs/:id/versions              list versions
POST   /v1/designs/:id/versions              new draft (optionally from=versionId)
GET    /v1/design-versions/:id               includes sceneJson
PUT    /v1/design-versions/:id/scene         save scene (DRAFT only) → returns server-priced totals
POST   /v1/design-versions/:id/submit        DRAFT → SUBMITTED
POST   /v1/design-versions/:id/price         compute price without saving (editor reconcile)
GET    /v1/design-versions/:id/diff/:otherId compare two versions (item-level diff)
```

### `review` (consultant)
```
GET    /v1/review/queue                      submitted versions awaiting review [CONSULTANT]
POST   /v1/design-versions/:id/comments      add comment (room/item pinned)
POST   /v1/design-versions/:id/request-changes  → CHANGES_REQUESTED
POST   /v1/design-versions/:id/approve       → APPROVED, creates quotation (transactional)
```

### `ai`
```
POST   /v1/ai/style-concepts                 {versionId, roomId, style} → job id (Track A)
GET    /v1/ai/generations/:id                status + signed image URLs
POST   /v1/ai/assistant/messages             design assistant chat (SSE streamed response)
GET    /v1/ai/suggestions                    catalog suggestions for room+style (Track B)
```

### `quotations`, `orders`, `payments`
```
GET    /v1/quotations/:id                    lines + totals + PDF URL
POST   /v1/quotations/:id/accept             customer accepts → creates Order
POST   /v1/orders/:id/checkout               → Stripe Checkout session URL
POST   /v1/webhooks/stripe                   signature-verified, idempotent
GET    /v1/orders/:id                        status timeline
```

## State machines (enforced in services, not controllers)

```
DesignVersion: DRAFT → SUBMITTED → IN_REVIEW → { APPROVED | CHANGES_REQUESTED | REJECTED }
               CHANGES_REQUESTED → (new DRAFT version created from it)
Quotation:     ISSUED → { ACCEPTED | EXPIRED | CANCELLED }
Order:         PENDING_PAYMENT → PAID → IN_FULFILLMENT → COMPLETED
```

Illegal transitions return `409` with a typed error. Transitions write `AuditEvent` rows in the same transaction.

## WebSocket gateway

Socket.io namespace `/rt`, Clerk-token authenticated on connect, rooms per resource:

| Room | Events |
|---|---|
| `project:{id}` | `conversion.progress`, `conversion.completed`, `conversion.failed` |
| `version:{id}` | `comment.created`, `version.statusChanged` |
| `ai:{generationId}` | `generation.progress`, `generation.completed` |

Rules: WebSocket is **notify-only** — payloads carry ids and status, never full documents; clients refetch via REST. This keeps authorization in one place and payloads trivially safe. Presence/co-editing is out of MVP scope.

## Background jobs (BullMQ queues)

| Queue | Jobs | Retry policy |
|---|---|---|
| `cad` | `cad.convert`, `cad.extractMetadata` | 3 attempts, exp backoff, DLQ |
| `ai` | `ai.styleConcept` | 2 attempts (paid API calls — don't hammer) |
| `render` | `render.thumbnail`, `render.quotationPdf` | 5 attempts |
| `notify` | `notify.email` | 5 attempts |

Every job payload is a zod-validated type in `packages/shared/jobs.ts`. Jobs are idempotent: processors check current DB state before acting and use natural keys (`ModelConversion` unique constraint, `Idempotency-Key`) to dedupe.

## Rate limiting

`@nestjs/throttler` backed by Redis: default 100 req/min per user; `POST /v1/ai/**` 10 req/min per user (paid vendor calls); auth-less webhook endpoints bypass throttler but verify signatures.
