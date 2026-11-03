# Environment boundary matrix

**FS-75** · Updated for [official stack](../../OFFICIAL-OPERATIONAL-STACK.md) · Neon + Render + Vercel (STACK-11).

## Deployment tiers

| Tier | `RENVANI_DEPLOYMENT_TIER` | Purpose | Customer data | Money & messaging |
|------|---------------------------|---------|---------------|-------------------|
| Local development | `development` (default if unset) | Engineer laptops | Synthetic / disposable | Test keys or mocks |
| Persistent staging | `staging` | Integrated validation, QA smoke | **Synthetic only** — no prod copy | **Non-live** integrations only |
| Production | `production` | Live operators | Real tenant data | Live integrations — **founder-authorized** only |

`NODE_ENV` remains the Node runtime mode (`development` | `test` | `production`). Staging hosts typically run `NODE_ENV=production` with `RENVANI_DEPLOYMENT_TIER=staging` so behavior matches production builds without using production credentials.

## Matrix: isolation by resource

| Dimension | Development | Staging | Production |
|-----------|-------------|---------|------------|
| `DATABASE_URL` | Local or disposable | **Neon staging branch**; never prod; optional **per-PR** Neon branch in CI | **Neon prod** branch |
| `REDIS_URL` | Local or disposable | **Unique** URL | Prod URL |
| `R2_BUCKET_NAME` (or equivalent) | Dev bucket | **Staging-only** bucket | Prod bucket |
| JWT / refresh secrets | Local | **Rotate independently** | Prod secrets |
| Stripe secret key | `sk_test_*` | `sk_test_*` only | `sk_live_*` (founder gate) |
| Stripe webhook secret | Test endpoint | Staging endpoint + test secret | Live endpoint |
| Twilio / SendGrid | Test or disabled | Sandbox / capture | Live send (policy) |
| `APP_URL` / public URLs | localhost | `https://staging-*` hosts | Production hosts |
| Network access to data plane | Open locally | Restricted to operators/CI | Restricted + audited |
| Backups | Optional | **Required** before staging stores durable data | Required + tested restore |

## Matrix: service × credential scope (least privilege)

| Service | Needs `DATABASE_URL` | Needs `REDIS_URL` | Stripe secret | Twilio | SendGrid | R2 write | OpenAI |
|---------|---------------------|-------------------|---------------|--------|----------|----------|--------|
| `web` | No | No | No* | No | No | No | No |
| `api` | Yes | Yes (enqueue) | Yes | Yes | Yes | Yes | Yes |
| `webhook` | Yes | Yes | Yes | Yes | No | No | No |
| `worker` | Yes | Yes | Optional | Yes | Yes | Yes | Yes |

\* Web may use publishable Stripe keys in UI only when payment surfaces exist; never `sk_*` on web.

## Cross-environment prohibitions (all tiers)

1. No production database URL in non-production tiers.
2. No `sk_live_` or live webhook secrets outside production.
3. No copy of production tenant rows into staging without a dedicated, reviewed migration procedure (out of FS-75 scope).
4. Secrets never committed to git, logs, traces, or AI prompts.

## Enforcement in repo (this slice)

- Template: `config/env/staging.env.example`
- Validator: `@fsm/config/deployment-environment` + `scripts/staging/validate-env-boundaries.mjs`
- Full `env.ts` optional-field split for partial stacks: **FS-76 / env controls ticket** — not required to merge FS-75 doc slice.

## FS-93 / ADR-FS-STACK gate

[ADR-FS-93](../../adr/ADR-FS-93-managed-platform-boundaries.md) is **Accepted** for Render compute, Vercel web, Render Key Value (BullMQ), and R2. [ADR-FS-STACK](../../adr/ADR-FS-STACK-renvani-official-platform.md) **partially supersedes** FS-93 for **PostgreSQL → Neon** and **staff identity → Clerk** (JWT remains in parallel until STACK-02 cutover).

This matrix therefore **may name** those official providers in row labels and notes (Neon, Render, Vercel, R2, Clerk) — as this document already does for staging tiers.

**Still out of scope for doc commits (founder / STACK provisioning):** live **project IDs**, **branch names**, **service IDs**, **DNS hostnames**, **IaC module paths**, and any **secret or connection string value**. Templates (`config/env/staging.env.example`, validators) stay placeholder-only with no real credentials.
