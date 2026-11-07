# H04: Retention, correction, withdrawal, and deletion

Version 1.0.0 · Prepared November 7, 2026 · PAI-H04

## Status and scope

This contract covers the analytical copies proposed for internal platform reporting. It does not change the retention of authoritative Renvani or Stripe financial, customer, employment, or audit records. Its durations and operating targets are concrete proposals for the accountable business/privacy/finance owners to accept or revise before real transfer. They are not legal retention advice, vendor guarantees, measured service levels, or approved production settings.

The policy accompanies the [export field allowlist](export-field-allowlist.v1.json) and [access matrix](reporting-access-matrix.md). Internal reporting, a customer's own product access, and shared learning have separate purposes. A later learning permission must not be inferred from data already being present in PostHog.

## 1. Purpose, region, and copy inventory

Before enabling a source, C01/H07 records the real source account/environment, permitted company population, destination organization/project, selected region, processor path, business purpose, applicable processing authority, and accepted retention profile. Region remains unresolved in this preparation because the current production deployment and customer commitments were not inspected. Prefer a region consistent with the actual service commitments and approved source deployment; do not choose a region solely from a vendor default or a sample code snippet.

PostHog documents both US and EU cloud hosting. That capability does not prove a particular project's location, every subprocessor/support path, or Renvani's contractual fit. The selected account and current agreement must supply the actual evidence. [Vendor security reference, accessed November 7, 2026](https://posthog.com/handbook/company/security).

The implementation maintains an inventory of every copy, including:

- Governed Renvani projections and any staging files or queues used only for analytics.
- Native/sanitized Stripe imports and synced Postgres tables, derived/materialized views and cached query results.
- Product events, company-group properties, any person records created by an SDK, AI attempt metadata and imported trace copies.
- Downloaded files, scheduled exports, temporary support extracts and approved downstream destinations.
- Backups, restoration paths and later permitted learning datasets/model versions, if those later exist.

Each inventory entry includes its owner, exact object identifiers, policy/configuration version, storage region, retention anchor/window, correction/delete mechanism, last verified checkpoint, backup expiry evidence, and whether it can reimport deleted records. There is no wildcard authorization to add another destination. H04 creates the contract for this inventory; H07/C01/C03–C07 instantiate it for actual accounts and objects.

## 2. Proposed retention schedule

An expiration is based on source business time or the explicit cohort/period anchor below. Synchronizing, retrying, copying, or changing an ingestion timestamp must not restart it. A correction preserves the source period and only creates a new retention obligation when the accepted financial or outcome policy actually requires it.

| Profile | Proposed active analytical window | Anchor and purpose | Expiry behavior / accountable owner |
|---|---|---|---|
| `RET-IDENTITY` | Current permitted company/account mappings, plus mapping history needed by another unexpired retained record | Mapping validity and referenced business period; enables reproducible scoped joins | Remove obsolete mapping histories when no permitted retained record depends on them; Platform/privacy |
| `RET-CORE` | 13 calendar months | Financial posting occurrence, subscription snapshot effective date, or company-cohort period end; supports current/prior-year operational comparison | Stop publishing expired rows; remove them from synced copies through verified purge/rebuild. Finance/product/privacy approve the window |
| `RET-OUTCOME` | 13 calendar months after the declared cohort observation window ends; if that end is unknown, a provisional cap of 13 calendar months after `eligible_at` | Eligible opportunity/fact/allocation evidence for the fixed cohort; the fallback is only an expiry cap and never asserts outcome maturity | Expire the coherent cohort and its derived rows without leaving unsupported retained totals; Product/measurement/privacy |
| `RET-AI-DETAIL` | 90 calendar days | Separately billable attempt occurrence time; quantitative debugging, cost and failure analysis | Remove individual attempt/trace identifiers and detail from analytical copies; keep only separately approved exact monthly cost/usage aggregates under `RET-CORE`; AI/platform/privacy |
| `RET-HEALTH` | 30 calendar days | `completed_at` when present, otherwise `started_at`; timeout/abandonment or retries do not reset the original run anchor | Delete run detail; retain limited monthly reliability totals under `RET-CORE` only when purpose and schema are accepted; Platform |
| `RET-EXPORT` | 7 calendar days, or sooner at end of the named use | File creation time | Revoke links and delete registered destination files/copies; export owner verifies closure |
| `RET-CHANGE-AUDIT` | 24 calendar months proposed for the minimized request/configuration evidence | Closure time of access, correction, withdrawal or deletion case | Retain case ID, scope category, policy/version, dates and result evidence; no copied customer content, prompts, financial payload or credentials. Privacy/security/finance approve any longer need |
| `RET-DENIED` | No ingestion or analytical storage | Secrets, raw personal contact/content, sensitive notes, payroll, unapproved prompt/output/tool content, unsupported fields | Reject before transfer; if discovered after transfer, contain and remove under the incident/correction process |

The windows describe analytical copies, not how long the business must keep books or source invoices. An exact retained financial aggregate may need a restricted lineage index to support a later correction. That index stays in the controlled Renvani accounting/evidence boundary and does not justify retaining every original trace or customer field in PostHog. When a retained aggregate is no longer reproducible from available evidence, mark that limitation; do not silently call it fully source-verifiable.

A retention profile does not approve a free-form aggregate schema. C12/H06 must define any proposed monthly cost or reliability rollup as a closed minimized schema under the accepted metric and field policy before materializing it. Until that exists, expiry of attempt/run detail leaves older affected coverage unavailable or partial; it does not authorize an unreviewed permanent copy.

For late-closing cohorts, C09 records the actual observation-window policy and a finite retention deadline. Where the maturity end remains unknown, use the explicit `eligible_at` expiry cap above, preserve the unknown-maturity state, and do not infer mature outcomes. An unlinked fact without a cohort uses its authoritative `occurred_at` as the same 13-month cap until the reviewed cohort linkage is available. Changing an anchor after authoritative linkage or policy evidence requires a recorded reason/version; ingestion/retries never extend it. Minimal links required to explain an unexpired financial component may be retained under a documented dependency exception, with named objects, purpose and expiry. This does not extend raw content retention.

### Native retention is not one setting

PostHog's event-retention documentation explicitly distinguishes its warehouse tables, which retain all rows, from its event window. The Free plan currently has a one-year event window and lacks custom retention; paid-plan controls and limits differ, and expiration is not a guarantee of immediate physical removal. Thus the proposed 13-month/90-day/30-day profiles cannot be represented as already supported by a free account or a single project-wide setting. C01/H07 must choose and verify a compatible capture/storage/purge approach, or record an accepted different profile before transfer. [Event retention](https://posthog.com/docs/data/events-retention).

The 30-day AI large-property cleanup does not erase all AI metadata; the remaining event continues under event retention. It is not permission to collect raw prompts for 30 days, and it does not implement the proposed 90-day attempt-detail policy. H04 excludes raw content before ingestion. [AI event retention](https://posthog.com/docs/ai-observability/data-retention).

For synced tables, removing rows from a source view or tightening a row filter is insufficient unless the chosen sync actually removes the older destination rows. Incremental copies can retain deleted source records. C04/C07 must provide a verified delete/rebuild/full-refresh path appropriate to each source. Event/person/group deletion must not be described as purging unrelated warehouse tables. [Source sync behavior](https://posthog.com/docs/data-pipelines/sources).

## 3. Correction contract

Corrections are versioned changes to evidence, not a second business action. Only the authoritative domain/provider operation may correct business state. Analytics consumes its resulting facts and preserves the lineage needed to explain a restated number.

1. **Identify the correction.** Record a stable case ID, verified company/account/environment/object scope, authoritative source revision, old/new definition or allocation version, reason code, affected period and source cutoff. Keep reason text and requestor identity in the restricted case system, not the reporting payload.
2. **Stop misleading output.** Mark affected cards/periods provisional, partial or unavailable until the verified corrected view is ready. A missing correction is not a zero adjustment.
3. **Apply once at the logical grain.** Use H03's source key plus accepted revision/deduplication rule. Financial reversals and fee refunds retain their own source components. Imported duplicates and replay do not create new collections or costs.
4. **Recompute affected outputs.** Rebuild the relevant company/cohort/period partitions and allocation views, plus associated caches and permitted exports. Preserve whether the display uses posting-period changes or a separately labeled restated/cumulative-net view. Do not sum both a superseded record and its replacement.
5. **Reconcile and verify.** Compare exact same-currency/component/account/cutoff totals to the accepted source. Verify the old revision is no longer counted and the new revision appears once. Reproduce H03's signed allocation conservation, including the explicit unallocated remainder.
6. **Close only after propagation.** Record copy-specific statuses and checkpoint evidence; unresolved copies stay pending. Reissue/revoke registered downloads when their figures materially change. Keep the prior query/metric version and restatement explanation without retaining prohibited content.

A mapping correction never rewrites history across tenants without evidence. If a provider object was associated with the wrong company, quarantine the affected fact, investigate the authorized historical mapping, remove wrongly attributed copies, rebuild both affected company results, and verify access at every destination. A correction request does not itself authorize reparenting the source object.

## 4. Withdrawal, offboarding, and deletion

Purpose withdrawal and data deletion are different operations. A company ending optional analytics processing or future shared learning does not automatically erase financial records that Renvani must retain under its separately established record policy. Equally, a financial retention need does not justify leaving unnecessary personal data in an analytics warehouse.

For a valid scoped request, use the following state machine in the restricted operations record:

`received → scope_verified → export_suppressed → live_copies_processing → live_copies_verified → backup_expiry_pending or closed`

An exception is explicitly recorded as `restricted_retention_exception`, with its authority, field/object scope, purpose, access boundary, owner and review/expiry date. It is not silently treated as completed deletion. Failed operations retain a retryable state and surface their affected copy; they do not disappear from the register.

| Step | Required behavior | Evidence |
|---|---|---|
| Verify scope | Verify the requester and permitted request through the existing company/privacy process; resolve account/mode/object identities and exact purpose affected | Case ID, scope keys, authorized decision; do not accept an email match as identity |
| Stop new copying | Set a company/record/purpose suppression rule before the next export, backfill, retry or rebuild; cancel pending exports and revoke applicable shared links | Versioned suppression checkpoint and test that a replay cannot reintroduce the record |
| Resolve source obligations | Classify which authoritative records have a documented retention obligation, which optional analytics copies must be removed, and which fields can be minimized | Explicit finance/privacy disposition; no blanket claim of universal erasure |
| Remove or replace live analytical copies | Purge affected tables/partitions/events/groups/derived outputs/caches using a verified product-specific method; rebuild only permitted residual rows | Copy inventory, operation IDs, completion status and authorized readback counts |
| Handle downloads and downstream copies | Notify the recorded internal owner through the existing authorized case workflow, revoke availability, remove registered extracts and propagate to other approved destinations | Per-copy owner acknowledgment/verification; a link expiry alone does not erase downloaded files |
| Verify and prevent recurrence | Query known keys and aggregates, test normal sync and replay against suppression, check that updates cannot restore denied rows | Actual destination readback and failed-reintroduction case |
| Handle backups | Record whether deletion is selective or by bounded backup expiry; block normal access and prevent a restoration from reintroducing suppressed data | Actual backup policy/contract, expiry date, restricted access and restore procedure |

Proposed operating targets for acceptance are: suppress new optional exports and mark affected output within one business day of verified scope; resolve/verify live analytical copies within 14 calendar days where the actual vendor mechanism supports it; escalate any shorter contractual requirement or blocked copy immediately. These are proposed operational goals, not assertions of legal deadlines or provider performance. Vendor/backup delays stay visible with a dated owner and next step. Do not promise completion while a copy is still pending.

PostHog documents asynchronous event deletion and status checking. A request accepted by an API is not proof that all events are gone; inspect error fields and the eventual result. Its person deletion procedure also does not establish what happened to independent company/financial warehouse rows. C07/C17 must verify the actual data families used by this integration. [Vendor deletion behavior](https://posthog.com/docs/privacy/data-storage).

### Financial retention exceptions

The finance/privacy owner must establish the authoritative record schedule for relevant jurisdictions and business obligations outside this preparation. This package does not invent a universal number of years. If a specific retained invoice/payment fact is needed, record the minimum fields and restrict it to that purpose. Remove optional analytics copies unless their continued retention is separately justified. Quarantine disputed or corrected records with clear status; do not delete a provider-side financial event merely to make a dashboard agree.

### Backups and restoration

No backup expiry, selective-erasure capability, or vendor-contract commitment was verified for Renvani's actual accounts. Those are unresolved implementation inputs. Before release, C07/C17 records the real retention period and restoration owner for Renvani staging/projection backups, PostHog managed copies, trace-provider copies and approved exports. Where selective deletion is unavailable, document the accepted bounded expiry and restricted use; keep the case in `backup_expiry_pending` until the relevant obligation is satisfied.

A restored database or export must reapply the latest suppression, corrected mapping and deletion ledger before serving queries or resuming synchronization. Keep the minimum protected identifiers necessary to enforce suppression for as long as retained source/backups can replay them. The ledger is not a spare copy of the deleted payload. If suppression identifiers cannot be retained, the alternative is verified source removal/restore filtering and a new proof that replay cannot reintroduce the data.

## 5. Learning and model-derived artifacts

No real shared-learning dataset or model-training use is enabled by H04. C20/L01 must later define each dataset's company/field purpose, lineage and withdrawal behavior; L02/L03 add evaluation and release authority. The operational-reporting export principal cannot be reused as a training credential.

If a later permitted dataset exists, a correction or withdrawal identifies all affected dataset versions, feature/label tables, evaluations and deployed candidate versions. Stop new training from withdrawn data; remove/rebuild the permitted datasets and reassess affected evaluation or release decisions. Do not claim that deleting a source row automatically removes its influence from trained model weights. Any required retraining, retirement or other treatment is a separately documented model/data decision under the accepted policy.

Aggregated company comparisons remain within their permitted purpose. An aggregate does not escape correction or privacy review merely because it omits a name, especially when a small cohort or linked identifier could reveal the contributor.

## 6. Concrete expected cases for H05 and runtime verification

These are worked requirements, not executed integration tests:

| Case | Expected result |
|---|---|
| A merchant principal refund arrives later, but no application-fee refund exists | Update only the principal component and affected linked outcome. Preserve the actual fee component. Reconcile the posting-period and any labeled cumulative view independently |
| A partial refund is allocated across two opportunities with a remaining unallocated amount | Keep every allocation the source company's currency/sign; allocated signed amounts plus the explicit remainder equal the source refund exactly; incomplete allocation remains visible |
| A company withdraws optional reporting while its old rows remain in an incremental source | Suppress future export first; explicitly purge/rebuild existing vendor copies. A new source filter alone is not completion |
| A new invoice metadata field contains an email or a payment URL | Reject it before transfer; do not solve it by hiding the column after ingestion. Record only a safe error code/count in health reporting |
| A trace includes a customer's address in a span name despite privacy mode | The source-side allowlist rejects the name; only the registered fixed workflow/span token is exported |
| A vendor accepts an event deletion request but still reports it pending | The case remains pending; no completed-deletion statement until the appropriate readback/status evidence exists |
| A source/backup replay contains a previously removed company record | Suppression is evaluated before materialization/export; the record is not reintroduced, and the attempted replay is logged without its payload |
| A trace-detail row expires, but an approved monthly cost aggregate remains | Remove the attempt/trace identifiers from the external copy; preserve only the defined aggregate and its permitted lineage/quality; do not silently treat it as individual-trace drill-through |
| A retained financial source fact must survive a valid deletion request for optional analytics | Keep only the specifically justified authoritative fields in the restricted record boundary; remove unjustified analytics copies and record the exception scope |

## 7. Acceptance ownership and evidence boundary

H04 is complete as preparation when the field/purpose/access contract, proposed schedule, propagation rules, exception handling and review findings are published. Final owner acceptance of region, contract fit, provider entitlements, retained-copy periods and exact account controls is a prerequisite to real integration, not a claim made here.

C03–C05 bind the allowed source objects, grants and transfer paths. C07 implements correction, suppression, purge and replay behavior. C10/C11 enforce event/AI payload minimization. C17 obtains independent access/privacy/financial verification for the enabled slice. H05 packages synthetic expected cases. No production payment, customer message, booking, mission, model training, deployment or destructive source deletion is authorized by this document.
