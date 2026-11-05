> **Historical instruction snapshot — clarified 2026-11-05 UTC.** The original text below is retained for traceability, including retired brand/Figma references, agent assignments, schema snapshots and milestone claims. It is not the current build queue or design authority. Current work follows [AGENTS.md](../../AGENTS.md), [TEAM.md](../../TEAM.md), the FS board, and the [Renvani Figma parity contract](../design/RENVANI_FIGMA_PARITY.md). Use canonical Figma file `jiGHTNUJNltWbHA4Il3hk7` and `packages/db/src/schema.ts`; do not implement old copy, use stale `fsm-schema.ts`, or rename persisted keys from this historical text.

# TICKET-026: Product Catalog Screens

**Phase:** 2D
**Assigned:** Agent 2
**Auditor:** Agent 4
**Priority:** P1
**Dependencies:** TICKET-025 APPROVED

---

## Agent Prompts

### Agent 2
Build the Product Catalog management screens at `/products`.
Owners and admins manage the company's price list here — services,
labor rates, and materials. Read the Figma designs attached.
Follow AGENTS.md, CODEX.md, WORKFLOW.md. Commit and push.
Output TASK COMPLETE when done.

### Agent 4
Run the full audit. Output TICKET-026 AUDIT: APPROVED or CHANGES REQUIRED.

---

## Figma Reference

**Export from figma.com/design/LNTOsgJ7D4blaFaTepQt3J:**
- 📦 Product Catalog page (List + Add/Edit screens)

---

## Acceptance Criteria

- [ ] `/products` list with search, category filter tabs, active-only toggle
- [ ] Table: Name | Category | SKU | Unit | Unit Price | Taxable | Used on Jobs
- [ ] Category color badges (Service/Labor/Material/Bundle/Equipment/Fee)
- [ ] "Add Product" button → slide-in form
- [ ] Edit product → same slide-in form pre-filled
- [ ] Soft delete with confirmation
- [ ] Add/Edit form: name, description, category, SKU, unit, unit price,
      cost (optional), taxable toggle, applicable asset types, active toggle
- [ ] Usage stats panel on edit: times used, total revenue, avg per job,
      last used, recently used on (job links)
- [ ] Role guard: write actions owner/admin only

---

## Agent 2 Owns

### API hooks
`apps/web/src/hooks/products.hooks.ts`

```typescript
export function useProducts(query: ListProductsQuery)
export function useProduct(productId: string)
export function useCreateProduct()
export function useUpdateProduct(productId: string)
export function useDeleteProduct()
export function useProductSearch(q: string)  // for picker dropdowns
```

### Product List page
`apps/web/src/app/(app)/products/page.tsx`

Category tabs: All | Service | Labor | Material | Equipment | Fee | Bundle
Search bar (debounced 300ms) + Active Only toggle.
Table with sort on column headers.
"+ Add Product" button → opens `ProductForm` sheet.

### ProductForm sheet
`apps/web/src/components/products/ProductForm.tsx`

Full form in shadcn Sheet slide-in (right side).
Fields:
- Product Name (required)
- Description (textarea)
- Category (select: Service/Labor/Material/Equipment/Fee/Bundle)
- SKU / Code (optional)
- Unit (select: each/hour/lb/sqft/linear ft/gallon/custom)
- Unit Price (currency input)
- Cost — optional, tooltip: "Used for job costing — not shown to customers"
- Taxable toggle
- Applicable Asset Types (multi-select chips: HVAC/Water Heater/Air Handler/
  Condenser/Electrical/Plumbing — add/remove)
- Active toggle

### Edit panel (right side when editing existing)
`apps/web/src/components/products/ProductUsageStats.tsx`

Only shown when editing existing product.
Stats: Times Used | Total Revenue | Avg Per Job | Last Used.
Recent jobs list (last 4): job number + customer + date.
Each job links to `/jobs/:id`.

---

## Agent 4 Audit Checklist

- [ ] `pnpm build` passes clean
- [ ] No `any` types
- [ ] Category tabs filter correctly
- [ ] Search debounced 300ms
- [ ] Active toggle filters to active-only by default
- [ ] Delete shows confirmation, blocked if product on active jobs
- [ ] Taxable toggle defaults to true for new products
- [ ] Asset type chips add/remove correctly
- [ ] Usage stats only shown when editing (not creating)
- [ ] Write actions guarded to owner/admin role

---

## Notes
- `GET /api/v1/products` — list
- `GET /api/v1/products/search?q=` — picker search
- Git commit: "TICKET-026: Product Catalog Screens"

---