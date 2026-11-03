# SQL migration numbering registry (Tech Lead authority)

**Purpose:** One linear Drizzle journal (`packages/db/migrations/meta/_journal.json`). Prevent colliding `00xx_*.sql` tags across open PRs.  
**Canonical tip on `dev` @ `9313130` (post-#86):** idx **25** — `0025_agent_action_reversed_state`.  
**Next allocatable index:** **0026** — **reserved** for [ADR-FS-MIGRATE](../adr/ADR-FS-MIGRATE-import-lineage.md) (`0026_fs_migrate_import_lineage`); no other work without Tech Lead release.  
**Owner:** Tech Lead — pairs request slots in PR description before `drizzle-kit generate`.

**Rules**

1. Never renumber merged migrations on `dev`.  
2. Open PRs with conflicting numbers must **rebase and renumber** before E.. CoS merge to `dev`.  
3. One migration PR should prefer **one journal entry**; split only when rollback isolation requires it.  
4. FS-80 (#63) owns **policy** (transactions, locks, recovery); this registry owns **sequence**.

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

| 26 | `0026_fs_migrate_import_lineage` | **Reserved** — FS-MIGRATE lineage + chunk runs (ADR-FS-MIGRATE); implementation PR only |

**FS-94 platform billing:** **⏸** per `BATCH-PLAN-5-9.md` §0 — do not allocate idx until founder/CoS budget gate.

---

## Renumber procedure (for PR authors)

1. Fetch `dev`, note current max idx in `_journal.json`.  
2. New commits onto feature branch (no force-push).  
3. Rename SQL + update `_journal.json` entries to next contiguous indices.  
4. Run `pnpm --filter @fsm/db test` (includes migration-safety).  
5. Post old→new tag map in PR comment for E.. CoS.

---

## Changelog

| Date | Change |
| --- | --- |
| 2026-10-22 | Initial registry; mapped #52–#56 migration collision risk post-0017 |
| 2026-10-22 | Assigned **0023** to #75 (FS-87); #75 must renumber off `0018_field_work_sync` |
| 2026-10-22 | Synced tip to **0025** after #81; next free **0026**; FS-94 deferred |
| 2026-10-23 | **0026** reserved for FS-MIGRATE import lineage per ADR-FS-MIGRATE; tip unchanged @ **0025** |
