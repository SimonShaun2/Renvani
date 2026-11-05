# ADR-FS-MIGRATE: Import lineage, business timestamps, and chunked ingest contract

**Status:** **Accepted** ([PR #94](https://github.com/SimonShaun2/Renvani/pull/94) merged to `dev`; [PO ACK](https://github.com/SimonShaun2/Renvani/pull/94#issuecomment-6354477665) permits acceptance on merge)\
**Owner:** Tech Lead (Grace) · **PO:** Elena  
**Date:** 2026-10-23  
**Base SHA:** `9313130f536f24cbc914add1f000a2c0728db035` (`dev` post-#86)  
**Evidence:** [MVP-MIGRATION-EPIC-FS-MIGRATE](../planning/MVP-MIGRATION-EPIC-FS-MIGRATE.md) (PR #93); [MVP-PLATFORM-P0-INFRA](../planning/MVP-PLATFORM-P0-INFRA.md); [ADR-FS-41](ADR-FS-41-renvani-sor-integrations-addendum.md)  
**Supersedes:** None (extends FS-11 `import_sessions` rollback model)  
**Superseded by:** None

---

## Problem

FS-MIGRATE will ingest **multi-year** tabular history (100k+ rows per tenant), vendor **files**, and relational bundles. Implementation branches must not invent per-entity dedupe keys or timestamp semantics ad hoc.

Without a single contract:

- Chunk retries duplicate rows or skip partial progress unpredictably.
- Reporting, FS-72 reminder candidates, and reactivation signals read **`created_at = import time`** instead of vendor business dates.
- Rollback via `importSessionId` cannot reconcile with upsert-by-vendor-id re-runs.

## Decision

### 1. External lineage (required on every imported domain row)

For any row created or updated by FS-MIGRATE commit paths (customers, properties, assets, jobs, invoices, payments, estimates, products/price-book lines, notes, message history pointers, maintenance plans, attachments metadata):

| Field | Type (implementation) | Rules |
| --- | --- | --- |
| `source_system` | `varchar(64)` not null on ingest | Stable preset id: `service_fusion`, `jobber`, `servicetitan`, `housecall_pro`, `qbo`, `qbd`, `manual_csv`, … — registry in `@fsm/config` import presets (not free text from CSV). |
| `source_id` | `varchar(256)` not null on ingest | Opaque vendor primary key / composite serialized id **as exported** (trimmed); never another tenant’s Renvani UUID. |
| `import_session_id` | existing FK | **Rollback / audit** scope; all session-tagged rows soft-deleted together. |
| `import_bundle_id` | UUID (new, optional on session) | Groups multi-file onboarding; many `import_sessions` may share one bundle. |

**Uniqueness (tenant-scoped):**  
`UNIQUE (company_id, source_system, source_id, entity_type)` where `entity_type` is the **canonical import entity** (`ImportEntityType` / domain discriminator), enforced at commit time.

- Re-import of the same vendor row → **upsert** (update mutable fields, preserve Renvani `id`).
- Same `source_id` across different `entity_type` values → allowed (vendor id namespaces differ per export file).

**Non-goals:** cross-tenant lineage; live API sync keys (ADR-FS-41).

### 2. Business timestamps vs row metadata

| Concept | Column(s) | Rule |
| --- | --- | --- |
| **Business time** | Domain fields (`jobs.completedAt`, `invoices.paidAt`, `estimates.approvedAt`, `maintenance_plans.nextServiceDate`, …) | Map from vendor export columns. **Do not** substitute `now()` on commit. |
| **Ingestion time** | `created_at` / `updated_at` (Drizzle timestamps) | Set by DB on insert/update; audit only. |
| **Optional provenance** | `imported_at` on session or row-level JSON snapshot | Wizard/debug only; not used for reporting. |

Activity events emitted on import commit use **business time in payload** when the event type implies a historical fact (e.g. `job.completed` uses job completion date); `occurred_at` on `activity_events` follows existing emitter rules.

### 3. Chunked worker ingest contract (`fsm:imports`)

Large files **must not** parse inside API handlers. Chunk work is **child jobs** of a parent `import_sessions` row.

**Job name:** `import-chunk-commit` (v1).

**Payload (Zod in `@fsm/jobs`):**

```typescript
{
  companyId: string;           // uuid
  importSessionId: string;     // uuid
  importBundleId?: string;       // uuid
  sourceSystem: string;        // preset id
  entityType: ImportEntityType;
  chunkIndex: number;          // 0-based
  chunksTotal: number;
  cursor: {
    byteOffset?: number;       // stream parser
    rowOffset?: number;        // row-index parser
    lastSourceId?: string;     // resume hint
  };
  idempotencyKey: string;      // `${importSessionId}:${entityType}:${chunkIndex}`
  rowWindow?: { start: number; end: number };
}
```

**Idempotency rules:**

1. Worker checks `idempotencyKey` against `import_chunk_runs` (new table, migration **0026**) or session `progress` JSON before writing.
2. Row commit uses upsert on `(companyId, source_system, source_id, entity_type)`.
3. Re-queueing the same chunk with the same key → **no duplicate domain rows**; may refresh `updated_at`.
4. Failed rows → `import_row_errors` (or extended `validation_errors`) **without** rolling back successful sibling chunks.

**Progress on `import_sessions`:** extend `progress` jsonb (or dedicated columns) with:

`{ entityType, chunksTotal, chunksDone, rowsOk, rowsFailed, lastCursor, lastIdempotencyKey }` — surfaced in wizard.

**Partial failure:** `chunksDone < chunksTotal` with `status = preview|importing` is valid; operator retries failed chunks only.

### 4. File batch jobs (reference)

`migrate-file-batch` shares `importSessionId` / `importBundleId` and uses object-level idempotency (`companyId`, `source_system`, `r2_key` or vendor file id). Detailed in FS-MIGRATE epic §3; **same lineage fields** on `file_attachments` where applicable.

### 5. Database migration slot

| idx | Tag | Owner | Status |
| --- | --- | --- | --- |
| **26** | `0026_fs_migrate_import_lineage` | Grace / FS-MIGRATE | **Reserved** — implement tables/columns/indexes per §1–§3. Request from Tech Lead before `drizzle-kit generate`. |

No implementation branch may allocate **0026** for unrelated work. See [MIGRATION_NUMBERING_REGISTRY](../platform/MIGRATION_NUMBERING_REGISTRY.md).

## Security impact

- `source_id` may contain PII — log at `debug` only; never in `info` request logs.
- All queries remain scoped to `companyId`; uniqueness is per-tenant.
- Chunk payloads must include `companyId` and match session ownership before commit.

## Alternatives considered

| Alternative | Rejected because |
| --- | --- |
| Dedupe only on email/phone | Collapses multi-entity vendor exports; breaks history |
| `import_session_id` as sole key | Cannot upsert on chunk retry; rollback ≠ re-run |
| Global `source_id` without `entity_type` | Collides across export files |
| Single monolithic import job | OOM / timeout; no resume |

## Acceptance gates

| Party | Status |
| --- | --- |
| Tech Lead (Grace) | **Proposed** in [PR #94's PO record](https://github.com/SimonShaun2/Renvani/pull/94#issuecomment-6354477665); separate acceptance by Grace is not recorded in #94. |
| Product Owner (Elena) | **ACK** (PR #94) |
| Security (Sam) | **PASS** (PR #94) |
| Architecture (Chloe) | **PASS** (PR #94) |
| Founder (Shaun) | Merge approval to `dev` — founder-only, exact head (#420) |

## Consequences

- FS-MIGRATE processors, presets, and wizard UI **must** conform to this ADR; no alternate dedupe keys.
- FS-72 / reactivation jobs read **business dates** on jobs/invoices, not import `created_at`.
- Platform P0 acceptance in `MVP-PLATFORM-P0-INFRA.md` (chunk resume, idempotent re-run) is tested against this contract.
- Future live connectors require a **new ADR** (ADR-FS-41); lineage shape may reuse `source_system` / `source_id`.
