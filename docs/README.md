# Engineering Documentation — Interior Design Visualization & Quotation Platform

This folder is the single source of truth for how we design, build, and operate the platform.
Every engineer joining the project reads these documents in order before writing code.

## Reading order

| # | Document | What it covers | Read when |
|---|----------|----------------|-----------|
| 00 | [Project Brief](00-project-brief.md) | Vision, users, scope, glossary, success criteria | Day 1 |
| 01 | [Architecture](01-architecture.md) | System components, monorepo layout, key flows, principles | Day 1 |
| 02 | [Data Model](02-data-model.md) | Full database schema, versioning model, money rules | Before backend work |
| 03 | [API Design](03-api-design.md) | REST conventions, endpoint map, auth, errors, realtime | Before backend work |
| 04 | [CAD & 3D Pipeline](04-cad-3d-pipeline.md) | APS/Speckle integration, glTF asset pipeline, R3F scene architecture | Before 3D work |
| 05 | [AI Integration](05-ai-integration.md) | Two-track AI design, image generation, Claude assistant, cost control | Before AI work |
| 06 | [Third-Party Services](06-third-party-services.md) | Every vendor: setup, implementation, gotchas, fallbacks | Before integration work |
| 07 | [Coding Guidelines](07-coding-guidelines.md) | TypeScript/React/NestJS standards, R3F rules, review checklist | Day 1 |
| 08 | [Development Workflow](08-development-workflow.md) | Local setup, git, CI/CD, environments, secrets, releases | Day 1 |
| 09 | [Testing Strategy](09-testing-strategy.md) | Test pyramid, BOM golden tests, 3D visual regression, E2E | Before first PR |
| 10 | [Security](10-security.md) | RBAC matrix, upload safety, payments, data protection | Before auth/payment work |
| 11 | [Performance & Observability](11-performance-observability.md) | Perf budgets, 3D optimization playbook, logging, alerts | Before Phase 2 |
| 12 | [Development Plan](12-development-plan.md) | Phase-by-phase epics, acceptance criteria, risks, milestones | Sprint planning |
| — | [adr/](adr/README.md) | Architecture Decision Records — why we chose what we chose | When questioning a decision |

## Ground rules for these docs

1. **Docs are code.** They live in the repo, change through PRs, and reviewers check that a change to behavior updates the matching doc.
2. **Decisions get an ADR.** Any choice that would be expensive to reverse (database, vendor, data model, protocol) is recorded in `adr/` with context and alternatives. Don't relitigate decisions in Slack — read the ADR, and if reality changed, write a superseding one.
3. **The data model doc wins.** If code and `02-data-model.md` disagree, one of them is a bug — fix whichever is wrong in the same PR.
4. **Discovery updates these docs.** Several decisions are marked **`DECIDE-IN-DISCOVERY`** — they depend on the client's real CAD files and product catalog. Phase 0 resolves each one and updates the affected docs and ADRs.

## Stack summary (details in 01 and 06)

| Layer | Choice |
|---|---|
| Monorepo | Turborepo + pnpm |
| Frontend | Next.js (App Router) + React + Tailwind + shadcn/ui |
| 3D | Three.js + React Three Fiber + drei |
| Backend | NestJS + Prisma + PostgreSQL 16 |
| Queue / jobs | BullMQ + Redis |
| Storage | Cloudflare R2 (S3-compatible) |
| CAD/BIM | Autodesk APS (primary candidate) / Speckle — `DECIDE-IN-DISCOVERY` |
| AI — assistant | Claude API (`claude-opus-5`) |
| AI — image generation | Provider-agnostic adapter (OpenAI Images / Gemini) |
| Auth | Clerk |
| Payments | Stripe |
| Web hosting | Vercel (web) + Railway (API & workers) for MVP |
