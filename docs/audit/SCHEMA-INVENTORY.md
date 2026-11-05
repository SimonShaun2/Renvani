# Canonical schema and migration source inventory

**Build specification 7. Source snapshot, November 5, 2026 (UTC).**
**Source:** `dev` at `b45b4996b64b16859e44a79b171b11cbe52c3e6a`. **Delivery:** complete source inventory; database replay, deployed equivalence and full legacy issue acceptance remain unverified.

## Scope and traceability

This implements the bounded source deliverable from [build specification 7](https://app.notion.com/p/40f317b92d158157997dcb3a1266058e), related to [legacy #5 / FSM-0004](https://github.com/SimonShaun2/Renvani/issues/5). It supplements the existing [FS-80 inventory](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/docs/platform/FS-80-database-inventory.md) and preserves that document’s 18-migration historical snapshot. FS-80 and ADR-FS-3 are related records, not an invented one-to-one successor or authorization to close #5. The current source authority remains [AGENTS.md](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/AGENTS.md) and [Drizzle configuration](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/drizzle.config.ts). No schema, migration, import, provider or application behavior changed.

The complete machine-readable [table/column/constraint and migration appendix](schema-source-inventory.json) contains all declarations, not only the selected fields discussed below. `id()` and `companyId()` are resolved to the helpers in the same canonical file; the shared `timestamps` spread is expanded for column counts. Source definitions, actual database constraints and deployed policy effectiveness are different evidence levels.

## Verified source counts

| Measure | Count / result |
|---|---:|
| Canonical `pgTable` declarations | 83 |
| Root snapshot `pgTable` declarations | 35 |
| Canonical tables missing from root snapshot | 48 |
| Canonical tables with `company_id` | 78 |
| Tables with intentional tenant-root, pre-tenant or platform scope | 5 |
| SQL migration files / journal entries | 62 / 62 |
| Distinct tables with ENABLE + FORCE RLS in checked-in SQL | 28 |
| Tables in original STACK-10 TypeScript RLS catalog | 3 |
| Applied migration / deployed schema / live-role RLS verification | Not performed |

Counts were derived from the pinned tree. The migration journal has exactly one entry for each SQL file, indices 0–61. Its `when` values are not monotonic: backward steps occur at 0021→0022, 0022→0023 and 0026→0027. A matching bundle does not establish clean replay or that any migration has been applied. File hashes in the appendix identify the inspected SQL bytes.

## Table register

Every row links to its canonical declaration. `C/U/D` means presence of `created_at` / `updated_at` / `deleted_at`, not a claim about retention or mutation behavior. RLS names the source migration that enables and forces policy enforcement; `none in SQL` means this inventory found no such declaration for that table, not that the table is necessarily publicly accessible. Foreign keys, index definitions and all column defaults are recorded in the JSON appendix.

| Table | Domain | Columns | Scope | C/U/D | Declared foreign keys / indexes or checks | RLS source |
|---|---|---:|---|---|---|---|
| [`companies`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L503) | Identity / tenant | 20 | Tenant root (`id`) | Y/Y/Y | 0 / 2 | none in SQL |
| [`clerk_workspace_intents`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L533) | Identity / tenant | 11 | Pre-tenant identity (`clerk_user_id`) | Y/Y/Y | 0 / 3 | none in SQL |
| [`clerk_workspace_intent_events`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L554) | Identity / tenant | 8 | Pre-tenant identity (`clerk_user_id`) | Y/Y/Y | 1 / 2 | none in SQL |
| [`users`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L566) | Identity / tenant | 21 | `company_id` NOT NULL | Y/Y/Y | 1 / 5 | none in SQL |
| [`refresh_tokens`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L599) | Identity / tenant | 7 | `company_id` NOT NULL | Y/N/N | 2 / 3 | none in SQL |
| [`service_areas`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L613) | Workforce / service | 9 | `company_id` NOT NULL | Y/Y/Y | 1 / 0 | none in SQL |
| [`customers`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L627) | Customer graph | 26 | `company_id` NOT NULL | Y/Y/Y | 2 / 4 | [0027](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0027_stack10_tenant_rls_policies.sql) |
| [`properties`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L669) | Customer graph | 24 | `company_id` NOT NULL | Y/Y/Y | 3 / 4 | none in SQL |
| [`assets`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L706) | Customer graph | 26 | `company_id` NOT NULL | Y/Y/Y | 4 / 7 | none in SQL |
| [`technicians`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L754) | Workforce / service | 23 | `company_id` NOT NULL | Y/Y/Y | 2 / 1 | none in SQL |
| [`jobs`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L788) | Workforce / service | 38 | `company_id` NOT NULL | Y/Y/Y | 8 / 8 | [0027](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0027_stack10_tenant_rls_policies.sql) |
| [`customer_notes`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L853) | Customer graph | 13 | `company_id` NOT NULL | Y/Y/Y | 4 / 3 | none in SQL |
| [`job_notes`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L877) | Workforce / service | 14 | `company_id` NOT NULL | Y/Y/Y | 4 / 1 | none in SQL |
| [`job_service_briefs`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L899) | Workforce / service | 12 | `company_id` NOT NULL | Y/Y/Y | 3 / 1 | [0049](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0049_fs25_service_agent_job_brief.sql) |
| [`job_photos`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L920) | Workforce / service | 12 | `company_id` NOT NULL | Y/Y/Y | 3 / 0 | none in SQL |
| [`estimates`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L938) | Estimates / money | 38 | `company_id` NOT NULL | Y/Y/Y | 6 / 7 | none in SQL |
| [`estimate_items`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L999) | Estimates / money | 15 | `company_id` NOT NULL | Y/Y/Y | 3 / 0 | none in SQL |
| [`invoices`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1020) | Estimates / money | 37 | `company_id` NOT NULL | Y/Y/Y | 6 / 6 | none in SQL |
| [`invoice_items`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1075) | Estimates / money | 15 | `company_id` NOT NULL | Y/Y/Y | 3 / 0 | none in SQL |
| [`payments`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1091) | Estimates / money | 24 | `company_id` NOT NULL | Y/Y/Y | 5 / 4 | none in SQL |
| [`vip_membership_tiers`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1137) | Agreements / retention | 13 | `company_id` NOT NULL | Y/Y/Y | 1 / 2 | none in SQL |
| [`service_agreement_templates`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1154) | Agreements / retention | 18 | `company_id` NOT NULL | Y/Y/Y | 1 / 2 | none in SQL |
| [`maintenance_plans`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1180) | Agreements / retention | 30 | `company_id` NOT NULL | Y/Y/Y | 6 / 6 | none in SQL |
| [`maintenance_visits`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1231) | Agreements / retention | 10 | `company_id` NOT NULL | Y/Y/Y | 3 / 0 | none in SQL |
| [`recurring_visit_series`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1255) | Agreements / retention | 16 | `company_id` NOT NULL | Y/Y/Y | 5 / 2 | [0048](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0048_fs59_recurring_visit_rls_unique.sql) |
| [`recurring_visit_occurrences`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1284) | Agreements / retention | 14 | `company_id` NOT NULL | Y/Y/Y | 4 / 2 | [0048](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0048_fs59_recurring_visit_rls_unique.sql) |
| [`schedule_slots`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1314) | Workforce / service | 14 | `company_id` NOT NULL | Y/Y/Y | 3 / 3 | none in SQL |
| [`activity_events`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1341) | Audit / agents | 15 | `company_id` NOT NULL | N/N/N | 1 / 6 | none in SQL |
| [`ai_recommendations`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1376) | Audit / agents | 26 | `company_id` NOT NULL | Y/Y/Y | 8 / 5 | none in SQL |
| [`campaigns`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1415) | Messaging | 22 | `company_id` NOT NULL | Y/Y/Y | 3 / 2 | none in SQL |
| [`campaign_recipients`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1445) | Messaging | 16 | `company_id` NOT NULL | Y/Y/Y | 4 / 0 | none in SQL |
| [`message_logs`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1470) | Messaging | 23 | `company_id` NOT NULL | Y/Y/Y | 5 / 4 | none in SQL |
| [`form_templates`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1512) | Forms / files | 13 | `company_id` NOT NULL | Y/Y/Y | 1 / 3 | none in SQL |
| [`form_submissions`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1536) | Forms / files | 14 | `company_id` NOT NULL | Y/Y/Y | 5 / 3 | none in SQL |
| [`import_bundles`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1563) | Imports / integrations | 14 | `company_id` NOT NULL | Y/Y/Y | 2 / 1 | none in SQL |
| [`saved_card_migrations`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1590) | Imports / integrations | 20 | `company_id` NOT NULL | Y/Y/Y | 4 / 3 | [0042](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0042_fs138_saved_card_migration.sql) |
| [`import_sessions`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1624) | Imports / integrations | 26 | `company_id` NOT NULL | Y/Y/Y | 4 / 4 | [0027](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0027_stack10_tenant_rls_policies.sql) |
| [`import_chunk_runs`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1666) | Imports / integrations | 16 | `company_id` NOT NULL | Y/Y/Y | 2 / 3 | none in SQL |
| [`integration_outbox_operations`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1706) | Imports / integrations | 14 | `company_id` NOT NULL | Y/Y/Y | 1 / 4 | [0050](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0050_fs15_integration_outbox_audit.sql) |
| [`integration_outbox_audit_events`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1738) | Imports / integrations | 7 | `company_id` NOT NULL | Y/N/N | 2 / 2 | [0050](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0050_fs15_integration_outbox_audit.sql) |
| [`stripe_disputes`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1769) | Estimates / money | 16 | `company_id` NOT NULL | Y/Y/Y | 2 / 4 | [0052](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0052_fs199_stripe_disputes.sql) |
| [`qbo_connections`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1814) | Imports / integrations | 14 | `company_id` NOT NULL | Y/Y/Y | 1 / 2 | [0035](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0035_fs133_qbo_ongoing_sync.sql) |
| [`qbo_sync_issues`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1832) | Imports / integrations | 16 | `company_id` NOT NULL | Y/Y/Y | 3 / 2 | [0035](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0035_fs133_qbo_ongoing_sync.sql) |
| [`data_export_sessions`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1854) | Imports / integrations | 16 | `company_id` NOT NULL | Y/Y/Y | 2 / 2 | none in SQL |
| [`automation_rules`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1886) | Audit / agents | 10 | `company_id` NOT NULL | Y/Y/Y | 1 / 3 | none in SQL |
| [`product_catalog`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1901) | Inventory | 19 | `company_id` NOT NULL | Y/Y/Y | 2 / 3 | none in SQL |
| [`import_invoice_line_seeds`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1930) | Imports / integrations | 11 | `company_id` NOT NULL | Y/Y/Y | 3 / 3 | none in SQL |
| [`job_tasks`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1954) | Workforce / service | 17 | `company_id` NOT NULL | Y/Y/Y | 4 / 3 | none in SQL |
| [`job_products`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L1976) | Workforce / service | 18 | `company_id` NOT NULL | Y/Y/Y | 4 / 2 | none in SQL |
| [`stock_locations`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2007) | Inventory | 9 | `company_id` NOT NULL | Y/Y/Y | 2 / 1 | [0044](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0044_fs170_inventory.sql) |
| [`stock_levels`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2019) | Inventory | 9 | `company_id` NOT NULL | Y/Y/Y | 3 / 2 | [0044](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0044_fs170_inventory.sql) |
| [`stock_movements`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2037) | Inventory | 13 | `company_id` NOT NULL | Y/N/N | 5 / 3 | [0044](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0044_fs170_inventory.sql) |
| [`time_entries`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2057) | Time / payroll | 13 | `company_id` NOT NULL | Y/Y/Y | 3 / 4 | none in SQL |
| [`timesheets`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2080) | Time / payroll | 16 | `company_id` NOT NULL | Y/Y/Y | 5 / 2 | [0045](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0045_fs171_timesheets_payroll.sql) |
| [`timesheet_audit_events`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2100) | Time / payroll | 10 | `company_id` NOT NULL | Y/N/N | 4 / 2 | [0045](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0045_fs171_timesheets_payroll.sql) |
| [`technician_pay_rates`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2116) | Time / payroll | 9 | `company_id` NOT NULL | Y/Y/Y | 3 / 2 | [0045](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0045_fs171_timesheets_payroll.sql) |
| [`review_requests`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2129) | Agreements / retention | 17 | `company_id` NOT NULL | Y/Y/Y | 4 / 5 | none in SQL |
| [`file_attachments`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2153) | Forms / files | 19 | `company_id` NOT NULL | Y/Y/Y | 2 / 4 | none in SQL |
| [`on_the_way_notifications`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2178) | Workforce / service | 14 | `company_id` NOT NULL | Y/Y/Y | 4 / 2 | none in SQL |
| [`booking_requests`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2196) | Booking / intake | 37 | `company_id` NOT NULL | Y/Y/Y | 4 / 5 | none in SQL |
| [`inquiry_submit_idempotency`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2241) | Booking / intake | 10 | `company_id` NOT NULL | Y/Y/Y | 2 / 2 | none in SQL |
| [`field_sync_batches`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2292) | Workforce / service | 10 | `company_id` NOT NULL | Y/Y/Y | 2 / 2 | none in SQL |
| [`field_sync_operations`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2314) | Workforce / service | 14 | `company_id` NOT NULL | Y/Y/Y | 3 / 2 | none in SQL |
| [`agent_actions`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2341) | Audit / agents | 21 | `company_id` NOT NULL | Y/Y/Y | 1 / 2 | none in SQL |
| [`growth_intake_checks`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2418) | Growth / marketing | 24 | `company_id` NOT NULL | Y/Y/Y | 3 / 3 | none in SQL |
| [`growth_intake_identity_candidates`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2455) | Growth / marketing | 12 | `company_id` NOT NULL | Y/Y/Y | 2 / 2 | none in SQL |
| [`growth_intake_findings`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2480) | Growth / marketing | 13 | `company_id` NOT NULL | Y/Y/Y | 2 / 2 | none in SQL |
| [`growth_intake_audit_events`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2503) | Growth / marketing | 10 | `company_id` NOT NULL | Y/N/N | 3 / 2 | none in SQL |
| [`qbo_entity_mappings`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2538) | Imports / integrations | 9 | `company_id` NOT NULL | Y/Y/Y | 1 / 2 | [0036](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0036_fs133_qbo_entity_mappings.sql) |
| [`booking_settings`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2555) | Booking / intake | 23 | `company_id` NOT NULL | Y/Y/Y | 1 / 2 | none in SQL |
| [`growth_check_scans`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2602) | Growth / marketing | 13 | `company_id` NOT NULL | Y/Y/Y | 2 / 2 | none in SQL |
| [`growth_check_findings`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2626) | Growth / marketing | 13 | `company_id` NOT NULL | Y/Y/Y | 2 / 3 | none in SQL |
| [`call_tracking_settings`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2651) | Growth / marketing | 12 | `company_id` NOT NULL | Y/Y/N | 2 / 1 | [0057](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0057_call_tracking.sql) |
| [`call_tracking_numbers`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2673) | Growth / marketing | 15 | `company_id` NOT NULL | Y/Y/Y | 1 / 2 | [0057](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0057_call_tracking.sql) |
| [`call_records`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2702) | Growth / marketing | 16 | `company_id` NOT NULL | Y/N/N | 2 / 3 | [0057](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0057_call_tracking.sql) |
| [`growth_check_finding_revisions`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2733) | Growth / marketing | 14 | `company_id` NOT NULL | Y/N/N | 4 / 5 | [0056](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0056_growth_check_finding_revisions.sql) |
| [`growth_check_report_drafts`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2771) | Growth / marketing | 11 | `company_id` NOT NULL | Y/Y/N | 4 / 2 | [0058](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0058_growth_check_reports.sql) |
| [`growth_check_report_draft_revisions`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2794) | Growth / marketing | 11 | `company_id` NOT NULL | Y/N/N | 3 / 3 | [0058](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0058_growth_check_reports.sql) |
| [`growth_check_report_shares`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2822) | Growth / marketing | 14 | `company_id` NOT NULL | Y/N/N | 4 / 4 | [0058](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0058_growth_check_reports.sql) |
| [`crews`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L3033) | Workforce / service | 9 | `company_id` NOT NULL | Y/Y/Y | 1 / 2 | [0053](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0053_fs195_crews.sql) |
| [`crew_members`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L3047) | Workforce / service | 8 | `company_id` NOT NULL | Y/Y/Y | 3 / 3 | [0053](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0053_fs195_crews.sql) |
| [`marketing_demo_requests`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L3065) | Growth / marketing | 10 | Platform prospect intake | Y/N/N | 0 / 2 | none in SQL |
| [`marketing_growth_checks`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L3082) | Growth / marketing | 9 | Platform prospect intake | Y/N/N | 0 / 2 | none in SQL |

## Relationships and constraints

The following is a source foreign-key register, with inherited `company_id → companies.id` omitted from the display only. The appendix retains it. A UUID column without `.references(...)` is not reported as an enforced foreign key. ORM `relations(...)`, embedded JSON identifiers and service-level ownership checks must not be confused with database constraints.

| Table | Declared additional foreign keys | Index / check names |
|---|---|---|
| `companies` | none | `companies_slug_idx`; `companies_clerk_organization_id_idx` |
| `clerk_workspace_intents` | none | `clerk_workspace_intents_clerk_user_idx`; `clerk_workspace_intents_attempt_idx`; `clerk_workspace_intents_clerk_org_idx` |
| `clerk_workspace_intent_events` | intent_id → clerk_workspace_intents.id | `clerk_workspace_intent_events_intent_idx`; `clerk_workspace_intent_events_clerk_user_idx` |
| `users` | none | `users_email_idx`; `users_email_company_idx`; `users_company_idx`; `users_email_verification_token_idx`; `users_clerk_user_id_idx` |
| `refresh_tokens` | user_id → users.id | `refresh_tokens_company_idx`; `refresh_tokens_user_idx`; `refresh_tokens_expires_at_idx` |
| `service_areas` | none | none in table callback |
| `customers` | import_session_id → import_sessions.id | `customers_company_idx`; `customers_email_idx`; `customers_last_service_idx`; `customers_import_lineage_idx` |
| `properties` | customer_id → customers.id; import_session_id → import_sessions.id | `properties_customer_idx`; `properties_company_idx`; `properties_zip_idx`; `properties_import_lineage_idx` |
| `assets` | property_id → properties.id; customer_id → customers.id; import_session_id → import_sessions.id | `assets_property_idx`; `assets_customer_idx`; `assets_company_idx`; `assets_type_idx`; `assets_warranty_idx`; `assets_install_idx`; `assets_import_lineage_idx` |
| `technicians` | user_id → users.id | `technicians_company_idx` |
| `jobs` | customer_id → customers.id; property_id → properties.id; asset_id → assets.id; technician_id → technicians.id; crew_id → crews.id; assigned_by_id → users.id; import_session_id → import_sessions.id | `jobs_company_idx`; `jobs_customer_idx`; `jobs_technician_idx`; `jobs_crew_idx`; `jobs_status_idx`; `jobs_scheduled_start_idx`; `jobs_job_number_company_idx`; `jobs_import_lineage_idx` |
| `customer_notes` | customer_id → customers.id; author_id → users.id; import_session_id → import_sessions.id | `customer_notes_company_idx`; `customer_notes_customer_idx`; `customer_notes_import_lineage_idx` |
| `job_notes` | job_id → jobs.id; author_id → users.id; import_session_id → import_sessions.id | `job_notes_import_lineage_idx` |
| `job_service_briefs` | job_id → jobs.id; approved_by_id → users.id | `job_service_briefs_company_job_idx` |
| `job_photos` | job_id → jobs.id; uploaded_by_id → users.id | none in table callback |
| `estimates` | job_id → jobs.id; customer_id → customers.id; property_id → properties.id; created_by_id → users.id; import_session_id → import_sessions.id | `estimates_company_idx`; `estimates_customer_idx`; `estimates_status_idx`; `estimates_approval_token_idx`; `estimates_tier_group_recommended_idx`; `estimates_number_company_idx`; `estimates_import_lineage_idx` |
| `estimate_items` | estimate_id → estimates.id; product_catalog_id → product_catalog.id | none in table callback |
| `invoices` | job_id → jobs.id; estimate_id → estimates.id; customer_id → customers.id; created_by_id → users.id; import_session_id → import_sessions.id | `invoices_company_idx`; `invoices_customer_idx`; `invoices_status_idx`; `invoices_due_idx`; `invoices_number_company_idx`; `invoices_import_lineage_idx` |
| `invoice_items` | invoice_id → invoices.id; product_catalog_id → product_catalog.id | none in table callback |
| `payments` | invoice_id → invoices.id; customer_id → customers.id; collected_by_id → users.id; import_session_id → import_sessions.id | `payments_company_idx`; `payments_invoice_idx`; `payments_stripe_intent_idx`; `payments_import_lineage_idx` |
| `vip_membership_tiers` | none | `vip_membership_tiers_company_idx`; `vip_membership_tiers_active_idx` |
| `service_agreement_templates` | none | `service_agreement_templates_company_idx`; `service_agreement_templates_active_idx` |
| `maintenance_plans` | customer_id → customers.id; property_id → properties.id; service_agreement_template_id → service_agreement_templates.id; vip_tier_id → vip_membership_tiers.id; import_session_id → import_sessions.id | `maintenance_plans_company_idx`; `maintenance_plans_customer_idx`; `maintenance_plans_next_service_idx`; `maintenance_plans_status_idx`; `maintenance_plans_stripe_sub_idx`; `maintenance_plans_import_lineage_idx` |
| `maintenance_visits` | maintenance_plan_id → maintenance_plans.id; job_id → jobs.id | none in table callback |
| `recurring_visit_series` | customer_id → customers.id; property_id → properties.id; maintenance_plan_id → maintenance_plans.id; anchor_maintenance_visit_id → maintenance_visits.id | `recurring_visit_series_company_idx`; `recurring_visit_series_active_plan_uidx` |
| `recurring_visit_occurrences` | series_id → recurring_visit_series.id; maintenance_visit_id → maintenance_visits.id; job_id → jobs.id | `recurring_visit_occurrences_series_index_uidx`; `recurring_visit_occurrences_company_series_idx` |
| `schedule_slots` | technician_id → technicians.id; job_id → jobs.id | `schedule_slots_technician_idx`; `schedule_slots_start_time_idx`; `schedule_slots_job_idx` |
| `activity_events` | none | `activity_events_company_idx`; `activity_events_entity_idx`; `activity_events_customer_idx`; `activity_events_job_idx`; `activity_events_event_type_idx`; `activity_events_occurred_at_idx` |
| `ai_recommendations` | customer_id → customers.id; property_id → properties.id; asset_id → assets.id; job_id → jobs.id; estimate_id → estimates.id; invoice_id → invoices.id; actioned_by_id → users.id | `ai_recommendations_company_idx`; `ai_recommendations_type_idx`; `ai_recommendations_status_idx`; `ai_recommendations_customer_idx`; `ai_recommendations_urgency_idx` |
| `campaigns` | created_by_id → users.id; ai_recommendation_id → ai_recommendations.id | `campaigns_company_idx`; `campaigns_status_idx` |
| `campaign_recipients` | campaign_id → campaigns.id; customer_id → customers.id; conversion_job_id → jobs.id | none in table callback |
| `message_logs` | customer_id → customers.id; job_id → jobs.id; campaign_id → campaigns.id; import_session_id → import_sessions.id | `message_logs_company_idx`; `message_logs_customer_idx`; `message_logs_job_idx`; `message_logs_import_lineage_idx` |
| `form_templates` | none | `form_templates_company_idx`; `form_templates_type_idx`; `form_templates_active_idx` |
| `form_submissions` | form_template_id → form_templates.id; job_id → jobs.id; asset_id → assets.id; submitted_by_id → users.id | `form_submissions_company_idx`; `form_submissions_job_idx`; `form_submissions_template_idx` |
| `import_bundles` | created_by_id → users.id | `import_bundles_company_idx` |
| `saved_card_migrations` | import_bundle_id → import_bundles.id; created_by_id → users.id; off_session_consent_acknowledged_by_id → users.id | `saved_card_migrations_company_idx`; `saved_card_migrations_bundle_idx`; `saved_card_migrations_status_idx` |
| `import_sessions` | created_by_id → users.id; import_bundle_id → import_bundles.id; rolled_back_by_id → users.id | `import_sessions_company_idx`; `import_sessions_status_idx`; `import_sessions_entity_type_idx`; `import_sessions_bundle_idx` |
| `import_chunk_runs` | import_session_id → import_sessions.id | `import_chunk_runs_company_idx`; `import_chunk_runs_session_idx`; `import_chunk_runs_idempotency_key_idx` |
| `integration_outbox_operations` | none | `integration_outbox_operations_company_kind_idempotency_idx`; `integration_outbox_operations_company_correlation_idx`; `integration_outbox_operations_status_updated_idx`; `integration_outbox_operations_kind_format_chk` |
| `integration_outbox_audit_events` | outbox_operation_id → integration_outbox_operations.id | `integration_outbox_audit_events_company_operation_idx`; `integration_outbox_audit_events_retry_receipt_key_idx` |
| `stripe_disputes` | payment_id → payments.id | `stripe_disputes_company_dispute_idx`; `stripe_disputes_company_status_disputed_idx`; `stripe_disputes_status_format_chk`; `stripe_disputes_reason_format_chk` |
| `qbo_connections` | none | `qbo_connections_company_idx`; `qbo_connections_realm_idx` |
| `qbo_sync_issues` | connection_id → qbo_connections.id; resolved_by_id → users.id | `qbo_sync_issues_company_idx`; `qbo_sync_issues_open_idx` |
| `data_export_sessions` | requested_by_id → users.id | `data_export_sessions_company_idx`; `data_export_sessions_status_idx` |
| `automation_rules` | none | `automation_rules_company_idx`; `automation_rules_rule_type_idx`; `automation_rules_company_rule_type_idx` |
| `product_catalog` | import_session_id → import_sessions.id | `product_catalog_company_idx`; `product_catalog_active_idx`; `product_catalog_lineage_company_idx` |
| `import_invoice_line_seeds` | import_session_id → import_sessions.id; product_catalog_id → product_catalog.id | `import_invoice_line_seeds_company_idx`; `import_invoice_line_seeds_session_idx`; `import_invoice_line_seeds_lookup_idx` |
| `job_tasks` | job_id → jobs.id; assigned_to_id → technicians.id; completed_by_id → users.id | `job_tasks_company_idx`; `job_tasks_job_idx`; `job_tasks_status_idx` |
| `job_products` | job_id → jobs.id; product_catalog_id → product_catalog.id; added_by_id → users.id | `job_products_company_idx`; `job_products_job_idx` |
| `stock_locations` | technician_id → technicians.id | `stock_locations_company_idx` |
| `stock_levels` | location_id → stock_locations.id; product_id → product_catalog.id | `stock_levels_company_idx`; `stock_levels_company_location_product_idx` |
| `stock_movements` | location_id → stock_locations.id; product_id → product_catalog.id; job_id → jobs.id; actor_user_id → users.id | `stock_movements_company_idx`; `stock_movements_location_product_idx`; `stock_movements_job_idx` |
| `time_entries` | job_id → jobs.id; technician_id → technicians.id | `time_entries_company_idx`; `time_entries_job_idx`; `time_entries_technician_idx`; `time_entries_open_technician_idx` |
| `timesheets` | technician_id → technicians.id; submitted_by_id → users.id; approved_by_id → users.id; rejected_by_id → users.id | `timesheets_company_idx`; `timesheets_company_technician_period_idx` |
| `timesheet_audit_events` | timesheet_id → timesheets.id; time_entry_id → time_entries.id; actor_user_id → users.id | `timesheet_audit_events_company_idx`; `timesheet_audit_events_timesheet_idx` |
| `technician_pay_rates` | technician_id → technicians.id; created_by_id → users.id | `technician_pay_rates_company_idx`; `technician_pay_rates_company_technician_effective_idx` |
| `review_requests` | job_id → jobs.id; customer_id → customers.id; technician_id → technicians.id | `review_requests_company_idx`; `review_requests_customer_idx`; `review_requests_job_idx`; `review_requests_status_idx`; `review_requests_reference_idx` |
| `file_attachments` | uploaded_by_id → users.id | `file_attachments_company_idx`; `file_attachments_entity_idx`; `file_attachments_job_idx`; `file_attachments_customer_idx` |
| `on_the_way_notifications` | job_id → jobs.id; technician_id → technicians.id; customer_id → customers.id | `on_the_way_company_idx`; `on_the_way_job_idx` |
| `booking_requests` | customer_id → customers.id; job_id → jobs.id; assigned_technician_id → technicians.id | `booking_requests_company_idx`; `booking_requests_status_idx`; `booking_requests_zip_idx`; `booking_requests_source_idx`; `booking_requests_phone_idx` |
| `inquiry_submit_idempotency` | booking_request_id → booking_requests.id | `inquiry_submit_idempotency_company_key_idx`; `inquiry_submit_idempotency_expires_idx` |
| `field_sync_batches` | user_id → users.id | `field_sync_batches_device_client_idx`; `field_sync_batches_company_user_idx` |
| `field_sync_operations` | batch_id → field_sync_batches.id; job_id → jobs.id | `field_sync_operations_company_client_op_idx`; `field_sync_operations_batch_sequence_idx` |
| `agent_actions` | none | `agent_actions_company_idempotency_idx`; `agent_actions_company_state_idx` |
| `growth_intake_checks` | owner_user_id → users.id; created_by_id → users.id | `growth_intake_checks_company_status_idx`; `growth_intake_checks_company_owner_idx`; `growth_intake_checks_company_review_idx` |
| `growth_intake_identity_candidates` | growth_intake_check_id → growth_intake_checks.id | `growth_intake_identity_candidates_check_idx`; `growth_intake_identity_candidates_company_check_idx` |
| `growth_intake_findings` | growth_intake_check_id → growth_intake_checks.id | `growth_intake_findings_check_idx`; `growth_intake_findings_company_check_idx` |
| `growth_intake_audit_events` | growth_intake_check_id → growth_intake_checks.id; actor_id → users.id | `growth_intake_audit_events_company_entity_idx`; `growth_intake_audit_events_company_check_idx` |
| `qbo_entity_mappings` | none | `qbo_entity_mappings_company_idx`; `qbo_entity_mappings_lookup_idx` |
| `booking_settings` | none | `booking_settings_company_idx`; `booking_settings_slug_idx` |
| `growth_check_scans` | requested_by_user_id → users.id | `growth_check_scans_company_idx`; `growth_check_scans_company_idempotency_idx` |
| `growth_check_findings` | scan_id → growth_check_scans.id | `growth_check_findings_company_idx`; `growth_check_findings_scan_idx`; `growth_check_findings_scan_check_idx` |
| `call_tracking_settings` | updated_by_user_id → users.id | `call_tracking_settings_company_idx` |
| `call_tracking_numbers` | none | `call_tracking_numbers_company_idx`; `call_tracking_numbers_tracking_number_idx` |
| `call_records` | tracking_number_id → call_tracking_numbers.id | `call_records_company_started_idx`; `call_records_tracking_number_idx`; `call_records_provider_call_idx` |
| `growth_check_finding_revisions` | finding_id → growth_check_findings.id; scan_id → growth_check_scans.id; actor_user_id → users.id | `growth_check_finding_revisions_company_idx`; `growth_check_finding_revisions_finding_idx`; `growth_check_finding_revisions_scan_idx`; `growth_check_finding_revisions_finding_revision_idx`; `growth_check_finding_revisions_company_idempotency_idx` |
| `growth_check_report_drafts` | scan_id → growth_check_scans.id; approved_by_user_id → users.id; created_by_user_id → users.id | `growth_check_report_drafts_company_idx`; `growth_check_report_drafts_company_scan_idx` |
| `growth_check_report_draft_revisions` | draft_id → growth_check_report_drafts.id; actor_user_id → users.id | `growth_check_report_draft_revisions_company_idx`; `growth_check_report_draft_revisions_draft_version_idx`; `growth_check_report_draft_revisions_company_idempotency_idx` |
| `growth_check_report_shares` | draft_id → growth_check_report_drafts.id; created_by_user_id → users.id; revoked_by_user_id → users.id | `growth_check_report_shares_company_idx`; `growth_check_report_shares_draft_idx`; `growth_check_report_shares_token_hash_idx`; `growth_check_report_shares_company_idempotency_idx` |
| `crews` | none | `crews_company_idx`; `crews_company_name_idx` |
| `crew_members` | crew_id → crews.id; technician_id → technicians.id | `crew_members_company_idx`; `crew_members_technician_idx`; `crew_members_crew_technician_idx` |
| `marketing_demo_requests` | none | `marketing_demo_requests_created_at_idx`; `marketing_demo_requests_email_idx` |
| `marketing_growth_checks` | none | `marketing_growth_checks_created_at_idx`; `marketing_growth_checks_email_idx` |

Constraints include tenant-key uniqueness for inquiry idempotency, source mapping and outbox operations; partial active-row uniqueness appears in recurring-visit and crew records. This register preserves exact definitions in the appendix rather than declaring all relationship constraints sufficient. SQL-only constraints and indexes can differ from the current Drizzle declaration; confirm equivalence in an isolated replay before changing either.

## Intentional non-company scopes and lifecycle exceptions

| Table(s) | Source rationale and required boundary |
|---|---|
| `companies` | Tenant root identified by its own `id`; a self-referential company_id is not expected. Staff access still requires a verified membership. |
| `clerk_workspace_intents`, `clerk_workspace_intent_events` | Explicit pre-tenant identity records. Ownership is the verified Clerk subject (`clerk_user_id`); tenant binding and subsequent tenant activity events happen later. See [workspace-intent service](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/apps/api/src/services/clerk-workspace-intent.service.ts). |
| `marketing_demo_requests`, `marketing_growth_checks` | Explicit platform-level prospect intake before a customer tenant exists. Source comments intentionally omit company_id and tenant RLS. Restricted operational access, retention and abuse handling require their own evidence; not a missing-tenant-column diagnosis. |

Fourteen tables omit `deleted_at`; twelve omit `updated_at`. Several are audit or append-only records, but the count alone does not establish a justified retention exception. The table register identifies each omission. `refresh_tokens` instead has `expires_at` and `revoked_at`; marketing intake has only `created_at`. Review retention and purge policy with the owning domain without adding generic soft-delete fields to audit tables in this documentation change.

## Three formerly omitted tables

### refresh_tokens

[`refresh_tokens`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L599) is absent from the root snapshot. All current columns are listed below; source type/default/nullable semantics are preserved.

| Property / database column | Declaration |
|---|---|
| `id` / `id` | `id()` |
| `companyId` / `company_id` | `companyId()` |
| `userId` / `user_id` | `uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" })` |
| `tokenHash` / `token_hash` | `text("token_hash").notNull()` |
| `expiresAt` / `expires_at` | `timestamp("expires_at").notNull()` |
| `revokedAt` / `revoked_at` | `timestamp("revoked_at")` |
| `createdAt` / `created_at` | `timestamp("created_at").notNull().defaultNow()` |

`token_hash` is a required text digest column; expiry and revocation are separate fields. The canonical service hashes tokens before persistence; database encryption-at-rest and deployed grants were not inspected. Company and user foreign keys have cascading delete declarations even though normal application deletes are soft deletes. The absence of updated_at/deleted_at is explicit rather than hidden by the shared helper.

### booking_settings

[`booking_settings`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2555) is absent from the root snapshot. All current columns are listed below; source type/default/nullable semantics are preserved.

| Property / database column | Declaration |
|---|---|
| `id` / `id` | `id()` |
| `companyId` / `company_id` | `companyId()` |
| `isEnabled` / `is_enabled` | `boolean("is_enabled").notNull().default(false)` |
| `bookingSlug` / `booking_slug` | `varchar("booking_slug", { length: 100 })` |
| `offeredServices` / `offered_services` | `jsonb("offered_services").default([])` |
| `availableHoursStart` / `available_hours_start` | `integer("available_hours_start").default(8)` |
| `availableHoursEnd` / `available_hours_end` | `integer("available_hours_end").default(17)` |
| `availableDays` / `available_days` | `text("available_days").array().default(["mon", "tue", "wed", "thu", "fri"])` |
| `slotDuration` / `slot_duration` | `integer("slot_duration").default(2)` |
| `maxAdvanceDays` / `max_advance_days` | `integer("max_advance_days").default(14)` |
| `autoConfirm` / `auto_confirm` | `boolean("auto_confirm").default(false)` |
| `googleReviewUrl` / `google_review_url` | `text("google_review_url")` |
| `yelpReviewUrl` / `yelp_review_url` | `text("yelp_review_url")` |
| `facebookReviewUrl` / `facebook_review_url` | `text("facebook_review_url")` |
| `customReviewUrl` / `custom_review_url` | `text("custom_review_url")` |
| `tagline` / `tagline` | `text("tagline")` |
| `allowZipOverflow` / `allow_zip_overflow` | `boolean("allow_zip_overflow").default(false)` |
| `balanceWorkload` / `balance_workload` | `boolean("balance_workload").default(true)` |
| `notifyOnNewBooking` / `notify_on_new_booking` | `boolean("notify_on_new_booking").default(true)` |
| `notificationEmail` / `notification_email` | `varchar("notification_email", { length: 255 })` |
| `createdAt` / `created_at` | `timestamp("created_at").notNull().defaultNow()` |
| `updatedAt` / `updated_at` | `timestamp("updated_at").notNull().defaultNow()` |
| `deletedAt` / `deleted_at` | `timestamp("deleted_at")` |

Booking starts disabled (`is_enabled = false`); auto-confirm is false; the company and slug indexes are unique. These are schema defaults, not evidence of any tenant’s current settings. JSON `offered_services` and company settings require application-level shape validation.

### booking_requests

[`booking_requests`](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/schema.ts#L2196) is absent from the root snapshot. All current columns are listed below; source type/default/nullable semantics are preserved.

| Property / database column | Declaration |
|---|---|
| `id` / `id` | `id()` |
| `companyId` / `company_id` | `companyId()` |
| `customerId` / `customer_id` | `uuid("customer_id").references(() => customers.id)` |
| `jobId` / `job_id` | `uuid("job_id").references(() => jobs.id)` |
| `assignedTechnicianId` / `assigned_technician_id` | `uuid("assigned_technician_id").references(() => technicians.id)` |
| `firstName` / `first_name` | `varchar("first_name", { length: 100 }).notNull()` |
| `lastName` / `last_name` | `varchar("last_name", { length: 100 }).notNull()` |
| `phone` / `phone` | `varchar("phone", { length: 30 }).notNull()` |
| `email` / `email` | `varchar("email", { length: 255 })` |
| `addressLine1` / `address_line1` | `varchar("address_line1", { length: 255 }).notNull()` |
| `addressLine2` / `address_line2` | `varchar("address_line2", { length: 100 })` |
| `city` / `city` | `varchar("city", { length: 100 }).notNull()` |
| `state` / `state` | `varchar("state", { length: 50 }).notNull()` |
| `zip` / `zip` | `varchar("zip", { length: 20 }).notNull()` |
| `propertyType` / `property_type` | `varchar("property_type", { length: 30 }).default("residential")` |
| `serviceCategory` / `service_category` | `varchar("service_category", { length: 100 })` |
| `serviceType` / `service_type` | `varchar("service_type", { length: 100 })` |
| `serviceDetail` / `service_detail` | `varchar("service_detail", { length: 255 })` |
| `urgency` / `urgency` | `varchar("urgency", { length: 30 }).default("this_week")` |
| `customerNotes` / `customer_notes` | `text("customer_notes")` |
| `preferredDate` / `preferred_date` | `date("preferred_date")` |
| `preferredWindow` / `preferred_window` | `varchar("preferred_window", { length: 50 })` |
| `status` / `status` | `bookingRequestStatusEnum("status").notNull().default("pending")` |
| `source` / `source` | `bookingSourceEnum("source").notNull().default("direct")` |
| `leadAttribution` / `lead_attribution` | `jsonb("lead_attribution").$type<Partial<Record<string, string>>>()` |
| `referenceNumber` / `reference_number` | `varchar("reference_number", { length: 50 })` |
| `isPropertyOwner` / `is_property_owner` | `boolean("is_property_owner").default(false)` |
| `smsConsentAppointments` / `sms_consent_appointments` | `boolean("sms_consent_appointments").default(false)` |
| `smsConsentMarketing` / `sms_consent_marketing` | `boolean("sms_consent_marketing").default(false)` |
| `confirmedAt` / `confirmed_at` | `timestamp("confirmed_at")` |
| `confirmedById` / `confirmed_by_id` | `uuid("confirmed_by_id")` |
| `confirmationSentAt` / `confirmation_sms_sent_at` | `timestamp("confirmation_sms_sent_at")` |
| `cancelledAt` / `cancelled_at` | `timestamp("cancelled_at")` |
| `cancellationReason` / `cancellation_reason` | `text("cancellation_reason")` |
| `createdAt` / `created_at` | `timestamp("created_at").notNull().defaultNow()` |
| `updatedAt` / `updated_at` | `timestamp("updated_at").notNull().defaultNow()` |
| `deletedAt` / `deleted_at` | `timestamp("deleted_at")` |

**Consent:** `smsConsentAppointments` maps to `sms_consent_appointments`, and `smsConsentMarketing` maps to `sms_consent_marketing`. Both default to **false** and neither has a `.notNull()` declaration. A nullable legacy value therefore exists in the declared type and must not be treated as affirmative consent. Appointment consent and marketing consent remain separate. This snapshot has no ordered consent-ledger or platform phone-opt-out table from the open #430/#431 work; those proposals must not be described as integrated.

## Money, identifiers and sensitive fields

All 51 `decimal(...)` declarations are listed below, including non-money quantities, rates and coordinates. No `real`, `doublePrecision` or float-type column constructor occurs in the canonical table declarations. This is a storage-type observation, not verification that every calculation or API serializer avoids floating-point arithmetic. Integer minor-unit amounts are recorded separately.

| Table | Decimal fields and precision/scale |
|---|---|
| `customers` | `decimal("lifetime_value", { precision: 10, scale: 2 }).default("0")` |
| `properties` | `decimal("lat", { precision: 10, scale: 7 })`; `decimal("lng", { precision: 10, scale: 7 })` |
| `assets` | `decimal("replacement_probability", { precision: 5, scale: 4 })` |
| `technicians` | `decimal("hours_per_day", { precision: 4, scale: 2 }).default("8")`; `decimal("estimate_close_rate", { precision: 5, scale: 4 })`; `decimal("avg_ticket_value", { precision: 10, scale: 2 })` |
| `jobs` | `decimal("estimate_total", { precision: 10, scale: 2 })`; `decimal("invoice_total", { precision: 10, scale: 2 })`; `decimal("amount_paid", { precision: 10, scale: 2 }).default("0")` |
| `estimates` | `decimal("subtotal", { precision: 10, scale: 2 }).notNull().default("0")`; `decimal("tax_rate", { precision: 5, scale: 4 }).default("0")`; `decimal("tax_amount", { precision: 10, scale: 2 }).default("0")`; `decimal("discount_amount", { precision: 10, scale: 2 }).default("0")`; `decimal("total", { precision: 10, scale: 2 }).notNull().default("0")` |
| `estimate_items` | `decimal("quantity", { precision: 10, scale: 3 }).notNull().default("1")`; `decimal("unit_price", { precision: 10, scale: 2 }).notNull()`; `decimal("total", { precision: 10, scale: 2 }).notNull()` |
| `invoices` | `decimal("subtotal", { precision: 10, scale: 2 }).notNull().default("0")`; `decimal("tax_rate", { precision: 5, scale: 4 }).default("0")`; `decimal("tax_amount", { precision: 10, scale: 2 }).default("0")`; `decimal("discount_amount", { precision: 10, scale: 2 }).default("0")`; `decimal("total", { precision: 10, scale: 2 }).notNull().default("0")`; `decimal("amount_paid", { precision: 10, scale: 2 }).default("0")`; `decimal("balance_due", { precision: 10, scale: 2 }).notNull().default("0")`; `decimal("service_fee_amount", { precision: 10, scale: 2 }).notNull().default("0")`; `decimal("booking_fee_amount", { precision: 10, scale: 2 }).notNull().default("0")` |
| `invoice_items` | `decimal("quantity", { precision: 10, scale: 3 }).notNull().default("1")`; `decimal("unit_price", { precision: 10, scale: 2 }).notNull()`; `decimal("total", { precision: 10, scale: 2 }).notNull()` |
| `payments` | `decimal("amount", { precision: 10, scale: 2 }).notNull()`; `decimal("service_fee_amount", { precision: 10, scale: 2 }).notNull().default("0")`; `decimal("booking_fee_amount", { precision: 10, scale: 2 }).notNull().default("0")`; `decimal("amount_refunded", { precision: 10, scale: 2 }).notNull().default("0")` |
| `vip_membership_tiers` | `decimal("monthly_price", { precision: 10, scale: 2 }).notNull()`; `decimal("discount_percent", { precision: 5, scale: 2 }).notNull().default("0")` |
| `service_agreement_templates` | `decimal("monthly_price", { precision: 10, scale: 2 })`; `decimal("annual_price", { precision: 10, scale: 2 })` |
| `maintenance_plans` | `decimal("price", { precision: 10, scale: 2 })` |
| `ai_recommendations` | `decimal("estimated_revenue", { precision: 10, scale: 2 })` |
| `campaigns` | `decimal("revenue_attributed", { precision: 10, scale: 2 }).default("0")` |
| `stripe_disputes` | `decimal("amount", { precision: 10, scale: 2 }).notNull()` |
| `product_catalog` | `decimal("unit_price", { precision: 10, scale: 2 }).notNull().default("0")`; `decimal("cost", { precision: 10, scale: 2 })` |
| `job_products` | `decimal("quantity", { precision: 10, scale: 3 }).notNull().default("1")`; `decimal("unit_price", { precision: 10, scale: 2 }).notNull()`; `decimal("total", { precision: 10, scale: 2 }).notNull()` |
| `on_the_way_notifications` | `decimal("technician_lat", { precision: 10, scale: 7 })`; `decimal("technician_lng", { precision: 10, scale: 7 })` |
| `agent_actions` | `decimal("confidence", { precision: 5, scale: 4 })` |
| `growth_intake_identity_candidates` | `decimal("confidence_score", { precision: 5, scale: 4 })` |

| Table | Integer amount/rate fields requiring explicit unit interpretation |
|---|---|
| `customers` | `total_jobs` |
| `technicians` | `total_jobs_completed` |
| `import_sessions` | `total_rows` |
| `import_chunk_runs` | `chunks_total` |
| `technician_pay_rates` | `hourly_rate_cents` |

The following field-name register is a review aid, not an exhaustive PII or encryption audit. Names, addresses, email, phone, notes, photos and payload JSON also contain sensitive customer data. No values or credentials were read.

| Table | Security/payment/consent identifiers observed |
|---|---|
| `companies` | `stripe_customer_id`; `stripe_account_id` |
| `users` | `password_hash`; `password_changed_at`; `email_verification_token_hash` |
| `refresh_tokens` | `token_hash` |
| `customers` | `stripe_customer_id` |
| `jobs` | `signature_url` |
| `estimates` | `approval_token`; `approved_signature_url` |
| `invoices` | `stripe_payment_link_id`; `stripe_payment_link_url`; `payment_token` |
| `payments` | `stripe_payment_intent_id`; `stripe_charge_id` |
| `vip_membership_tiers` | `stripe_monthly_price_id` |
| `service_agreement_templates` | `stripe_mthly_price_id`; `stripe_annual_price_id` |
| `maintenance_plans` | `stripe_subscription_id`; `stripe_price_id`; `stripe_current_period_start`; `stripe_current_period_end`; `stripe_cancel_at_period_end` |
| `saved_card_migrations` | `stripe_import_reference`; `off_session_consent_acknowledged_at`; `off_session_consent_acknowledged_by_id`; `off_session_consent_text_version`; `off_session_consent_batch_id` |
| `stripe_disputes` | `stripe_dispute_id`; `stripe_charge_id`; `stripe_payment_intent_id` |
| `qbo_connections` | `access_token_enc`; `refresh_token_enc`; `access_token_expires_at` |
| `booking_requests` | `sms_consent_appointments`; `sms_consent_marketing` |
| `inquiry_submit_idempotency` | `payload_hash` |
| `field_sync_operations` | `payload_hash` |
| `agent_actions` | `payload_hash` |
| `call_tracking_settings` | `consent_mode` |
| `call_records` | `caller_hash`; `caller_consent` |
| `growth_check_finding_revisions` | `payload_hash` |
| `growth_check_report_draft_revisions` | `payload_hash` |
| `growth_check_report_shares` | `content_hash`; `token_hash`; `payload_hash` |
| `marketing_demo_requests` | `ip_hash` |
| `marketing_growth_checks` | `ip_hash` |

Application-level encryption fields such as `qbo_connections.access_token_enc` and `refresh_token_enc` are declared as text. The names do not prove key custody, encryption-at-rest or credential rotation. Existing FS-76 and Security work owns that runtime evidence.

## RLS source coverage

The original [STACK-10 catalog](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/rls-policy-catalog.ts) lists **customers, import_sessions and jobs** and generates migration 0027. Later SQL independently adds policy declarations; it is therefore incorrect to use that three-entry catalog as the full RLS denominator. Across 62 SQL files, **28 distinct canonical tables** have ENABLE, FORCE and CREATE POLICY statements using `app.current_company_id`. All 28 have company_id in the canonical schema. No database query was made to verify application, role bypass flags, session setting, grants or cross-tenant behavior.

The remaining 50 company-scoped tables have no ENABLE/FORCE RLS declaration in this source snapshot. Many rely on explicit tenant predicates. This is a review boundary, not a conclusion that they are exploitable. The existing [STACK-10 policy specification](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/docs/security/STACK-10-rls-policy-spec.md), [FS-42 audit](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/docs/security/FS-42-tenant-access-audit.md) and [STACK-03 matrix](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/docs/security/STACK-03-cross-tenant-ci-matrix.md) remain the related security records. A proposed RLS rollout needs service/session and database-role compatibility analysis.

## Migration register

Each row exists in the checked-in journal and SQL directory. **Applied status and clean replay are not verified for every row.** No migration was executed, edited or generated. Content hashes, journal timestamp and RLS effects are in the appendix.

| Journal index | SQL file | Tables receiving RLS in this file |
|---:|---|---|
| 0 | [0000_luxuriant_gabe_jones](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0000_luxuriant_gabe_jones.sql) | none |
| 1 | [0001_flimsy_ma_gnuci](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0001_flimsy_ma_gnuci.sql) | none |
| 2 | [0002_sleepy_fixer](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0002_sleepy_fixer.sql) | none |
| 3 | [0003_greedy_norrin_radd](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0003_greedy_norrin_radd.sql) | none |
| 4 | [0004_nasty_wasp](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0004_nasty_wasp.sql) | none |
| 5 | [0005_sharp_lethal_legion](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0005_sharp_lethal_legion.sql) | none |
| 6 | [0006_strong_boomer](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0006_strong_boomer.sql) | none |
| 7 | [0007_smart_lily_hollister](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0007_smart_lily_hollister.sql) | none |
| 8 | [0008_equal_sharon_ventura](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0008_equal_sharon_ventura.sql) | none |
| 9 | [0009_tan_malice](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0009_tan_malice.sql) | none |
| 10 | [0010_futuristic_tombstone](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0010_futuristic_tombstone.sql) | none |
| 11 | [0011_perpetual_cammi](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0011_perpetual_cammi.sql) | none |
| 12 | [0012_grey_eternals](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0012_grey_eternals.sql) | none |
| 13 | [0013_spicy_victor_mancha](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0013_spicy_victor_mancha.sql) | none |
| 14 | [0014_windy_exiles](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0014_windy_exiles.sql) | none |
| 15 | [0015_fluffy_karnak](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0015_fluffy_karnak.sql) | none |
| 16 | [0016_soft_solo](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0016_soft_solo.sql) | none |
| 17 | [0017_agent_control_plane](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0017_agent_control_plane.sql) | none |
| 18 | [0018_growth_check_fs55](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0018_growth_check_fs55.sql) | none |
| 19 | [0019_growth_check_activity_events](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0019_growth_check_activity_events.sql) | none |
| 20 | [0020_inquiry_intake_idempotency](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0020_inquiry_intake_idempotency.sql) | none |
| 21 | [0021_agent_action_approved_parameters](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0021_agent_action_approved_parameters.sql) | none |
| 22 | [0022_fs53_growth_intake_foundation](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0022_fs53_growth_intake_foundation.sql) | none |
| 23 | [0023_field_work_sync](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0023_field_work_sync.sql) | none |
| 24 | [0024_fs89_data_export_sessions](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0024_fs89_data_export_sessions.sql) | none |
| 25 | [0025_agent_action_reversed_state](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0025_agent_action_reversed_state.sql) | none |
| 26 | [0026_fs_migrate_import_lineage](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0026_fs_migrate_import_lineage.sql) | none |
| 27 | [0027_stack10_tenant_rls_policies](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0027_stack10_tenant_rls_policies.sql) | `customers`, `import_sessions`, `jobs` |
| 28 | [0028_fs_migrate_onboarding_wizard](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0028_fs_migrate_onboarding_wizard.sql) | none |
| 29 | [0029_fs_migrate_price_book_catalog](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0029_fs_migrate_price_book_catalog.sql) | none |
| 30 | [0030_fs_migrate_invoice_payment_import](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0030_fs_migrate_invoice_payment_import.sql) | none |
| 31 | [0031_fs72_agent_product_loyalty](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0031_fs72_agent_product_loyalty.sql) | none |
| 32 | [0032_fs_migrate_communications_history](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0032_fs_migrate_communications_history.sql) | none |
| 33 | [0033_fs_migrate_notes_import](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0033_fs_migrate_notes_import.sql) | none |
| 34 | [0034_vip_membership_foundation](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0034_vip_membership_foundation.sql) | none |
| 35 | [0035_fs133_qbo_ongoing_sync](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0035_fs133_qbo_ongoing_sync.sql) | `qbo_connections`, `qbo_sync_issues` |
| 36 | [0036_fs133_qbo_entity_mappings](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0036_fs133_qbo_entity_mappings.sql) | `qbo_entity_mappings` |
| 37 | [0037_user_email_verification](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0037_user_email_verification.sql) | none |
| 38 | [0038_fs157_clerk_identity](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0038_fs157_clerk_identity.sql) | none |
| 39 | [0039_fs160b_clerk_unlink_tombstone](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0039_fs160b_clerk_unlink_tombstone.sql) | none |
| 40 | [0040_fs_migrate_service_agreements_import](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0040_fs_migrate_service_agreements_import.sql) | none |
| 41 | [0041_fs147_price_book_line_picker](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0041_fs147_price_book_line_picker.sql) | none |
| 42 | [0042_fs138_saved_card_migration](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0042_fs138_saved_card_migration.sql) | `saved_card_migrations` |
| 43 | [0043_payments_service_fee_booking_fee](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0043_payments_service_fee_booking_fee.sql) | none |
| 44 | [0044_fs170_inventory](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0044_fs170_inventory.sql) | `stock_locations`, `stock_levels`, `stock_movements` |
| 45 | [0045_fs171_timesheets_payroll](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0045_fs171_timesheets_payroll.sql) | `timesheets`, `timesheet_audit_events`, `technician_pay_rates` |
| 46 | [0046_fs171_open_time_entry_unique](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0046_fs171_open_time_entry_unique.sql) | none |
| 47 | [0047_fs59_recurring_visit_series](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0047_fs59_recurring_visit_series.sql) | none |
| 48 | [0048_fs59_recurring_visit_rls_unique](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0048_fs59_recurring_visit_rls_unique.sql) | `recurring_visit_series`, `recurring_visit_occurrences` |
| 49 | [0049_fs25_service_agent_job_brief](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0049_fs25_service_agent_job_brief.sql) | `job_service_briefs` |
| 50 | [0050_fs15_integration_outbox_audit](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0050_fs15_integration_outbox_audit.sql) | `integration_outbox_operations`, `integration_outbox_audit_events` |
| 51 | [0051_fs15_outbox_kind_registry](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0051_fs15_outbox_kind_registry.sql) | none |
| 52 | [0052_fs199_stripe_disputes](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0052_fs199_stripe_disputes.sql) | `stripe_disputes` |
| 53 | [0053_fs195_crews](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0053_fs195_crews.sql) | `crews`, `crew_members` |
| 54 | [0054_growth_lead_attribution](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0054_growth_lead_attribution.sql) | none |
| 55 | [0055_growth_marketing_intake](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0055_growth_marketing_intake.sql) | none |
| 56 | [0056_growth_check_finding_revisions](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0056_growth_check_finding_revisions.sql) | `growth_check_finding_revisions` |
| 57 | [0057_call_tracking](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0057_call_tracking.sql) | `call_tracking_settings`, `call_tracking_numbers`, `call_records` |
| 58 | [0058_growth_check_reports](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0058_growth_check_reports.sql) | `growth_check_report_drafts`, `growth_check_report_draft_revisions`, `growth_check_report_shares` |
| 59 | [0059_estimate_option_sets](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0059_estimate_option_sets.sql) | none |
| 60 | [0060_call_tracking_numbers_verified_at](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0060_call_tracking_numbers_verified_at.sql) | none |
| 61 | [0061_fs235_clerk_workspace_intent](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/migrations/0061_fs235_clerk_workspace_intent.sql) | none |

### Journal ordering follow-up

The backward journal timestamps are source-observed at 0021→0022 (1792610524767→1777660000000), 0022→0023 (1777660000000→1777650000000), and 0026→0027 (1792716506136→1777700000000). The existing migration-safety validator discards `when` when loading the journal and does not validate timestamp order. Codex/database work should reproduce clean and incremental migration behavior against isolated databases, including one with a previously applied higher timestamp, and compare resulting tables/policies. Do not rewrite applied journal timestamps as a documentation fix. No runtime failure is inferred here.

## Duplicate-source comparison and consumers

The root snapshot contains 35 tables, all still present in the canonical schema. The canonical source adds 48 tables. Shared tables also differ in columns, defaults and constraints; per-table added/removed/changed declarations are recorded in the appendix. A differing declaration is not a deployable migration plan.

Runtime evidence points to the canonical source: [database client](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/client.ts) imports `./schema.js`; [package entry point](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/index.ts) exports it; [migration tooling](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/drizzle.config.ts) selects `./src/schema.ts`. A tracked TypeScript/JavaScript import search found **no executable import of `fsm-schema.ts`**. This is narrower than claiming zero references: old planning/context documents still mention it.

At the pinned dev source, operative-looking context references exist in docs/README.md and PHASE2-MASTER-PLAN.md, PHASE3-TICKETS.md and PHASE3-REMAINING-TICKETS.md. The documentation reconciliation package records those files as historical and points current work to the canonical schema. PROJECT_STATE.md, ADR-FS-3 and the legacy FSM-0004 ticket preserve historical drift records. Root snapshot deletion remains a separate reviewed compatibility change, not a completed action in this inventory.

## Existing tests and remaining evidence

| Evidence | Source / next action |
|---|---|
| Bundle and destructive-statement checks exist | [migration-safety.test.ts](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/migration-safety.test.ts); source inspected, not executed by this inventory. |
| Catalog and SQL rendering tests exist | [catalog tests](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/rls-policy-catalog.test.ts) and [SQL-render tests](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/rls-migration-sql.test.ts). |
| PostgreSQL policy tests exist | [original RLS tests](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/rls-policies.integration.test.ts) plus domain integration files for recurring visits, service briefs, outbox, disputes and crews. These are separate from source checks and were not run here. |
| Full replay / Drizzle equivalence | Requires a disposable PostgreSQL instance, expected migration-role grants and resulting catalog comparison at this exact source. Retained for Codex/database acceptance. |
| Current provider state | Requires actual migration journal, role/grant/session evidence and appropriate access. Not inferred from source counts. |
| Root snapshot retirement | Read-only consumer scan is complete; preserve historical docs and remove only in its own approved change. |
| Consent ledger / global opt-out | [#430](https://github.com/SimonShaun2/Renvani/pull/430) and [#431](https://github.com/SimonShaun2/Renvani/pull/431) remain separate unmerged work. Migration-number allocation and integration order must be reconciled there. |

## Reproduction and local validation

```sh
git rev-parse b45b4996b64b16859e44a79b171b11cbe52c3e6a
rg -n "pgTable\(" packages/db/src/schema.ts fsm-schema.ts
rg --files packages/db/migrations -g "*.sql"
rg -n "ENABLE ROW LEVEL|FORCE ROW LEVEL|CREATE POLICY" packages/db/migrations
rg -n "fsm-schema" --glob "*.ts" --glob "*.tsx" --glob "*.js" --glob "*.mjs" --glob "*.cjs"
```

Validation performed for this report: AST table/column extraction; every schema row links to an existing source declaration; all 62 journal tags resolve to exactly one SQL file with indices 0–61; timestamp ordering identified three backward steps for a migration follow-up; RLS ENABLE/FORCE/policy sets match; all 35 root tables resolve in the canonical set. These are source checks only. No test execution count, live migration result, Security approval or full #5 completion is claimed.
