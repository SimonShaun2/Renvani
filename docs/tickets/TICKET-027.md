> **Historical instruction snapshot — clarified 2026-11-05 UTC.** The original text below is retained for traceability, including retired brand/Figma references, agent assignments, schema snapshots and milestone claims. It is not the current build queue or design authority. Current work follows [AGENTS.md](../../AGENTS.md), [TEAM.md](../../TEAM.md), the FS board, and the [Renvani Figma parity contract](../design/RENVANI_FIGMA_PARITY.md). Use canonical Figma file `jiGHTNUJNltWbHA4Il3hk7` and `packages/db/src/schema.ts`; do not implement old copy, use stale `fsm-schema.ts`, or rename persisted keys from this historical text.

# TICKET-027: Service Agreements UI

**Phase:** 2D
**Assigned:** Agent 2
**Auditor:** Agent 4
**Priority:** P1
**Dependencies:** TICKET-026 APPROVED

---

## Figma Reference

**Export from figma.com/design/LNTOsgJ7D4blaFaTepQt3J:**
- 🛡 Service Agreements page

---

## Acceptance Criteria

- [ ] `/service-agreements` list with search + status filter
- [ ] Status badges: Active / Pending / Cancelled / Expired / Paused
- [ ] MRR summary card at top
- [ ] Agreement detail: plan name, customer, billing cycle, next renewal,
      covered assets, included visits, payment method
- [ ] Cancel agreement with reason + cancel-at-period-end toggle
- [ ] Pause agreement (owner/admin only)
- [ ] Create agreement from customer profile (linked)
- [ ] Stripe subscription status badge (Active/Past Due/Cancelled)
- [ ] Failed payment alert with "Retry Payment" button

---

## Agent 2 Owns

### API hooks
`apps/web/src/hooks/service-agreements.hooks.ts`

```typescript
export function useServiceAgreements(query: ListAgreementsQuery)
export function useServiceAgreement(agreementId: string)
export function useCreateServiceAgreement()
export function useCancelServiceAgreement(agreementId: string)
export function usePauseServiceAgreement(agreementId: string)
```

### List page
`apps/web/src/app/(app)/service-agreements/page.tsx`

MRR summary card at top: Total MRR | Active Plans | Expiring This Month |
Failed Payments.
Filter chips: All | Active | Pending | Cancelled | Expiring Soon.
Table: Customer | Plan | Billing | MRR | Next Renewal | Status | Actions.

### Agreement Detail
`apps/web/src/app/(app)/service-agreements/[id]/page.tsx`

Left: plan details, covered assets, scheduled visits.
Right: billing history, Stripe status, payment method.
Cancel button → Cancel Agreement modal:
- Cancel immediately vs cancel at period end toggle
- Reason field
- Impact warning: "Customer will lose plan benefits immediately"

---

## Agent 4 Audit Checklist

- [ ] `pnpm build` passes clean
- [ ] No `any` types
- [ ] MRR card sums only active agreements
- [ ] Cancel modal shows impact warning
- [ ] Cancel-at-period-end stores correct value
- [ ] Failed payment badge pulls from Stripe status field
- [ ] Retry Payment calls correct API endpoint

---

## Notes
- `GET /api/v1/service-agreements`
- `POST /api/v1/service-agreements/:id/cancel`
- Git commit: "TICKET-027: Service Agreements UI"

---