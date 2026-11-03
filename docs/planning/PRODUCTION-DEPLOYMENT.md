# ServiceRev — Production Deployment

**Version:** v3.1.0 (Render reconciliation — docs only; aligns with FS-93 / ADR-FS-93 on PR #59)  
**Repo:** SimonShaun2/Renvani (formerly FSM-Platform)  
**Platform decision:** Vercel (web) + Render (API, worker, webhook, Postgres, Key Value) + Cloudflare R2 + in-repo JWT. Key Value **`maxmemoryPolicy: noeviction`** required for BullMQ.

---

## Infrastructure Overview

| Layer | Service | Plan |
|---|---|---|
| Frontend | Vercel | Pro (needed for team + custom domain) |
| API | Render **web service** (`apps/api`) | Starter → scale as needed |
| Worker | Render **background worker** (`apps/worker`) | Same Blueprint / project as API |
| Webhook | Render **web service** (`apps/webhook`) | Stripe + Twilio ingress |
| Database | Render Postgres | Starter → upgrade as needed |
| Queues | Render **Key Value** (Redis-compatible) | Starter+; **`noeviction`** policy |
| File Storage | Cloudflare R2 | Pay as you go |
| Email | SendGrid | Essentials (40K/mo free) |
| SMS | Twilio | Pay as you go |
| Payments | Stripe Connect | Platform account (already set up) |
| Domain | Cloudflare DNS | servicerev.app |

**Total estimated monthly cost at launch:** ~$50–120/mo  
(Render web + worker + webhook + Postgres + Key Value + Vercel Pro + R2 ~$0–5 + Twilio/SendGrid usage)

**Reference runbook (FS-93, PR #59):** `docs/platform/FS-93-render-runbook.md` and `docs/infrastructure/render-blueprint.render.yaml` (blueprint not applied until founder authorizes staging).

---

## Step 1: Render Setup

### Create Render workspace / Blueprint (when authorized)

1. Go to [render.com](https://render.com) → Dashboard (founder-owned account).
2. **Option A — Blueprint:** Import repo and use `render.yaml` from a reviewed platform PR (draft reference: `docs/infrastructure/render-blueprint.render.yaml`). Approve resource list; set `sync: false` secrets in the dashboard.
3. **Option B — Manual:** Create services below in one project/region.

### Add Postgres

Render Dashboard → **New** → **PostgreSQL**

- Name: `renvani-postgres` (or per blueprint)
- Note **Internal Database URL** → `DATABASE_URL`
- Run migrations after first API deploy (Step 6)

### Add Key Value (BullMQ)

Render Dashboard → **New** → **Key Value**

- Name: `renvani-bullmq-kv`
- **Maxmemory policy:** `noeviction` (required for job queues — do not use default `allkeys-lru`)
- **Inbound IP rules:** internal only (`ipAllowList: []` in blueprint) unless you have a documented need for public Redis
- Note **Internal Redis URL** → `REDIS_URL`

### Add API web service

Render Dashboard → **New** → **Web Service** → connect GitHub repo `SimonShaun2/Renvani`

| Setting | Value |
|---|---|
| Root directory | Repository root (monorepo) |
| Build command | `corepack enable && corepack pnpm install --frozen-lockfile && corepack pnpm build` |
| Start command | `corepack pnpm --filter @fsm/api start` |
| Health check path | `/health` (FS-79 **liveness**; use `/health/ready` for readiness probes when supported) |

**Render `PORT` → `API_PORT`:** Render injects `PORT` on web services. `@fsm/config` validates **`API_PORT`**, not `PORT` (`apps/api/src/server.ts` listens on `env.API_PORT`). On the API service set **`API_PORT` to the same value as `PORT`** (Render Dashboard: set `API_PORT` from the `PORT` env var reference, or use a start wrapper that exports `API_PORT=$PORT` before `pnpm --filter @fsm/api start`).

### Add background worker

Render Dashboard → **New** → **Background Worker** (same repo)

| Setting | Value |
|---|---|
| Build command | Same as API |
| Start command | `corepack pnpm --filter @fsm/worker start` |

No HTTP health check. Scale on queue depth.

### Add webhook web service

Render Dashboard → **New** → **Web Service** (same repo)

| Setting | Value |
|---|---|
| Build command | Same as API |
| Start command | `corepack pnpm --filter @fsm/webhook start` |

Routes: `POST /stripe`, `POST /twilio` (see `apps/webhook`). Assign a public URL (e.g. `webhooks.servicerev.app`).

**Render `PORT` → `WEBHOOK_PORT`:** Same pattern as the API — set **`WEBHOOK_PORT` to match Render `PORT`** (`apps/webhook` listens on `env.WEBHOOK_PORT`). `@fsm/config` still requires **`API_PORT`** on the webhook service (use any valid port number, e.g. `3001`; it is unused for HTTP on this service).

### Environment variables (API + Worker + Webhook)

Set in Render → each service → **Environment**.

**Source of truth:** `packages/config/src/env.ts` (and `.env.example`). Any service that imports `@fsm/config` (API, worker, webhook) must satisfy this schema at boot.

#### A. `@fsm/config` — required on API, worker, and webhook

```
NODE_ENV=production

# Ports (see PORT mapping above on web services)
API_PORT=10000                    # API: same as Render PORT
WEBHOOK_PORT=10000                # Webhook only: same as Render PORT

DATABASE_URL=postgresql://...     # Render Postgres — internal URL
REDIS_URL=redis://...             # Render Key Value — internal URL

APP_URL=https://app.servicerev.app

JWT_SECRET=<openssl rand -hex 64>
JWT_REFRESH_SECRET=<openssl rand -hex 64>
BOOKING_HOLD_TOKEN_SECRET=<openssl rand -hex 64>

ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_SECONDS=2592000
RESET_TOKEN_TTL_SECONDS=3600

ESTIMATE_EXPIRY_DAYS=30           # optional; default 30 in env.ts
INVOICE_DUE_DAYS=30               # optional; default 30 in env.ts

STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_CLIENT_ID=ca_...
# Legacy, no longer customer-facing; the customer Service Fee is SERVICE_FEE_RATE_BPS (2%) in @fsm/config/stripe-pricing
STRIPE_PLATFORM_FEE_PERCENT=0.02

OPENAI_API_KEY=sk-...

TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...

SENDGRID_API_KEY=SG....
SENDGRID_FROM_EMAIL=noreply@servicerev.app

R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=servicerev-production

NEXT_PUBLIC_API_URL=https://api.servicerev.app
```

Worker: set the same block (including `API_PORT`; worker does not bind HTTP but env validation still runs). Webhook: full block plus `WEBHOOK_PORT` mapped from `PORT`.

#### B. Not in `env.ts` — scope labels (do not assume `@fsm/config` reads these)

| Variable | Where set | Scope |
| --- | --- | --- |
| `API_URL` | **Vercel** (optional) | Server-side Next.js origin for `/api/v1/public/*` rewrites (`apps/web/next.config.ts`). Defaults to `NEXT_PUBLIC_API_URL`. Not required on Render API. |
| `CORS_ORIGINS` | **Render API** (when implemented) | Fastify CORS allowlist for browser calls to the API — production config / TICKET-039; **not** in `env.ts` today. Example: `https://servicerev.app,https://app.servicerev.app` |

#### C. Vercel-only (see Step 2)

`NEXT_PUBLIC_*` keys for the browser; must stay consistent with `NEXT_PUBLIC_API_URL` above.

### Generate secrets (run once locally)

```bash
openssl rand -hex 64   # JWT_SECRET, JWT_REFRESH_SECRET, BOOKING_HOLD_TOKEN_SECRET (separate values)
```

---

## Step 2: Vercel Setup

### Create Vercel project

1. Go to vercel.com → New Project → Import Git Repository
2. Repo: `SimonShaun2/Renvani`
3. Framework: Next.js
4. Root directory: `apps/web`
5. Build command: `pnpm --filter @fsm/web build`
6. Output directory: `.next`
7. Install command: `pnpm install`

### Environment variables (Vercel)

Set in Vercel → Project → Settings → Environment Variables:

```
# API
NEXT_PUBLIC_API_URL=https://api.servicerev.app
NEXT_PUBLIC_APP_URL=https://app.servicerev.app

# Auth
NEXT_PUBLIC_JWT_STORAGE_KEY=servicerev_token

# Booking
NEXT_PUBLIC_BOOKING_BASE_URL=https://servicerev.app

# Push notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<same as above — PUBLIC key only>

# Stripe (public key only)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Analytics (add later)
# NEXT_PUBLIC_POSTHOG_KEY=...
```

### Vercel domains

In Vercel → Project → Domains:

- Add `servicerev.app` → landing page (root `/`)
- Add `app.servicerev.app` → the app (all authenticated routes)

The monorepo has one Next.js app. Use Vercel's domain-based routing
or middleware to handle `servicerev.app` → landing, `app.servicerev.app` → app.

---

## Step 3: Cloudflare R2 Setup

1. Cloudflare Dashboard → R2 → Create Bucket
2. Name: `servicerev-production`
3. Region: Auto
4. Create API token with R2 Read+Write permissions
5. Keep the bucket **private** (no public access / no open listing). Tenant objects are read through the API (authorization + signed URLs or server-mediated download) — see `packages/config/src/storage.ts`. A custom domain such as `files.servicerev.app` is optional **controlled delivery** (CDN in front of authorized objects), not a publicly writable bucket.
6. CORS on the bucket (if browser uploads hit R2 directly in a future flow) — today restrict origins to production web apps:

```json
[
  {
    "AllowedOrigins": ["https://servicerev.app", "https://app.servicerev.app"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## Step 4: Domain Setup (Cloudflare DNS)

All DNS managed in Cloudflare. Set these records:

```
Type    Name                    Value                       Proxy
A       servicerev.app          76.76.21.21 (Vercel)        ✅ Proxied
CNAME   app                     cname.vercel-dns.com        ✅ Proxied
CNAME   api                     [Render API service host]   ✅ Proxied
CNAME   webhooks                [Render webhook service host] ✅ Proxied
CNAME   files                   [optional CDN / custom domain for authorized object delivery] ✅ Proxied
```

### Email sending (SendGrid)

Add these DNS records for SendGrid domain verification:

```
CNAME   em1234.servicerev.app   u1234.wl.sendgrid.net
CNAME   s1._domainkey           s1.domainkey.u1234.wl.sendgrid.net
CNAME   s2._domainkey           s2.domainkey.u1234.wl.sendgrid.net
TXT     servicerev.app          v=spf1 include:sendgrid.net ~all
```

(SendGrid provides exact values in their dashboard)

---

## Step 5: Stripe Webhook Setup

In Stripe Dashboard → Developers → Webhooks → Add endpoint:

- Endpoint URL: `https://webhooks.servicerev.app/stripe` (dedicated webhook service — `apps/webhook`)
- Events to listen to:

  ```
  payment_intent.succeeded
  payment_intent.payment_failed
  customer.subscription.created
  customer.subscription.updated
  customer.subscription.deleted
  invoice.paid
  invoice.payment_failed
  account.updated  (for Connect)
  ```

- Copy the webhook signing secret → add to `STRIPE_WEBHOOK_SECRET` on the **webhook** Render service (and API if shared handlers require it)

Twilio inbound SMS: configure Twilio webhook URL to `https://webhooks.servicerev.app/twilio`.

---

## Step 6: Database Migration (Production)

After the Render API service deploys for the first time:

```bash
# Option A: Render Shell (one-off) on API service
# Dashboard → renvani-api → Shell
corepack pnpm --filter @fsm/db db:migrate

# Option B: Add to API start script (runs on every deploy)
# In apps/api/package.json start script:
# "start": "node -e \"require('./dist/migrate').default()\" && node dist/server.js"
```

**Recommended:** Add a `migrate` script that runs Drizzle migrations before
the server starts. This ensures migrations run on every deploy automatically.

---

## Step 7: Production Config Changes

These code changes must be made before deploying:

### 7a. API: Trust Render proxy headers

`apps/api/src/app.ts`

```typescript
// Add to Fastify options:
trustProxy: true,
```

### 7b. API: FS-79 liveness and readiness

Implement per **FS-79** (do not use ad-hoc `/health/db`):

| Probe | Path | Purpose |
| --- | --- | --- |
| **Liveness** | `GET /health` | Process up; use for Render health check path |
| **Readiness** | `GET /health/ready` | Dependencies ready (e.g. Postgres + Redis); use for deploy gates and uptime monitors |

Contract and handler behavior live in the FS-79 ticket/PR — this runbook only names the paths operators should curl after deploy.

### 7c. Worker: Graceful shutdown

`apps/worker/src/index.ts`

```typescript
process.on('SIGTERM', async () => {
  await worker.close();
  await redisConnection.quit();
  process.exit(0);
});
```

### 7d. Next.js: Add domain config

`apps/web/next.config.ts`

```typescript
const nextConfig = {
  images: {
    domains: ['files.servicerev.app'],
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Cache-Control', value: 'no-cache' },
        ],
      },
    ];
  },
};
```

### 7e. CORS: Production origins (adjunct env — not `env.ts`)

When Fastify CORS is wired (TICKET-039 / production config PR), set **`CORS_ORIGINS`** on the **Render API service only** to comma-separated production web origins. This variable is **not** validated by `@fsm/config` today.

### 7f. Run migrations automatically on deploy

`apps/api/src/server.ts`

```typescript
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from '@fsm/db';

// Before starting server:
await migrate(db, { migrationsFolder: '../../packages/db/migrations' });
```

---

## Step 8: Deploy Sequence

Run in this order:

```bash
# 1. Make production config changes (Step 7)
git add .
git commit -m "chore: production config for deployment"
git push origin main

# 2. Render auto-deploys API, worker, and webhook from connected branch

# 3. Vercel auto-deploys web from main branch

# 4. FS-79 liveness
curl -sf https://api.servicerev.app/health

# 5. FS-79 readiness (Postgres + Redis)
curl -sf https://api.servicerev.app/health/ready

# 6. Test auth flow end to end
# Create test company → login → verify JWT → check dashboard loads

# 7. Test booking flow end to end
# Visit https://servicerev.app/book/test-company
# Submit booking → verify it lands in dispatch queue

# 8. Test Stripe webhook
# Stripe Dashboard → Webhooks → Send test event
# Verify it processes without error in Render webhook service logs
```

---

## Step 9: Go-Live Checklist

Complete every item before sending real traffic:

### Security

- [ ] `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `BOOKING_HOLD_TOKEN_SECRET` are independent 64+ hex secrets
- [ ] STRIPE_SECRET_KEY is `sk_live_` (not `sk_test_`)
- [ ] Stripe webhook secret is from the live webhook endpoint
- [ ] `CORS_ORIGINS` (API adjunct) only includes production web origins when enabled
- [ ] R2 bucket remains **private**; no public bucket policy; customer files only via authorized API paths
- [ ] No `.env` files committed to git
- [ ] Render Key Value uses **`noeviction`** (BullMQ)

### Infrastructure

- [ ] `GET /health` (liveness) and `GET /health/ready` (readiness) return 200 on API (FS-79)
- [ ] Database migration ran — all migrations applied
- [ ] Redis connected — worker processing jobs; Key Value memory monitored
- [ ] Worker service running — Render logs show worker startup
- [ ] Webhook service reachable at `webhooks.servicerev.app`
- [ ] R2 bucket created, CORS configured
- [ ] All DNS records propagated (check with `dig servicerev.app`)

### Email / SMS

- [ ] SendGrid domain verified (green checkmarks in SendGrid)
- [ ] Send test email via API — verify delivery
- [ ] Twilio number active and verified
- [ ] Send test SMS via API — verify delivery
- [ ] OTW notification flow tested end to end

### Payments

- [ ] Stripe Connect platform account live mode enabled
- [ ] Test Stripe Connect onboarding flow with a test company
- [ ] Stripe webhook receiving events (check Stripe dashboard)
- [ ] Payment link generated and loads in browser

### App

- [ ] Landing page loads at `servicerev.app`
- [ ] Authenticated users redirect to `app.servicerev.app/dashboard`
- [ ] Login flow works end to end
- [ ] Role-based routing works (owner → dashboard, tech → mobile/jobs)
- [ ] CSV import works with a real file
- [ ] Online booking flow works end to end
- [ ] Customer portal magic link flow works

### Monitoring (add before going live)

- [ ] Set up Render notifications: deploy failures, instance health
- [ ] Set up Vercel analytics (free tier)
- [ ] Set up UptimeRobot (free): ping `/health/ready` every 5 min (or `/health` for liveness-only)

---

## Step 10: Post-Launch

### First customer onboarding flow

1. Owner signs up at `servicerev.app`
2. Redirected to CSV import wizard (`/onboarding/import`)
3. Uploads customer list
4. AI maps columns, detects duplicates
5. AI Revenue Engine scans on first import
6. Owner sees opportunities on dashboard immediately

### Monitoring

- **Render Dashboard** → each service → **Logs** (API, worker, webhook)
- **Metrics:** CPU/memory per service; Key Value memory (critical with `noeviction`)
- **Queue depth:** inspect via Redis CLI from Render Shell on Key Value or app diagnostics (avoid public Redis)

### Scaling triggers

- API memory > 512MB consistently → upgrade Render plan or horizontal scale
- DB connections > 80% → add connection pooling (FS-80 policy)
- Worker queue depth > 1000 consistently → add worker instances
- Key Value memory near limit → upgrade Key Value plan or reduce retained job data

---

## Environment Variables Summary

**Validated by `@fsm/config` (`packages/config/src/env.ts`):** set on every Render service that boots `@fsm/config`.

| Variable | Notes |
| --- | --- |
| `NODE_ENV` | `production` |
| `API_PORT` | API: = Render `PORT`; worker/webhook: required by schema |
| `WEBHOOK_PORT` | Webhook service: = Render `PORT` |
| `DATABASE_URL` | Render Postgres internal URL |
| `REDIS_URL` | Render Key Value internal URL |
| `APP_URL` | Canonical app origin (staff UI) |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` / `BOOKING_HOLD_TOKEN_SECRET` | `openssl rand -hex 64` each |
| `ACCESS_TOKEN_TTL_SECONDS` / `REFRESH_TOKEN_TTL_SECONDS` / `RESET_TOKEN_TTL_SECONDS` | See `.env.example` |
| `ESTIMATE_EXPIRY_DAYS` / `INVOICE_DUE_DAYS` | Optional defaults in env.ts |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_CONNECT_CLIENT_ID` / `STRIPE_PLATFORM_FEE_PERCENT` | Stripe Dashboard |
| `OPENAI_API_KEY` | OpenAI platform |
| `TWILIO_*` | Twilio Console |
| `SENDGRID_API_KEY` / `SENDGRID_FROM_EMAIL` | SendGrid |
| `R2_*` | Cloudflare R2 API token + bucket name |
| `NEXT_PUBLIC_API_URL` | Public API base URL (also set on Vercel) |

**Adjunct (not in env.ts):** `API_URL` (Vercel server rewrites), `CORS_ORIGINS` (Render API when implemented).

**Vercel-only examples:** `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL`, etc. (Step 2).
