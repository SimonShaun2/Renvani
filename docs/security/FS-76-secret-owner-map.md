# FS-76 — Secret & credential owner map

**Ticket:** [FS-76](https://app.notion.com/p/401317b92d1581c49195d4cff55672fe) (Pair 5 — Infrastructure)  
**Status:** Local FS-76 runtime-boundary implementation; staging rotation/revocation evidence remains gated. No credential values.
**Base branch:** `dev`  
**Companion:** `FS-76-secrets-env-inventory.md` (Diego — env inventory), `FS-76-secret-rotation-runbook.md` (Hana — rotation)

## Ownership model (normative for v1)

| Role | Responsibility |
| --- | --- |
| **Shaun** | **Sole owner** of all **production** integration credentials and platform admin access (Stripe, Twilio, SendGrid, OpenAI, Cloudflare R2, Render/Vercel/Neon hosting, database superuser, Render Key Value, JWT signing secrets in prod). Creates, stores, rotates, and revokes prod secrets. |
| **Pair 5 (Diego + Hana)** | Maintain **inventory**, injection paths, and **runbooks**; coordinate **non-production** rotation drills; never create or rotate **production** secrets without Shaun + FS-93 + Security approval. |
| **Security** | Review least-privilege, exposure response, and sign-off on rotation evidence in staging. |
| **E.. CoS (PM)** | Merge approval to `dev`; no secret custody. |

Engineering agents and CI **must not** hold long-lived production secrets in chat, artifacts, or git.

## Credential classes by integration

Names match the canonical `env-schema.ts` and scoped views in `packages/config/src/runtime-env.ts`. **Values are never documented here.** A listed adapter credential is not automatically injected into every service.

| Class | Env var names (secret or signing) | Primary consumer(s) | Prod owner | Notes |
| --- | --- | --- | --- | --- |
| **Database** | `DATABASE_URL` | `apps/api`, `apps/worker`, `apps/webhook`, `packages/db` | Shaun | Connection string; least-privilege DB user per environment. |
| **Cache / queues** | `REDIS_URL` | `apps/api`, `apps/worker`, BullMQ | Shaun | |
| **Payments** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_CLIENT_ID` | API payment adapter; webhook verification endpoint | Shaun | API boot requires the secret key. Webhook signing secret belongs only in webhook. Connect ID is conditional. |
| **Payments (config)** | `STRIPE_PLATFORM_FEE_PERCENT` | API / billing | Shaun (policy) | Non-secret numeric; still environment-specific. |
| **AI** | `OPENAI_API_KEY` | Enabled worker AI adapter | Shaun | Validate on use; outside worker boot view. |
| **SMS** | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Webhook verification; enabled outbound SMS adapter | Shaun | Webhook boot view needs token and sender number; account SID is conditional. |
| **Email** | `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` | API boot/email; worker notifications when enabled | Shaun | API view requires both; worker sender fields are conditional. |
| **Object storage** | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` | Enabled import/upload adapters | Shaun | Storage view validates R2 fields when R2 is enabled. Access key pair is secret. |
| **Auth / session** | `JWT_SECRET`, `JWT_REFRESH_SECRET` | `apps/api` auth | Shaun | Rotation invalidates active sessions — planned window required. |
| **Auth / public holds** | `BOOKING_HOLD_TOKEN_SECRET` | `apps/api` booking holds | Shaun | Distinct from session JWT; rotate on API only. |
| **Auth (TTL)** | `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_SECONDS`, `RESET_TOKEN_TTL_SECONDS` | API auth | Engineering (config) | Not secrets; document per environment. |
| **App URLs** | `APP_URL`, `NEXT_PUBLIC_API_URL`, `API_URL` (web server only) | Web, API links, webhook/worker links | Engineering (config) | `API_URL` resolves in a server-only web module; browser uses the public URL or same-origin. |
| **Runtime** | `NODE_ENV`, `API_PORT`, `WEBHOOK_PORT` | All Node services | Engineering (config) | |
| **Product defaults** | `ESTIMATE_EXPIRY_DAYS`, `INVOICE_DUE_DAYS` | API services | Engineering (config) | |

## FS-93 / official-stack injection model (documentation only)

**Selected:** Vercel (web), Render (API, worker, webhook and Key Value), Neon PostgreSQL, Clerk development identity in tester environments, and Cloudflare R2. See the [official stack](../OFFICIAL-OPERATIONAL-STACK.md) and [staging boundary matrix](../infrastructure/staging/environment-boundary-matrix.md). This local branch does **not** change host secrets or CI.

| Surface | Injection host | Env vars (names only) |
| --- | --- | --- |
| `apps/web` | **Vercel** project environment | Public `NEXT_PUBLIC_API_URL`; server-only `API_URL`, `APP_URL`; Clerk server key only where enabled |
| `apps/api` | **Render** service secret settings | Exact API boot view, then enabled adapters — see `docs/env/templates/api.env.example` |
| `apps/worker` | **Render** service secret settings | Core + `APP_URL`, then enabled adapters — see `docs/env/templates/worker.env.example` |
| `apps/webhook` | **Render** service secret settings | Core + inbound Stripe/Twilio verification — see `docs/env/templates/webhook.env.example` |
| PostgreSQL | **Neon** isolated branch | Scoped `DATABASE_URL` injected only into data-plane consumers |
| Queues/cache | **Render Key Value** | Scoped `REDIS_URL` injected only into queue/data-plane consumers |
| Identity | **Clerk development instance** for tester tier | Publishable key in web, server key only in enabled server path, authorized parties exact origins |
| Object storage | **Cloudflare R2** | `R2_*` only on enabled storage adapters; distinct tester bucket/credentials |

Staging and production must have isolated resources and disjoint secret values. The aggregate `config/env/staging.env.example` exists for boundary validation only; never inject it wholesale into a service.

## Environment boundaries

| Environment | Who may hold secrets | Injection (FS-93 Option A) |
| --- | --- | --- |
| **Local / preview** | Individual developer, approved CI secret injection | Local gitignored env or isolated preview settings; no prod values |
| **Staging** | Platform under target-specific authorization; Pair 5 coordinates drills | Vercel + Render tester secrets, Neon branch, Render Key Value, R2 tester keys, Clerk development instance |
| **Production** | **Shaun only** | Production host secret settings; no copies in Notion, chat, PRs or CI logs |

## Escalation

1. Suspected leak → follow `FS-76-secret-rotation-runbook.md` § Incident (Shaun executes prod revocation).
2. New integration → add row to inventory + this map before merge to `dev`.
3. FS-76 source-and-built-artifact scanner runs in the **approved batch** only after exact-head review and CI authorization; local scan is not CI evidence. Production rotation by agents remains **out of scope** without Shaun approval.
