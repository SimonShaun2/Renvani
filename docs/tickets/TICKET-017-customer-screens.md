> **Historical instruction snapshot — clarified 2026-11-05 UTC.** The original text below is retained for traceability, including retired brand/Figma references, agent assignments, schema snapshots and milestone claims. It is not the current build queue or design authority. Current work follows [AGENTS.md](../../AGENTS.md), [TEAM.md](../../TEAM.md), the FS board, and the [Renvani Figma parity contract](../design/RENVANI_FIGMA_PARITY.md). Use canonical Figma file `jiGHTNUJNltWbHA4Il3hk7` and `packages/db/src/schema.ts`; do not implement old copy, use stale `fsm-schema.ts`, or rename persisted keys from this historical text.

# TICKET-017: Customer + Property + Asset Screens

**Phase:** 2B
**Assigned:** Agent 2 (Frontend Engineer)
**Auditor:** Agent 4 (QA & Standards)
**Priority:** P1
**Dependencies:** TICKET-016 APPROVED

---

## Agent Prompts

### Agent 2 — Read This First
You are Agent 2 building ServiceRev. This ticket implements the full
Customer section: list, profile, property detail, and asset detail.
This is a master-detail pattern. The customer profile is the most
information-dense screen after the dispatch board — it shows everything
about a customer including their properties, assets, job history,
financials, AI suggestions, and communication controls.

Read the Figma designs attached. Follow AGENTS.md, CODEX.md, WORKFLOW.md.
Commit and push. Output TASK COMPLETE when done.

### Agent 4
Run the full audit checklist. Output TICKET-017 AUDIT: APPROVED or
CHANGES REQUIRED.

---

## Figma Reference

**Export from figma.com/design/LNTOsgJ7D4blaFaTepQt3J:**
- 👥 Customer Profile — full customer profile page

---

## Acceptance Criteria

### Customer List (`/customers`)
- [ ] Searchable + filterable table (name, phone, email, status)
- [ ] Filter chips: All / Active / Dormant / No Plan / Overdue Invoice
- [ ] Sort: last service date, name, lifetime value
- [ ] Status badges (Active / Dormant / Plan Active / Invoice Overdue)
- [ ] "New Customer" button → slide-in form
- [ ] Pagination (25 per page)
- [ ] Click row → navigates to `/customers/:id`

### Customer Profile (`/customers/:id`)
- [ ] Header: name, tags, contact info, New Job / Message / Edit buttons
- [ ] Stats row: customer since, lifetime value, total jobs, last job
- [ ] Properties list (expandable — shows assets per property)
- [ ] Key Assets section with condition badges
- [ ] Job History tab (paginated, filterable by status)
- [ ] Financials tab (invoices, agreements, payment history)
- [ ] Communications tab (SMS history, sent emails)
- [ ] AI Suggestions section (3 most relevant recommendations)
- [ ] Activity timeline (scrollable event feed)
- [ ] Edit customer slide-in form
- [ ] Add property slide-in form
- [ ] Delete customer with confirmation dialog

### Property Detail (`/customers/:id/properties/:propId`)
- [ ] Address, property type, access notes
- [ ] Assets list for this property
- [ ] Job history for this property
- [ ] Add asset form

### Asset Detail (`/customers/:id/assets/:assetId`)
- [ ] Asset info: make/model/serial/install date
- [ ] Condition badge (Healthy / Aging / At Risk / Critical)
- [ ] Last service + next recommended service
- [ ] AI assessment text
- [ ] Job history for this asset
- [ ] Edit asset form

---

## Agent 2 Owns

### 1. API hooks
**File:** `apps/web/src/hooks/customers.hooks.ts`

```typescript
export function useCustomers(query: ListCustomersQuery)
export function useCustomer(customerId: string)
export function useCreateCustomer()
export function useUpdateCustomer(customerId: string)
export function useDeleteCustomer()
export function useCustomerJobs(customerId: string, query: ListJobsQuery)
export function useCustomerInvoices(customerId: string)
export function useCustomerProperties(customerId: string)
export function useCreateProperty(customerId: string)
export function useCustomerAssets(customerId: string)
export function useCreateAsset(propertyId: string)
export function useUpdateAsset(assetId: string)
```

Standard useQuery / useMutation patterns from TICKET-015.

### 2. Customer List
**File:** `apps/web/src/app/(app)/customers/page.tsx`
**File:** `apps/web/src/components/customers/CustomerTable.tsx`

Table columns: Name | Type | Phone | Last Service | Status | Lifetime Value
Filter bar above table.
New Customer button → `CustomerForm` slide-in.

### 3. Customer Profile
**File:** `apps/web/src/app/(app)/customers/[id]/page.tsx`
**File:** `apps/web/src/components/customers/CustomerProfile.tsx`

**Header:**
`apps/web/src/components/customers/CustomerHeader.tsx`
Avatar initials, name (bold), tags (pill chips), phone/email,
action buttons row: `+ New Job` / `✉ Message` / `✎ Edit`.

**Stats row (4 metrics):**
`apps/web/src/components/customers/CustomerStats.tsx`
Customer since | Lifetime value | Total jobs | Last job.
Inline, no card wrappers — horizontal rule below.

**Properties + Assets:**
`apps/web/src/components/customers/PropertiesSection.tsx`
Each property is an expandable card. Collapsed: address + asset count.
Expanded: list of assets with condition badges.
Condition badge colors:
- Healthy → green
- Aging → orange
- At Risk → red (pulse animation)
- Critical → red solid

**AI Suggestions:**
`apps/web/src/components/customers/CustomerAISuggestions.tsx`
Max 3 suggestions. Same card design as dashboard AI rail.
"View all for this customer →" link to AI Revenue Center filtered.

**Tabs (Job History / Financials / Communications):**
`apps/web/src/components/customers/CustomerTabs.tsx`

Job History tab:
- Status filter chips
- Table: job # | type | date | tech | status | amount
- Click row → navigate to job detail

Financials tab:
- Open Invoices section (unpaid) with "Send Payment Link" button
- All Invoices table
- Service Agreements section
- Total billed / total collected stats

Communications tab:
- SMS conversation thread (read-only, most recent at bottom)
- Sent campaigns that included this customer
- Email log

**Activity Timeline:**
`apps/web/src/components/customers/ActivityTimeline.tsx`
Right-side panel or bottom section.
Scrollable list of activity events from `GET /api/v1/activity-events?entityId=`.
Each event: colored dot, event text, timestamp.

### 4. Forms (slide-in panels using Sheet from shadcn)

**CustomerForm:**
`apps/web/src/components/customers/CustomerForm.tsx`
Fields: firstName, lastName, displayName (business), email, phone,
altPhone, tags, leadSource, internalNotes, prefersSms, prefersEmail.
Validation: phone format, email format.

**PropertyForm:**
`apps/web/src/components/customers/PropertyForm.tsx`
Fields: addressLine1, addressLine2, city, state, zip, propertyType,
accessNotes, yearBuilt.

**AssetForm:**
`apps/web/src/components/customers/AssetForm.tsx`
Fields: assetType, make, model, serialNumber, installDate,
warrantyExpiry, notes.
Asset type drives icon selection.

### 5. Property + Asset pages
`apps/web/src/app/(app)/customers/[id]/properties/[propId]/page.tsx`
`apps/web/src/app/(app)/customers/[id]/assets/[assetId]/page.tsx`

Both follow the same layout: breadcrumb back link → header section
→ detail cards → history table.

---

## Agent 4 Audit Checklist

- [ ] `pnpm build` passes clean
- [ ] No `any` types
- [ ] Customer list search is debounced (300ms)
- [ ] Customer profile header "New Job" creates job with customerId pre-filled
- [ ] Delete customer shows confirmation dialog
- [ ] Asset condition badges use correct colors per spec
- [ ] AI suggestions link to AI Revenue Center with correct filter
- [ ] Job history tab correctly paginates
- [ ] Activity timeline events sorted newest first
- [ ] All forms validate before submit
- [ ] All forms show server error messages if API returns error
- [ ] Sheet slide-ins close on Escape and backdrop click
- [ ] Breadcrumb navigation works on property and asset pages

---

## Notes

- `GET /api/v1/customers` — list with search/filter
- `GET /api/v1/customers/:id` — full profile with nested properties/assets
- `GET /api/v1/activity-events?entityType=customer&entityId=:id`
- Git commit: "TICKET-017: Customer + Property + Asset Screens"
