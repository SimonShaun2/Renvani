# STACK-13 — Stripe Billing MVP (Aria)

**Scope:** Platform subscription for Renvani tenants (test mode). **Stripe Connect remains separate** (STACK-14 / existing `/api/v1/stripe/connect/*`).

## API

| Method | Path | Role |
| --- | --- | --- |
| GET | `/api/v1/billing/platform/status` | owner, admin |
| POST | `/api/v1/billing/platform/checkout` | owner |

## Flags & env

- `stripePlatformBillingMvp` in `@fsm/config/feature-flags` (default **false**).
- `STRIPE_PLATFORM_BILLING_PRICE_ID_FLEX` / `STRIPE_PLATFORM_BILLING_PRICE_ID_FLAT` — Flex ($299/mo) and Flat ($799/mo) Stripe Price ids (test mode).
- `STRIPE_PLATFORM_BILLING_PRICE_ID` — legacy alias for Flex when `_FLEX` unset.
- `STRIPE_PLATFORM_FEE_PERCENT` — legacy, still required by `env.ts` (use `0.02`) but no longer customer-facing; the customer Service Fee is SERVICE_FEE_RATE_BPS (2%) in @fsm/config/stripe-pricing. Flat: no Service Fee (see STACK-14).

## State

Subscription snapshot stored in `companies.settings.stripePlatformBilling` until a dedicated billing table is justified.

## Webhooks (`apps/webhook`)

Platform subscriptions use the existing `POST /stripe` endpoint (same signing secret as Connect). Handlers key off subscription metadata `billingKind: platform_mvp` (set at checkout) so **Connect / service-agreement subscription flows are unchanged**.

| Stripe event | Effect |
| --- | --- |
| `customer.subscription.created` | Snapshot status + period end; `company.updated` activity event |
| `customer.subscription.updated` | Refresh snapshot; `company.updated` |
| `customer.subscription.deleted` | Mark snapshot `canceled`; `company.updated` |

Processing is idempotent via Redis (`stripe-idempotency.ts`), matching other Stripe webhook events.
