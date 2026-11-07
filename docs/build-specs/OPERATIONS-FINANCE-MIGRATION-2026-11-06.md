# DRAFT — Renvani Operations, Finance, Reporting and Implementation

Version 0.1 | November 6, 2026 | Product and engineering build specification

**Decision requested:** approve the staged scope and unresolved policies below before creating implementation assignments. This document is a draft, not a claim that the proposed features are built, accepted, merged or enabled.

**Audited repository:** `SimonShaun2/Renvani`, `dev` at `e5aff10fb380dca5457679811c1e3dfa2ae9c0cd`. Source tree: `efb840b27835436e375e3df52dcbd53d4e7f9a74`. Separately inspected: draft PR #445 at `29e95a9bf3f90c7a5a60ced710e581d33b76ea1b`, its upstream UI chain, relevant Notion migration/onboarding records, the four supplied ServiceTitan pages and official Intuit integration documentation.

**Audit method and limits:** read-only source, schema, route, worker, interface and PR/status inspection. No application tests, authenticated browser scenarios, provider connections or customer migrations were run for this audit. Existing tests and historical successful runs are evidence of a foundation, not a new acceptance result. “Not found” means not found in the inspected production paths, schema and repository-wide keyword/path checks; it is not proof that no unpublished work exists. Re-fetch current heads and reconcile active owners before implementation.

## 1. Executive conclusion

Renvani should support these capabilities as one connected operating workflow, not eight independent add-ons. The existing code provides meaningful foundations, particularly timesheets, quantity-based inventory and migration. The biggest missing layer is reliable financial linkage: approved time becomes labor cost, purchasing becomes committed cost, consumed material becomes actual cost, and those records feed reports and accounting without duplicate entry or duplicate counting.

**Recommended product promise:** the owner can see what happened, what each job earned, what the team should be paid, what must be purchased, and what needs attention. The owner should not have to reconcile conflicting totals across screens.

ServiceTitan's reference pages establish useful capability categories: field/office time and performance pay; warehouse/truck purchasing and inventory; operational scorecards and drill-down; and separate QuickBooks Online and Desktop integrations. They are references, not a requirement to copy ServiceTitan's complete enterprise footprint or its marketing claims. Automated delivery is a Renvani requirement from this request, not something inferred merely from a dashboard screenshot. [E1–E4]

### Current-state matrix

| Area | Verified foundation | Gap and proposed treatment | Assessment |
| --- | --- | --- | --- |
| Reports | Reporting dashboard, KPI calculations, operational breakdown endpoints and manual CSV snapshot | Move shared metrics to server-owned contracts; saved definitions, schedules, background generation, secure delivery and run history | Extend and refactor |
| Timesheets | Time entries, review/approval/reopening, effective-dated technician rates, gross regular/overtime summary and CSV | Policy validation, wider employee coverage, pay-run snapshots, earnings items, exceptions and payroll-provider handoff | Substantial foundation; not full payroll |
| Job costing | Jobs, estimates, invoices, time/rates, catalog costs and material quantities | Immutable historical cost postings, budgets, committed versus actual costs, burden, adjustments and margin reporting | New costing domain over existing records |
| Inventory | Warehouse/van locations, balances, low-stock thresholds, transfers, adjustments and job usage | Fractional units, reservations, receiving, returns, counts, valuation and accounting linkage | Substantial quantity foundation |
| Purchase orders | Catalog and stock locations can be reused | Vendor/requisition/PO/receipt/bill-match lifecycle not found as an operational domain | New purchasing domain |
| QuickBooks Online | Sandbox OAuth/configuration, customer push, mapping/issue records, queue and CDC scaffolding | Invoice/payment export is explicitly unimplemented; production support, deterministic reconciliation and recovery are missing | Partial sandbox connector |
| QuickBooks Desktop | IIF and CSV/Excel import support and Desktop-specific migration contracts | No recurring qbXML/Web Connector service found | File migration exists; ongoing connector is new |
| Forms | `form_templates` and `form_submissions` schema; job checklists, photos and signatures nearby | Versioned template API, builder/renderer, assignments, mobile drafts, submission validation and closeout rules | Schema foundation, not finished forms product |
| Data migration | Generic AI-guided file mapping, review/dedupe, chunk workers, lineage, reconciliation and rollback foundations | Entity-by-entrypoint acceptance, new finance/workforce entities, large-data testing, cutover and recovery certification | Meaningful implementation; end-to-end readiness not established |
| Customer implementation | Workspace provisioning, onboarding/import screens and business settings | Unified readiness checklist, configuration/training evidence, rehearsal, approved cutover and hypercare | Partial onboarding, incomplete implementation lifecycle |

Sources: [R1–R14]. No percentage-complete score is assigned: code presence, passing tests, accepted integration and deployed readiness are different states.

### Preserve existing work

PR #445 is still draft and unmerged. Its estimate-group pagination and weekly dispatch implementation, mobile closeout, issue-reporting and public approval recovery must be reconciled, not rebuilt. Its recorded application work is on `feat/fsm-workflow-reliability-20261105`, not assumed present in the audited `dev`. The original UI chain is #432 → #435 → #437 → #438. This new spec does not approve any of their merges. [R12]

The OP identifiers below are **document-local work packages**, not existing FS ticket IDs. Map them to the current board and open work before making tickets; do not create a parallel program or assign fictional owners.

## 2. Shared architecture and non-negotiable accounting boundaries

Keep the existing Next.js/Fastify/Drizzle/PostgreSQL/BullMQ architecture and canonical domain services. Add bounded services and typed contracts; do not replace the application or build a new financial microservice estate.

### Connected lifecycle

1. Accepted estimate establishes a versioned job scope and estimated cost budget.
2. An approved purchase order creates a **commitment**, not an actual job expense.
3. Receiving records quantity, location and provisional acquisition cost; vendor bills reconcile price and tax differences.
4. Issuing stock to a job records consumed quantity and historical material cost. Transfers preserve value; returns reverse or adjust the original cost basis.
5. Approved job-linked time produces labor cost using the applicable rate, burden and overtime-allocation policy. A payroll export does not create a second labor expense.
6. Authorized subcontractor, equipment and other direct costs are posted once with their source document.
7. Invoiced value, earned operational revenue, cash collected, tax, refunds and credits remain separately defined metrics. None is silently substituted for another.
8. Job-cost views and scheduled reports read the same versioned business facts. Accounting exports reference those facts and remote mappings; they do not recalculate a competing ledger.
9. Imports preserve historical provenance and cutover boundaries. Historical paid invoices do not become new charges, new sales or automatic accounting exports.

### Required cross-module contracts

Every new cost or accounting posting carries tenant scope, source type/ID/version, job or explicit unallocated scope, currency, effective date, recorded date, actor, policy version, idempotency key and reversal linkage where applicable. Monetary amounts use decimal strings and controlled rounding; quantities have explicit units and precision. Unknown costs are not zero costs.

Preserve historical facts through append-only postings or versioned amendments. Do not rewrite closed-job margins merely because a current price-book cost or employee rate changes. A correction must explain which prior fact it supersedes and whether it affects an open or closed period.

Use transactional outbox or equivalent durable enqueue coordination for state-changing work. Database transaction success and provider delivery success are separate states. A timeout after a remote write must become an explicit uncertain outcome requiring reconciliation, not an automatic second invoice, payment, purchase or payroll submission.

### Proposed ownership boundaries

| Fact | Proposed authoritative owner | Other modules consume |
| --- | --- | --- |
| Job scope, operational completion, price and customer workflow | Existing Renvani domain services | Reports, costing and accounting adapters |
| Employee time and approved earning inputs | Workforce service; payroll processing provider owns its processing result | Costing and payroll reconciliation |
| Stock quantity and acquisition-cost movements | Inventory/purchasing service under an approved valuation policy | Job-cost postings and accounting mappings |
| Job estimated/committed/actual cost | Job-cost service with source references | Margin reports and Command Center |
| Statutory books and closed accounting periods | Chosen external accounting system, with an explicit field ownership matrix | Reconciliation and approved return updates |
| Import origin | Migration lineage, preserved separately from accounting IDs | Every domain and integration |

An accounting adapter must not overwrite original migration `sourceSystem`/`sourceId` to remember a new remote accounting ID. Use connection-specific mappings instead. No unlimited bidirectional sync: define allowed direction and conflict handling for each entity and field.

## 3. OP-00 — Source reconciliation, policies and shared contracts

**First implementation prerequisite.** Establish exact current branch ancestry, existing board ownership, domain contracts and a small synthetic fixture set before parallel module work.

Deliver a metric dictionary; job-cost and stock valuation ADR; accounting ownership matrix; time/pay policy contract; migration capability matrix; and acceptance evidence template. Proposed additions belong under existing `packages/types` and domain services. Schema changes must be reviewed in `packages/db/src/schema.ts` and receive coordinated migration numbers only when implementation is approved.

Use explicit capabilities rather than promises: `quantity_tracking`, `inventory_valuation`, `payroll_preparation`, `payroll_processing`, `qbo_financial_export`, `qbd_recurring_sync`, `forms_required_at_closeout`, and `migration_cutover_accepted`. Do not make these flags public claims until their gates pass.

**Exit:** reviewed definitions, consumer map, permission matrix, representative fixture set and a dependency-cleared first packet. No production flags changed.

## 4. OP-01 — Automated reporting and operational digests

### Existing code to reuse

`ReportingDashboardClient.tsx`, `reporting.hooks.ts`, the reporting routes and existing job-source/direct-demand/revenue-outcome services. The current reporting hook fetches all pages of several operational lists and assembles its dataset in the browser. That is not a durable scheduled-report service and should not become the authoritative financial calculation path. [R1]

### Proposed v1

Create a server-owned report catalog with versioned definitions, safe filters, allowed dimensions, date basis, currency, time zone and role scope. Existing dashboards and new exports must consume the same definitions. Include `asOf`, source freshness and completeness indicators; distinguish empty, unavailable, incomplete and true zero.

Provide eight opinionated report templates: daily owner summary; weekly bookings/operations; payroll/time exceptions; job margin and cost variance; receivables/collections; inventory/reorder; PO/receiving exceptions; accounting/migration reconciliation. Reports whose underlying costing or purchasing data is not ready must remain explicitly unavailable, not display invented metrics.

Add saved views and subscriptions with daily/weekly/monthly schedules, recipients, tenant time zone and period rules. Workers generate immutable run snapshots and CSV/PDF artifacts. Default delivery is an in-app record plus a minimal email digest and authenticated report link. Payroll detail is not placed in general owner emails or broadly shared attachments. External accountants require explicit access scope and revocation.

Proposed entities: `report_definitions`, `saved_reports`, `report_schedules`, `report_runs`, `report_deliveries`; first inspect whether existing generic scheduling/outbox primitives can serve these roles. Proposed API family: `/reporting/catalog`, `/reporting/runs`, `/reporting/subscriptions`, and authorized run/download detail. These are proposed, not existing endpoints.

A schedule occurrence has a deterministic deduplication key. Generation failure can be retried safely. Provider delivery has its own deduplication and uncertain-outcome handling; do not promise exactly-once email delivery. Pause schedules on lost authorization. Support cancellation, bounded catch-up, rate limits, retention and visible failures.

**Acceptance:** company-local month/year/DST boundaries; stable totals across UI/CSV/PDF; no browser list-window cap masquerading as complete data; cross-tenant and wage-data denial; duplicate scheduler ticks; revoked recipients; partial data; delivery timeout/replay; export formula-injection protection; bounded queries on representative volume.

**Not v1:** unrestricted SQL/report formulas, arbitrary dashboard designers or AI-created financial numbers. An AI summary may explain the deterministic report and cite its rows, never become the accounting authority.

## 5. OP-02 — Workforce, timesheets and payroll preparation

### Existing code to retain

`timesheets.service.ts`, timesheet routes/types, time entries, technician pay-rate records and the existing UI. Approval, rejection, reopening, rate dates and gross-pay CSV are real foundations. The inspected service documents Monday-based workweeks, closed travel/on-site entries as paid, breaks as unpaid and a default 2,400-minute overtime threshold. These are implementation assumptions, not a universal lawful payroll policy. [R2]

### Proposed v1

Extend time/pay eligibility to approved employee types rather than assuming every paid employee is a technician. Preserve a separate field-assignment identity. Model effective-dated workweek and time-zone rules, paid/unpaid activity types, break treatment, overtime rules and earning-code mappings. Payroll/legal specialists must approve jurisdictional rules before customer activation.

Support employee review/attestation, correction requests, manager approvals and reasoned reopen/amendments. Distinguish travel, vendor run, on-site, training, office and other approved non-job time. Automatic job-status suggestions may assist time entry, but do not silently invent compensable hours or claim geofence accuracy without a separate accepted capability.

Add immutable payroll-preparation runs containing approved source time versions, applicable rates, earning lines, gross calculations, exceptions and provider mapping. State model: draft → calculated → exceptions/review → approved → exported/submitted → acknowledged/reconciled. Exported is not paid. A post-export correction creates an amendment, not an invisible change to the old file.

First provider delivery may be a provider-specific validated CSV. Direct payroll-provider integration is a separate acceptance slice. Include performance pay as an explicit versioned earnings contract: commission basis, earning date, approval, shared credit, cancellation/refund reversal and paid status. Do not simply apply a percentage to every invoice or collected payment.

### Source risks to test before expansion

The current payroll summary can mark missing individual pay rates with unknown gross amounts while aggregate accumulation treats null amounts as zero. Reproduce this deterministically and ensure an incomplete payroll cannot be approved as a complete total. Test pay-rate changes inside periods, date ranges that do not align to entire sheets/workweeks, midnight-crossing shifts, and different requested overtime policies. These are source-identified acceptance risks, not claims of observed incorrect customer payouts.

**Acceptance:** no double-counting overlapping entries; exact rate effective dates; approved-sheet immutability; payroll-only wage permissions; office/field eligibility; no export with unresolved mandatory rates; overtime allocation spanning jobs; duplicate provider submission; amendments and acknowledgements; total reconciliation to approved inputs.

**Boundary:** v1 is time, earnings and payroll preparation, not Renvani calculating every payroll tax, filing returns or moving wages. Intuit now documents Workforce/payroll APIs with partner-tier and approval requirements; access and write capabilities must be confirmed rather than assuming that QBO accounting access includes payroll processing. [E6–E7]

## 6. OP-03 — Job costing and margin control

### Existing foundation and missing authority

Jobs, quotes, invoices, pay rates/time and product/stock records can be reused. However, the inspected job-product snapshot captures selling `unitPrice` and `total`, not the historical acquisition cost of the consumed material. Current catalog cost is not sufficient to reconstruct immutable actual job cost. [R3]

### Proposed v1

Build a dedicated job-cost service, not a calculation in the job detail component. Keep these views separate: estimated budget; approved committed cost; accrued/provisional actual cost; finalized actual cost; and variance. Track labor, employer burden, material, subcontractor, rental/equipment and approved other direct costs. Optional allocated overhead must be labeled separately from direct gross margin.

Proposed data: `job_cost_budgets` and revisions, `job_cost_entries`, allocation/reversal references and report snapshots. Reuse existing time, stock, PO, invoice and source documents through IDs; do not duplicate their mutable state.

Labor postings use approved time/rate versions and an approved burden policy. Material cost comes from inventory issue valuation or a documented direct-to-job receipt/consumption policy. A purchase request, receipt, bill and payment for the same item cannot each become a separate job cost. Vendor bill variance adjustments must link back to original stock/job cost allocations.

Expose job summary/drill-down with source records, actual-versus-estimated variance, unallocated costs, missing-cost exceptions and last calculation time. Support provisional margins while labor or bills are unapproved; never label them final. Maintain restricted wage-level drill-down even when an operator can see aggregate labor cost.

**Acceptance fixture:** $1,000 net operational job revenue, $120 labor, $24 burden, $180 consumed material and $30 equipment produces $354 direct cost and $646 direct gross margin, or 64.6%. An unused $300 PO commitment is shown separately and does not reduce actual margin. Issuing a receipt/bill/payment must not add the $180 again. Changing the catalog cost later does not rewrite the original result. Missing labor rate produces incomplete cost, not a more profitable job. This is a synthetic calculation, not a revenue-recognition policy.

**Not v1:** general ledger, enterprise project WIP recognition, unrestricted overhead allocation or tax accounting. The external accounting system and approved financial policy remain authoritative for statutory books.

## 7. OP-04 — Purchasing and inventory valuation

### Existing foundation

Inventory v1 already supports warehouse and van locations, quantities, low stock, transfers, adjustments and job usage. Its contract expressly uses integer quantities and does not store money in stock movements. It is not yet a procurement and valued-inventory system. [R4]

### Proposed v1

Introduce vendor identities and catalog cross-references; requisitions; purchase orders and lines; approvals; expected delivery and location/job allocations; partial receiving; receipt corrections; vendor returns/credits; and bill matching. Start with a controlled workflow, not autonomous vendor purchasing.

PO lifecycle: draft → submitted → approved → issued → partially received/received → reconciled/closed, with explicit rejection, cancellation and amendment paths. Receiving and bill matching have independent states: a received PO is not necessarily paid. Re-approval is required for material post-approval changes under company policy. Vendor transmission is audited separately from approval.

Evolve stock quantities to precision-aware units where needed, preserving compatibility with existing integer callers. Define base units and approved conversions for each material. A “box” cannot silently be treated as one foot or one pound. Add reservations, available-to-promise quantity, in-transit stock, receipt/return movements, reasoned cycle counts and barcode lookup where supported.

Recommended v1 valuation decision for review: weighted-average cost for ordinary interchangeable materials, with explicit exceptions for serialized equipment; FIFO is an alternative decision, not something to silently mix. Define valuation scope, opening balance policy, freight/nonrecoverable tax treatment, bill price variance and backdated corrections with the accounting owner.

Use concurrency-safe balance updates and append-only quantity/value movement records. Positive receiving is idempotent by receipt-line identity. Transfers move existing value without generating job cost or profit. Returns reference original receipts/issues and original cost policy. Negative-stock exceptions require controlled permission and explicit valuation treatment.

**Acceptance:** partial deliveries; duplicate receipt replay; simultaneous truck issues; fractional quantities; unit conversions; returned/defective stock; price variance; PO amendment; location permissions; counts and corrections; no PO+receipt+bill triple expense; invoice-material lines do not automatically imply stock consumption twice.

**Later slices:** supplier catalog feeds, EDI, automated replenishment ordering, advanced lots/expiry and broad serialized-asset logistics. Low-stock proposals are appropriate before automatic purchase authority.

## 8. OP-05 — QuickBooks Online accounting integration

### Existing foundation and precise limitations

Reuse existing connection/OAuth/token, mappings, sync issue, queue and settings components. The current engine's invoice and payment branches explicitly record `NOT_IMPLEMENTED`; the runtime configuration only accepts the sandbox environment. A connected-looking settings page is not a live financial integration. [R5–R6]

The inspected customer method named `upsertCustomer` sends a create-style payload without an existing remote ID/SyncToken. The CDC client and engine do not demonstrate complete financial change application. These require provider-contract tests and reconciliation; method names and a “last sync” timestamp are not proof. Also separate remote accounting identity from original import lineage. [R7]

### Proposed staged implementation

**05A — connection and ownership:** confirm approved Intuit app access, realm-to-tenant binding, scopes, callback protection, refresh locking, credential lifecycle and dedicated token encryption. Document import versus continuing sync boundaries. Do not enable production by removing a sandbox guard alone.

**05B — deterministic outbound accounting:** customer/item/account/tax/payment-method mappings, finalized invoices and linked payment records in dependency order. Use durable delivery records, source versions and immutable request identity. Track remote IDs and concurrency tokens. Reconcile timeout-after-success before retry; do not duplicate transactions or charge customers through this accounting path.

**05C — reconciliation and controlled inbound updates:** signed notifications, durable event handling, per-realm ordering controls and replay. Keep CDC watermarks tied to successfully processed changes, not merely observed timestamps. Intuit recommends queued processing and CDC-based recovery for missed notifications; implement against current official contracts. [E8]

**05D — purchasing and further entities:** vendors, bills, credits and supported purchase transactions after OP-04 and accounting mapping acceptance. Payroll/time data is a separate capability and permissions decision.

Provide a user-facing sync center showing not connected, blocked, pending, partially applied, uncertain, reconciled and failed states by entity. Display the last successfully reconciled period/entity and unresolved issue count, not just a successful API request time. Avoid unrestricted two-way field ownership and overwrite loops.

**Acceptance:** mapping dependencies; duplicates; sparse edits and concurrency conflict; expired/revoked tokens; disconnect during work; webhooks out of order; missed-event replay; refunds/credits/voids; tax and rounding; closed periods; cross-tenant realm attempts; historical imported transactions not re-exported as new; zero live charges.

**Release gate:** an isolated approved company pilot with accountant sign-off and exact amounts/IDs on both sides, followed by explicit production authorization. Do not claim QBO production support from sandbox tests.

## 9. OP-06 — QuickBooks Desktop recurring connector

### Existing versus new

Keep the existing QBD IIF/CSV migration support. It is file onboarding, not an ongoing accounting bridge. No production qbXML/Web Connector runtime was found in the inspected source. [R8]

Run a bounded discovery spike early, in parallel with contracts, because Desktop hosting and version constraints can shape the product. Official Intuit documentation describes a Windows Web Connector installed with/near QuickBooks, initiating communication to a web service implementing its WSDL and exchanging qbXML. It is a different transport from QBO OAuth and can be scheduled locally. [E5]

### Proposed v1

Reuse OP-05's accounting entity/mapping/outbox/reconciliation contracts, not its HTTP OAuth adapter. Add a Desktop adapter, authenticated company-file pairing and approved `.qwc` configuration. Specify supported current editions/versions, region, Windows hosting, connector version and operating prerequisites; do not promise every legacy edition or Mac compatibility.

Persist request state, responses, remote TxnID/ListID/EditSequence and last reconciled checkpoints. Handle host offline, locked or wrong company file, competing connector sessions, interrupted responses and reconnect without duplicate financial writes. XML parsing must disable unsafe external entities and enforce strict size/content limits. Connector pairing and logs cannot expose broad tenant credentials.

Start with agreed customer/item/account/tax mappings, invoice and payment synchronization. Expand to vendors/bills/time only where the exact supported SDK contract, permissions and customer need are verified. Provide explicit stale/offline status and operator recovery instructions. An offline host is not “sync complete.”

**Acceptance:** authorized Windows test company; backup/restore and company-file identity mismatch; duplicate request replay; remote write followed by lost reply; SyncToken-equivalent edit/version conflict; multiple companies; locked books; negative tenant boundary tests; reconciled totals. A Linux-only unit suite cannot certify the actual Desktop integration.

## 10. OP-07 — Operational forms and inspections

### Existing foundation

Evolve `form_templates` and `form_submissions`; reuse job tasks, attachment and signature infrastructure. The inspected production references to these form tables were schema/relations rather than a completed forms API/renderer. Marketing intake forms and job checklists are not substitutes for inspection/submission workflows. [R9]

### Proposed v1

Provide versioned templates with controlled text, numeric/unit, select, date, checkbox, photo and signature fields; conditional required rules; documented acceptable ranges; and assignment by job type/asset. Ship reviewed HVAC maintenance/startup, plumbing inspection and job completion templates plus a simple controlled editor. Template comments in a schema do not count as shipped templates.

A job assignment pins its template version. Later edits create a new template version without changing completed submissions. Lifecycle: draft/in-progress → submitted → reviewed/returned → amended where authorized. Preserve prior response versions, actor/time and approval history. Distinguish required customer work approval from a technician checklist or safety attestation.

Mobile rendering supports resumable local drafts, server version conflicts, pending photo uploads and explicit offline state. A required photo or signature cannot be considered complete while its artifact is unavailable. Validate all fields on the server, including conditional requirements; job closeout uses server-enforced form rules with an audited exception mechanism, not a frontend-only disabled button.

Provide authorized PDF/archive generation and controlled customer sharing. Access, retention and audit rules must distinguish employee-only safety notes from customer deliverables. Do not claim a signature capture alone supplies every legal requirement for electronic agreements.

**Acceptance:** pinned old/new templates; invalid/missing conditional answers; unit bounds; assigned technician authorization; customer visibility; offline retry; double submission; simultaneous edits; missing attachments; failed inspection review; backend closeout enforcement; accessible tablet/phone operation.

**Later:** arbitrary scripting/formulas, unbounded nested builders and advanced enterprise document automation.

## 11. OP-08 — Migration expansion and production-readiness certification

### Current development status

The repository has a real generic file-import foundation: CSV/XLSX/IIF parsing, AI-assisted mapping, review, deduplication, source lineage, worker processing, reconciliation artifacts and rollback services. The five-step migration wizard is not just a mockup. [R8, R10–R11]

However, entrypoints do not all have identical entity coverage. The generic built-in chunk committer registry explicitly includes customers, properties, jobs, estimates, assets and invoices. Price-book, payment/history, communications, notes and file migration have specialized paths that must be traced individually from UI through worker and reconciliation. A broad type declaration or golden fixture is not proof that every upload path supports that entity. [R10]

The golden import expectations inspected explicitly name QBD and Service Fusion. They provide useful deterministic test seeds, not certification for every export format, vendor version, multi-year scale or all customer files. QBO and QBD have dedicated export-oriented catalog entries; Service Fusion, Jobber, ServiceTitan and Housecall Pro are generic-import presets/export guidance, not separate live integrations. QBO OAuth inside the migration catalog is disabled/gated. [R8, R11]

Notion FS-95 remains In Progress, with historical Next Action references that predate newer GitHub work. FS-222 remains Blocked in its older board record, while the workspace-intent foundation PR #411 is actually merged. Preserve this distinction: stale blocker wording should be reconciled, but a merged provisioning foundation does not establish full signup-to-go-live acceptance. [N1–N2, R13]

### Proposed completion work

Create a capability matrix per entity and entrypoint: advertised upload type, parser, mapping schema, validation, preview, dependency resolution, committer, reconciliation, rollback/recovery and executed acceptance evidence. Reject or quarantine unsupported types visibly; do not silently accept and drop them.

Keep one generic AI-guided importer with presets for header matching, preserving the recorded product direction. QuickBooks-specific format/adapters remain deliberate exceptions. Mapping suggestions do not authorize data writes; deterministic validation and explicit preview acceptance remain mandatory.

Add reviewed import contracts for employees/rates/time where supported, vendors, open POs and receipts, opening stock quantity/value, historical job costs and relevant form history. Classify unsupported legacy forms as retained read-only artifacts when executable reconstruction is not reliable. Do not infer valid current labor rates, tax policies, stock valuation or marketing consent from incomplete historical exports.

Support entity dependency order, stable lineage, idempotent replay, field-level exceptions, partial failure and exact recovery progress. Test a bundle that enters `committing` and then fails to enqueue/start a later session. Determine and implement recovery from that demonstrated case before claiming end-to-end resumability. This is a source-based test requirement, not an assertion that a live migration failed.

Reconciliation must cover source/accepted/rejected/duplicate counts, relationships, invoice totals/paid/balance, opening inventory quantity/value, historical cost and file checksums/links. Every variance must be explained or explicitly waived by an authorized approver. Unsupported data must appear in the customer-facing scope agreement.

Separate rehearsal from final cutover. Capture source export time, freeze/delta boundaries, import batch provenance and accounting ownership. Preserve original remote accounting IDs when known so old transactions are not exported again. Do not automatically activate memberships, charge saved cards, send campaigns or contact historical customers after an import.

Rollback before operational use may reverse isolated imported effects under existing safeguards. After subsequent live edits, costs or accounting exports, use controlled compensating corrections and review; do not promise arbitrary destructive rollback. Raw card PAN/CVV must not enter the generic importer; existing saved-card migration remains its separately authorized provider/consent flow.

**Acceptance:** representative multi-year, large-file, malformed and duplicate datasets; cross-tenant references; replay and partial retry; accurate rejected rows; source-ID collisions; opening balance reconciliation; rollback with downstream changes; no surprise payments/messages; human acceptance of documented exceptions.

## 12. OP-09 — Customer implementation and go-live workbench

An imported database is not an implemented business. Reuse workspace provisioning, business settings, user permissions, the import wizard, pricebook, forms and accounting setup. Do not rebuild Clerk workspace creation because an old Notion card still describes it as missing. [R13, N2]

Proposed lifecycle: discovery → configuration → migration rehearsal → reconciliation → training/test workflows → pilot acceptance → approved cutover → hypercare → completed. Proposed `implementation_projects`, readiness tasks, evidence records and sign-offs should reference existing configurations/import bundles, not duplicate their state.

Readiness covers business/location/timezone identity; users and roles; scheduling/capacity; pricebook and taxes; payroll policies; stock opening balances; forms; accounting mappings; import exceptions; and first working estimate-to-job-to-closeout journey. Payment readiness remains a separate approved test/provider step. A tenant starting without historical data needs an explicit fresh-start path, not a fake completed import.

Each mandatory gate needs evidence, responsible human/role, timestamp and unresolved exceptions. The UI shows which business capability is blocked and why. “Upload finished,” “OAuth connected,” “build green” and “owner clicked next” cannot independently mark go-live accepted.

Include role-specific training, a test job and accounting reconciliation, cutover runbook, fallback decision and support escalation. Delegated implementation/support access must be authorized, limited and audited. No broad impersonation capability is implied.

**Acceptance:** fresh-start and migration tenants; interrupted/resumed onboarding; stale configuration invalidating a gate; failed accounting setup; incomplete stock/payroll policies; authorized waivers; pilot evidence; explicit owner cutover acceptance; no automatic production sends/payments on completion.

## 13. Sequencing and parallel work

| Stage | Work | Dependency / outcome |
| --- | --- | --- |
| 0 | OP-00 source/ownership/policy decisions; reconcile #445 and existing board | Stop duplicate builds; establish authoritative numbers and contracts |
| 1 | OP-01 server metric/report foundation; OP-02 timesheet correctness; OP-07 forms contracts; OP-08 migration acceptance matrix | Useful owner reports and safer existing modules without waiting for every integration |
| Parallel discovery | OP-06 Desktop feasibility and OP-05 Intuit capability/access review | Discover Windows, provider and permissions constraints early; no production connection |
| 2 | OP-03 cost ledger; OP-04 purchasing, receiving and valuation; OP-02 earning/pay-run extensions | Link actual time/material/purchases to jobs with no double counting |
| 3 | OP-01 cost/procurement reports; OP-05 QBO financial sync; OP-06 Desktop core adapter | Reconcile operational facts to external accounting |
| 4 | OP-08 new-entity migration and OP-09 implementation/cutover workbench | Accepted customer transition across the connected workflow |

Design discovery and acceptance planning run alongside backend contracts. Do not place a new approved frame ID in a ticket unless the exact design exists in canonical Figma `jiGHTNUJNltWbHA4Il3hk7`. Desktop, tablet, mobile and empty/loading/error flows need independent acceptance. No new UI parity claim was established by this audit.

## 14. Decisions that must be resolved

| Decision | Recommended default for review | Must be confirmed |
| --- | --- | --- |
| Payroll scope | Preparation and qualified provider handoff first | Provider, API access, employees/contractors, jurisdictions, overtime/break/pay rules |
| Commission policy | Versioned earnings with explicit approval/reversal | Earned basis, split credit, refunds, timing and wage-rule review |
| Inventory valuation | Weighted-average ordinary materials; documented serialized exception | Accounting owner, location scope, backdating, freight/tax and FIFO needs |
| Margin definition | Direct job gross margin with separate provisional/committed views | Revenue basis, burden/OT allocation and overhead presentation |
| Accounting ownership | One active authoritative export destination per legal accounting scope | QBO versus QBD, legal entities, classes/locations, tax and currency mappings |
| Desktop support | Bounded current Windows/QuickBooks support matrix | Actual customer editions, versions, host uptime and SDK/connector prerequisites |
| Report distribution | Secure in-app report and authenticated links | Recipients, accountant access, retention, delivery and size budgets |
| Migration breadth | Explicit per-entity capability contract and rehearsal | Customer exports, history horizon, opening balances, unsupported artifacts and cutover |
| Customer implementation | Evidence-backed gates with authorized exceptions | Pilot criteria, responsible roles and launch authorization |

Customer settings should express facts and policy, not require owners to design complicated workflows. Opinionated defaults are welcome only where correct and accepted; jurisdictional pay/tax/accounting rules cannot be invented for simplicity.

## 15. Cross-cutting acceptance and release controls

All implementations require tenant and role negative tests, decimal/currency correctness, optimistic concurrency where applicable, auditability, idempotent processing, explicit incomplete/uncertain states, and no secrets in logs. Source code, local checks, CI, independent acceptance and deployment must be recorded separately by exact SHA.

Financial tests must distinguish missing cost from zero, invoice from cash, commitment from expense, imported history from new business, and a provider acknowledgment from a settled or paid result. Backdated corrections and closed periods need deterministic behavior.

Operational tests cover DST, company versus browser timezone, multiple employees and stock locations, large reports, simultaneous stock movement, stale form versions, offline mobile retries, interrupted imports, expired/revoked integration access and unavailable Desktop hosts. Proposed performance budgets must be agreed against representative customer volumes; do not certify a large tenant with a two-row fixture.

No new live payroll, purchase, payment, accounting export, customer message, provider credential change or production deployment is authorized by this draft. Founder named-PR/exact-head merge authority and independent Peer/QA/Security-by-risk/Design requirements remain intact. Phase II Operating Missions runtime is separate; these operational records may eventually feed it, but this spec does not authorize that runtime.

## 16. Codex / Cursor pickup instructions

Read `AGENTS.md`, `CODEX.md`, current repository/board state and this spec. Recheck the audited SHA and active PR ancestry. The first bounded packet is **OP-00 plus reproduction tests for the identified existing data-truth risks**, not a full rebuild of timesheets or inventory.

Next, implement server-owned metrics and a small scheduled report run/delivery slice after scope approval, while the appropriate pair develops the cost and purchasing contracts. Independently trace the migration capability matrix. Keep Desktop feasibility early. Obtain actual design nodes before frontend work.

Report: exact source/head, files reused, contracts changed, tests executed versus skipped, provider/live boundaries, evidence gaps and next smallest blocker. Do not call this spec or any schema-only foundation a completed feature. Do not alter board status or assign owners merely because the document lists a work package.

## 17. Source register

All Renvani file links below are pinned to the inspected `dev` snapshot unless stated otherwise. Notion task fields may contain historical next actions; live merge metadata and code were checked where material conflicts were identified.

- **R1 Reporting:** [browser dataset and metric hook](https://github.com/SimonShaun2/Renvani/blob/e5aff10fb380dca5457679811c1e3dfa2ae9c0cd/apps/web/src/hooks/reporting.hooks.ts); [reporting routes](https://github.com/SimonShaun2/Renvani/blob/e5aff10fb380dca5457679811c1e3dfa2ae9c0cd/apps/api/src/routes/reporting/index.ts).
- **R2 Workforce:** [timesheets service](https://github.com/SimonShaun2/Renvani/blob/e5aff10fb380dca5457679811c1e3dfa2ae9c0cd/apps/api/src/services/timesheets.service.ts); [types](https://github.com/SimonShaun2/Renvani/blob/e5aff10fb380dca5457679811c1e3dfa2ae9c0cd/packages/types/src/timesheets/v1/index.ts).
- **R3 Job materials/cost inputs:** [job-product snapshot/service](https://github.com/SimonShaun2/Renvani/blob/e5aff10fb380dca5457679811c1e3dfa2ae9c0cd/apps/api/src/services/job-products.service.ts); [authoritative schema](https://github.com/SimonShaun2/Renvani/blob/e5aff10fb380dca5457679811c1e3dfa2ae9c0cd/packages/db/src/schema.ts).
- **R4 Inventory:** [FS-170 contract](https://github.com/SimonShaun2/Renvani/blob/e5aff10fb380dca5457679811c1e3dfa2ae9c0cd/packages/types/src/inventory/v1/index.ts); [service](https://github.com/SimonShaun2/Renvani/blob/e5aff10fb380dca5457679811c1e3dfa2ae9c0cd/apps/api/src/services/inventory.service.ts).
- **R5 QBO engine:** [sync implementation and unimplemented branches](https://github.com/SimonShaun2/Renvani/blob/e5aff10fb380dca5457679811c1e3dfa2ae9c0cd/packages/db/src/qbo-sync-engine.ts).
- **R6 QBO environment:** [sandbox-only configuration](https://github.com/SimonShaun2/Renvani/blob/e5aff10fb380dca5457679811c1e3dfa2ae9c0cd/packages/config/src/qbo-env.ts).
- **R7 QBO client:** [customer and CDC client](https://github.com/SimonShaun2/Renvani/blob/e5aff10fb380dca5457679811c1e3dfa2ae9c0cd/packages/config/src/quickbooks/qbo-api-client.ts).
- **R8 Migration catalog:** [source catalog and gated OAuth](https://github.com/SimonShaun2/Renvani/blob/e5aff10fb380dca5457679811c1e3dfa2ae9c0cd/packages/types/src/migrate-onboarding/v1/source-catalog.ts); [IIF parser](https://github.com/SimonShaun2/Renvani/blob/e5aff10fb380dca5457679811c1e3dfa2ae9c0cd/packages/import-engine/src/quickbooks-iif.ts).
- **R9 Forms:** [form template/submission schema](https://github.com/SimonShaun2/Renvani/blob/e5aff10fb380dca5457679811c1e3dfa2ae9c0cd/packages/db/src/schema.ts#L1523-L1572).
- **R10 Migration runtime:** [registered chunk committers](https://github.com/SimonShaun2/Renvani/blob/e5aff10fb380dca5457679811c1e3dfa2ae9c0cd/apps/worker/src/lib/import-chunk-builtin-committers.ts); [bundle commit service](https://github.com/SimonShaun2/Renvani/blob/e5aff10fb380dca5457679811c1e3dfa2ae9c0cd/apps/api/src/services/migrate-onboarding.service.ts); [import start/rollback](https://github.com/SimonShaun2/Renvani/blob/e5aff10fb380dca5457679811c1e3dfa2ae9c0cd/apps/api/src/services/import.service.ts).
- **R11 Golden coverage:** [QBD and Service Fusion expectations](https://github.com/SimonShaun2/Renvani/blob/e5aff10fb380dca5457679811c1e3dfa2ae9c0cd/packages/db/src/golden-import-e2e/expectations.ts).
- **R12 Unmerged prior work:** [PR #445](https://github.com/SimonShaun2/Renvani/pull/445); [six-package handoff](https://github.com/SimonShaun2/Renvani/blob/feat/fsm-workflow-reliability-20261105/docs/handoffs/RENVANI-FSM-CODEX-CURSOR-START-HERE-2026-11-05.md).
- **R13 Provisioning:** [merged PR #411 / FS-235](https://github.com/SimonShaun2/Renvani/pull/411).
- **R14 Baseline/governance:** [pinned audit commit](https://github.com/SimonShaun2/Renvani/commit/e5aff10fb380dca5457679811c1e3dfa2ae9c0cd); [founder issue #420](https://github.com/SimonShaun2/Renvani/issues/420).
- **N1 Migration board:** [FS-95 universal import/onboarding](https://app.notion.com/p/402317b92d158171803ec6326cf197bd).
- **N2 Onboarding board:** [FS-222 signup/workspace/onboarding](https://app.notion.com/p/407317b92d1581e385ecf8e17c743363).
- **E1 Reference payroll:** https://www.servicetitan.com/features/contractor-payroll-software
- **E2 Reference inventory:** https://www.servicetitan.com/features/contractor-inventory-software
- **E3 Reference reporting:** https://www.servicetitan.com/features/field-reporting-software
- **E4 Reference accounting:** https://www.servicetitan.com/features/accounting/integrations
- **E5 Intuit Desktop transport:** https://static.developer.intuit.com/output_html/qbdesktop/docs/get-started/get-started-with-quickbooks-web-connector.html
- **E6 Intuit partner/API access:** https://static.developer.intuit.com/output_html/qbo/docs/get-started/partner-faq.html (page updated October 29, 2026).
- **E7 Intuit payroll employee access:** https://developer.intuit.com/app/developer/payroll-time/docs/workflows/payroll-employee
- **E8 Intuit event/recovery practices:** https://static.developer.intuit.com/output_html/qbo/docs/develop/webhooks/best-practices.html

**Document completion:** this audit and proposed specification are complete as a draft. No proposed module was implemented by creating this document. No existing PR was merged and no application runtime was changed.
