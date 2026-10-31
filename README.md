# Renvani (FSM Platform)

Renvani aims to be the **Owner.com of home and field services**—a growth platform for one vertical ([Owner.com](https://www.owner.com/) as aspirational guide, not a literal product/pricing/app blueprint). **Revenue growth leads** the product (get found, win jobs, earn repeat)—same sequencing idea as Owner.com vs Toast/Square (growth first, POS on the back end), applied vs operations-first FSM (Jobber, ServiceTitan, Service Fusion) with FSM depth as the back end. **Growth outcomes lead;** AI powers workflows behind the five areas; not an “agent company” pitch. **FSM modules in this monorepo are the supporting system-of-record layer** on standalone Renvani SoR (legacy import-only), with human approval and policy where required. Build tickets, schema, and phase history: [`docs/README.md`](docs/README.md).

## Prerequisites

- Node.js 20+
- pnpm
- Postgres
- Redis

## Setup

1. `cp .env.example .env`
2. Fill in the required environment variable values
3. `pnpm install`
4. `pnpm dev`

## Required environment variables

- `DATABASE_URL`: Postgres connection string for the main application database
- `REDIS_URL`: Redis connection string for queues, caching, and workers
- `JWT_SECRET`: Secret used to sign access and reset tokens
- `JWT_REFRESH_SECRET`: Secret used to sign refresh tokens
- `ACCESS_TOKEN_TTL_SECONDS`: Access token lifetime in seconds
- `REFRESH_TOKEN_TTL_SECONDS`: Refresh token lifetime in seconds
- `RESET_TOKEN_TTL_SECONDS`: Password reset token lifetime in seconds
- `APP_URL`: Base application URL used in password reset links
- `NEXT_PUBLIC_API_URL`: Browser-safe API base URL for the web app

### Provider keys

- Stripe
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PLATFORM_FEE_PERCENT`
  - Get these from your Stripe dashboard
- Twilio
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_FROM_NUMBER`
  - Get these from your Twilio console
- SendGrid
  - `SENDGRID_API_KEY`
  - `SENDGRID_FROM_EMAIL`
  - Get these from your SendGrid account and verified sender settings
- OpenAI
  - `OPENAI_API_KEY`
  - Get this from your OpenAI API project
- Cloudflare R2
  - `R2_ACCOUNT_ID`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_BUCKET_NAME`
  - Get these from your Cloudflare account and R2 bucket settings

## Database migrations

- Generate a migration: `pnpm --filter @fsm/db db:generate`
- Apply migrations: `pnpm --filter @fsm/db db:migrate`

## QA: Branded site → booking (local)

After migrations and `pnpm dev`, use a tenant with **Settings → Booking** enabled and a unique `booking_slug` (defaults to company slug).

```bash
BOOKING_SLUG=your-company-slug ./scripts/qa-branded-site-local.sh
```

Manual path:

1. `http://localhost:3000/site/{slug}` — branded Growth storefront (FS-58)
2. **Book a clean** / **Book this time** → `http://localhost:3000/book/{slug}?src=website` (public booking / FS-21 handoff)

The script verifies `GET /api/v1/public/booking/{slug}` on the API host before you open the browser. In the browser, public booking calls use same-origin `/api/v1/public/*` (Next.js rewrite to the API).
