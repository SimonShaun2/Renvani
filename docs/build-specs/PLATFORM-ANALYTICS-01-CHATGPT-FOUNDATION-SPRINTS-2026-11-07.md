# 01: Platform Analytics Preparation We Can Complete Here

Version 1.1 · November 7, 2026 · H01–H04 prepared; H05–H08 planned

## Purpose and execution boundary

Prepare the contracts, examples, dashboard definitions, and acceptance evidence for the selected Stripe + PostHog internal analytics approach. This track is suitable for bounded work in this ChatGPT environment: source review, requirements, structured data definitions, synthetic fixtures, logical query templates, small isolated pure validators, and documentation review. It does not require connecting production services to begin.

The user authorized **Track A H01–H04**, and the associated source/decision, metric, identity/event/outcome and export-policy artifacts are now supplied in the [H01–H04 checkpoint](../planning/platform-analytics/preparation/H01-H04-CHECKPOINT.md). Its review and validation receipts describe the bounded evidence. H05–H08 and every runtime/later-learning ticket remain **Planned**. This is documentation and machine-readable contract preparation, not a fixture harness, active provider integration or live dashboard.

- [Build plan and verified sources](../planning/PLATFORM-ANALYTICS-BUILD-PLAN-2026-11-07.md)
- [02: Technical and Codex/Cursor specification](PLATFORM-ANALYTICS-02-CODEX-CURSOR-SPRINTS-2026-11-07.md)
- [Implementation start here](../handoffs/PLATFORM-ANALYTICS-START-HERE-2026-11-07.md)
- [Machine-readable ticket ledger](../planning/platform-analytics/ticket-ledger.v1.json)

PAI-H identifiers are local planning IDs. H01 maps existing FS/RCI responsibility; runtime owner assignments are still C01 work. Paths beginning `preparation/` are relative to `docs/planning/platform-analytics/`. H01–H04 deliverable paths now exist, with the ownership crosswalk at `preparation/ownership-crosswalk.md`. H05–H08 paths remain future outputs; no official FS card is marked Done.

## Reuse before extending

Current baseline is `dev` at `5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58`. Existing Connected Intelligence H01–H16 is merged in #452, and the C integration plan is merged in #449. Use its scope, evidence, quality, calculation, claim, and readiness contracts where applicable. Inspect `packages/types/src/connected-intelligence/v1/`, `apps/api/src/services/connected-intelligence/foundation-math.ts`, and the foundation handoff before proposing a new helper.

The earlier foundation does not automatically become a public runtime API. Runtime adoption, approved readers, authenticated integrations, and exports remain implementation work. The H02/H03 audit found that current RCI v1 money helpers assume two decimals and its metric catalog does not register PA-M01–PA-M24. Reuse exact-Decimal/quality concepts through a reviewed versioned adapter or compatible extension; do not coerce unsupported values or copy a parallel metric engine. See H01 D13.

Reuse #445 workflows, #442 mission preparation, and preserved FS-43 observability work. The plan's source register distinguishes merged source from actual deployment evidence and identifies stale historical status prose.

## Sprint and parallel-work plan

| Sprint | Tickets | Deliverable | Completion evidence |
|---|---|---|---|
| H1: Definitions and boundaries | H01–H04 | Source map, financial metrics, stable identity/events, permitted reporting fields | Reviewed contracts and concrete expected examples |
| H2: Offline evidence and handoff | H05–H08 | Fixtures, dashboard/query contracts, connector/cost runbook, reviewed handoff | Actual offline results where code exists; requirement/dependency coverage and review findings |

H02, H03, and H04 can proceed in parallel after the initial H01 map. H07 can begin alongside H05. H06 consumes the definitions and expected cases. H08 reviews the resulting preparation package.

Codex/Cursor can perform read-only source/provider discovery in parallel. Do not wait for every preparation artifact to inspect an existing integration. Implementation consumes the reviewed subset it needs; release acceptance requires the complete relevant preparation evidence.

## What can be coded here

For the remaining H05–H08 work, appropriate small code includes JSON/Zod contract validation, fixture normalizers, exact classification invariants, dependency/coverage checks and tests for pure transformations. Prefer existing tooling and reuse accepted exact-money helpers where their precision/semantics fit; document the versioned adapter needed otherwise. No database, live credentials, customer records, provider calls, production imports or new public exports are needed for bounded offline preparation.

Do not add tests that merely restate an implementation. Test meaningful invariants: one financial object is counted once; merchant cash is not platform revenue; late fee refunds change the correct component; missing costs remain missing; unsupported claims are refused. A documentation check is not a runtime test.

## Handoff boundary to Codex/Cursor

Database roles/migrations, real reporting projections, SDK instrumentation, queue/outbox integration, Stripe/PostHog configuration, actual source backfills, authenticated access tests, vendor dashboard creation, pilot observations, and releases belong to Document 2. A logical SQL template is not accepted as executable production SQL until the real source schema and engine are inspected and the expected results are reproduced.

Production data processing and shared-learning permissions are different decisions. H04 prepares the concrete field/purpose/access matrix; implementation verifies actual controls. The work does not change customer pricing, send messages, run charges, or start missions.

## Full ticket cards

Each card has a measurable output, dependency, boundary, acceptance criteria, and verification evidence. Assignment remains by owner function through the existing program; no staff names or calendar commitments are invented.

### PAI-H01: Source, ownership, and decision register

**Sprint:** H1 · **Status:** Prepared — see H01–H04 review/validation; unmerged · **Assignment:** Unassigned

**Objective:** Freeze the relevant source evidence and map this work to the existing Renvani program before implementation.

**Dependencies:** None.

**Scope and implementation boundary:** Refresh the bounded Stripe, identity, event, outcome, observability, and governance inventory. Record specifications, implemented source, and deployed behavior separately. Confirm preserved FS-43 work and merged H01–H16 rather than recreating them.

**Deliverables:**

- preparation/source-register.json
- preparation/decision-register.md
- preparation/ownership-crosswalk.md

**Acceptance criteria:**

1. Each source records a full commit or document revision, path/URL, domain owner function, known limitation, and evidence level.
2. Map #442, #445, #449, #452, FS-43/#142, and applicable RCI-C tickets to reuse, extension, or prerequisite status.
3. Record founder 5% direction versus inspected 2% checkout implementation as an unresolved alignment issue; do not change pricing through this initiative.
4. List decision owners and affected tickets; preserve Phase A/B, financial, review, and release boundaries.

**Verification evidence:** Readback of pinned sources and actual PR metadata; Independent review of scope and duplicate-work mapping.

### PAI-H02: Financial classification and metric catalog

**Sprint:** H1 · **Status:** Prepared — see H01–H04 review/validation; unmerged · **Assignment:** Unassigned

**Objective:** Make each dashboard number reproducible and consistent with the existing evidence system.

**Dependencies:** PAI-H01.

**Scope and implementation boundary:** Expand the initial metric catalog in Document 2 into versioned definitions. Reuse existing RCI calculation/quality contracts and keep platform-company economics distinct from merchant business metrics.

**Deliverables:**

- preparation/metric-catalog.v1.json
- preparation/financial-classification.md
- preparation/data-dictionary.md

**Acceptance criteria:**

1. Every metric has ID/version, formula, grain, authoritative source, population, time basis, unit/currency, exclusions, freshness, completeness, and source drill-through.
2. Separate platform subscriptions, merchant subscriptions, actual application fees, merchant collections, processor expenses, transfers, and adjustments.
3. Use actual fee and fee-refund records; distinguish MRR, cash receipts, settlement, and accounting recognition; document status/discount/proration rules for MRR.
4. Unknown costs are not zero; mixed currencies are not silently summed; imported history is baseline; incomplete data cannot support complete-profit or causal-lift claims.

**Verification evidence:** Hand-calculated examples with independent expected totals; Metric-to-source and metric-to-card coverage review.

### PAI-H03: Company identity, event, and outcome contracts

**Sprint:** H1 · **Status:** Prepared — see H01–H04 review/validation; unmerged · **Assignment:** Unassigned

**Objective:** Specify stable joins and lifecycle meanings across Stripe, the application, product events, and AI traces.

**Dependencies:** PAI-H01.

**Scope and implementation boundary:** Define logical reporting records and proposed schema extensions only where existing contracts are insufficient. Specify account/mode/object identity, valid-time company mapping, immutable event IDs, correction revisions, and canonical opportunity allocation.

**Deliverables:**

- preparation/identity-contract.md
- preparation/event-contracts.v1.json
- preparation/outcome-lifecycle.md

**Acceptance criteria:**

1. Canonical company identity comes from trusted server scope; email is never the join key; account and live/test scope prevent provider-object collisions.
2. Events include schema/source versions, occurrence and ingestion time, company, source references, and relevant opportunity/action/workflow/release IDs.
3. Approval, execution attempt, provider acknowledgement, delivery, customer response, booking, completion, and collection remain distinct facts.
4. Idempotency, replay, late correction, one-to-many payment allocation, and non-additive product assistance have explicit rules; missing mappings are exceptions.

**Verification evidence:** Synthetic cross-account, duplicate, and allocation examples; Compatibility review against merged H01–H16 and current event consumers.

### PAI-H04: Export permissions, minimization, and correction contract

**Sprint:** H1 · **Status:** Prepared — see H01–H04 review/validation; unmerged · **Assignment:** Unassigned

**Objective:** Define what internal analytics may receive and who may use it, independently of training permission.

**Dependencies:** PAI-H01.

**Scope and implementation boundary:** Specify purpose, region, retention, staff roles, approved fields, correction/deletion propagation, and allowed query outputs. Include actual Stripe source column inspection as an implementation gate, because selecting tables may still export unnecessary personal data.

**Deliverables:**

- preparation/export-field-allowlist.v1.json
- preparation/reporting-access-matrix.md
- preparation/retention-correction-policy.md

**Acceptance criteria:**

1. Distinguish internal operational reporting, customer-facing access, and cross-company learning permissions; PostHog groups are not security isolation.
2. Exclude secrets, end-customer contact details, message bodies, raw prompts/outputs, payment-method details, payroll data, and sensitive notes by default.
3. Document the read-only export identity, permitted reporting objects, vendor access/exports, and a fallback if native connector payloads cannot meet the approved field policy.
4. Specify retention, withdrawal, correction, and deletion handling for copies/backups; financial retention exceptions require an explicit policy, not a silent promise of universal erasure.

**Verification evidence:** Allowed/denied field examples; Access matrix and data-processing-purpose review.

### PAI-H05: Synthetic fixtures and acceptance matrix

**Sprint:** H2 · **Status:** Planned · **Assignment:** Unassigned

**Objective:** Create reproducible expected results for the reporting invariants before real customer data is connected.

**Dependencies:** PAI-H02, PAI-H03, PAI-H04.

**Scope and implementation boundary:** Build synthetic-only platform/merchant, refund, duplicate, late-arrival, identity, workflow, privacy, and cost examples. Implement a small pure validator only where it checks a meaningful invariant; do not rebuild existing RCI arithmetic.

**Deliverables:**

- preparation/fixtures/*.json
- preparation/expected-results.v1.json
- preparation/acceptance-matrix.md
- Optional isolated offline validator using existing tooling

**Acceptance criteria:**

1. Each Document 2 AT case maps to a fixture or explicit runtime-only check, a metric/contract, and a ticket owner.
2. Expected amounts and states cover actual versus assumed fees, merchant versus platform money, partial refunds, fee refunds, multi-currency, missing cost, and unresolved identity.
3. Retain declined, failed, unselected, and pending opportunities; imported history and approvals alone cannot become recovered revenue.
4. Record executed commands and actual results for any offline validator. Unexecuted cases remain planned; no RLS/provider/deployment pass is inferred.

**Verification evidence:** Independent expected-result review; Offline schema/invariant validation if implemented.

### PAI-H06: Four-dashboard blueprint and query contracts

**Sprint:** H2 · **Status:** Planned · **Assignment:** Unassigned

**Objective:** Give the implementer a precise dashboard specification that uses PostHog's existing interface.

**Dependencies:** PAI-H02, PAI-H03, PAI-H05.

**Scope and implementation boundary:** Specify economics, activation, workflow outcomes, and AI/data-health cards with business question, source, filter, drill-through, and unavailable-state behavior. Query templates target declared logical views until actual vendor schemas are verified.

**Deliverables:**

- preparation/dashboard-blueprint.md
- preparation/card-metric-filter-matrix.json
- preparation/logical-query-templates.sql

**Acceptance criteria:**

1. Every card maps to a metric ID/version and approved dataset; role-appropriate source detail is defined.
2. Period/timezone, unit/currency, population, freshness, completeness, and reconciliation status are visible where relevant.
3. Zero, no eligible population, unavailable, stale, and partial states are distinct; missing outcome or AI panels do not block the billing/activation slice.
4. Templates are labeled logical until run against real schemas; no new customer UI or new Figma design is implied.

**Verification evidence:** Fixture-to-card walkthrough; Query shape and filter/denominator review.

### PAI-H07: Connector, AI-path, and cost runbook

**Sprint:** H2 · **Status:** Planned · **Assignment:** Unassigned

**Objective:** Prepare concrete configuration and verification steps without enabling services or exposing secrets.

**Dependencies:** PAI-H01, PAI-H03, PAI-H04.

**Scope and implementation boundary:** Document direct Stripe-to-PostHog plus approved Postgres exports, current provider docs, one AI trace path, initial volumes, account roles, source sync modes, fresh-data targets, and rollback. Stripe-to-Neon is an alternative, not an additional default pipeline.

**Deliverables:**

- preparation/connector-runbook.md
- preparation/account-source-inventory.template.json
- preparation/usage-budget-worksheet.md

**Acceptance criteria:**

1. List required resources/scopes and verify connected-account coverage; distinguish native analytics webhooks from operational payment webhooks.
2. Explain backfill and mutable-record behavior, correction/deletion coverage, synchronization latency, and reconciliation samples.
3. Inspect native connector fields before transfer; if the approved policy cannot be met, define a filtered export alternative for review.
4. Include group-analytics entitlement, source/AI row volumes, retention and caps; distinguish estimated price-derived AI cost from billed expense. Store no keys or raw production records.

**Verification evidence:** Current official documentation cross-check; Configuration walkthrough using placeholders and synthetic data only.

### PAI-H08: Independent preparation review and implementation handoff

**Sprint:** H2 · **Status:** Planned · **Assignment:** Unassigned

**Objective:** Deliver a consistent starting package with a precise first implementation slice and visible evidence gaps.

**Dependencies:** PAI-H01, PAI-H02, PAI-H03, PAI-H04, PAI-H05, PAI-H06, PAI-H07.

**Scope and implementation boundary:** Review the prepared artifacts independently, reconcile findings, validate dependency and requirement coverage, and publish an immutable handoff checkpoint. Distinguish planning completion from tested preparation and live integration.

**Deliverables:**

- preparation/START-HERE.md
- preparation/requirement-coverage.json
- preparation/validation-summary.json
- Updated ticket ledger and source pins

**Acceptance criteria:**

1. No dependency cycles, orphan requirements, conflicting metric definitions, broken package references, or invented official ticket assignments.
2. The first Codex/Cursor slice and allowed files are explicit; existing H/RCI/FS-43 work is reused and all material open decisions have a route.
3. Independent reviewer findings and dispositions are recorded; author self-review does not substitute for required runtime Peer/QA/Security review.
4. Every test and provider/access claim has evidence or remains unverified; publication does not activate billing, missions, training, or production.

**Verification evidence:** Package integrity check; Independent preparation review; Readback of saved handoff.


## Preparation exit checklist

- Every enabled metric has an authoritative source, exact financial meaning, time basis, population, and completeness behavior.
- Every external source has a field allowlist, account/environment scope, expected sync behavior, and rollback plan.
- Every dashboard card maps to the metric catalog and a source/fixture acceptance case.
- Financial and outcome examples include negative cases, incomplete cases, reversals, and late corrections.
- Existing RCI/FS work is referenced and reused; no second execution or financial framework is introduced.
- Independent review findings have a disposition; actual command results and unexecuted checks remain distinguishable.
- The first implementation slice and its release evidence are explicit.

These are criteria for the complete eight-ticket H track. H01–H04 supplies the first preparation subset; publication of this checkpoint is not a declaration that H05–H08 or runtime gates have passed.
