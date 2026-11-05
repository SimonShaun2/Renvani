> **Historical instruction snapshot — clarified 2026-11-05 UTC.** The original text below is retained for traceability, including retired brand/Figma references, agent assignments, schema snapshots and milestone claims. It is not the current build queue or design authority. Current work follows [AGENTS.md](../../AGENTS.md), [TEAM.md](../../TEAM.md), the FS board, and the [Renvani Figma parity contract](../design/RENVANI_FIGMA_PARITY.md). Use canonical Figma file `jiGHTNUJNltWbHA4Il3hk7` and `packages/db/src/schema.ts`; do not implement old copy, use stale `fsm-schema.ts`, or rename persisted keys from this historical text.

# TICKET-018: Job Detail — Full Screen

**Phase:** 2B
**Assigned:** Agent 2 (Frontend Engineer)
**Auditor:** Agent 4 (QA & Standards)
**Priority:** P0 — Central operational screen. Used by dispatchers and technicians.
**Dependencies:** TICKET-017 APPROVED

---

## Agent Prompts

### Agent 2 — Read This First
You are Agent 2 building ServiceRev. Job Detail is the central
operational screen — the dispatcher and tech both live here.
It has two columns: left (customer/property/asset context + tasks)
and right (products + time tracking + AI + actions).

Read all attached Figma designs carefully. There are 5 pages of designs
for this ticket. Follow AGENTS.md, CODEX.md, WORKFLOW.md.
Commit and push. Output TASK COMPLETE when done.

### Agent 4
Run the full audit checklist. Output TICKET-018 AUDIT: APPROVED or
CHANGES REQUIRED.

---

## Figma Reference

**Export from figma.com/design/LNTOsgJ7D4blaFaTepQt3J:**
- 🔧 Job Detail — main two-column layout
- ✅ Job Tasks + Products — task checklist and products panel
- ⏱ Time Tracking — desktop time panel
- 📎 File Attachments — attachments panel
- 🚗 On The Way — desktop OTW status

---

## Acceptance Criteria

- [ ] Two-column desktop layout
- [ ] Job header: number, title, status badge, action bar
- [ ] Left col: context cards (customer / property / asset), notes,
      task checklist with progress bar, required flags, AI suggestion
- [ ] Right col: products panel, time tracking panel, AI upsell,
      complete job CTA
- [ ] Tasks: check off, add, reorder (drag), required flag
- [ ] Products: add from catalog picker, add custom, remove,
      approve upsell, totals with tax
- [ ] Time tracking: start/stop timer, entry log, billable summary
- [ ] File attachments: upload, grid view, before/after labels
- [ ] On The Way: send OTW notification from desktop
- [ ] Job status transitions: all valid next states shown as actions
- [ ] Activity timeline at bottom
- [ ] Complete Job → triggers e-signature flow if on mobile,
      invoice creation on desktop

---

## Agent 2 Owns

### 1. API hooks
**File:** `apps/web/src/hooks/jobs.hooks.ts`

```typescript
export function useJob(jobId: string)
export function useUpdateJob(jobId: string)
export function useTransitionJob(jobId: string)
export function useJobTasks(jobId: string)
export function useCreateTask(jobId: string)
export function useUpdateTask(jobId: string)
export function useCompleteTask(jobId: string)
export function useReorderTasks(jobId: string)
export function useJobProducts(jobId: string)
export function useAddJobProduct(jobId: string)
export function useUpdateJobProduct(jobId: string)
export function useRemoveJobProduct(jobId: string)
export function useApproveUpsell(jobId: string)
export function useJobTimeEntries(jobId: string)
export function useStartTimer(jobId: string)
export function useStopTimer(jobId: string)
export function useSendOTW(jobId: string)
export function useJobAttachments(jobId: string)
export function useUploadAttachment(jobId: string)
export function useDeleteAttachment()
```

### 2. Job Detail page
**File:** `apps/web/src/app/(app)/jobs/[id]/page.tsx`

**Job Header:**
`apps/web/src/components/jobs/JobHeader.tsx`
Back link | Job number | Customer name | Status badge | Action bar

Action bar buttons (vary by current status):
- `lead` → Assign Tech | Schedule | Cancel
- `scheduled` → Reschedule | OTW | Start Job | Cancel
- `in_progress` → Complete Job | Create Invoice | Reschedule
- `completed` → Create Invoice | Request Review
- `invoiced` → View Invoice

**Two-column layout:**
Left col: 56% width
Right col: 44% width
Divider: 1px neutral-200

### 3. Left Column

**Context Cards (3 mini cards in a row):**
`apps/web/src/components/jobs/JobContextCards.tsx`

Customer card: name, phone, "View →" link
Property card: address line 1 + city, "View →" link
Asset card: make/model, condition badge, install year, "View →" link

**Job Notes:**
Inline editable text area. Auto-saves on blur.
`PATCH /api/v1/jobs/:id` with `{ notes }`

**Task Checklist:**
`apps/web/src/components/jobs/TaskChecklist.tsx`

Progress bar: filled green = completedTasks/totalTasks
"X of Y complete" text + percentage

Each task row:
- Checkbox (green when done, border when pending)
- Task label (strikethrough when done)
- Required badge (orange) if `isRequired = true` and not done
- Estimated time label (right-aligned, muted)
- Drag handle (left edge) for reordering

Click checkbox → `completeTask` mutation
Drag to reorder → `reorderTasks` mutation (on drop)

Add task: inline input at bottom, Enter to save.

**AI Suggestion card:**
`apps/web/src/components/jobs/JobAISuggestion.tsx`
Purple background card. Sparkle icon + suggestion text + action link.
Dismissed per job via local state (not persisted in V1).

### 4. Right Column

**Products Panel:**
`apps/web/src/components/jobs/JobProductsPanel.tsx`

Header: "📦 Products" + "+ Add from Catalog" button

Line items table:
- Product name + category badge
- Qty (editable inline)
- Unit price
- Line total (qty × price)
- 🗑 remove button
- UPSELL badge (orange) if `isUpsell = true`
- "Get Approval →" button if upsell not yet approved

Totals section:
- Subtotal
- Tax (rate from company settings)
- Discount (editable)
- **Total** (bold)

"+ Add from Catalog" → opens `ProductCatalogPicker` sheet
"+ Add Custom Item" → inline form row

**ProductCatalogPicker:**
`apps/web/src/components/jobs/ProductCatalogPicker.tsx`
Sheet slide-in. Search input (calls `/api/v1/products/search?q=`).
Category filter chips at top.
Each result: name, category, price, + button.
Multiple can be added before closing.

**Time Tracking Panel:**
`apps/web/src/components/jobs/TimeTrackingPanel.tsx`

If no active entry:
- "▶ Start Timer" button (green)
- Timer type select: On Site / Travel / Break

If active entry:
- Live elapsed time display (updates every second via setInterval)
- Entry type label + start time
- "⏹ Stop Timer" button (red)

Time entry log:
- Table: Type | Start | End | Duration | Tech
- Pencil icon → edit entry (admin/owner only)

Summary row: Travel / On Site / Break / Total Billable

**File Attachments Panel:**
`apps/web/src/components/jobs/AttachmentsPanel.tsx`

Filter tabs: All | Photos | Documents
Photo grid: 3 columns, before/after badges
Document list: icon + name + size + download link
Upload: dropzone + "📷 Take Photo" button (mobile only)

Photo upload:
- `<input type="file" accept="image/*" capture="environment">` for mobile
- Standard file input for desktop
- On select: POST to `/api/v1/attachments` (multipart)
- Show upload progress bar

**On The Way Panel:**
`apps/web/src/components/jobs/OTWPanel.tsx`

Shows last OTW sent (if any): time sent + "Delivered" badge.
"🚗 Send On The Way" button → opens OTW modal:
- ETA select (5/10/15/20/30/45/60 min)
- Message preview (auto-generated, editable)
- Channel: SMS (default) / Email
- Send button → calls POST `/api/v1/jobs/:id/on-the-way`

### 5. Job status transitions
**File:** `apps/web/src/components/jobs/JobStatusTransitions.tsx`

"Complete Job" button → `transitionJob` mutation with `{ event: 'complete' }`
On success: if on desktop → redirect to create invoice modal
Shows confirmation dialog first:
- "Are all tasks complete?" warning if required tasks remain
- Override checkbox: "Complete anyway"

### 6. Activity Timeline
`apps/web/src/components/jobs/JobActivityTimeline.tsx`
At bottom below both columns.
`GET /api/v1/activity-events?entityType=job&entityId=:id`
Newest first. Colored dots per event type.

---

## Live Timer Implementation

```typescript
// TimeTrackingPanel.tsx
const [elapsed, setElapsed] = useState(0);
const [startTime, setStartTime] = useState<Date | null>(null);

useEffect(() => {
  if (!activeEntry) return;
  setStartTime(new Date(activeEntry.startedAt));
  const interval = setInterval(() => {
    setElapsed(Math.floor((Date.now() - new Date(activeEntry.startedAt).getTime()) / 1000));
  }, 1000);
  return () => clearInterval(interval);
}, [activeEntry]);

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}
```

---

## Agent 4 Audit Checklist

- [ ] `pnpm build` passes clean
- [ ] No `any` types
- [ ] Job notes auto-save on blur (not on every keystroke)
- [ ] Task drag-to-reorder calls `reorderTasks` on drop end
- [ ] Required tasks show warning on Complete Job if not done
- [ ] Timer updates every second while active
- [ ] Timer stop calculates duration and invalidates time entries query
- [ ] Product totals recalculate when qty changes
- [ ] Tax rate comes from company settings (not hardcoded)
- [ ] Upsell approve button calls correct endpoint
- [ ] Product catalog picker search is debounced (300ms)
- [ ] File upload shows progress bar
- [ ] Before/after badge set from `photoType` field
- [ ] OTW "once per day" constraint handled (button disabled if already sent)
- [ ] Activity timeline sorted newest first
- [ ] Status action buttons match current status correctly

---

## Notes

- Time entry duration is in seconds — format as HH:MM:SS for display
- Product line total = `ROUND(qty × unitPrice, 2)` — do arithmetic on
  floats for display only; never send computed totals to API
- Git commit: "TICKET-018: Job Detail Full Screen"
