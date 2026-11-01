# ADR-006: Clerk for authentication

- Status: Accepted
- Date: 2026-08-07
- Deciders: Tech lead

## Context

Four roles, invited-user model (no open sign-up), sessions across a Next.js app and a NestJS API, MVP timeline. Auth is undifferentiated heavy lifting with catastrophic failure modes — a textbook "buy".

## Options considered

1. **Clerk** — managed identity, polished Next.js SDK, JWT verification on any backend via JWKS, org/invitation primitives. Cons: MAU pricing, vendor dependency for login availability.
2. **Auth.js (NextAuth)** — free, self-owned; but session handling across a separate NestJS API, invitation flows, and account security features (device management, bot protection) become our code and our pager.
3. **Keycloak (self-hosted)** — full control, heavyweight ops burden completely out of proportion for a single-org MVP.

## Decision

Clerk, with one structural safeguard: **our `User` table is the authority for roles and all business data; Clerk holds identity only** (see [02](../02-data-model.md), [06](../06-third-party-services.md)). The API trusts Clerk JWTs solely to establish *who*, never *what they may do*.

## Consequences

- Easier: secure sessions, invitations, SSO later, zero password-storage liability.
- Harder: local/E2E testing needs Clerk test instances or its testing tokens (documented in [08](../08-development-workflow.md)); MAU costs at scale.
- Exit path: because roles/memberships live in our DB and users are keyed by email + `clerkId`, migrating to Auth.js is a bounded identity-swap, not a data-model rewrite.
