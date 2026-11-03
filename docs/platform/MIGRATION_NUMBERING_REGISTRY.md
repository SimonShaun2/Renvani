# SQL migration numbering registry (Tech Lead authority)

**Purpose:** One linear Drizzle journal (`packages/db/migrations/meta/_journal.json`). Prevent colliding `00xx_*.sql` tags across open PRs.  
**Canonical tip on `dev`:** idx **25** — `0025_agent_action_reversed_state` (pre-**0026** merge).  
**Owner:** Tech Lead (Grace) — **central idx assignment** below is authoritative for open PRs @ 2026-10-23.

**Rules**

1. Never renumber migrations **already merged** on `dev`.  
2. Open PRs use **only** the idx in the pending table for that PR — rename SQL + `_journal.json` on your branch.  
3. **Lineage columns** (`source_system`, `source_id`, `import_session_id`, lineage unique indexes on importable entities) live **only** in **`0026_fs_migrate_import_lineage`** (Noah **#96**). No other migration may `ADD COLUMN` those fields.  
4. FS-80 (#63) owns **policy** (transactions, locks, recovery); this registry owns **sequence**.  
5. Sync feature branches with **`git merge origin/dev`** only — **no rebase, no force-push**.

---

## Current `dev` chain (0000–0025)

| idx | Tag | Notes |
| --- | --- | --- |
| 0–16 | `0000` … `0016` | Historical FSM baseline |
| 17 | `0017_agent_control_plane` | Agent actions / control plane |
| 18–19 | `0018_growth_check_fs55`, `0019_growth_check_activity_events` | FS-55 |
| 20 | `0020_inquiry_intake_idempotency` | FS-17 |
| 21 | `0021_agent_action_approved_parameters` | FS-14 |
| 22 | `0022_fs53_growth_intake_foundation` | FS-53 |
| 23 | `0023_field_work_sync` | FS-87 |
| 24 | `0024_fs89_data_export_sessions` | FS-89 (#81 renumber) |
| 25 | `0025_agent_action_reversed_state` | Agent action enum `reversed` (#81) |

---

## Pending allocations (planned merge order)

Apply after **`git merge origin/dev`**. Contiguous chain **0026 → 0030**.

| idx | SQL tag | Owner | PR | Scope (migration file only) |
| --- | --- | --- | --- | --- |
| **26** | `0026_fs_migrate_import_lineage` | **Noah** | [#96](https://github.com/SimonShaun2/Renvani/pull/96) | **All import lineage DDL** — bundles, chunk runs, session progress, `source_system` / `source_id` / `import_session_id` on customers, jobs, invoices, payments, catalog, etc. |
| **27** | `0027_stack10_tenant_rls_policies` | **Sofia** | [#102](https://github.com/SimonShaun2/Renvani/pull/102) | RLS ENABLE/FORCE + policies (`customers`, `import_sessions`, `jobs`) from catalog |
| **28** | `0028_fs_migrate_onboarding_wizard` | **Ben** | [#114](https://github.com/SimonShaun2/Renvani/pull/114) | Wizard columns on `import_bundles`, bundle↔session links, `import.bundle.*` events — **no new lineage columns** |
| **29** | `0029_fs_migrate_price_book_catalog` | **Omar** | [#113](https://github.com/SimonShaun2/Renvani/pull/113) | `product_catalog`, line seeds, `price_book` entity — **do not edit `0026` SQL**; no duplicate lineage columns |
| **30** | `0030_fs_migrate_invoice_payment_import` | **Hana** | [#115](https://github.com/SimonShaun2/Renvani/pull/115) | `payments` import entity, commit indexes/constraints — **no duplicate lineage columns** (lineage in **0026** only) |

**No migration file**

| Owner | PR | Action on merge `dev` |
| --- | --- | --- |
| **Ezra** | [#110](https://github.com/SimonShaun2/Renvani/pull/110) | Drop `0027_stack10_*` SQL + journal from branch if present; keep Neon CI / `neon-per-pr-branch.mjs` only |

**Merge batch 1 (8–10 PRs, migration-aware merge order on `dev`)**

Candidates: **#96**, **#107**, **#117**, **#102**, **#114**, **#113**, **#115**, **#110**, **#112**, **#103**, **#101**, **#104** — single batched triple sign-off when all green at heads; merge as one batch (SQL order **0026 → 0030** preserved).

**FS-94 platform billing:** **⏸** per `BATCH-PLAN-5-9.md` §0 — do not allocate idx until founder/CoS budget gate.

---

## Owner sync procedure (2026-10-23)

1. `git fetch origin dev`  
2. `git merge origin/dev` on your feature branch (**no rebase, no force-push**).  
3. Rename your migration to **your assigned idx/tag**; fix `_journal.json` to stay contiguous with `dev`.  
4. Remove any lineage `ADD COLUMN` not in **0026** (coordinate with Noah if **0026** must gain a table you need).  
5. `pnpm --filter @fsm/db db:check-migrations` + `pnpm --filter @fsm/db test`.  
6. PR comment: `old_tag → new_tag` for E.. CoS.

---

## Changelog

| Date | Change |
| --- | --- |
| 2026-10-22 | Initial registry; mapped #52–#56 migration collision risk post-0017 |
| 2026-10-22 | Assigned **0023** to #75 (FS-87); #75 must renumber off `0018_field_work_sync` |
| 2026-10-22 | Synced tip to **0025** after #81; next free **0026**; FS-94 deferred |
| 2026-10-23 | **0026** reserved for FS-MIGRATE import lineage per ADR-FS-MIGRATE |
| 2026-10-23 | **Central assign 0026–0030** for #96, #102, #114, #113, #115; #110 migration stripped; lineage-only-in-0026 rule |
| 2026-10-23 | **0032** — FS-MIGRATE communications history (`message_logs` lineage + `communications` import entity) |
| 2026-10-23 | **0033** FS-MIGRATE notes import (`customer_notes`, job note lineage) — `cursor/fs-migrate-notes-1f27` |
| 2026-10-23 | Founder batch policy: 8–10 PRs per merge batch; auto CI at PR head |
