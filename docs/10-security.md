# 10 — Security

Scope: MVP for a single client organization, handling personal data (names, emails, addresses), commercial data (catalog pricing, quotations), and payments (delegated to Stripe). No card data ever touches our systems (SAQ-A).

## Threat model (abridged)

| Threat | Vector | Primary control |
|---|---|---|
| Cross-tenant/project data access | IDOR on ids | `ProjectAccessGuard` on every project-scoped route; integration tests per role |
| Privilege escalation | Role checks client-side only | All RBAC server-side; client role checks are UX sugar only |
| Malicious file upload | CAD/GLB uploads | Type/size allowlist, presigned direct-to-R2, files never executed/parsed in API process, conversion in isolated workers |
| Payment manipulation | Forged webhooks, replay | Stripe signature verification + event dedup + state-machine guard; order totals come from the quotation, never the client |
| Quotation tampering | Editing approved data | Immutability of non-DRAFT versions + frozen quotation lines + audit log |
| Secret leakage | Repo, logs, client bundles | Secret manager, log scrubbing, `NEXT_PUBLIC_` review in CI |
| Prompt injection (assistant) | User content in prompts | Assistant is read-only (no mutating tools); tool outputs are data, not instructions; catalog grounding checked server-side |

## RBAC matrix (enforced by guards; integration-tested)

| Resource / action | ENGINEER | CUSTOMER | CONSULTANT | ADMIN |
|---|---|---|---|---|
| Project create / publish | ✅ | — | — | ✅ |
| CAD upload / reconvert | ✅ (member) | — | — | ✅ |
| View project 3D | ✅ (member) | ✅ (member) | ✅ | ✅ |
| Edit design version (DRAFT) | — | ✅ (own) | ✅ (in review) | ✅ |
| Submit version | — | ✅ (own) | — | — |
| Comment | — | ✅ (member) | ✅ | ✅ |
| Approve / request changes | — | — | ✅ | ✅ |
| View quotation | — | ✅ (own project) | ✅ | ✅ |
| Accept quote / pay | — | ✅ (own) | — | — |
| Catalog CRUD / import | — | — | — | ✅ |
| User management | — | — | — | ✅ |
| Audit log read | — | — | — | ✅ |

"member" = row in `ProjectMember`. Rule of thumb in code review: any new endpoint without both a role gate and (if project-scoped) a membership gate is a blocking finding.

## File upload safety

1. API validates declared type/size against allowlists (CAD: rvt/ifc/dwg/dxf ≤ 2 GB; assets: glb ≤ 200 MB; images ≤ 20 MB) before issuing a presigned URL — the URL constrains content-length and content-type.
2. After upload, the worker verifies magic bytes match the declared format and recomputes the checksum before any processing.
3. CAD parsing happens only inside vendor services (APS/Speckle) or isolated worker containers — never in the API process.
4. Serving: all user content via signed URLs from private buckets; catalog assets via CDN with content-hashed immutable keys; nothing user-uploaded is ever served with an executable or HTML content type.

## Payments

- Stripe Checkout only; our DB stores intent/session ids and webhook payloads, no PAN data.
- The **webhook is the single writer** of payment success. UI "success" pages are cosmetic until the webhook lands.
- Amount charged is read from the accepted `Quotation` server-side at session creation; any client-supplied amount is ignored by design.
- Refunds are admin-initiated in Stripe dashboard for MVP, reconciled by webhook.

## Data protection

- TLS everywhere (platform-managed). Postgres and R2 encrypted at rest (provider-managed).
- PII inventory: `User(name,email)`, project addresses, quotation PDFs. All exportable/deletable per user on request — deletion anonymizes `User` and severs memberships while preserving financial records (legal retention).
- Backups: PG point-in-time recovery, 30-day window; quarterly restore drill (a backup that's never been restored doesn't exist).
- Logs: no request bodies with PII at info level; Sentry `beforeSend` scrubs emails/tokens; retention 90 days.

## Application hardening checklist

- [ ] Helmet-equivalent headers on web (CSP with explicit script/img/connect sources incl. R2/CDN; frame-ancestors none)
- [ ] CORS: API allows only known web origins per environment
- [ ] Rate limiting per [03](03-api-design.md); login/brute-force handled by Clerk
- [ ] Prisma parameterization everywhere (no raw SQL without review; `$queryRaw` requires tagged templates)
- [ ] Dependency scanning: `pnpm audit` + Renovate weekly; critical CVEs patched < 72 h
- [ ] Secret scanning in CI (gitleaks); a leaked secret means rotate, not delete-the-commit
- [ ] `NEXT_PUBLIC_` env diff reviewed in every PR that touches env files
- [ ] Admin endpoints additionally require role ADMIN at the router group level (defense in depth)

## Audit & incident basics

- `AuditEvent` on all money-adjacent and permission-adjacent mutations (see [02](02-data-model.md)), immutable, admin-readable.
- Incident rule of thumb for MVP team size: detect (Sentry/alerts) → contain (flag off / key rotate) → notify client owner same business day → postmortem doc in `docs/incidents/` within a week.
