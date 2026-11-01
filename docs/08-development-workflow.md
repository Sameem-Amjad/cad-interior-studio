# 08 — Development Workflow

## Environments

| Env | Purpose | Data | Deploy trigger |
|---|---|---|---|
| `local` | Development | Seeded fixtures | — |
| `preview` | Per-PR review apps (web on Vercel previews; API shared dev instance) | Ephemeral / dev DB | Every PR push |
| `staging` | Client demos, QA, discovery spikes with real files | Anonymized-ish, real catalog sample | Merge to `main` |
| `production` | Live | Real | Tagged release `vX.Y.Z` |

Rules: staging mirrors prod config exactly (same vendors, test-mode keys). Nobody develops against staging data. Production database access is break-glass only, logged.

## Local setup (target: productive in < 30 minutes)

```bash
git clone <repo> && cd <repo>
corepack enable && pnpm install
cp .env.example .env.local          # every var documented in the example file
docker compose up -d                # postgres:16, redis:7, minio (R2 stand-in)
pnpm db:migrate && pnpm db:seed     # demo org, users per role, 60-product catalog,
                                    # one converted sample building (GLB fixture)
pnpm dev                            # turbo: web :3000, api :4000, worker
```

- The seed includes a **pre-converted building model fixture** so 3D work never depends on APS credentials locally.
- Vendor calls in local dev hit fakes by default (`FAKE_VENDORS=true`): the CAD provider returns the fixture after a fake delay; image-gen returns placeholder images; Stripe uses test mode + `stripe listen`. Real vendor debugging is opt-in per service.

## Branching & releases

- **Trunk-based**: short-lived branches `feat/…`, `fix/…` off `main`; merge via PR with 1 approval + green CI; squash-merge with a Conventional Commit title.
- `main` is protected and always deployable. No long-lived develop branch, no release branches.
- **Release**: tag `vX.Y.Z` on main → CI deploys API/worker images + runs migrations → Vercel promotes web. Changelog generated from commits.
- **Migrations deploy before code** (expand-contract pattern from [02](02-data-model.md)); a release that can't roll back needs an explicit plan in the PR.
- **Feature flags** (simple env/DB-backed flags service, no vendor for MVP) gate anything user-visible that ships incomplete: `ai.styleConcepts`, `ai.assistant`, `payments.live`.

## CI pipeline (GitHub Actions)

```yaml
# .github/workflows/ci.yml — conceptual stages
jobs:
  quality:      # ~3 min target
    - pnpm install --frozen-lockfile
    - turbo lint typecheck            # cached per-package
  test:
    - turbo test                      # unit: vitest, affected packages only
    - api integration tests           # testcontainers: postgres + redis
  build:
    - turbo build
    - docker build api + worker (pushed on main only)
  e2e:          # on main + nightly, not every PR push
    - playwright against preview deployment
  deploy:       # main → staging; tag → production
    - run prisma migrate deploy
    - deploy images / promote web
```

Gates: PRs merge only with quality + test + build green. E2E failures on main page the team (block the next release, not the merge that's already in).

## Secrets & config

- Local: `.env.local` (gitignored). `.env.example` is the complete, documented registry of every variable — adding a var without updating it fails review.
- Hosted: platform secret managers (Vercel/Railway envs). No secrets in CI logs; CI secrets scoped per environment.
- Key rotation quarterly and on any suspicion; rotation steps documented per vendor in [06](06-third-party-services.md).

### Environment variable registry (excerpt — full list in `.env.example`)

| Var | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | api, worker | |
| `REDIS_URL` | api, worker | |
| `R2_*` | api, worker | account, keys, bucket names |
| `CLERK_SECRET_KEY` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | api / web | |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | api | |
| `APS_CLIENT_ID` / `APS_CLIENT_SECRET` | worker | |
| `ANTHROPIC_API_KEY` / `AI_ASSISTANT_MODEL` | api, worker | model defaults to `claude-opus-5` |
| `IMAGEGEN_PROVIDER` + provider key | worker | `openai` \| `gemini` |
| `FAKE_VENDORS` | all | local-only convenience |

## Definition of Done (every story)

1. Code merged to `main` behind a flag if incomplete.
2. Tests at the layer [09](09-testing-strategy.md) prescribes; CI green.
3. Docs updated (data model / API / pipeline docs for behavior changes).
4. Observable: new failure modes log structured events; new jobs report to the queue dashboard.
5. Demoable on staging with seed data — "works on my machine" is not done.
