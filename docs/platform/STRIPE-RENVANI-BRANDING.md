# Stripe — Renvani customer branding policy

**Owner:** Shaun (live-mode approvals) · **Default implementer:** STACK-14 / #134

Customers should experience **Renvani** (and the shop name), not Stripe marketing surfaces. Stripe remains the payments processor and appears only where required (Connect KYC, card network disclosures, legal terms).

## In code (this repo)

| Area | Behavior |
| --- | --- |
| Connect accounts | `applyConnectAccountBranding` sets business profile, statement descriptor, and branding colors (logo/icon URLs optional via env). |
| Connect settings UI | Embedded Connect components via `POST /api/v1/stripe/connect/account-session` + `@stripe/connect-js` on **Settings → Payments**. Account Link redirect remains fallback when publishable key missing or flag off. |
| Invoice pay | Embedded Checkout on `/pay/:token` when `stripeRenvaniEmbeddedCheckout` is on; customer emails use **Renvani pay URL**, not `checkout.stripe.com`. |
| Card statements | `buildCardStatementDescriptor` → shop name or `RENVANI` prefix (`STRIPE_RENVANI_STATEMENT_PREFIX`). |
| Receipts / dunning | PaymentIntent metadata `renvaniReceiptChannel: resend`; transactional email via notifications worker (Resend when `resendEmailEnabled`). **Disable Stripe customer emails** in Dashboard (see below). |

## Env (optional until founder approves live assets)

- `STRIPE_RENVANI_STATEMENT_PREFIX` (default `RENVANI`)
- `STRIPE_BRANDING_LOGO_URL` / `STRIPE_BRANDING_ICON_URL` — hosted assets for Connect + Checkout branding
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — required for embedded Connect / Checkout on web

## API automation (uses `STRIPE_SECRET_KEY` — test or live)

- API `onReady`: `syncRenvaniStripePlatformPolicies()` — platform branding colors + `RENVANI` statement descriptor
- Connect: `applyConnectAccountBranding` on create/onboarding (logo/icon when `STRIPE_BRANDING_*` URLs set)
- Subscriptions: `collection_method: charge_automatically` (avoids Stripe invoice email flow)
- Portal URLs (`stripeRenvaniPortalUrls`): maintenance retry `/portal/agreements/{token}`; receipt `/pay/{token}/receipt` + `.pdf` API

**Founder approval:** Shaun approved STACK-14 live follow-up on **2026-10-23 8:55 AM CT** (Notion FS-131).

## Founder / live-mode checklist (Dashboard / DNS — not in API)

- [ ] **Live** `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (Shaun / infra)
- [ ] Stripe Dashboard → **Settings → Branding** if assets are not supplied via env URLs
- [ ] Connect → **Custom domain** (**DNS** — cannot be done from this repo)
- [ ] Dashboard → **Settings → Customer emails** — disable Stripe receipts/invoices (no platform API toggle in Stripe v17)
- [ ] Statement descriptor prefix review for production connected accounts
- [ ] Figma parity (file `jiGHTNUJNltWbHA4Il3hk7`, pages 03 & 05)

## Feature flags (`@fsm/config/feature-flags`)

- `stripeRenvaniEmbeddedCheckout` — invoice embedded Checkout (default **true**)
- `stripeRenvaniConnectEmbedded` — Connect Account Session in app (default **true**)
- `stripeRenvaniPlatformSync` — sync platform branding on API boot (default **true**)
- `stripeRenvaniPortalUrls` — Renvani portal instead of `hosted_invoice_url` (default **true**)
