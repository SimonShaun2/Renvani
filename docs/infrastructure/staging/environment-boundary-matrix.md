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
| `worker` | Yes | Yes | No | Sender only | When email is enabled | When storage is enabled | When AI is enabled |

\* Web may use publishable Stripe keys in UI only when payment surfaces exist; never `sk_*` on web.

## Cross-environment prohibitions (all tiers)

1. No production database URL in non-production tiers.
2. No `sk_live_` or live webhook secrets outside production.
3. No copy of production tenant rows into staging without a dedicated, reviewed migration procedure (out of FS-75 scope).
4. Secrets never committed to git, logs, traces, or AI prompts.

## FS-76 runtime permission boundary

| Runtime view | Required at startup | Denied from parsed view | Conditional adapter fields |
|--------------|---------------------|-------------------------|----------------------------|
| `core` (DB and Redis) | Database and Redis URLs | Payment, messaging, AI, object-storage keys | None |
| `webhook` (Render) | Core, Stripe test signing/verification, Twilio verification, application URL | SendGrid, OpenAI, R2 and Clerk secrets | No outbound messaging key |
| `worker` (Render) | Core and application URL | Stripe secret, Clerk secret and webhook signing secrets | Email, SMS sender, R2 and AI validated at use |
| `web-server` (Vercel) | Application and public API URLs | Stripe secret, database, Redis, Twilio, SendGrid, OpenAI and R2 | Clerk server key when auth is enabled |
| `browser` (Vercel bundle) | Public API URL | **Every secret** | Publishable Stripe key only |
| `api` (Render) | Core, application URL and auth signing keys | No browser exposure | Provider keys validated by enabled adapters |

The typed views in `@fsm/config/runtime-env` pick from the canonical schema and return only their listed fields. Missing/invalid field errors name fields, not values. `@fsm/db` and `@fsm/jobs` consume the core view so a worker or webhook cannot acquire broad API credentials through those packages. The FS-76 approved batch hook scans tracked source and generated server/client artifacts with a pinned local ruleset and synthetic canary; it emits path and rule names only.

## Enforcement in repo (this slice)

- Template: `config/env/staging.env.example`
- Validator: `@fsm/config/deployment-environment` + `scripts/staging/validate-env-boundaries.mjs`
- Runtime-specific environment views and secret scanner: **FS-76 / env controls ticket**. Until its reviewed head merges, these are local implementation evidence, not a deployed staging claim.

## FS-93 / ADR-FS-STACK gate

[ADR-FS-93](../../adr/ADR-FS-93-managed-platform-boundaries.md) is **Accepted** for Render compute, Vercel web, Render Key Value (BullMQ), and R2. [ADR-FS-STACK](../../adr/ADR-FS-STACK-renvani-official-platform.md) **partially supersedes** FS-93 for **PostgreSQL → Neon** and **staff identity → Clerk** (JWT remains in parallel until STACK-02 cutover).

This matrix therefore **may name** those official providers in row labels and notes (Neon, Render, Vercel, R2, Clerk) — as this document already does for staging tiers.

**Still out of scope for doc commits (founder / STACK provisioning):** live **project IDs**, **branch names**, **service IDs**, **DNS hostnames**, **IaC module paths**, and any **secret or connection string value**. Templates (`config/env/staging.env.example`, validators) stay placeholder-only with no real credentials.
