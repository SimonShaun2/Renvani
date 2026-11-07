# H04: Reporting access and export boundary

Version 1.0.0 · Prepared November 7, 2026 · PAI-H04

## Status and intended use

This is the prepared access contract for Renvani's internal Stripe + PostHog analytics. It defines the controls the integration must implement and prove. No database role, vendor account, export, or live access test was created by this preparation work. The principal names below are logical owner functions, not assigned people or existing provider roles. Actual membership, region, entitlements, and processing authority remain recorded implementation decisions in H01/C01.

The companion [field policy](export-field-allowlist.v1.json) is a closed list of candidate reporting fields. A field's presence in that file means it can be considered for the stated internal reporting purpose after the release gates below; it does not authorize transfer now. The [retention and correction contract](retention-correction-policy.md) governs every resulting copy. H03's [identity contract](identity-contract.md) and [event contracts](event-contracts.v1.json) determine how an allowed identifier or fact is represented.

## 1. Three distinct purposes

| Purpose | Authorized audience and result | Data boundary | State in this package |
|---|---|---|---|
| Internal operational reporting | Specifically granted Renvani staff inspect company economics, activation, observed outcomes, AI costs, and source health | Minimized company-scoped reporting records in a restricted internal destination; personal contact/content fields excluded | Requirements prepared; real processing authority, grants, and configuration must be evidenced before transfer |
| Customer-facing Command Center and Reports | Authenticated users receive only results their current Renvani company, location, role, and sensitivity permissions permit | Existing tenant-authorized readers and evidence assembly; source drill-through reauthorizes each request | Existing product boundary preserved; this package creates no customer access to the internal workspace |
| Cross-company learning, benchmarking, or intervention experiments | A separately authorized dataset/pipeline and approved product surface | Company/record/field purpose permission, eligible cohort, withdrawal lineage, evaluation and experiment gates | Disabled under this policy; C20 designs readiness and L01–L03 carry later work |

A customer's right to view its own data does not grant its users a vendor-project seat. An employee's access to internal reporting does not grant permission to train a model, export a company dataset, or change a workflow. Group properties, company filters, and saved dashboard filters aid analysis; they are not an authorization boundary. Opaque IDs and aggregates can still identify a company or link to an individual, so this package does not call them anonymous.

## 2. Proposed human access matrix

The matrix is the target behavior to demonstrate at C17. Start with the smallest set of individually named internal users that the installed plan can actually restrict. If a capability cannot enforce a row in this matrix, narrow the audience/data or select a suitable entitlement before enabling that capability.

| Logical owner function | Read company economics | Read workflow/activation detail | Read AI/data-health detail | Ad hoc query and download | Configure sources, grants, or deletion |
|---|---|---|---|---|---|
| Founder / designated analytics accountable owner | Governed aggregate and authorized company detail | Governed aggregate and authorized company detail | Minimized metrics and source-health summaries | Only as explicitly granted; approved output scope and logged export | Approves business scope; provider admin access is separately named and recorded |
| Finance / billing analyst | Classified financial records, component reconciliation, source keys | Aggregates needed to explain the finance metric; no customer or staff detail | Attributable cost and finance-source health | Queries on the approved finance dataset; registered exports with expiry | No source credentials or access changes; may propose corrections through domain owners |
| Product / operations analyst | Approved aggregate economics; no unrestricted financial posting table by default | Minimized company/opportunity/job facts and cohort definitions | Aggregated workflow/model usage and health | Approved operational datasets only; downloads require a documented use and destination | No integration or access changes |
| Platform analytics engineer | Minimized records necessary to reconcile or diagnose | Minimized records necessary to reconcile or diagnose | Attempt IDs, timing, safe error codes, source runs and counts | Scoped technical queries; diagnostic output follows the same allowlist | Time-bounded configuration privileges when assigned; no financial or customer-action authority |
| Security / privacy custodian | Access only to evidence needed for a named review or request | Same restriction | Export inventory, access/configuration records and safe health metadata | Scoped verification with a recorded case; no blanket production data copy | Authorizes/executes applicable access or privacy operations through a separate audited administrative identity |
| Support or implementation staff | No internal analytics access by default | Approved aggregate view or existing tenant-authorized support route when required | No trace or source-table access by default | No unrestricted SQL, downloads, or internal vendor seat | None |
| External consultant or collaborator | None by default | None by default | None by default | Synthetic/review documents only until separately scoped | None |
| Merchant owner/admin, merchant staff, end customer | No internal vendor workspace | Own authorized Renvani surface only | Own permitted Renvani result, where implemented | Existing product export permissions only | No internal analytics administration |
| Learning service or model/evaluation operator | None from this policy | None from this policy | None from this policy | Real pooled data export denied pending the L-track contract | No authority derived from a reporting credential |

Organization admins are powerful principals and must be explicitly inventoried; they cannot be treated as ordinary viewers. No shared human account. Revoke access when the business need ends; review the named membership and effective permissions at release and on each access change. A proposed recurring review interval is 30 days, subject to the operating owner's acceptance.

### Vendor entitlement and effective-access proof

PostHog's current documentation distinguishes its basic plans from access-control packages: Free/Pay-as-you-go opens projects and resources to organization members with editor access; Boost/Scale provides per-member controls, and Enterprise supports role-based access. Current organization owners/admins inherit broad privileges. H07/C01 must record the actual plan and effective grants, not assume a named custom role has enforcement. A tightly restricted organization containing only approved operators can reduce exposure, but does not itself prove read-only viewer separation. If the target matrix needs that separation, enable the appropriate controls or keep those viewers outside the workspace. [PostHog access control, accessed November 7, 2026](https://posthog.com/docs/settings/access-control).

Warehouse permissions can restrict query access across the SQL editor, PostHog AI and MCP. A restricted source plus a permissioned materialized projection is a possible sharing boundary; an ordinary view still depends on access to its underlying table. These vendor capabilities require an actual configuration test, and do not replace Renvani-side data minimization. [Warehouse access control](https://posthog.com/docs/settings/warehouse-access-control).

Do not assume a hidden dashboard hides the dataset, or that disabling a product UI disables every API/MCP query. Test effective access through available UI, SQL, API, MCP, sharing and export paths. Keep PostHog AI, third-party destinations, public sharing, scheduled outbound reports, and other secondary uses disabled unless their specific audience and processing path have been reviewed. This requirement does not prevent a future approved use of an internal assistant on permitted analytics.

## 3. Service identities and database grants

| Identity | Permitted operation | Explicit boundary | Implementation evidence |
|---|---|---|---|
| Reporting projection builder | Read named authoritative records and write only derived reporting objects under existing Renvani service controls | No extra customer actions, pricing changes, billing mutations, or action-policy authority | C03 documents owner, exact source reads, output objects, and replay behavior |
| Postgres reporting export principal | Connect over verified encrypted transport; read a named reporting schema and enumerated approved views/tables | No app service credential, table ownership, superuser, role creation, write, bypass-RLS or replication permission by default; no direct base-table grants | C03 positive/negative database tests and exact grant snapshot; C04 verifies actual connector behavior |
| Stripe analytics data reader | Read approved resources for explicit account and live/test scope | No payment, refund, transfer, product-price, customer or subscription mutations | C05 records actual key/OAuth scopes and source resource/account inventory |
| Optional analytics webhook setup identity | Create/manage only the dedicated analytics ingestion endpoint under an approved configuration task, if necessary | Separate from operational Stripe payment webhooks; webhook write capability is recorded as a setup exception, not described as entirely read-only | C05 demonstrates endpoint scope and return to the accepted steady-state privilege where feasible |
| Reporting event producer | Send closed-schema, backend-confirmed reporting events to the correct environment/project | No arbitrary browser tenant identity, full activity payload, staff identity, message content, or ingestion-based permissions | C10 payload capture/schema check and cross-environment negative cases |
| Primary AI telemetry producer | Send approved quantitative attempt metadata through the selected trace path | No raw prompts, outputs, tool calls/results, arbitrary trace names or error text; one capture authority and deduplication identity | C11 inspected outgoing payload plus failed/retried/streaming cases |
| Correction/deletion executor | Perform a named, auditable correction or purge across registered analytics copies | Separate from reader and ordinary analyst credentials; no implied right to erase authoritative financial records | C07/C17 scope, authorization, readback, failure/retry and recovery evidence |

Use a dedicated reporting schema as the exposed database surface. Grant `CONNECT`, schema `USAGE`, and `SELECT` only where required. The physical implementation must inspect view ownership, inherited grants, `PUBLIC` privileges, function execution, default privileges and any RLS behavior; checking the login's name is insufficient. Give new reporting objects no automatic export grant until their fields and purpose are reviewed. Keep application write credentials, source secrets and signing secrets in the approved secret configuration mechanism, never in these artifacts, analytics rows, query text, dashboards, logs, or chat.

The native Postgres connector supports a schema choice and selected columns, but defaults to all columns; its primary/incremental key columns cannot be deselected. Bind it to a minimized projection whose exposed keys are already safe. Column selection is a second control, not permission to give the connector unrestricted application-table access. [Postgres source](https://posthog.com/docs/data-pipelines/sources/postgres).

CDC/replication privileges and live production SQL access are not required by this preparation. Introduce them only if the selected update/freshness requirement cannot be met by a bounded approved approach and their privileges/load/recovery are reviewed in C03/C04. Connector visibility across several companies is a specific internal reporting privilege; it must never be reused by a customer request path.

## 4. Native Stripe and AI payload gates

Selecting `Invoice`, `Charge`, or another native Stripe table is not a field-level privacy decision. Before any production transfer, C05 must inspect the source schema and representative nested payload shapes using synthetic/sandbox records, compare every transmitted field to the policy, and record the account/resource/mode/configuration version. A resource may include customer details, billing addresses, descriptions or arbitrary metadata even when the dashboard displays only totals.

PostHog's current source documentation says managed-schema sources such as Stripe do not support column masking; API sources also lack SQL row filtering. Therefore do not plan to remove prohibited fields merely by enabling a mask or hiding a column in a dashboard. Native ingestion is conditional on proving the full transmitted dataset fits the accepted policy. If it cannot, exclude the resource and export sanitized, classified records from a Renvani-controlled projection instead. Redacting after transfer does not meet a rule that forbids transfer. [Source filtering/masking reference](https://posthog.com/docs/data-pipelines/sources).

The Stripe connector's change-aware mode may require a dedicated webhook setup capability. Its update/delete observations are applied at scheduled sync, so reporting freshness and correction evidence must use the actual table cutoff. Do not broaden the operational payment integration to make analytics simpler. [Stripe source](https://posthog.com/docs/data-pipelines/sources/stripe).

For AI, privacy mode removes content-bearing inputs and outputs, but still sends custom properties, names and tool definitions. Use fixed registered names and an outgoing allowlist; omit tool descriptions/schemas entirely unless separately reviewed. A source-side sanitizer is required even when privacy mode is enabled. [AI privacy mode](https://posthog.com/docs/ai-observability/privacy-mode).

The inspected Langfuse stub currently has optional `actorId` and `errorMessage` metadata. Those fields are not approved vendor reporting fields under H04. C11 must filter or map them before the selected reporting trace path exports data; this preparation does not claim the current stub is privacy-complete or enabled. [Pinned Langfuse source](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/packages/ai/src/langfuse/client.ts).

The preserved FS-43 branch supplies useful PostHog/Sentry wiring, but its `trackNodeProductEvent` accepts arbitrary scalar properties and its Sentry path can capture a raw exception. Reusing that wiring requires a closed reporting adapter and independent telemetry review; it does not approve every historical event property or diagnostic body. This is preserved branch evidence, not a claim that PR #142 merged or that the integration runs in production. [Pinned FS-43 node adapter](https://github.com/SimonShaun2/Renvani/blob/7ee169c8a3fa443f33920e208607fc46328709aa/packages/observability/src/node/index.ts).

## 5. Query outputs, joins, and source drill-through

Queries may return only permitted fields and derived measures with a registered metric/query definition, period, timezone, environment, currency, population, source cutoff and quality state. An approved field does not automatically permit every combination: joining financial, operational and AI detail requires the user's actual purpose/grants and the same verified company scope. Exports preserve the same restrictions and carry the metric/query version, expiration, destination and owner.

The exported `query_manifest_ref` is only an opaque handle. Its immutable internal manifest binds the exact resolved company set and population snapshot, actual filter values and definition, period/timezone/currency/environment/account-mode, source revisions/cutoffs and producing authorization context. That context is not copied wholesale into PostHog. A missing, incomplete or mutable-only manifest cannot support a complete/reproducible result. Missing verified access scope denies output; it never falls back to a broader partial result. Every current query or source drill-through reauthorizes access independently of the historical manifest.

Company-level internal reporting can include small cohorts for named authorized operational users; no external benchmark or claim of anonymity is authorized. Customer-facing benchmark publication later requires a separate disclosure/cohort-risk review. Hashing an email or removing a name does not make the underlying record eligible for collective learning.

Source detail is resolved through opaque internal object references. Open the existing authenticated Renvani or provider view only after that system verifies current access. Do not embed payment links, signed URLs, session tokens, invoice PDFs, message bodies or copied source payloads in analytics. Do not export a raw `sourceId` from an import if it could contain contact information or a URL; resolve a Renvani-issued safe reference instead. A dashboard link conveys navigation, not authority.

Raw CSV/JSON downloads and scheduled emails are disabled by default. A permitted one-off export has a named purpose, minimum columns/rows, approved destination, owner, expiry and correction/deletion registration. If the installed vendor cannot enforce a download restriction, restrict dataset access to people permitted to export it and record that limitation; do not advertise an unenforced control.

## 6. Compatibility with current Renvani source

The inspected internal-admin guard requires both an owner/admin role and the Renvani internal-company ID. It is useful existing application authority, not evidence that PostHog access is configured. Reuse the boundary when an internal Renvani route is needed; do not grant a merchant administrator cross-company reporting merely because their local role is `admin`. [Pinned internal guard](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/apps/api/src/lib/require-renavi-internal-admin.ts).

RCI v1 already separates verified tenant/actor scope, sensitivities, source evidence, quality and denied/unavailable reads. Its schema explicitly says shape validation is not authentication. Retain those runtime meanings. The internal RCI scope/packet is not an approved wholesale export: staff `actorId`, arbitrary source subjects, and customer/payroll evidence stay behind their existing reader permissions. [Pinned RCI contracts](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/packages/types/src/connected-intelligence/v1/contracts.ts).

The canonical schema contains mixed-sensitivity fields within the same tables: company contact/settings fields, user credentials and identity, customer contact/notes, invoice payment tokens/URLs/messages, and activity actor names/summary/payload. This is why table access alone is insufficient. H04's allowlist is an explicit projection of the permitted facts, not an invitation to export these application tables. [Pinned canonical schema](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/packages/db/src/schema.ts).

## 7. Release evidence and remaining decisions

| Decision or proof | Required record | Owner function / ticket |
|---|---|---|
| Processing purpose and company eligibility | Applicable service/data terms or other reviewed authority, allowed company population, excluded uses, processor path | Business/privacy owner with C01; shared learning remains separate |
| Region and destination | Actual PostHog organization/project/region, source region, allowed processing locations, environment separation | Platform/security/privacy owners in C01/H07 |
| Access entitlement and users | Actual package, named users, effective rights and admin inheritance | Platform/security in C01/C17 |
| Exact exported columns and nested content | Schema/configuration version plus positive/negative outgoing payload evidence; deny unknown fields | C03/C05/C10/C11 |
| Retention/correction/deletion | Accepted targets, actual supported mechanisms, purge proof and known backup limits | C07/C17 and business/privacy/finance owners |
| Provider scopes and network | Export-only grants, verified encrypted transport, secret reference, narrowly reviewed setup exceptions | C03–C05 |
| Reporting-only behavior | Pause/replay/correction cannot charge, send, book, complete work, or grant permissions | C07/C17 |

Planned C17 negative checks include: a merchant admin cannot enter the internal project; a viewer cannot reconfigure a source; a denied table is inaccessible through UI/SQL/API/MCP; a new source column is not automatically exported; free-form metadata and nested contact fields never reach the destination; revoked access and expired exports cannot be reused; and a reporting-only replay does not call a business action. These are requirements, not tests executed in H04. H05 will package the synthetic cases and runtime-only matrix.
