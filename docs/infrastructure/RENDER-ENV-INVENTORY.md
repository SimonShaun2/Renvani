# Render environment inventory (names only)

**Never put values in this file, in `render.yaml`, in logs or in PRs.** Values come from the
founder-owned password manager (keys set up 2026-10-22: Stripe test, Clerk, Neon, Render, Resend,
R2, Sentry, PostHog; Twilio deferred).

Sources: `packages/config/src/env.ts` (schema authority), `docs/security/FS-76-secrets-env-inventory.md`,
and `process.env` reads in `apps/{api,worker,webhook}` and `packages/*` (`FSM_PROCESS_ROLE`,
`RENVANI_DEPLOYMENT_TIER`, `CLERK_*`, `QUICKBOOKS_*`). Generated from `/render.yaml`.

Legend: **prompt** = `sync: false`; Render asks for it once, at Blueprint creation (later Blueprint syncs
ignore it, so add new secrets by hand on the service). **from KV** = bound to `renvani-bullmq-kv`.
A literal value = non-secret config committed in the Blueprint. **—** = not set on that service (schema default applies).

| Name | renvani-api | renvani-worker | renvani-webhook |
| --- | --- | --- | --- |
| `NODE_ENV` | `production` | `production` | `production` |
| `NODE_VERSION` | `22.16.0` | `22.16.0` | `22.16.0` |
| `COREPACK_ENABLE_DOWNLOAD_PROMPT` | `0` | `0` | `0` |
| `ACCESS_TOKEN_TTL_SECONDS` | `900` | `900` | `900` |
| `REFRESH_TOKEN_TTL_SECONDS` | `2592000` | `2592000` | `2592000` |
| `RESET_TOKEN_TTL_SECONDS` | `3600` | `3600` | `3600` |
| `FSM_PROCESS_ROLE` | `api` | `worker` | `webhook` |
| `TRUST_PROXY_HOPS` | `1` | — | — |
| `GLOBAL_RATE_LIMIT_ENABLED` | `false` | — | — |
| `ORIGIN_SECRET` | prompt (optional; same value as Vercel web) | — | — |
| `QUICKBOOKS_ENVIRONMENT` | `sandbox` | `sandbox` | — |
| `REDIS_URL` | from KV | from KV | from KV |
| `DATABASE_URL` | prompt | prompt | prompt |
| `STRIPE_SECRET_KEY` | prompt | prompt | prompt |
| `STRIPE_WEBHOOK_SECRET` | prompt | prompt | prompt |
| `STRIPE_CONNECT_CLIENT_ID` | prompt | prompt | prompt |
| `OPENAI_API_KEY` | prompt | prompt | prompt |
| `TWILIO_ACCOUNT_SID` | prompt | prompt | prompt |
| `TWILIO_AUTH_TOKEN` | prompt | prompt | prompt |
| `SENDGRID_API_KEY` | prompt | prompt | prompt |
| `R2_ACCESS_KEY_ID` | prompt | prompt | prompt |
| `R2_SECRET_ACCESS_KEY` | prompt | prompt | prompt |
| `JWT_SECRET` | prompt | prompt | prompt |
| `JWT_REFRESH_SECRET` | prompt | prompt | prompt |
| `BOOKING_HOLD_TOKEN_SECRET` | prompt | prompt | prompt |
| `APP_URL` | prompt | prompt | prompt |
| `TWILIO_FROM_NUMBER` | prompt | prompt | prompt |
| `SENDGRID_FROM_EMAIL` | prompt | prompt | prompt |
| `R2_ACCOUNT_ID` | prompt | prompt | prompt |
| `R2_BUCKET_NAME` | prompt | prompt | prompt |
| `STRIPE_PLATFORM_FEE_PERCENT` | prompt | prompt | prompt |
| `RENVANI_DEPLOYMENT_TIER` | prompt | prompt | prompt |
| `RESEND_API_KEY` | prompt | prompt | — |
| `RESEND_FROM_EMAIL` | prompt | prompt | — |
| `SENTRY_DSN` | prompt | prompt | prompt |
| `CLERK_SECRET_KEY` | prompt | — | — |
| `CLERK_WEBHOOK_SECRET` | prompt | — | — |
| `CLERK_AUTHORIZED_PARTIES` | prompt | — | — |
| `QUICKBOOKS_CLIENT_ID` | prompt | prompt | — |
| `QUICKBOOKS_CLIENT_SECRET` | prompt | prompt | — |
| `QUICKBOOKS_REDIRECT_URI` | prompt | — | — |
| `QUICKBOOKS_TOKEN_ENCRYPTION_KEY` | prompt | prompt | — |

## Why every service gets the same required keys

`@fsm/config` validates one monolithic Zod schema at boot (FS-76 "Full schema" for api, worker and
webhook). A missing required key crashes the process, so all three services list every required name
even where they don't use it. Least-privilege per-service schemas are a follow-up (FS-76 target matrix).

## Deferred / placeholder providers

- **Twilio** is deferred, but `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM_NUMBER` are still
  required by the schema (boot only checks they are non-empty). Enter clearly non-production placeholder strings until
  Twilio is set up; SMS sends will not work until real values are entered.
- **SendGrid** keys are still required by the schema although email goes through Resend when `RESEND_API_KEY`
  is set. Same placeholder approach.
- **`RENVANI_DEPLOYMENT_TIER`**: `staging` turns on Clerk parallel auth (`packages/config/src/feature-flags.ts`);
  `production` blocks Neon per-PR CI URLs. Founder chooses at creation.

## Names deliberately not on Render

- `NEXT_PUBLIC_*`, `API_URL`: web only, set in Vercel.
- `PORT`: injected by Render; apps read `PORT ?? API_PORT/WEBHOOK_PORT`.
- PostHog keys: web only today (`NEXT_PUBLIC_POSTHOG_KEY` in Vercel).
