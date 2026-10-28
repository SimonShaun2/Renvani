# FS-76 — Secrets & environment variable inventory

**Ticket:** [FS-76](https://app.notion.com/p/401317b92d1581c49195d4cff55672fe) (Pair 5 — Ezra / env inventory)  
**Companion:** `FS-76-secret-owner-map.md` (Hana), `FS-76-secret-rotation-runbook.md` (Hana)  
**Schema authority:** `packages/config/src/env.ts` — **names only; never values.**

Re-run after schema changes:

```bash
pnpm check:env-docs
```

## Classification

| Class | Description |
| --- | --- |
| **secret** | Credential or signing key; never log at info+; rotate on exposure |
| **config** | Non-secret tunable (ports, TTLs, fee percent) |
| **public** | May appear in browser bundles (`NEXT_PUBLIC_*`) |
| **web-server** | Next.js server-only; not in Zod schema |

## Per-service minimum (target injection)

| Runtime | Required at startup today | Notes |
| --- | --- | --- |
| **api** | Full `@fsm/config` schema | Stripe, auth, email/SMS, R2, queues |
| **webhook** | Full schema | Stripe + Twilio verify; DB/Redis |
| **worker** | Full schema | Monolithic Zod today; notifications import `apps/api/dist/lib/email.js` / `sms.js` |
| **web** | `NEXT_PUBLIC_API_URL`; optional `API_URL` | `publicEnv` only from `@fsm/config` |
| **migrations** | `DATABASE_URL` (+ full schema if `env` loads) | `packages/db/drizzle.config.ts` |

Templates: `docs/env/templates/`. Least-privilege target matrix: § below.

## Shared schema (`@fsm/config`)

| Variable | Class | Default | Primary consumers |
| --- | --- | --- | --- |
| `NODE_ENV` | config | `development` | `apps/api`, `apps/webhook` (log level) |
| `API_PORT` | config | `3001` | `apps/api/src/server.ts` |
| `WEBHOOK_PORT` | config | `3002` | `apps/webhook/src/server.ts` |
| `DATABASE_URL` | secret | — | `packages/db/src/client.ts`; all `@fsm/db` users |
| `REDIS_URL` | secret | — | `packages/jobs/src/connection.ts` |
| `STRIPE_SECRET_KEY` | secret | — | `apps/api/src/lib/stripe.ts`; webhook Stripe middleware |
| `STRIPE_WEBHOOK_SECRET` | secret | — | `apps/webhook/src/middleware/stripe-verify.ts` |
| `STRIPE_CONNECT_CLIENT_ID` | secret | — | Schema + test fixtures; no app read site yet |
| `STRIPE_PLATFORM_FEE_PERCENT` | config | — | Legacy, required by `env.ts`; read only by `resolveConnectApplicationFeeFraction` (no customer-facing use; Service Fee = `SERVICE_FEE_RATE_BPS`) |
| `OPENAI_API_KEY` | secret | — | `packages/ai`; worker `csv-import`, `ai-revenue` |
| `TWILIO_ACCOUNT_SID` | secret | — | `apps/api/src/lib/sms.ts`; worker via API dist SMS |
| `TWILIO_AUTH_TOKEN` | secret | — | `sms.ts`, `twilio-verify.ts` |
| `TWILIO_FROM_NUMBER` | config | — | SMS send + inbound routing check |
| `SENDGRID_API_KEY` | secret | — | `apps/api/src/lib/email.ts`; worker notifications |
| `SENDGRID_FROM_EMAIL` | config | — | Email from-address |
| `R2_ACCOUNT_ID` | config | — | `packages/config/src/storage.ts` |
| `R2_ACCESS_KEY_ID` | secret | — | storage adapter |
| `R2_SECRET_ACCESS_KEY` | secret | — | storage adapter |
| `R2_BUCKET_NAME` | config | — | storage adapter |
| `APP_URL` | config | — | Auth links, Stripe URLs, worker deep links |
| `JWT_SECRET` | secret | — | `apps/api/src/lib/tokens.ts` |
| `JWT_REFRESH_SECRET` | secret | — | `tokens.ts` |
| `BOOKING_HOLD_TOKEN_SECRET` | secret | — | `booking-hold-token.ts` (public holds; not session JWT) |
| `ACCESS_TOKEN_TTL_SECONDS` | config | — | `auth.service.ts`, `tokens.ts` |
| `REFRESH_TOKEN_TTL_SECONDS` | config | — | `auth.service.ts`, `tokens.ts` |
| `RESET_TOKEN_TTL_SECONDS` | config | — | `tokens.ts` |
| `ESTIMATE_EXPIRY_DAYS` | config | `30` | `estimate.service.ts` |
| `INVOICE_DUE_DAYS` | config | `30` | `invoice.service.ts` |
| `NEXT_PUBLIC_API_URL` | public | `http://localhost:3001` | `apps/web` via `publicEnv` |

## Web-only (not in `env.ts`)

| Variable | Class | Consumers |
| --- | --- | --- |
| `API_URL` | web-server | `apps/web/next.config.ts`, `public-api.ts` |

## Least-privilege matrix (staging ≠ production secrets)

| Variable | API | Webhook | Worker | Web | Staging vs prod |
| --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | R | R | R | — | Distinct DB per env |
| `REDIS_URL` | R | R | R | — | Distinct instance |
| `JWT_*` / `BOOKING_HOLD_TOKEN_SECRET` | R | — | —¹ | — | Distinct per env |
| `STRIPE_*` | R | R² | —¹ | — | Test vs live keys |
| `OPENAI_API_KEY` | O⁴ | — | O⁴ | — | Separate keys recommended |
| `TWILIO_*` | O⁴ | O³⁴ | O¹⁴ | — | Staging subaccount/test |
| `SENDGRID_*` | O⁴ | — | O¹⁴ | — | Per-env API keys |
| `R2_*` | R | — | R | — | Separate buckets |
| `NEXT_PUBLIC_API_URL` | — | — | — | R | Public URL per env |

¹ Worker still loads full schema today (technical debt).  
² Webhook: verify + `TWILIO_AUTH_TOKEN`; no outbound SMS.  
³ Inbound signature only.  
⁴ Optional (non-core): services boot without it and the feature is disabled. OpenAI unset → AI calls fail fast with `OPENAI_NOT_CONFIGURED` (import mapping falls back to presets; campaign drafting returns 409). Twilio is all-or-none (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`); unset → `/twilio` webhook returns 503 and never trusts a signature. SendGrid: `SENDGRID_FROM_EMAIL` is required only when `SENDGRID_API_KEY` is set. Core stays required: `DATABASE_URL`, `REDIS_URL`, `STRIPE_*`.

## FS-93 Option A — per-host injection (approved)

Documented deployment split: [PRODUCTION-DEPLOYMENT.md](../planning/PRODUCTION-DEPLOYMENT.md). Values are injected manually via host consoles until automated sync exists; **no live wiring in FS-76.**

| Surface | Host | Variables (representative) |
| --- | --- | --- |
| `apps/web` | **Vercel** | `NEXT_PUBLIC_API_URL`, `API_URL` |
| `apps/api` | **Railway** | Full schema — `docs/env/templates/api.env.example` |
| `apps/worker` | **Railway** | Full schema — `docs/env/templates/worker.env.example` |
| `apps/webhook` | **Railway** | `docs/env/templates/webhook.env.example` |
| Postgres | **Railway** | `DATABASE_URL` on DB-connected services |
| Redis | **Railway** | `REDIS_URL` on API, worker, webhook |
| R2 | **Cloudflare** | `R2_*` on API + worker |

## Deployment doc drift

`docs/planning/PRODUCTION-DEPLOYMENT.md` may list keys not in `env.ts` (`CORS_ORIGINS`, VAPID, PostHog, etc.). `check:env-docs` warns; reconcile under FS-93.

## Client bundle

Only `NEXT_PUBLIC_API_URL` is in the public schema. No signing secrets in `apps/web` client bundles.
