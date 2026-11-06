# Renvani | Document 2 of 2
# Codex / Cursor Integrated Build Specification, Tickets and Sprints

Version 1.0 | November 6, 2026 | Planning status: drafted; implementation not started by this document

**Companion:** [Document 1: ChatGPT foundation tickets and sprints](CONNECTED-INTELLIGENCE-01-CHATGPT-FOUNDATION-SPRINTS-2026-11-06.md).

**Outcome:** make the existing AI platform use real operational and financial evidence to answer questions, explain situations, surface exceptions and support authorized decisions through Command Center. Complete the underlying reports, workforce, costing, purchasing/inventory, QBO, QBD, forms, migration and customer-implementation capabilities required for those answers.

**Delivery:** 28 implementation planning tickets across seven integration sprints. Each ticket includes its evidence integration; the AI layer is not postponed until after standalone modules are built. No ticket is represented as implemented, assigned or release-approved by this plan.

## 1. Product and engineering contract

The platform path is business intent → authoritative domain facts → shared evidence → supported explanation → appropriate recommendation → separately authorized execution → verified outcome. Operating Missions supplies intent; the Outcome Intelligence Engine coordinates; Growth, Revenue, Operations and Retention supply specialized capability; Command Center unifies the owner experience; Reports presents the same facts in detail. [S1, S2]

Preserve one source of truth per business fact. Do not rebuild the scheduler, jobs, timesheets, inventory quantity ledger, import engine, agent-action service or legacy Command Center merely because this plan introduces a new read contract. Reuse the existing Next.js/Fastify/PostgreSQL/Drizzle/BullMQ architecture and current integrations. [S3, S4]

Financial identity and provenance must span the full lifecycle: accepted estimate → work order/job/visit → approved time/material consumption → job cost → invoice/credit → payment/refund → accounting mapping. Imported history remains separately traceable. An invoice, payment and four product-assistance records do not create six sales.

### What we are not building by default

No general ledger replacement, universal payroll tax/remittance engine, unrestricted production SQL agent, autonomous wage/PO/payment execution, global customer retrieval store or second report scheduler. No assumption that QBO accounting access includes payroll-provider capabilities. A QBD file import is not a recurring Desktop connector. Provider/version/legal requirements must be checked against current official sources during the relevant implementation ticket.

### Ticket and sprint rules

RCI-C01–RCI-C28 are local planning IDs to map to existing FS owners before implementation; they are not newly created board issues or fictional FS IDs. All begin **Draft / unassigned / tests not executed**. Suggested lanes describe responsibility, not named assignees. P1/P2 are extension-relative priorities, not replacements for existing P0 work.

C0–C6 are dependency-led sprint batches, not calendar commitments or a replacement for the master Phase A/A1–A5 and Phase B program. Actual capacity determines sprint length and which parallel lanes are staffed. A larger ticket must be delivered through the stated bounded slices/PRs rather than an unsafe large merge. Only accepted dependency outputs may be consumed; source-level interfaces alone do not establish runtime capability.

Code readiness, independent acceptance, approved exact-head CI, founder merge approval and production enablement are separate. Phase II mission execution remains gated by original software acceptance and explicit founder permission. Read-only Phase I foundations are not automatically blocked by unrelated mission/provider work. [S5]

## 2. Sprint roadmap and release slices

| Sprint | Goal | Tickets | Main output / exit gate |
| --- | --- | --- | --- |
| C0 | Reconcile the repo and establish adoption/provider prerequisites | C01–C03 | Named ownership, integration base, contract adoption plan and verified connector constraints |
| C1 | Deliver the first real read-only Command Center answer | C04–C06 | Authenticated “What needs attention today?” using current accepted sources, with provenance and partial states |
| C2 | Add controlled questioning, secure history and reporting | C07–C10 | Grounded routing, reauthorized conversations, shared report delivery and independent first-slice acceptance |
| C3 | Extend workforce, materials, costing and forms | C11–C15 | Approved payroll preparation, stock readiness, provisional costing and real field-form workflows |
| C4 | Connect purchasing, valued stock and QBO financial sync | C16–C19 | Reconciled procurement/material cost, complete supported margin and accepted QBO financial pilot |
| C5 | Deliver Desktop, migration expansion and implementation readiness | C20–C23 | Tested Desktop bridge, accounting purchase flows, reconciled imports and go-live workbench |
| C6 | Unify specialist stories, proactive attention and controlled rollout | C24–C28 | Cross-domain acceptance, proactive lifecycle, optional authorized action bridge and staged release |

**Early value:** C01/C03 start beside H1. C02 begins once its contract inputs are reviewed; it does not wait for every foundation/domain fixture. C04–C06 use the accepted H04–H09 subset, applicable H12 tests and H14 design requirements. C10 can certify the read-only slice before C3–C6 finish.

**Capability-by-capability rollout:** each domain ticket contributes its reader and question as soon as accepted. C24 reconciles multi-specialist orchestration; it is not an excuse to defer every domain answer. C25 can first enable already-accepted deterministic detectors. QBO customers do not need Desktop enabled, but Desktop remains a committed build scope with its own acceptance. The action bridge C26 is not a prerequisite for a read-only release.

## 3. Target implementation boundaries

| Boundary | Existing source / proposed extension | Required control |
| --- | --- | --- |
| Shared contracts | Existing types plus accepted H04–H07 module | Versioned adoption; unchanged legacy brief consumers |
| Reads and metric computations | Existing domain services; reviewed aggregate queries | Tenant/role/entity/field filters before model context; exact decimal/date semantics |
| Insight composition | Additive services alongside current Command Center | Bounded readers, source versions, explicit incomplete/unsupported states |
| Question interface | Existing Command Center and contextual record surfaces | Canonical Figma, authenticated data, accessible responsive states |
| Run/history/cache | Reuse compatible report/OM manifests; add only reviewed records | Scope-sensitive cache keys, reauthorization, retention and revocation |
| Async work | Existing jobs/outbox/worker boundaries | Durable intent, idempotent processing, cancellation and visible failures |
| Financial writes | Existing operational records plus new reviewed cost/procurement domains | Append-only corrections, historic cost, exact source IDs, no duplicate posting |
| Providers | Separate QBO and QBD transport adapters | Per-entity mappings, uncertainty recovery, current official compatibility and approved pilot |
| Actions | Existing agent-action/domain authorization | Current facts and exact payload/grant rechecked; no writes from read tools |

Proposed paths such as `services/connected-intelligence/`, versioned shared schemas and insight routes are design candidates, not assertions that these paths already exist. C02 settles their final names and central-file ownership.

A new module is accepted only when its business workflow, authorized evidence reader, definitions, source links, quality states, negative-access tests and at least one cross-domain question pass. CRUD screens alone are insufficient.

## 4. Sprint C0 | Integration and prerequisites

### RCI-C01 | Reconcile code lineage, FS ownership and implementation branches

**Priority / risk / lane:** P1 / Architecture / Technical Lead. **Dependencies:** H01; current repository instructions. **Maps to:** CI-00, OP-00.

**Build:** reconcile current `dev`, #445 and its UI ancestry, #442 preparation and #449 documentation. Identify overlapping active work and record one owner per schema/shared service. Map these local tickets onto existing FS records before issuing gaps. Start narrow implementation branches from the verified intended base; the docs branch is not a substitute application integration base.

**Deliverables:** exact source/merge-base record, central-file reservation map, existing-ticket links, permitted CI scope and staged integration order. Preserve original source and history; no force push or auto-merge.

**Acceptance:** no six-package workflow or mission foundation is recreated; every planned change has a real source/dependency owner; stale board text is reconciled without silently declaring acceptance; clean source comparison identifies what is actually in each branch.

**Handoff:** all C-tickets. **Excluded:** permission to merge, deploy or start Phase II.

### RCI-C02 | Adopt shared contracts, schema decisions and design gates

**Priority / risk / lane:** P1 / Architecture and security / Backend platform. **Dependencies:** C01; reviewed H02–H07; incremental H15 package. **Maps to:** CI-01, OP-00, OM-01/04/05.

**Build:** adopt the foundation interfaces into current shared packages without breaking existing consumers. Decide whether existing report/OM manifests satisfy insight-run/evidence retention needs. Review minimal new tables/indexes, compatible API versioning, migration order and model/client projections. Coordinate exact Figma requirements with H14; missing frames become explicit design deliverables.

**Deliverables:** contract version, consumer map, authorized migration plan, source/cutoff ownership and approved rollout flags. Review begins early; final adoption consumes the accepted subset, avoiding a circular wait on the full H15/H16 handoff.

**Acceptance:** baseline consumer tests pass; tenant/sensitivity columns and retention are explicit; migrations replay in a disposable DB if added; definition changes do not relabel historical totals. Unsupported domain contracts remain disabled.

**Handoff:** C04 onward. **Excluded:** speculative infrastructure replacement and unapproved shared-schema migrations.

### RCI-C03 | Verify QBO, QBD and payroll-provider capability prerequisites

**Priority / risk / lane:** P1 / Provider and money / Integrations. **Dependencies:** C01; H01/H03. **Maps to:** OP-02/05/06.

**Build:** a bounded discovery implementation using current official provider documentation and approved sandbox/test-company access. Confirm QBO app scopes, financial entity support and production prerequisites; separately establish a supported Windows/QuickBooks Desktop/Web Connector matrix and hosting requirements. Identify a payroll handoff format/provider independently of QBO accounting access.

**Deliverables:** compatibility/access decision record, safe test-company runbook, entity/direction/field-ownership matrix, common mapping/uncertain-write contract and an evidence reader for connection/readiness state. Do not print or copy secrets.

**Acceptance:** current official references and exact test-environment constraints are recorded; QBD has an actual test-host plan; unsupported features are named; no production data, payroll or financial write occurs. Discovery completion is not connector acceptance.

**Handoff:** C11/C19/C20/C21. **Excluded:** promising all Desktop editions or payroll processing from an accounting token.

## 5. Sprint C1 | First real Command Center answer

### RCI-C04 | Implement authenticated read capabilities and insight-run API

**Priority / risk / lane:** P1 / Tenant and sensitive data / Backend platform. **Dependencies:** C02; H03–H08 and first-slice H12 tests. **Maps to:** CI-05/06, OP-01.

**Build:** server-bound tenant/actor request scope, allowlisted read capabilities, validated request/result contracts and minimally persisted evidence manifests where required. Enforce permissions before retrieval and before model/client projection. Add bounded query/run/detail routes without changing business records. New insight-run metadata is not a financial mutation.

**Deliverables:** routes/services, negative-role/tenant tests, request tracing and explicit unavailable/partial outcomes. C08 expands history/cache; C04 must already be safe without it.

**Acceptance:** real PostgreSQL/RLS and route tests reject cross-tenant IDs and hidden wage reads; user text cannot set actor authority; no arbitrary SQL/URLs; source detail access reauthorizes; read requests execute zero business/provider writes.

**Question enabled:** safe scope for CI-Q01. **Excluded:** conversational memory and consequential actions.

### RCI-C05 | Connect core readers and exact shared metric results

**Priority / risk / lane:** P1 / Correctness / Domain backend. **Dependencies:** C04; H02/H05/H07/H09. **Maps to:** CI-05, OP-01, OM-04/05.

**Build:** adapters for existing needs-you, job status, estimates and invoice-balance facts. Reuse existing Command Center and domain services; improve bounded reads with reviewed aggregates or continuations where complete results are required. Bind metric definition, company-local period, source versions and cutoff. Preserve legacy basis rather than recalculate it under a stronger name.

**Deliverables:** evidence assembly service, canonical-ID joins, partial-source error handling and seeded database integration tests. Cost/purchasing/forms data remains unsupported until its own adapter passes.

**Acceptance:** full computation is not confused with displayed citations; caps are visible; unknown is not zero; deleted/unrelated records are excluded; the same basis produces reconciled totals in legacy-compatible and new views; one failed optional source does not erase valid facts.

**Handoff:** C06/C07/C09. **Question:** CI-Q01 read-only attention summary.

### RCI-C06 | Build the authenticated Command Center answer experience

**Priority / risk / lane:** P1 / UI and access / Frontend with API owner. **Dependencies:** C05; H14 and accepted exact designs. **Maps to:** CI-06, OM-06.

**Build:** question chips and deterministic answer cards for “What needs attention today?”, source/evidence drawer, covered-period label, partial/unavailable states and safe existing review links. Keep Reports and manual navigation intact. Contextual records can seed subject scope but cannot widen permissions.

**Deliverables:** real Next/React components and API bindings, accessibility tests and desktop/tablet/phone screenshots against canonical Figma. A fixture conversation is not the deliverable.

**Acceptance:** authorized real records answer the question without a Reports detour; loading/error/empty/zero/partial states are distinct; revoked/denied source links fail safely; keyboard/touch controls work; legacy owner/dashboard behavior is preserved. Each new view has independent Design/Product and QA evidence.

**Handoff:** C10 early release; C07 richer questions. **Excluded:** new direct sends, charges, purchases, payroll approvals or schedule changes.

## 6. Sprint C2 | Controlled questioning and report delivery

### RCI-C07 | Add bounded natural-language routing and verified explanation

**Priority / risk / lane:** P1 / Model and data safety / AI integration. **Dependencies:** C05/C06; H06/H08/H12; approved provider data handling. **Maps to:** CI-02/07, OM-07.

**Build:** route natural-language questions into approved recipes/read tools, preserve explicit period/metric assumptions and return structured grounded claims. Limit tool fan-out, time, retries and context. Use deterministic numeric facts and source handles; run claim checks before presentation. Separate factual explanation from hypothesis/forecast.

**Deliverables:** provider adapter integration, tool policies, safe prompt projection, held-out routing/grounding evaluations and deterministic fallback on model failure. Current model/library choices are verified during implementation, not frozen by this plan.

**Acceptance:** injected record text cannot change authority or export destinations; unsupported questions do not become invented capabilities; invalid numbers/links are blocked; essential uncertainty survives rewriting; factual Command Center remains usable during model timeout.

**Excluded:** broad database agents, recursive unbounded delegation and business writes.

### RCI-C08 | Implement secure follow-ups, conversation history and caching

**Priority / risk / lane:** P1 / Privacy / Backend platform and Security. **Dependencies:** C04/C07; H03/H12. **Maps to:** CI-05/06.

**Build:** retain scoped question/period/subject context, minimal answer/evidence manifests and authorization-sensitive cache. Reauthorize every follow-up, source open and saved-answer access. Key caches by tenant, effective permission scope, metric/policy version, filters and source watermark; invalidate on relevant changes.

**Deliverables:** reviewed persistence/retention controls, deletion/redaction behavior, scoped trace logs and cache isolation tests. Never store credentials or broad payroll/customer histories in shared prompts/logs.

**Acceptance:** workspace/role switches cannot reuse privileged evidence; revoked access is effective; repeated questions do not reconstruct suppressed wages; stale cached stock/calendar cannot establish current readiness; historic answer cutoff is visible. Cache bypass still returns correct authorized behavior.

**Handoff:** C09/C24/C25. **Excluded:** treating prior conversation as standing action authority or cross-tenant learning consent.

### RCI-C09 | Implement shared report runs, saved questions and scheduled delivery

**Priority / risk / lane:** P1 / Privacy and reliability / Reporting/worker. **Dependencies:** C05/C08; H13; OP-01 contracts. **Maps to:** CI-08, OP-01.

**Build in slices:** server report catalog and immutable run snapshots; authorized saved views/questions; shared scheduler/worker; CSV/PDF generation and secure delivery with run history. Reuse one report/evidence pipeline for Command Center and Reports. Add domain templates only when their source capability is ready.

**Deliverables:** report/subscription APIs, worker/outbox coordination, download access checks and minimal email digest with authenticated detail link. Payroll detail is excluded from general digests.

**Acceptance:** identical definition/cutoff/scope reconciles across answer/export; DST/month-end works; duplicate scheduler ticks are safe; authorization loss blocks delivery/download; CSV formula injection is handled; provider timeouts become visible uncertainty rather than a guarantee of exactly-once email.

**Question:** CI-Q01 plus accepted catalog metrics. **Excluded:** unrestricted SQL/report formulas or a second scheduler.

### RCI-C10 | Independently accept and pilot the first read-only slice

**Priority / risk / lane:** P1 / Release / Independent QA, Security and Design. **Dependencies:** C04–C09 to the extent enabled; first-slice H12. **Maps to:** CI-04/06.

**Build:** acceptance evidence, not new feature scope. Exercise real Clerk roles, tenant data, partial/missing/stale sources, injection attempts, provider/model failure and responsive UI. Check record/source/report parity and diagnostics. A deterministic-only pilot may omit C07–C09 features if disabled and honestly scoped.

**Deliverables:** exact-head test/evaluation report, explicit enabled-capability manifest, rollback/kill-switch check and founder-reviewed release candidate. Use an approved synthetic/test tenant or explicitly authorized pilot, not unapproved customer mutations.

**Acceptance:** no unauthorized disclosure or business writes; claims reconcile to source; missing evidence is visible; exact Figma/browser checks and independent sign-offs exist; approved CI matches the reviewed head. Founder separately approves named PR/merge and activation.

**Handoff:** useful read-only release while later domains proceed. **Excluded:** claiming the entire financial/AI platform is complete.

## 7. Sprint C3 | Workforce, stock readiness and field evidence

### RCI-C11 | Extend timesheets into reliable payroll preparation

**Priority / risk / lane:** P1 / Money and wage privacy / Workforce backend and UI. **Dependencies:** C02/C03/C04; H10; reviewed pay policies. **Maps to:** OP-02, CI-05/07.

**Build in slices:** reproduce/fix existing missing-rate, effective-date and period-boundary risks; broaden approved employee eligibility; immutable pay-run snapshots and amendments; reviewed earning/commission inputs; validated provider-specific export. Reuse existing time entries, approvals and pay rates. Keep statutory processing/remittance outside the accepted provider scope.

**Deliverables:** review/attestation/correction UI, gross-preparation states, provider acknowledgment handling and workforce evidence adapter. Exported does not mean paid; no automatic wage submission from an insight.

**Acceptance:** overlapping time is not double-counted; unknown rates block complete totals; office/field permissions hold; approved/exported snapshots remain immutable; earning reversals and cross-job overtime allocations reconcile; full-period/DST/midnight cases pass.

**Question:** CI-Q04 identifies exact authorized payroll blockers; C13 consumes approved cost inputs. **Excluded:** invented pay law, universal tax engine and net-pay promises.

### RCI-C12 | Extend quantity inventory with units and shared reservations

**Priority / risk / lane:** P1 / Concurrency / Inventory backend and UI. **Dependencies:** C02/C04; H10; reviewed UOM/reservation policy. **Maps to:** OP-04, CI-05/07.

**Build:** compatible fractional units/conversions, source location, reservations/release, job allocation and physical quantity checks. Preserve existing warehouse/van movements, transfers and permitted adjustment behavior. Manual, field and future mission workflows must share the same reservation authority.

**Deliverables:** reviewed migration if needed, transaction/version controls, updated inventory/job interfaces and availability evidence reader. Valuation remains explicitly unavailable until C18.

**Acceptance:** concurrent claims cannot consume the same stock; stale updates conflict; transfers conserve quantities; unit conversions are exact under policy; unreceived orders do not become on-hand stock; cancelled work releases reservations safely.

**Question:** supported portion of CI-Q05/06, with missing requirements labeled. **Excluded:** automatic purchasing or inferred availability from unsupported provider data.

### RCI-C13 | Implement the job-cost ledger and provisional margin read model

**Priority / risk / lane:** P1 / Money / Costing backend and UI. **Dependencies:** C02/C04/C11; accepted H02/H10 cost contracts; C12 quantity references. **Maps to:** OP-03, OM-04, CI-05/07.

**Build:** versioned budgets, commitments, source-linked actual cost postings, labor/burden allocations and append-only reversals/amendments. Separate estimated, committed, provisional and finalized views. Establish material-cost input ports; before C18, missing valued material remains missing or explicitly provisional, never synthesized from selling price.

**Deliverables:** ledger/schema, job-cost drill-down, completeness flags and costing evidence adapter with wage-restricted detail. Support one cost owner per source and no duplicate expense from export/payroll events.

**Acceptance:** synthetic $354 actual cost/$646 margin reconciles only when all required facts exist; catalog/rate changes do not rewrite history; one receipt/bill/payment chain cannot multiply costs; missing cost blocks final margin; closed-period adjustments are traceable.

**Question:** CI-Q03 provisional until C18 and policy completeness. **Excluded:** general ledger or full net-profit claims.

### RCI-C14 | Implement versioned operational forms and backend closeout rules

**Priority / risk / lane:** P1 / Data integrity / Forms backend. **Dependencies:** C02/C04; H11; approved field schemas and domain rules. **Maps to:** OP-07, CI-05/07.

**Build:** evolve existing form tables into versioned templates, job/asset assignment, drafts, submission/review/amendment and conditional validation. Pin assigned template versions; preserve history. Reuse tasks/attachments/signature references without equating a checklist with customer work authorization.

**Deliverables:** strict form APIs, template library/editor contracts, role/field visibility, server-enforced closeout checks and forms evidence reader. Emergency/exception overrides require explicit existing or reviewed authority and audit.

**Acceptance:** old submissions retain old fields/rules; hidden conditionals validate correctly; unavailable required uploads block completion; unauthorized technicians cannot modify other jobs; failed inspection is not silently complete; backend rules cannot be bypassed by a direct request.

**Question:** CI-Q09 reports real unmet requirements. **Excluded:** unrestricted form scripting and universal e-sign legal certification.

### RCI-C15 | Complete mobile forms, draft recovery and controlled artifacts

**Priority / risk / lane:** P1 / Field reliability / Mobile web and QA. **Dependencies:** C14; H14 exact design/state map. **Maps to:** OP-07, CI-06.

**Build:** responsive field renderer and office template/review interfaces; safe draft save, explicit offline/pending synchronization, photo/signature upload progress, conflict resolution and authorized PDF/share outputs. Preserve actual job identity and existing mobile work flow.

**Deliverables:** authenticated components and API bindings, test-only offline/conflict fixtures and accessible desktop/tablet/phone acceptance. Form evidence must remain usable by C14's reader without copying sensitive internal notes into customer artifacts.

**Acceptance:** retry cannot duplicate submission; unsynced uploads are not server-confirmed; template changes do not erase drafts; customer shares omit employee-only fields; required closeout behavior matches backend; real responsive Figma checks pass.

**Question:** contextual “What remains on this job?” **Excluded:** replacing working field navigation or claiming mock/offline tests certify production connectivity.

## 8. Sprint C4 | Purchasing, actual material cost and QBO

### RCI-C16 | Build vendors, requisitions and approved purchase orders

**Priority / risk / lane:** P1 / Spend authority / Purchasing backend and UI. **Dependencies:** C02/C04/C12/C13; H10; approved purchasing policy. **Maps to:** OP-04, CI-05/07.

**Build:** vendors/catalog cross-references, requisitions, PO lines, job/location allocation, approvals, revisions/cancellation and expected delivery. An approved PO creates committed cost, not consumed-material expense. Separate draft/approval from any actual supplier send/order effect.

**Deliverables:** operational purchasing workflow, activity/audit events and evidence for commitments/shortages. Supplier execution remains separately authorized and supported; a review button cannot silently place an order.

**Acceptance:** duplicate approval/retry does not duplicate commitment; revised scope invalidates old approval appropriately; units and currency reconcile; cancelled balance is traceable; unauthorized user cannot approve spend; unreceived stock remains unavailable.

**Question:** CI-Q06 proposes a supported requisition and explains existing inbound supply. **Excluded:** buying under a read-only question.

### RCI-C17 | Build partial receiving, returns and vendor-bill matching

**Priority / risk / lane:** P1 / Money and concurrency / Purchasing/inventory. **Dependencies:** C16/C12; H10. **Maps to:** OP-04.

**Build:** partial receipt, damaged/short shipment, receiving correction, supplier return, bill/receipt/PO matching and variance review. Receipt quantity updates the physical ledger once; bill/payment transitions do not consume the material a second time.

**Deliverables:** receipt/bill-match domain services and UI, durable event/outbox boundaries and source lineage for C18/C21. Preserve provisional acquisition cost until the approved variance policy resolves it.

**Acceptance:** repeat receipt/return messages are idempotent; over-receipt and stale version behavior is explicit; returns cannot exceed eligible quantities without authorized correction; line/quantity/money reconciliation works across partials; every difference is matched or an open exception.

**Question:** CI-Q05/06 distinguishes expected, received and disputed supply. **Excluded:** a second independent stock ledger or automatic bill payment.

### RCI-C18 | Add inventory valuation and complete material-to-job cost linkage

**Priority / risk / lane:** P1 / Financial correctness / Costing and inventory. **Dependencies:** C12/C13/C17; approved valuation/period policy; H10. **Maps to:** OP-03/04, OM-04.

**Build:** valuation under the reviewed method, landed/provisional cost, transfer cost conservation, issue-to-job allocations, returns and receipt/bill variance adjustments. Use source IDs to prevent receipt, bill and payment from each becoming a new job expense. Preserve historical posting versions.

**Deliverables:** valuation records, cost postings, controlled backdated adjustments and shared job-margin/inventory-value readers. Weighted-average is only a proposed prior default, not an approved policy inherited from this plan.

**Acceptance:** quantities and value reconcile; transfers preserve value; corrections link to originals; catalog changes do not rewrite prior jobs; approved policy controls negative stock/backdating; missing rates or costs still prevent final completeness.

**Question:** CI-Q03 can give finalized direct margin only for fully supported cohorts; CI-Q12 uses the same facts. **Excluded:** unapproved accounting-policy choices.

### RCI-C19 | Complete QuickBooks Online financial synchronization

**Priority / risk / lane:** P1 / Money and provider security / Accounting integrations. **Dependencies:** C03/C04; accepted H10; accounting mapping/ownership policy. **Maps to:** OP-05, CI-05/07.

**Build in bounded slices:** secure approved connection/token/realm handling; customer/item/account/tax mappings with remote versions; invoice and linked payment exports; authorized inbound changes and reconciliation. Reuse existing sandbox scaffolding while fixing explicitly unfinished financial paths. Use connection-specific mappings without overwriting import source lineage.

**Deliverables:** durable outbox/retry/reconcile flow, sync-center UI, per-entity readiness reader and approved sandbox/test-company financial evidence. Purchasing entities arrive in C21.

**Acceptance:** duplicate sends and lost replies do not duplicate transactions; revoked tokens/realm mismatch fail safely; CDC/webhook replay checkpoints reflect processed changes; credits/refunds/voids/tax/rounding reconcile; imported history is not exported again; accountant validates exact source/remote IDs and totals before production authorization.

**Question:** CI-Q07 for enabled QBO scope. **Excluded:** payroll processing or production enablement from a sandbox pass alone.

## 9. Sprint C5 | Desktop, migration and customer implementation

### RCI-C20 | Build and certify the QuickBooks Desktop recurring connector

**Priority / risk / lane:** P1 / Money and host integration / Desktop/accounting integration. **Dependencies:** C03; shared mapping/outbox/reconciliation contracts from C19, or their separately accepted adapter-neutral extraction; H10. **Maps to:** OP-06.

**Build:** supported Windows/Web Connector pairing, approved company-file identity, secure transport and qbXML request/response adapter. Persist transaction/list IDs, edit versions, session progress and reconciliation checkpoints. Share domain contracts, not QBO OAuth transport. Keep existing IIF/CSV migration as a separate capability.

**Deliverables:** customer/item/account/tax and supported invoice/payment sync, offline/locked-file recovery, operator setup/status UI and a real supported Windows test-company runbook.

**Acceptance:** wrong/changed/restored file identity is detected; interrupted/lost-response requests do not duplicate financial records; multiple company scopes remain isolated; unsafe XML is rejected; host offline is stale/unavailable, not success; exact supported-version pilot reconciles. Linux mocks alone cannot certify this ticket.

**Question:** CI-Q07 for enabled Desktop scope. **Excluded:** all-edition/Mac compatibility promises.

### RCI-C21 | Synchronize purchasing and cost-related accounting entities

**Priority / risk / lane:** P1 / Money / Accounting integrations. **Dependencies:** C16–C18; C19 for QBO and C20 only for Desktop support; H10. **Maps to:** OP-04/05/06.

**Build:** supported vendor, PO, bill, credit and relevant inventory/cost mappings under the approved accounting ownership policy. Determine operational versus external-book authority for each entity/field and period. Avoid unrestricted bidirectional overwrites and double recognition of material expense.

**Deliverables:** adapter-specific supported-entity matrix, reconciliation cases and shared evidence of pending/partial/uncertain/reconciled state. Unsupported provider transactions remain explicitly unavailable, not silently dropped.

**Acceptance:** PO commitment and bill/consumption accounting retain their defined distinction; partial receipts/credits/closed periods reconcile; retry and reverse flows preserve original IDs; no automatic supplier payments; independent accounting review accepts each enabled connector scope.

**Question:** CI-Q07 explains actual procurement-related differences. **Excluded:** blocking QBO delivery on an irrelevant disabled Desktop connector.

### RCI-C22 | Expand migration coverage and prove resumable reconciled cutover

**Priority / risk / lane:** P1 / Data and money / Migration platform. **Dependencies:** C04; H11; accepted destination domains for each selected entity. **Maps to:** OP-08, CI-05/07.

**Build:** entity-by-entrypoint capability matrix; trace upload/parser/mapping/preview/dependency/committer/reconciliation/recovery. Extend generic import contracts for approved workforce, vendors/open POs, opening stock quantity/value, historical job cost and form artifacts. Preserve generic AI mapping with deterministic validation and explicit review, not a separate importer per FSM vendor.

**Deliverables:** partial-enqueue/restart recovery, source/cutover lineage, rejected-row reports, large-data tests and migration evidence reader. Preserve QBD/QBO export-specific formats and separately controlled card migration.

**Acceptance:** replays do not duplicate records; source/accepted/rejected relationships and amounts reconcile; unsupported data is disclosed; no automatic historical charges/messages/accounting exports; downstream live edits prevent unsafe destructive rollback; selected migration passes rehearsal and documented exceptions.

**Question:** CI-Q10 reports exactly what can be trusted. **Excluded:** raw PAN/CVV in generic imports or blanket all-vendor certification.

### RCI-C23 | Build the customer implementation and go-live workbench

**Priority / risk / lane:** P1 / Release readiness / Onboarding backend and UI. **Dependencies:** C04/C06; H11/H14; selected domain/migration acceptance. **Maps to:** OP-09, CI-05/06.

**Build:** discovery/configuration, rehearsal, reconciliation, role-specific training, test-job acceptance, cutover, hypercare and completion. Reuse existing Clerk provisioning/settings/import screens; do not rebuild merged foundations due to old board text. Record required evidence, accountable role, current version and approved exceptions for each readiness gate.

**Deliverables:** operational workbench, readiness query/evidence adapter, fresh-start path and source-change invalidation. Payment/provider readiness remains a distinct authorized verification, not a side effect of wizard completion.

**Acceptance:** a fresh-start business can omit imports legitimately; unmet configuration or accounting evidence stays blocked; changed settings invalidate affected checks; owner cutover acceptance is explicit; support access is limited/audited; no automatic launch, provider action or customer contact.

**Question:** CI-Q11 explains remaining work and next verification. **Excluded:** a fabricated percentage based on completed screens.

## 10. Sprint C6 | Platform-wide stories and release

### RCI-C24 | Integrate the shared evidence service across all four specialists

**Priority / risk / lane:** P1 / AI and semantic correctness / Outcome Intelligence integration. **Dependencies:** C07/C08 and whichever domain adapters the selected recipe requires; H06/H08/H12. **Maps to:** CI-07, OM-05/07.

**Build:** bounded Growth/Revenue/Operations/Retention analyses with one coordinator and shared fact/metric IDs. Compose only the required authorized evidence. Preserve disagreements, incompatible cutoffs and unsupported capabilities. Deduplicate opportunities/jobs/economic outcomes while retaining non-additive assistance links.

**Deliverables:** recipe-level adapter coverage and cross-domain answers for the 12 catalog questions as supported. Single-domain answers remain usable before the full orchestration set is complete.

**Acceptance:** channel performance includes supported fulfillment/cost caveats; retention respects unresolved service obligations; revenue options consider capacity/material constraints; model agents cannot expand access or invoke hidden writes; observed results are not presented as causal lift; each claim has allowed supporting evidence.

**Handoff:** C25/C27. **Excluded:** one model call per tab without measured value or a parallel mission planner.

### RCI-C25 | Implement proactive situations, attention lifecycle and shared digests

**Priority / risk / lane:** P2 / Reliability and user burden / Worker and Command Center. **Dependencies:** C09; H13; accepted domain adapters; C24 only where model synthesis is needed. **Maps to:** CI-08, OM-06/08/10.

**Build:** event/version-triggered recomputation, related-issue grouping, materiality/severity policy, deduplication, snooze, ownership, verified resolution and scheduled owner narratives. Start with deterministic accepted sources; use the existing report/subscription pipeline for delivery.

**Deliverables:** visible lifecycle, invalidation/continuation, failure observability and alert-volume measurements. Rules reference actual events or reviewed event additions; no invented event names are assumed implemented.

**Acceptance:** repeated events do not flood the owner; stale data is not a new emergency; a suggested fix does not resolve the issue; lost authorization stops delivery; model failure leaves factual cards intact; Reports and cards show the same scoped values/cutoffs.

**Question:** proactive CI-Q01 and supported domain situations. **Excluded:** scheduling a new system outside the existing workers or automatic actions from alert severity.

### RCI-C26 | Bridge supported recommendations to Trusted Execution

**Priority / risk / lane:** P1 / Authority and money / Existing action-service owner. **Dependencies:** C24; accepted domain write capability; applicable OM-02/03/05; explicit action/runtime authorization. **Maps to:** CI-09.

**Build:** typed proposals carrying exact evidence, payload, policy/grant and expected-version references. Reuse existing approval/claim/outbox/provider-reconciliation services. Separately record proposed, approved, queued, attempted, uncertain, acknowledged and verified outcomes. Read-only routes cannot invoke this path.

**Deliverables:** approved action-class integration, payload-diff review, current-state rechecks, bounded delegation limits and deterministic race/replay tests. New payroll/purchasing actions require their own authority decision rather than inheriting messaging permissions.

**Acceptance:** changed stock, balance, schedule, consent or grant blocks stale execution; multiple clicks do not create duplicate effects; cancel/pause affects undispatched work; uncertain provider writes reconcile before retry; independent security review covers action boundaries.

**Release condition:** original Phase I acceptance and founder permission for relevant mission runtime remain mandatory. **Not a blocker:** read-only/report releases with this capability disabled.

### RCI-C27 | Perform independent full-scope security, performance and quality acceptance

**Priority / risk / lane:** P1 / Release / Independent QA, Security, Design and domain reviewers. **Dependencies:** all tickets enabled in the candidate scope; H12; C26 only when actions are enabled. **Maps to:** CI-04/09 and every OP domain.

**Build:** no new product scope. Run real database/concurrency, role/tenant/field, provider replay, model-grounding, accessible responsive UI, retention and representative-volume tests. Define measured budgets for reads, model calls, queue delay and cost before judging them. Use held-out evaluation cases in addition to self-authored fixtures.

**Deliverables:** exact-head pass/fail/skipped evidence, unresolved defects, enabled-capability manifest, accountant/provider acceptance and rollback proof. Existing CI and independent review requirements apply; automated reviewer availability is not assumed.

**Acceptance:** zero unauthorized disclosure or unintended writes in the acceptance matrix; exact fixture reconciliation; no unsupported final claims; all enabled production paths have real evidence; skipped external tests remain gaps, not passes; actual Figma comparisons are recorded.

**Handoff:** C28. **Excluded:** marking unfinished optional capabilities accepted for a broader marketing claim.

### RCI-C28 | Complete staged pilot, rollout, migration order and operational handoff

**Priority / risk / lane:** P1 / Production / Platform with founder approval. **Dependencies:** C27 for selected scope; C23 when onboarding a pilot business; named exact-head merge and activation approval. **Maps to:** CI-09, OP-09.

**Build:** staged flags and tenant pilot, approved migration/API-before-web order, monitored read-only baseline, progressive capability enablement, incident/rollback playbook and support ownership. Preserve open work rather than bundling all modules into a single unsafe promotion.

**Deliverables:** founder-approved release manifest, pilot evidence, no-regression checks, operating runbooks and GitHub/Notion status reconciliation. Measure actual user task completion, source coverage, grounded answers, latency/cost and notification burden; do not invent target achievements.

**Acceptance:** authorized pilot workflows and accounting totals reconcile; rollback is demonstrated without corrupting financial history; degraded providers preserve safe reads; founder acceptance is explicit; public capability claims match only enabled and tested scope.

**End state:** production acceptance for the named scope, not blanket authorization for future missions, autonomous payments or payroll processing.

## 11. Dependency and ownership map

| Domain | Foundation inputs | Implementation owners by planning ticket | Intelligence acceptance |
| --- | --- | --- | --- |
| Shared meanings/security | H01–H08 | C01/C02/C04/C08 | Every reader, claim and follow-up retains authorized scope |
| Command Center | H06/H08/H09/H14 | C05/C06/C07/C10 | CI-Q01 works with real current data and honest limits |
| Reports | H02/H07/H13 | C09 | Same metrics/cutoff match answer, detail and export |
| Timesheets/payroll preparation | H02/H03/H10 | C11 | CI-Q04, missing rates and export-versus-paid distinction |
| Inventory quantities and purchasing | H05/H10 | C12/C16/C17 | CI-Q05/06, no expected-stock-as-on-hand claim |
| Job costing and valuation | H02/H07/H10 | C13/C18 | CI-Q03/12, finality only with complete historical cost |
| QuickBooks Online | H03/H05/H10 | C03/C19/C21 | CI-Q07 with per-entity reconciliation |
| QuickBooks Desktop | H03/H05/H10 | C03/C20/C21 | CI-Q07 with real Windows/file/host acceptance |
| Operational forms | H11/H14 | C14/C15 | CI-Q09, backend-enforced required evidence |
| Migration | H11 | C22 | CI-Q10, coverage/lineage/reconciliation and safe recovery |
| Customer implementation | H11/H14 | C23 | CI-Q11, evidence-backed launch decisions |
| Cross-specialist questions/attention | H06/H08/H12/H13 | C24/C25 | All accepted CI-Q recipes with common fact IDs |
| Consequential actions | H03/H08/H12 | C26 | Existing authority rechecked at execution, separately enabled |
| Release | H12/H16 | C10/C27/C28 | Exact-head independent acceptance and founder approval |

**Critical path to first value:** H04–H09 plus scoped H12/H14 → C02/C04 → C05 → C06 → C10. C07–C09 are added to that early release only when accepted. C03 provider discovery and later domain preparation do not block a useful read-only answer.

**Critical financial path:** approved policy → C11/C12 → C13 → C16/C17 → C18 → C21 and relevant accounting adapter. C19 QBO core can progress in parallel after its own contracts. C20 Desktop can consume an accepted common accounting-contract extraction without waiting for unrelated QBO UI completion.

**Migration path:** selected destination domains → C22 rehearsal/reconciliation → C23 launch evidence → C28 authorized pilot. A new tenant with no legacy data follows C23's fresh-start path, not a fake completed import.

## 12. Definition of ready, done and completion evidence

### Ready to implement

The current FS owner and base SHA are known; required contract/policy decisions are reviewed; source dependencies and consumers are named; proposed schema/queues/provider effects are authorized for the ticket; acceptance data/environment exists or its setup is included; exact UI frame discovery has an owner; forbidden scope is explicit.

### Done for review

All scoped code and tests exist; actual local results are recorded; tenant/role/field boundaries and relevant concurrency cases pass; state changes emit existing or reviewed events; async work is durable and idempotent; money/quantity/date semantics reconcile; source quality remains visible; updated UI is mapped to real Figma and reviewed independently. Provider/readiness limitations remain visible.

### Merge and release

Approved exact-head CI and actual independent Peer/QA/Security-by-risk/Design evidence are present. A changed head invalidates affected sign-offs. Founder approves each named PR and exact reviewed head. Production, external sends, purchases, accounting writes, payroll and mission activation need their applicable separate authority. No obsolete coordination role substitutes for the current governance. [S5]

### Required ticket closeout record

Ticket and existing FS mapping; branch and full SHA; changed paths; contract versions/consumers; schema/migration and queue changes; model/provider effect scope; actual test commands and passed/failed/skipped counts; independent reviewer evidence; known gaps; rollback; next downstream task; implemented/tested/reviewed/merged/deployed/accepted states listed separately.

## 13. Open decisions to settle in the owning tickets

| Decision | Owner ticket | Fallback until accepted |
| --- | --- | --- |
| Revenue, margin, burden and cost allocation basis | C02/C13/C18 | Name available facts precisely; no final-profit claim |
| Pay rules, eligible staff, earning basis and provider scope | C03/C11 | Preparation only under verified rules; incomplete runs blocked |
| Stock valuation, fractional units, negative stock and backdating | C12/C18 | Quantity-only or explicitly provisional cost |
| Accounting field ownership, closed periods and connector matrix | C03/C19/C20/C21 | Disabled unsupported exports; visible reconciliation gaps |
| Source freshness, retained evidence and permission granularity | C02/C04/C08 | Deny or narrow affected read; no broad cached disclosure |
| New UI frames and responsive interactions | C02/C06/C15/C23 | Design HOLD for affected view; no invented parity claim |
| Proactive severity, notification budget and measured SLOs | C25/C27 | Bounded deterministic attention; no invented reliability claims |
| New write capabilities and mission phase permission | C26/C28 | Read-only or human review; no inferred delegation |

## 14. Source and traceability index

[S1] [Outcome Intelligence Engine charter](https://app.notion.com/p/40e317b92d158107a87ef66deb7ba2a1).

[S2] [Connected Intelligence specification](COMMAND-CENTER-CONNECTED-INTELLIGENCE-2026-11-06.md), [original CI plan](../planning/CONNECTED-INTELLIGENCE-BUILD-PLAN-2026-11-06.md) and [question/acceptance catalog](../planning/connected-intelligence/foundation-catalog.v0_1.json). Planning baseline: `a49fb3def59302b705a7136b8a29d2bb7a3c2ed9`.

[S3] [Operations/finance/migration source audit](OPERATIONS-FINANCE-MIGRATION-2026-11-06.md): OP-00–OP-09, source reuse, unresolved policies and audit limitations. This ticket decomposition does not constitute a new runtime audit.

[S4] [Existing workflow PR #445](https://github.com/SimonShaun2/Renvani/pull/445), [mission-preparation PR #442](https://github.com/SimonShaun2/Renvani/pull/442), [Part II handoff](https://app.notion.com/p/40f317b92d15811281d3f387c4d1a9b3). Reconcile actual current heads; do not duplicate their work.

[S5] [Current repository instructions](https://github.com/SimonShaun2/Renvani/blob/dev/AGENTS.md), [founder directive #420](https://github.com/SimonShaun2/Renvani/issues/420) and [master Phase I/II plan](https://app.notion.com/p/40c317b92d15812b8ed9c7ead55480e4).

[S6] [Document 1: foundation build](CONNECTED-INTELLIGENCE-01-CHATGPT-FOUNDATION-SPRINTS-2026-11-06.md). It owns H01–H16; this document owns the corresponding live integrations, not duplicate implementations.
