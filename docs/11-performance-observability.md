# 11 — Performance & Observability

## Performance budgets (regressions fail the causing PR)

| Metric | Budget | Measured by |
|---|---|---|
| Web LCP (non-3D pages) | < 2.5 s p75 | Vercel analytics / Lighthouse CI |
| Studio: shell visible | < 5 s on 20 Mbps, mid-laptop | Playwright perf smoke |
| Studio: furnished room interactive | < 8 s | Playwright perf smoke |
| Editor frame rate | ≥ 30 fps median, 150-item scene (60 target) | CI perf smoke + in-app FPS telemetry p50/p95 |
| Draw calls (furnished room) | < 300 | dev overlay + CI assertion |
| GPU texture memory | < 768 MB active room | dev overlay |
| Building shell GLB | < 25 MB compressed | asset pipeline gate |
| Catalog item GLB (LOD0) | < 3 MB compressed | asset pipeline gate |
| API p95 (CRUD) | < 300 ms | metrics dashboard |
| Scene save (validate+project+price) | < 800 ms p95 for 200-item scene | integration test timing |
| CAD conversion | < 15 min typical; progress events ≥ every 30 s | job metrics |
| Quotation generation (approve → lines committed) | < 5 s | job metrics |

## 3D performance playbook (apply in this order)

1. **Cut draw calls first**: instancing for repeated variants, merged static shell geometry, material sharing across variants of the same product family.
2. **Compress everything**: meshopt on geometry, KTX2/Basis on textures (GPU stays compressed — the biggest memory lever), DRACO only for network-bound huge meshes.
3. **LOD + room scoping**: active room LOD0, adjacent LOD1, others unloaded. Camera-distance LOD switch via drei `<Detailed>`.
4. **Lighting is baked/cheap**: one directional + ambient/hemisphere + a light-probe environment; no dynamic shadows from every lamp — a single soft contact-shadow rig. "Lighting presets" swap IBL/exposure, not add lights.
5. **Frustum + occlusion sanity**: rely on Three frustum culling (don't defeat it with giant merged furniture buffers per floor); shell split per room/level.
6. **Never resize the canvas on state change**; `dpr` capped at 2; `powerPreference: "high-performance"`.
7. Measure before optimizing further: `r3f-perf` in dev, `renderer.info` snapshots in telemetry.

## Backend performance

- **N+1 discipline**: list endpoints use explicit `include`/`select`; PR review flags any loop-with-query. `prisma-query-log` sampled in staging.
- Indexes reviewed with every migration ([02](02-data-model.md) carries `@@index` as part of the schema, not an afterthought). Slow-query log threshold 200 ms in staging.
- **Caching**: catalog reads (hot path for the editor) cached in Redis 60 s with explicit invalidation on admin writes; signed URL generation batched.
- Queue isolation: `cad` conversions can't starve `render` PDFs — separate queues, separate worker concurrency budgets.
- Payload discipline: scene JSON is the only big body (cap 2 MB); everything else paginated.

## Observability

### Errors — Sentry
Web (`@sentry/nextjs`) + API/worker (`@sentry/node`), release-tagged with git SHA, environment-tagged. `x-request-id` attached to every event. PII scrubbing in `beforeSend`.

### Logs — pino (structured JSON)
One line per request (`method, path, status, durationMs, userId, requestId`) + domain events (`design.submitted`, `quotation.issued`, `order.paid`, `conversion.failed`). Shipped to the platform log store; searchable by `requestId` end-to-end (web → api → job).

### Metrics (prom-client → dashboard)
| Metric | Alert threshold |
|---|---|
| `http_request_duration` p95 per route | > 2× budget for 10 min |
| `queue_depth` / `job_duration` per queue | depth > 50 for 15 min |
| `conversion_success_rate` | < 90% daily |
| `payment_webhook_lag` | > 5 min |
| `ai_spend_cents_daily` (per provider) | > daily budget (page immediately) |
| `editor_fps_p50` (client telemetry) | < 30 for a device-class cohort |

### Health & uptime
`/healthz` (process) and `/readyz` (DB+Redis ping) on API and worker; external uptime check on web + API; alerting to the team channel. On-call is informal for MVP: the release owner watches dashboards for 24 h post-release.

### Client telemetry (minimal, consent-respecting)
Studio sends anonymous perf beacons (fps p50/p95, load times, device class) and funnel events (design started/saved/submitted). No session replay in MVP. This is what tells us whether the 3D budgets hold on real hardware — treat it as an engineering tool, not marketing analytics.

## Cost observability (easy to forget, expensive to ignore)

Per-unit costs are recorded at the source: APS translation cost on `ModelConversion`, AI cost on `AiGeneration`/assistant messages, R2 storage by bucket in a weekly job. One dashboard: **cost per project onboarded** and **cost per design session** — these two numbers decide the pricing model at scale.
