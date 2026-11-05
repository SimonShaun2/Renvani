> **Historical instruction snapshot — clarified 2026-11-05 UTC.** The original text below is retained for traceability, including retired brand/Figma references, agent assignments, schema snapshots and milestone claims. It is not the current build queue or design authority. Current work follows [AGENTS.md](../../AGENTS.md), [TEAM.md](../../TEAM.md), the FS board, and the [Renvani Figma parity contract](../design/RENVANI_FIGMA_PARITY.md). Use canonical Figma file `jiGHTNUJNltWbHA4Il3hk7` and `packages/db/src/schema.ts`; do not implement old copy, use stale `fsm-schema.ts`, or rename persisted keys from this historical text.

# TICKET-032: CSV Import Wizard UI

**Phase:** 2D
**Assigned:** Agent 2
**Auditor:** Agent 4
**Priority:** P1 — Required for onboarding new customers from existing systems.
**Dependencies:** TICKET-031 APPROVED

---

## Figma Reference

**Export from figma.com/design/LNTOsgJ7D4blaFaTepQt3J:**
- 📂 CSV Import Wizard page

---

## Acceptance Criteria

- [ ] `/onboarding/import` — 7-step wizard
- [ ] Step 1: Upload CSV (drag and drop or file picker)
- [ ] Step 2: AI column mapping (auto-detected, editable)
- [ ] Step 3: Preview mapped data (first 5 rows)
- [ ] Step 4: Duplicate detection results
- [ ] Step 5: Confirm + import
- [ ] Step 6: Progress (real-time via polling)
- [ ] Step 7: Results summary (imported / skipped / errors)
- [ ] Download error report CSV
- [ ] Step progress bar persists
- [ ] Can cancel import before step 6

---

## Agent 2 Owns

### CSV Import store
`apps/web/src/stores/csv-import.store.ts`

```typescript
interface CSVImportStore {
  currentStep: number;
  file: File | null;
  uploadId: string | null;
  mappings: ColumnMapping[];
  previewRows: Record<string, string>[];
  duplicateCount: number;
  importJobId: string | null;
  results: ImportResults | null;
  setStep: (step: number) => void;
  reset: () => void;
}
```

### Import Wizard page
`apps/web/src/app/(app)/onboarding/import/page.tsx`

Step router — renders correct step component based on store step.
7-step progress bar at top.

### Step 1: Upload
`apps/web/src/components/csv-import/Step1Upload.tsx`

Drag-and-drop zone (react-dropzone or native).
Accepts: `.csv`, `.xlsx` (xlsx parsed client-side with SheetJS).
File size limit: 10MB.
On file select: POST to `/api/v1/csv-import/upload` (multipart).
Returns `uploadId` + detected columns.

### Step 2: Column Mapping
`apps/web/src/components/csv-import/Step2Mapping.tsx`

Table: CSV Column | Sample Data | Map To (select dropdown).
AI auto-detected mappings shown pre-filled.
"Map To" options: First Name / Last Name / Email / Phone / Address /
City / State / ZIP / Company Name / Notes / Skip This Column.
User can override any mapping.
Required fields highlighted: at least one of (First Name + Last Name) or
Company Name must be mapped.

### Step 3: Preview
`apps/web/src/components/csv-import/Step3Preview.tsx`

First 5 rows rendered as a table using the confirmed mappings.
"Looks good" button to continue.
"← Go Back and Fix" button.

### Step 4: Duplicate Detection
`apps/web/src/components/csv-import/Step4Duplicates.tsx`

Shows count of detected duplicates.
Table: CSV Row | Matched Customer | Match Reason (phone/email/name).
Options per row: Skip | Update Existing | Import as New.
"Select all: Skip Duplicates" bulk action.

### Step 5: Confirm
`apps/web/src/components/csv-import/Step5Confirm.tsx`

Summary: X customers to import | Y duplicates (action) | Z to skip.
"Start Import" button → POST `/api/v1/csv-import/:uploadId/start`.
Returns `importJobId`.

### Step 6: Progress
`apps/web/src/components/csv-import/Step6Progress.tsx`

Progress bar (polls `GET /api/v1/csv-import/:importJobId/status` every 2s).
Shows: processed / total count.
Estimated time remaining.
Cannot navigate away (warn if they try).

### Step 7: Results
`apps/web/src/components/csv-import/Step7Results.tsx`

Summary cards: ✅ Imported | ⏭ Skipped | ❌ Errors.
Error table (if any): row number + customer name + error reason.
"Download Error Report" → generates CSV of failed rows.
"Go to Customers →" button.
"Import Another File" → resets store.

---

## Agent 4 Audit Checklist

- [ ] `pnpm build` passes clean
- [ ] No `any` types
- [ ] File size validated client-side before upload (10MB)
- [ ] xlsx files parsed client-side and converted to CSV rows
- [ ] Required field mapping validated before allowing step 3
- [ ] Duplicate detection table renders for 0 duplicates correctly
- [ ] Progress polling cleans up interval on unmount
- [ ] Navigate-away warning fires during Step 6
- [ ] Error report CSV downloads correctly
- [ ] Store resets cleanly on "Import Another File"

---

## Notes
- `POST /api/v1/csv-import/upload` — already built in TICKET-011
- `POST /api/v1/csv-import/:uploadId/start`
- `GET /api/v1/csv-import/:importJobId/status`
- Git commit: "TICKET-032: CSV Import Wizard UI"