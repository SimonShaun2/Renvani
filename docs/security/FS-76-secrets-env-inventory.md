# FS-76 — Secrets & environment variable inventory

**Ticket:** [FS-76](https://app.notion.com/p/401317b92d1581c49195d4cff55672fe) (Pair 5 — Ezra / env inventory)  
**Companion:** `FS-76-secret-owner-map.md` (Hana), `FS-76-secret-rotation-runbook.md` (Hana)  
**Schema authority:** `packages/config/src/env-schema.ts`; service picks in `runtime-env.ts` — **names only; never values.**

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
| **api** | Core + `APP_URL`, auth signing keys/TTLs, `STRIPE_SECRET_KEY`, SendGrid key/from | Payment view separately requires platform fee; enabled adapters validate own fields |
| **webhook** | Core + `APP_URL`, Stripe secret/signing and inbound Twilio verification | No outbound email/AI/R2 keys |
| **worker** | Core + `APP_URL` | Sender settings optional; AI/R2 adapter keys validated when enabled; no Stripe/session keys |
| **web** | Public `NEXT_PUBLIC_API_URL`; server `APP_URL` | Server `API_URL` resolves in a `server-only` module; no secret in client bundle |
| **migrations** | `DATABASE_URL` | Database scope only |

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
| `STRIPE_PLATFORM_FEE_PERCENT` | config | — | Required in the payment view; read by `resolveConnectApplicationFeeFraction` (customer Service Fee remains `SERVICE_FEE_RATE_BPS`) |
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

## Web-only (outside the canonical schema)

| Variable | Class | Consumers |
| --- | --- | --- |
| `API_URL` | web-server | `apps/web/next.config.ts`, `public-api-server.ts` (`server-only`) |

## Least-privilege matrix (staging ≠ production secrets)

| Variable | API | Webhook | Worker | Web | Staging vs prod |
| --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | R | R | R | — | Distinct DB per env |
| `REDIS_URL` | R | R | R | — | Distinct instance |
| `JWT_*` / `BOOKING_HOLD_TOKEN_SECRET` | R | — | — | — | Distinct signing keys per env |
| `STRIPE_SECRET_KEY` | R | R | — | — | Test key in staging; API boot is eager |
| `STRIPE_WEBHOOK_SECRET` | — | R | — | — | Exact test endpoint signing secret |
| `STRIPE_PLATFORM_FEE_PERCENT` | Payment view | — | — | — | Required numeric policy field |
| `OPENAI_API_KEY` | — | — | Conditional AI adapter | — | No worker boot requirement |
| `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | Conditional outbound adapter | R | Sender only | — | Webhook inbound signature and number |
| `SENDGRID_API_KEY` / `SENDGRID_FROM_EMAIL` | R | — | Conditional sender | — | API boot required; worker sender optional |
| `R2_*` | Conditional storage adapter | — | Conditional storage adapter | — | Separate bucket/keys when R2 enabled |
| `NEXT_PUBLIC_API_URL` | — | — | — | R | Public URL per env |
| `CLERK_SECRET_KEY` | Optional Clerk path | — | — | Optional server-only path | Development instance for tester tier |

## Official stack — per-host injection

The [official stack](../OFFICIAL-OPERATIONAL-STACK.md) uses Vercel, Render, Neon, Render Key Value, Clerk and R2. Values are injected through approved host settings; **no host mutation in this local FS-76 slice.**

| Surface | Host | Variables (representative) |
| --- | --- | --- |
| `apps/web` | **Vercel** | Public `NEXT_PUBLIC_API_URL`; server `API_URL`/`APP_URL`; conditional Clerk |
| `apps/api` | **Render** | Scoped API boot and enabled adapters — `docs/env/templates/api.env.example` |
| `apps/worker` | **Render** | Scoped worker boot and enabled adapters — `docs/env/templates/worker.env.example` |
| `apps/webhook` | **Render** | Inbound verification view — `docs/env/templates/webhook.env.example` |
| Postgres | **Neon** | `DATABASE_URL` for data-plane services |
| Queues/cache | **Render Key Value** | `REDIS_URL` for API, worker and webhook |
| Identity | **Clerk development instance** | Tester-only keys on enabled paths |
| R2 | **Cloudflare** | `R2_*` on enabled storage adapters |

## Deployment doc drift

`docs/planning/PRODUCTION-DEPLOYMENT.md` is historical and may list keys not in `env-schema.ts` (`CORS_ORIGINS`, VAPID, PostHog, etc.). Reconcile under FS-93; do not use it as current host injection instruction.

## Client bundle

Only `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` are in the browser runtime view. No signing secrets in `apps/web` client bundles.
