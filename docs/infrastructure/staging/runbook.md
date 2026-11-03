# Staging runbook (Render, Neon, Vercel, Clerk)

**FS-75 / FS-76** · **Owner:** Platform 1. FS-93 and the official operational stack name Render compute/Key Value, Neon PostgreSQL, Vercel web, Clerk development identity and R2 storage. Provider actions still require the ticket's specific authorization.

## 1. Preconditions

- [x] FS-93 and official-stack decisions recorded; verify the isolated tester target before a new action
- [ ] Staging env template reviewed: `config/env/staging.env.example`
- [ ] Boundary validator passes locally (see below)
- [ ] Backend health endpoints available for smoke (coordinate Pair 1 / API — separate PR if not on `dev`)

## 2. Isolated staging target (operator action requires ticket authorization)

> **Stop:** This local FS-76 slice does not create accounts, issue credentials, deploy, or change production. Platform records the exact authorized tester target before any staging action.

Current provider checklist (existing isolated resources are preserved):

1. Verify the isolated Neon branch, Render Key Value instance and R2 bucket/prefix are tester-only.
2. Verify four service targets: Vercel `web`, Render `api`, `webhook`, `worker` (see [service-inventory.md](./service-inventory.md)).
3. Inject secrets per service scope; set `RENVANI_DEPLOYMENT_TIER=staging`.
4. Apply migrations through the approved deployment migration gate, not from this FS-76 slice.
5. Register Stripe **test** webhooks to staging `webhook` URL.

Record provision evidence (project IDs, URLs, SHA) on FS-75 board Evidence field.

## 3. Local boundary validation (allowed now)

```bash
cp config/env/staging.env.example /tmp/renvani-staging.env
# Edit /tmp/renvani-staging.env with non-secret placeholders or test keys — never commit.

node scripts/staging/validate-env-boundaries.mjs --tier staging /tmp/renvani-staging.env
```

## 4. Smoke checks (template)

Dry-run (documents steps only):

```bash
bash scripts/staging/smoke-check.template.sh --dry-run
```

Live smoke (after staging URLs exist and health routes ship):

```bash
export STAGING_API_URL=https://api.staging.example
export STAGING_WEB_URL=https://app.staging.example
export STAGING_WEBHOOK_URL=https://webhooks.staging.example
bash scripts/staging/smoke-check.template.sh
```

Expected checks (FS-75 acceptance targets):

| Check | Endpoint / action |
|-------|-------------------|
| API liveness | `GET $STAGING_API_URL/health` → 200 |
| API data plane | `GET $STAGING_API_URL/health/db` → 200 or documented 503 |
| Web | `GET $STAGING_WEB_URL` → 200 |
| Webhook | `GET $STAGING_WEBHOOK_URL/health` → 200 |
| Worker | Queue consumer heartbeat / job processed (observability TBD) |
| Object storage | Signed upload smoke via API attachment route (QA script TBD) |

## 5. Synthetic seed and reset

**Seed (post-provision):** document seed entrypoint when available (`packages/db` seed scripts or dedicated staging seed ticket). Until then: manual creation of one company + owner via signup flow on staging.

**Reset (staging only):**

1. Scale worker to 0 (stop job processing).
2. Drop and recreate database; re-run migrations.
3. Flush Redis staging instance.
4. Remove objects under staging bucket prefix.
5. Scale worker up; re-seed synthetic data.

Never run reset against production identifiers.

## 6. Teardown

1. Delete staging DNS records (FS-93 owner).
2. Destroy staging data plane resources after backup if required for audit.
3. Revoke staging API keys in Stripe/Twilio/SendGrid/OpenAI dashboards.
4. Archive Evidence on FS-75.

## 7. CI integration

Staging smoke in an **approved batch** or post-merge workflow requires E.. CoS authorization per `GITHUB_WORKFLOW.md`. FS-76 adds a source-and-built-artifact secret scan to the existing approved batch; the workflow remains label gated. A passing local scan is not approved CI.

## Handoff

| Next ticket | Responsibility |
|-------------|----------------|
| **FS-93** | Provider ADR, account layout, IaC/deploy binding |
| **FS-76** (env controls) | Optional integration fields in `env.ts` |
| API pair | `/health` routes if not present |
| Platform 2 | Observability + backup drill on staging |
