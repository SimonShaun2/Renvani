# Staging secrets, data isolation, and non-live integrations

**FS-75** · **Security review:** coordinate with FS-8 / Security before staging holds realistic tenant shapes.

## Secret handling (all non-production tiers)

| Rule | Staging requirement |
|------|---------------------|
| Storage | Host secret manager only (vendor TBD, FS-93); never git |
| Scope | Per-service credentials per [environment-boundary-matrix.md](./environment-boundary-matrix.md) |
| Rotation | Staging keys rotated independently of production |
| Injection | CI and operators use short-lived access; no secrets in batch CI logs |

## Data isolation

1. **PostgreSQL:** empty or synthetically seeded database; migrations applied from `packages/db` only.
2. **Redis:** empty keyspace at provision; BullMQ prefix remains `fsm` but must not point at production Redis.
3. **Object storage:** staging bucket with no production object paths copied in bulk.
4. **Files & PII:** use generated companies/users; no exports from production.

Reset procedure (post-provision): drop/recreate staging database and Redis, empty bucket prefix, re-run migrations and seed — documented in [runbook.md](./runbook.md).

## Authentication boundary (staging)

| Control | Requirement |
|---------|-------------|
| JWT signing | Unique `JWT_SECRET` and `JWT_REFRESH_SECRET` per environment |
| Session lifetime | Same TTL env vars as other tiers; shorter TTL optional for staging via ops policy |
| MFA / staff lifecycle | Exercises use staging IdP or local auth only; no production identity federation |
| Public routes | Branded booking/pay links must not expose staff APIs without scoped tokens |

Full staff identity provider ADR is **separate** (FS board identity lifecycle ticket). FS-75 only documents that staging auth secrets and user stores are not shared with production.

## Payment boundary (two ledgers — PR #59)

Staging must exercise **test mode only**:

| Flow | Staging integration | Forbidden |
|------|---------------------|-----------|
| Renvani SaaS subscription (Flex/Flat) | Stripe Billing **test** products/prices | Charging real cards |
| Service-business invoice (Connect) | Connect **test** accounts + `sk_test_` | `sk_live_`, live Connect charges |

Validation rules (repo):

- `STRIPE_SECRET_KEY` must match `sk_test_` when `RENVANI_DEPLOYMENT_TIER=staging`.
- Webhook endpoints registered in Stripe **test** dashboard for staging hostnames only.
- Settlement and payout reconciliation tests use Stripe test clocks/events — no live money.

## Messaging boundary

| Provider | Staging |
|----------|---------|
| Twilio | Test credentials or approved send suppression; no SMS to real customers without QA allowlist |
| SendGrid | Sandbox / mail capture; `SENDGRID_FROM_EMAIL` on staging domain |

## AI boundary

- Dedicated low-quota API key; prompts must not include production exports.

## Automated checks

```bash
node scripts/staging/validate-env-boundaries.mjs --tier staging path/to/.env
```

See `packages/config/src/deployment-environment.ts` for machine-readable rules.
The local dotenv boundary validator rejects duplicate keys, including duplicate secret names, before it evaluates the environment. Its error identifies the key only and never prints either value.
