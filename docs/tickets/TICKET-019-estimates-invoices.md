> **Historical instruction snapshot — clarified 2026-11-05 UTC.** The original text below is retained for traceability, including retired brand/Figma references, agent assignments, schema snapshots and milestone claims. It is not the current build queue or design authority. Current work follows [AGENTS.md](../../AGENTS.md), [TEAM.md](../../TEAM.md), the FS board, and the [Renvani Figma parity contract](../design/RENVANI_FIGMA_PARITY.md). Use canonical Figma file `jiGHTNUJNltWbHA4Il3hk7` and `packages/db/src/schema.ts`; do not implement old copy, use stale `fsm-schema.ts`, or rename persisted keys from this historical text.

# TICKET-019: Estimates + Invoices

**Phase:** 2B
**Assigned:** Agent 2 (Frontend Engineer)
**Auditor:** Agent 4 (QA & Standards)
**Priority:** P0 — Core revenue capture.
**Dependencies:** TICKET-018 APPROVED

---

## Agent Prompts

### Agent 2
Build the Estimates and Invoices screens. Estimates are built with a
Good/Better/Best tier option or single quote. Invoices are created from
estimates or jobs and sent to customers via Stripe payment links.
Read the Figma designs attached. Follow all rules. Commit and push.
Output TASK COMPLETE when done.

### Agent 4
Run the full audit. Output TICKET-019 AUDIT: APPROVED or CHANGES REQUIRED.

---

## Figma Reference

**Export from figma.com/design/LNTOsgJ7D4blaFaTepQt3J:**
- 📋 Estimates — list + builder
- 💳 Invoices — list + detail

---

## Acceptance Criteria

### Estimates
- [ ] `/estimates` list with filter chips + search
- [ ] Status badges (Draft / Sent / Approved / Declined / Expired)
- [ ] "New Estimate" → builder screen
- [ ] Builder: Single quote OR Good/Better/Best tier mode
- [ ] Line items: add from catalog, add custom, qty, price, total
- [ ] Notes to customer field
- [ ] Tax calculation (from company settings)
- [ ] Discount field
- [ ] Send to customer (via SMS link or Email)
- [ ] "Show on screen" mode (hand device to customer)
- [ ] Customer approval captured with timestamp
- [ ] Approved estimate → "Convert to Job" button
- [ ] Good/Better/Best tier: customer selects tier, approval recorded

### Invoices
- [ ] `/invoices` list with filter + search
- [ ] Status badges (Draft / Sent / Paid / Overdue / Void)
- [ ] Invoice detail: line items, totals, payment status
- [ ] Send payment link (Stripe)
- [ ] Record cash / check payment
- [ ] Mark as paid (manual)
- [ ] Void invoice with reason
- [ ] Download / print PDF
- [ ] Overdue: resend payment reminder
- [ ] Payment received: confirmation state

---

## Agent 2 Owns

### 1. API hooks
**File:** `apps/web/src/hooks/estimates.hooks.ts`

```typescript
export function useEstimates(query: ListEstimatesQuery)
export function useEstimate(estimateId: string)
export function useCreateEstimate()
export function useUpdateEstimate(estimateId: string)
export function useSendEstimate(estimateId: string)
export function useApproveEstimate(estimateId: string)   // dispatcher override
export function useConvertEstimateToJob(estimateId: string)
```

**File:** `apps/web/src/hooks/invoices.hooks.ts`

```typescript
export function useInvoices(query: ListInvoicesQuery)
export function useInvoice(invoiceId: string)
export function useCreateInvoice()
export function useSendInvoice(invoiceId: string)
export function useRecordPayment(invoiceId: string)
export function useVoidInvoice(invoiceId: string)
export function useResendPaymentReminder(invoiceId: string)
```

### 2. Estimates List
**File:** `apps/web/src/app/(app)/estimates/page.tsx`

Filter chips: All | Draft | Sent | Approved | Declined | Expired
Table: # | Customer | Title | Date | Expires | Total | Status | Actions
"New Estimate" button top-right.
Click row → `/estimates/:id`

### 3. Estimate Builder
**File:** `apps/web/src/app/(app)/estimates/new/page.tsx`
**File:** `apps/web/src/app/(app)/estimates/[id]/page.tsx`

Two-column layout:
- Left (60%): line items builder
- Right (40%): summary + send options

**Mode toggle** (top of left col):
```
[ Single Quote ]  [ Good / Better / Best ]
```

**Single Quote mode:**
Line items table same as job products panel.
Notes to customer: text area.
Message preview.

**Good/Better/Best mode:**
Three tier cards (stacked vertically, collapsible):
- Good: label, price, items list, description
- Better: label, price, items (highlighted), "Recommended" badge
- Best: label, price, items, extras

Each tier independently has its own line items.
"Better" tier is pre-highlighted as recommended.

**Line items per tier:**
Same product catalog picker, same add custom item flow as TICKET-018.

**Right column (same for both modes):**
- Subtotal
- Tax
- Discount
- Total
- "Send to Customer" button → opens send modal
- "Show on Screen" button → switches to customer view

**Send Modal:**
`apps/web/src/components/estimates/EstimateSendModal.tsx`
Channel: SMS / Email / Both
Preview of message text (editable)
Send button → `POST /api/v1/estimates/:id/send`

**Customer View (Show on Screen):**
`apps/web/src/components/estimates/CustomerEstimateView.tsx`

Full-screen overlay, white background.
For G/B/B: shows three tier cards. Customer taps their choice.
Tapped tier highlighted. Approve button below.

For single quote: shows quote summary. Approve button.

On customer taps Approve:
`POST /api/v1/estimates/:id/approve`
Shows "✓ Approved" confirmation state.
"Back to office view" button exits customer view.

**Public estimate page:**
`apps/web/src/app/(public)/estimates/[token]/page.tsx`
Same customer view UI but served at public URL.
No auth. Uses token from URL.

### 4. Estimate detail (read-only with actions)
`apps/web/src/app/(app)/estimates/[id]/page.tsx`

When estimate status is `sent`, `approved`, or `declined`:
Show read-only view with approval state.
Action buttons vary by status:
- `sent` → Resend | Mark Approved | Decline
- `approved` → Convert to Job | Create Invoice
- `declined` → Re-send | Edit

**Convert to Job:**
Opens a small dialog:
- Pre-fills job title from estimate
- Tech assign dropdown
- Schedule date/time picker
- "Create Job" → `POST /api/v1/estimates/:id/convert-to-job`

### 5. Invoices List
**File:** `apps/web/src/app/(app)/invoices/page.tsx`

Same pattern as estimates. Extra cols: Due Date | Amount Due.
Red row highlight for overdue invoices.
"New Invoice" button.

### 6. Invoice Detail
**File:** `apps/web/src/app/(app)/invoices/[id]/page.tsx`

Header: INV-XXXX | Customer | Status badge
Line items table (read-only once sent)
Totals: subtotal / tax / discount / **total**
Paid amount + balance due

Payment status banner:
- Unpaid: "Send Payment Link" (blue) + "Record Payment" (outline)
- Overdue: red banner + "Send Reminder" button
- Paid: green banner with amount + date + method

**Record Payment modal:**
`apps/web/src/components/invoices/RecordPaymentModal.tsx`
Method: Cash | Check | Bank Transfer | Other
Amount (pre-filled with balance due)
Date
Reference # (optional)
"Mark as Paid" → `POST /api/v1/invoices/:id/payments`

**Void Invoice dialog:**
Reason field required.
"Void Invoice" → `POST /api/v1/invoices/:id/void`

**Public payment page:**
`apps/web/src/app/(public)/pay/[token]/page.tsx`
Stripe-hosted payment redirect (just a redirect page in V1):
Fetches payment link URL from API → immediate redirect to Stripe.
Shows loading spinner while redirecting.

---

## Agent 4 Audit Checklist

- [ ] `pnpm build` passes clean
- [ ] No `any` types
- [ ] Estimate builder saves as draft on every line item change (debounced 2s)
- [ ] G/B/B mode stores three separate tier line items
- [ ] Tax calculated from company setting, not hardcoded
- [ ] Customer view is full-screen overlay, hides all dispatcher UI
- [ ] Customer approval records timestamp and which tier (if G/B/B)
- [ ] Public estimate page at `/estimates/:token` requires no auth
- [ ] Convert to job calls correct endpoint
- [ ] Overdue invoices show red highlight in list
- [ ] Record payment pre-fills balance due
- [ ] Void invoice requires reason field
- [ ] Public pay page redirects to Stripe URL immediately
- [ ] Both lists have pagination (25 per page)

---

## Notes

- Estimates: `GET /api/v1/estimates`, `POST /api/v1/estimates`
- Send: `POST /api/v1/estimates/:id/send`
- Approve: `POST /api/v1/estimates/:id/approve` (+ `customerToken` for public)
- Convert: `POST /api/v1/estimates/:id/convert-to-job`
- Invoices: `GET /api/v1/invoices`, `GET /api/v1/invoices/:id`
- Payment link: `POST /api/v1/invoices/:id/send` returns `paymentLinkUrl`
- Record payment: `POST /api/v1/invoices/:id/payments`
- Git commit: "TICKET-019: Estimates + Invoices"
