# Tester e2e smoke runbook

Script: `scripts/tester/e2e-smoke.sh`. It extends the check style of `scripts/render/smoke.sh` from PR #258 and does not modify it. The script exercises the first-tester flow against a **deployed** API in **Stripe TEST mode only**:

health → sign up → onboard → import customers → create job → create invoice → send → pay.

Each step prints `PASS`, `FAIL`, `SKIP` or `GAP` (and `DRY` in dry-run mode). The script exits 1 on any `FAIL`. A `GAP` is a step that can't be automated against a deployed env yet; it doesn't fail the run.

```bash
scripts/tester/e2e-smoke.sh --dry-run          # no network; proves the output format
API_BASE_URL=... WEB_BASE_URL=... WEBHOOK_BASE_URL=... scripts/tester/e2e-smoke.sh
```

Needs `curl` and `jq`. Env var **names** only; the script never prints values:

| Var | Purpose |
|---|---|
| `API_BASE_URL` | required |
| `WEB_BASE_URL`, `WEBHOOK_BASE_URL` | optional extra checks |
| `TESTER_EMAIL`, `TESTER_PASSWORD` | optional. Default is a unique `smoke+<ts>@example.com` with a random password. |
| `TESTER_ACCESS_TOKEN` | optional. Skips register/login and uses this bearer token. |
| `SMOKE_IMPORT_FIXTURE` | defaults to the existing golden fixture `packages/config/fixtures/import-golden-bundles/qbo/customers.csv` |
| `SMOKE_IMPORT_TIMEOUT_SECONDS` (180), `SMOKE_TIMEOUT_SECONDS` (20) | timeouts |
| `SMOKE_WAIT_FOR_PAYMENT=1` | prints the Checkout link, then polls up to 10 min for `status=paid` while a human pays with test card 4242… |

Each run creates a new company, customer, job and invoice. Run it only against a staging or test database.

## Write guard (fail closed)

The script runs only read-only checks until the guard passes: `/health/live`, `/health/ready`, and the unsigned-webhook reject probe, which is expected to return 4xx. After those, and before any write step (register, import, create, send, pay), it decides as follows:

1. **Allowed:** `/health/ready` reports `"tier"` (from `RENVANI_DEPLOYMENT_TIER` in `apps/api/src/services/health.service.ts`) as `staging` or `tester`.
2. **Refused:** the host looks like production, meaning the tier is `production`/`prod`, or the hostname contains none of `staging|stage|tester|test|dev|preview|localhost|127.0.0.1`. The allowlist cannot override this. Set `RENVANI_DEPLOYMENT_TIER=staging` (or `tester`) on that API service instead.
3. **Allowed:** the exact API hostname is listed in `SMOKE_ALLOWED_HOSTS` (comma-separated) or `ALLOW_HOST`. Example: `ALLOW_HOST=renvani-api-staging.onrender.com`.
4. **Refused:** anything else.

When the guard refuses, it prints a `FAIL write guard REFUSED ...` line and the summary, then exits with code **2**. `--dry-run` makes no network calls and prints the guard as a `DRY` step.

## Steps (verified against code)

| Step | Endpoint | Notes |
|---|---|---|
| health | `GET /health/live`, `/health/ready` | `ready` covers db, redis and storage |
| sign up | `POST /api/v1/auth/register` (202) then `POST /api/v1/auth/login` → `tokens.accessToken` | Login does not require email verification, so the legacy JWT path is scriptable. |
| onboard | `GET /api/v1/company`; `POST /api/v1/migrate/onboarding/sessions {"resumeActive":true}` | Requires owner/admin. |
| import | `POST /api/v1/imports` (multipart `file` + `entityType=customers`) → worker → status `mapping` → `POST /:id/confirm-mapping {"mappingOverrides":{}}` → `preview` → `POST /:id/start {"duplicateActions":{}}` → `completed` | Session statuses come from `import_session_status`. |
| customer | `POST /api/v1/customers {firstName,lastName,email}` | Email is needed because `sendInvoice` rejects customers without one. |
| job | `POST /api/v1/jobs {customerId,title}` | |
| invoice | `POST /api/v1/invoices {customerId,jobId,items:[{name,quantity,unitPrice}]}` | The total must be > 0 before the invoice can be sent. |
| stripe | `GET /api/v1/stripe/connect/status` → `connected`, `chargesEnabled` | |
| send | `POST /api/v1/invoices/:id/send` → `stripePaymentLinkUrl` (`/pay/<token>`) | Returns 409 if `company.stripeAccountId` is null. |
| pay | Stripe Checkout (`createInvoiceCheckoutSession`, destination charge to the connected account) | The webhook `POST /stripe` handles `payment_intent.succeeded` and marks the invoice paid. |

## GAPs (currently impossible on a deployed env without a human)

- **G1, Clerk sign-up.**
  - Why: Clerk sign-up runs in Clerk's hosted UI in a browser. The API accepts Clerk bearer tokens only when `isClerkParallelAuthAvailable()`, which needs the `clerkAuthParallelJwt` flag plus a Clerk secret key.
  - Workaround: the script uses the legacy `/auth/register` + `/auth/login` path.
  - Fix: use Clerk testing tokens or the Backend API to create a test user, plus Playwright, or keep legacy JWT for testers.
- **G2, AI column mapping.** This is a dependency, not a hard gap.
  - Why: the worker's mapping step calls OpenAI. With no OpenAI key, the import never reaches `mapping` and the script reports FAIL. The mapping step also needs a worker, Redis and R2.
  - Fix: provision those, or add a deterministic mapping fallback for known golden headers.
- **G3, Stripe Connect onboarding.**
  - Why: `POST /api/v1/stripe/connect/onboard` (owner only) returns a Stripe-hosted Express onboarding link that a human must complete in a browser. Until then `stripeAccountId` is null or `chargesEnabled=false`, so `send` returns 409.
  - Fix: complete onboarding once in TEST mode for a fixed tester company and reuse it via `TESTER_ACCESS_TOKEN`, or add a test-only seed that attaches a pre-onboarded `acct_…` test account to the company.
- **G4, paying the invoice.**
  - Why: Checkout is browser-only (hosted or embedded), and the paid status arrives only through the webhook (`payment_intent.succeeded`, verified with `STRIPE_WEBHOOK_SECRET`).
  - Fix: run with `SMOKE_WAIT_FOR_PAYMENT=1` and pay with the test card, or drive Checkout with Playwright, or use `stripe trigger` / Stripe CLI against the test account with the right metadata.
  - Fallback: `POST /invoices/:id/payments` records a manual payment (cash or check). It proves the invoice-to-paid transition but is not a Stripe test.

## Other blockers to a first tester run

1. **Not provisioned.** Render services from PR #258 are not created. The api, worker, webhook and Key Value services are needed, and `render.yaml` has `autoDeploy: false` and region `oregon` as a placeholder that must match Neon.
2. **Worker path.** Imports need the worker running plus Redis (`noeviction`), R2 storage and an OpenAI key. Without any one of them, the import stalls at `uploaded` or `mapping`.
3. **Env schema.** The API, worker and webhook validate env at boot. Every required var in `RENDER-ENV-INVENTORY.md` (#258) must be set, including placeholders for integrations not under test, such as Twilio and email.
4. **Rate limits.**
   - Register is limited to 5/hour per IP and login to 10 per 15 min per IP+email.
   - Behind Render's proxy, `TRUST_PROXY_HOPS` must be 1. With 0, all clients share the proxy IP's bucket.
   - Repeated smoke runs from one IP hit the register limit. After the first run, reuse an account via `TESTER_EMAIL`/`TESTER_PASSWORD` or `TESTER_ACCESS_TOKEN`.
5. **Migrations.** These run in the api `preDeployCommand` (`db:migrate`). A failed migration blocks deploy. The Neon branch must be the dev or staging one, never prod.
6. **Web access.** Vercel Deployment Protection returns 302/401 for unauthenticated testers on preview URLs. Use a production-alias staging domain or a protection bypass. The script reports this as a FAIL on `web root`.
7. **Stripe webhook.** A Stripe TEST-mode endpoint must point at `<WEBHOOK_BASE_URL>/stripe`, with matching `STRIPE_WEBHOOK_SECRET` and the `payment_intent.*` and `account.updated` events enabled. `account.updated` keeps `chargesEnabled` in sync.
8. **Email.** Register sends a verification email. The email provider must be configured or register may error. Verification isn't required for login, but testers will expect the email.
9. **Clerk vs legacy auth.** The web app's sign-up UI must match the auth mode the API has enabled (`RENVANI_DEPLOYMENT_TIER`, the Clerk flag and key). Otherwise testers can sign up in the web app and still get 401s from the API.
