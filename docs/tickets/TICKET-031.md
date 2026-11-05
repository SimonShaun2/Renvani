> **Historical instruction snapshot — clarified 2026-11-05 UTC.** The original text below is retained for traceability, including retired brand/Figma references, agent assignments, schema snapshots and milestone claims. It is not the current build queue or design authority. Current work follows [AGENTS.md](../../AGENTS.md), [TEAM.md](../../TEAM.md), the FS board, and the [Renvani Figma parity contract](../design/RENVANI_FIGMA_PARITY.md). Use canonical Figma file `jiGHTNUJNltWbHA4Il3hk7` and `packages/db/src/schema.ts`; do not implement old copy, use stale `fsm-schema.ts`, or rename persisted keys from this historical text.

# TICKET-031: Settings — All Tabs

**Phase:** 2D
**Assigned:** Agent 2
**Auditor:** Agent 4
**Priority:** P1
**Dependencies:** TICKET-030 APPROVED

---

## Figma Reference

**Export from figma.com/design/LNTOsgJ7D4blaFaTepQt3J:**
- ⚙️ Settings + Onboarding page

---

## Acceptance Criteria

Settings at `/settings` with left nav tabs:

- [ ] **General** — company name, logo, phone, address, timezone, currency
- [ ] **Payments** — Stripe Connect status, platform fee display, payout schedule
- [ ] **Automation Rules** — toggle each AI automation on/off
  (estimate follow-up, invoice recovery, dormant scan, review request,
   revenue opportunities)
- [ ] **Notifications** — email/SMS preferences per event type
- [ ] **Booking** — sub-tabs: General | Services | Availability |
      Booking Links | Service Areas | Notifications | Appearance
- [ ] **Review Links** — Google/Yelp/Facebook/Custom URLs
- [ ] **Users** — link to `/settings/users` (TICKET-029)
- [ ] **Billing** — ServiceRev subscription plan + usage
- [ ] All forms auto-save on blur or explicit Save button
- [ ] Unsaved changes warning on navigate away

---

## Agent 2 Owns

### Settings layout
`apps/web/src/app/(app)/settings/layout.tsx`

Left nav: stacked links, active state.
Right: content area for selected tab.
Unsaved changes: use a `useUnsavedChanges` hook that prompts on
`beforeunload` and route change.

### General tab
`apps/web/src/app/(app)/settings/general/page.tsx`

Company name, trading name, email, phone, address, timezone select,
currency (USD default), logo upload (to R2 via file attachment API).

### Automation Rules tab
`apps/web/src/app/(app)/settings/automation/page.tsx`

List of automation rules with toggle per rule.
Each rule: name | description | trigger condition | toggle.
Rules come from `GET /api/v1/automation-rules`.
Toggle calls `PATCH /api/v1/automation-rules/:id`.

### Payments tab
`apps/web/src/app/(app)/settings/payments/page.tsx`

Stripe Connect status card.
If not connected: "Connect Stripe" button → Stripe OAuth flow.
If connected: account name, payout schedule, last payout amount.
Platform fee note (read-only): "ServiceRev charges X% per transaction".

### Booking settings tabs
Reuse components already built in TICKET-025:
- Booking Links → `apps/web/src/app/(app)/settings/booking/links/page.tsx`
- Service Areas → `apps/web/src/app/(app)/settings/booking/service-areas/page.tsx`

Add remaining booking sub-tabs:
- General: enable/disable online booking toggle, booking slug, auto-confirm toggle
- Services: which services are available for online booking (checkboxes)
- Availability: hours of operation, days available, slot duration, max advance days
- Appearance: company tagline shown on booking page (text input only in V1)

---

## Agent 4 Audit Checklist

- [ ] `pnpm build` passes clean
- [ ] No `any` types
- [ ] Unsaved changes prompt fires on navigate away
- [ ] General form saves correctly
- [ ] Logo upload calls file attachment API
- [ ] Automation rules toggle calls correct PATCH endpoint
- [ ] Stripe Connect button redirects to correct OAuth URL
- [ ] Booking slug uniqueness validated (debounced check against API)
- [ ] All booking sub-tabs render without errors

---

## Notes
- `GET /api/v1/company` — company settings
- `PATCH /api/v1/company` — update settings
- `GET /api/v1/automation-rules`
- `PATCH /api/v1/automation-rules/:id`
- Git commit: "TICKET-031: Settings All Tabs"

---