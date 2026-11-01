# 06 — Third-Party Services

Every external dependency: why we use it, how to set it up, how it's wired in, and what to do when it misbehaves. **Adapter rule from [01](01-architecture.md):** vendor SDK imports are confined to the adapter/module that owns the vendor; business logic sees our interfaces only.

## Overview

| Service | Purpose | Pricing shape | Criticality | Fallback |
|---|---|---|---|---|
| Autodesk APS | CAD translation, (optionally) viewer | Flex tokens per translation | High (Path A) | Speckle (Path B) |
| Speckle | Open-source BIM exchange | Free self-host / cloud tiers | Alt to APS | APS |
| Clerk | Auth, sessions, orgs | MAU-based | High | Auth.js migration path (own `User` table keeps us portable) |
| Stripe | Checkout, payments, invoices | % + fixed per transaction | High | None needed (industry standard) |
| Cloudflare R2 | Object storage + CDN | Storage + ops, zero egress fees | High | Any S3-compatible (adapter uses S3 API) |
| Claude API | Design assistant, suggestion re-rank | Per-token | Medium (degrade gracefully) | Feature-flag off; app fully usable without |
| OpenAI Images / Gemini | Style concepts | Per-image | Medium | Swap via `ImageGenProvider`; feature-flag off |
| Resend | Transactional email | Per-email | Medium | Any SMTP provider |
| Sentry | Error tracking (web+api) | Event volume | Medium | — |
| Railway / Vercel | Hosting (MVP) | Usage | High | Dockerized services → any host |

## Autodesk APS

- **Setup**: APS account → app of type "Server-to-Server" → `APS_CLIENT_ID`/`APS_CLIENT_SECRET`. Buy Flex tokens; enable Model Derivative + Data Management APIs.
- **Implementation**: `apps/worker/src/cad/providers/aps.provider.ts` implements `CadConversionProvider { upload, translate, getStatus, downloadDerivative, extractMetadata }`. Full flow in [04](04-cad-3d-pipeline.md).
- **Env**: `APS_CLIENT_ID`, `APS_CLIENT_SECRET`, `APS_BUCKET_PREFIX`.
- **Gotchas**: token endpoint rate limits (cache the token); bucket keys are global-per-app (prefix with env); URNs must be base64-url-encoded; per-derivative failures hide inside a `success` manifest; **cost per translation must be logged** — finance will ask.
- **Terms check (discovery)**: confirm current APS terms for serving extracted derivatives (OBJ/glTF) from our own storage to end users. This gates ADR-005.

## Speckle

- **Setup**: start with Speckle-hosted workspace; self-host (Docker) only if data-residency or cost demands it. Personal-access token for the server integration.
- **Implementation**: same `CadConversionProvider` interface; ingestion via stream webhooks + GraphQL; engineers need connectors installed (document a one-page setup guide for the client's engineers — this is an adoption cost, price it in).
- **Env**: `SPECKLE_SERVER_URL`, `SPECKLE_TOKEN`.

## Clerk

- **Setup**: Clerk app per environment; enable email+password and Google SSO; disable public sign-up in prod (users are invited by ADMIN).
- **Implementation**: `@clerk/nextjs` middleware on the web; on the API a `ClerkAuthGuard` verifies JWTs against JWKS (cached 24 h). A Clerk webhook (`user.created/updated/deleted`) syncs to our `User` table — **our table is the authority for roles**, Clerk only for identity.
- **Env**: `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SECRET`.
- **Gotcha**: never store role/business data only in Clerk metadata — it must live in our DB or RBAC becomes untestable.

## Stripe

- **Setup**: Standard account; API keys + one webhook endpoint per environment (`checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`).
- **Implementation**: Stripe Checkout (hosted page) — we never touch card data (SAQ-A scope). `orders/:id/checkout` creates a Checkout Session with `client_reference_id = orderId` and an idempotency key; the webhook handler is the **only** code path that marks orders paid. Signature verified with `stripe.webhooks.constructEvent`; events deduped by `event.id` in the `Payment.providerRef`/processed-events table.
- **Env**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- **Gotchas**: webhooks arrive out of order and duplicated — handlers must be idempotent and state-machine-guarded; test with `stripe listen` locally; amounts are minor units (matches our money rules).

## Cloudflare R2

- **Buckets**: `cad-{env}` (versioning ON, private), `assets-{env}` (catalog GLBs/textures, behind CDN, immutable content-hashed keys), `renders-{env}` (AI images, thumbnails, quotation PDFs, private + signed URLs).
- **Implementation**: `StorageService` wraps `@aws-sdk/client-s3` (R2 is S3-compatible). Uploads from browsers use presigned PUT URLs (15 min TTL) issued by the API after validating type/size. Downloads of private objects use presigned GET (5 min TTL).
- **Env**: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_*`.

## Claude API (Anthropic)

- **Setup**: Anthropic org with 30-day retention default; API key per environment, scoped workspace.
- **Implementation**: [05-ai-integration.md](05-ai-integration.md). Official `@anthropic-ai/sdk`; model id from config (`AI_ASSISTANT_MODEL=claude-opus-5`); streaming SSE pass-through to the client; prompt caching on the frozen system prompt; typed error handling; per-message token/cost logging.
- **Env**: `ANTHROPIC_API_KEY`, `AI_ASSISTANT_MODEL`.
- **Gotcha**: rate limits are per-model buckets — size for launch traffic; the assistant must degrade to "temporarily unavailable" without blocking any design/quote flow.

## Image generation (OpenAI Images / Google Gemini)

- **Implementation**: behind `ImageGenProvider` ([05](05-ai-integration.md)); provider chosen by env (`IMAGEGEN_PROVIDER=openai|gemini`). Run the discovery spike on identical room renders through both and pick on quality of *architecture preservation*, not general prettiness.
- **Env**: `OPENAI_API_KEY` / `GOOGLE_AI_API_KEY`.
- **Gotcha**: image endpoints have low default rate limits and multi-second latency — always behind the queue, never in a request handler.

## Asset licensing

This is a legal dependency, treated like a service:

- Marketplace models (TurboSquid, CGTrader, Sketchfab) come with licenses that commonly **prohibit redistribution in interactive apps** or require extended licenses. Every purchased asset needs the license PDF archived and `ProductAsset.licensedFrom` filled.
- Preferred order: (1) manufacturer-provided models for the client's actual products, (2) commissioned models for signature items, (3) extended-licensed marketplace assets for generic filler, (4) Poly Haven (CC0) for props.
- **No AI-generated 3D assets in the sellable catalog** — quality and licensing are both unresolved.

## Resend / Sentry / hosting

- **Resend**: `notify.email` worker jobs; React Email templates in `apps/worker/src/email/`; env `RESEND_API_KEY`. Domain SPF/DKIM before launch.
- **Sentry**: `@sentry/nextjs` + `@sentry/node`; release tagging from git SHA; PII scrubbing on (see [11](11-performance-observability.md)).
- **Hosting (MVP)**: web on Vercel; API + worker + Postgres + Redis on Railway. Both API and worker ship as Docker images from CI so the exit path to AWS/GCP is `docker run`, not a rewrite.

## Vendor-risk rules

1. New vendor ⇒ new ADR + adapter interface + this doc updated.
2. Any vendor whose outage would block **quote-to-order** gets a documented degradation mode (AI features: flag off; APS: queue and retry; Stripe: no degradation — surface loudly).
3. Keys live in the platform secret manager, never in repo or `.env` committed files; rotation quarterly ([10](10-security.md)).
