# DRAFT — Connected Intelligence build plan and agent handoff

Version 0.1 | November 6, 2026

**Specification:** [Command Center and Connected Business Intelligence](../build-specs/COMMAND-CENTER-CONNECTED-INTELLIGENCE-2026-11-06.md). **Domain scope:** [OP-00–OP-09](../build-specs/OPERATIONS-FINANCE-MIGRATION-2026-11-06.md). **Prepared catalog:** [12 questions and 24 acceptance scenarios](connected-intelligence/foundation-catalog.v0_1.json).

This plan is the engineering bridge between the full AI platform and operational modules. CI identifiers below are local planning labels, not issued FS tickets, assignments or permission to change production. Reconcile them with the existing board and OM/OP packages before creating work. No runtime code or tests are claimed implemented by this documentation delivery.

## 1. Delivery decisions

Build the shared evidence contract before a conversational interface. Ship a useful read-only owner answer before waiting for every new domain module. Require the same contracts for every new OP module from its first accepted slice. Add richer evidence only when the corresponding capability is actually ready. Extend current Command Center and Outcome Intelligence Engine sources rather than a new agent platform, analytics ledger or parallel report scheduler.

Keep the existing manual operator and Reports workflows. They remain authoritative working surfaces and fallbacks; the owner need not visit them to assemble a supported answer. No chatbot should hide degraded source coverage behind fluent prose.

### Existing source to preserve

| Source | Reuse | Important limitation |
| --- | --- | --- |
| `apps/api/src/services/command-center/command-center-brief.service.ts` | Tenant-session read composition, time periods, current operational facts | Current brief is bounded/deterministic, not general cross-domain conversational runtime. |
| `apps/api/src/services/command-center/command-center-sources.ts` | Safe source labels and domain links | Nine current source kinds; new kinds need reviewed routes and access checks. |
| `packages/types/src/command-center.types.ts` | Brief/KPI/source/needs-you shapes | Preserve v1; do not silently change legacy metric meaning or owner/admin access. |
| `apps/api/src/services/operator-inbox.service.ts` and existing agent-action services | Proposal/approval/execution boundaries | Reading a recommendation is not a grant or a completed external effect. |
| `apps/api/src/services/revenue-outcomes.service.ts` and reporting services | Existing bounded calculations and source readers | Legacy basis/material-only contributions cannot be relabeled as final job margin. |
| `apps/api/src/services/timesheets.service.ts`, `inventory.service.ts`, import and QBO services | Domain-specific readers/quality states | Use the OP audit limitations; do not treat partial integrations as full accounting/payroll support. |
| PR #445 and #432 → #435 → #437 → #438 | Prior grouped estimates, dispatch and UI workflow work | Draft/unmerged work; reconcile source ancestry and reviews rather than duplicate it. |
| PR #442, `docs/operating-missions/preparation/` | Metric/source/authority/specialist/acceptance preparation | Prepared source maps are not an implemented OM snapshot or active mission runtime. |

Current source checkpoint for the focused Command Center review: `dev` at `8d01e752377d2401cb2c6cdf235aa8dcbdde0aeb`. The OP audit remains pinned to its own recorded baseline. Re-fetch all heads before implementation; a PR description is not proof of its current source.

## 2. What we can build here versus the integration track

| Deliverable | Bounded work suitable here | Codex/Cursor integration responsibility |
| --- | --- | --- |
| Source and metric catalog | Reconcile names, provenance, definitions, crosswalk and known gaps | Verify actual queries, tenant enforcement, indexes and deployed source behavior |
| Typed evidence contracts | Draft/review strict schemas and adapter interfaces; synthetic contract tests | Adopt them compatibly into shared packages and real route/service consumers |
| Question plans | Supported intents, required/optional evidence, safe fallback and capability requirements | Connect authenticated real readers; validate flexible intent routing and query budgets |
| Evidence/answer helpers | Pure completeness, units/basis compatibility, deduplication, claim-reference and presentation validation | Enforce at real trust boundaries; database/integration/race acceptance |
| Acceptance fixtures | Deterministic synthetic data, expected arithmetic, adversarial cases and offline test harness | Production-path integration and independent evaluation with actual model/tool traces |
| UI preparation | Answer cards, drill-down states, copy and component contracts; exact-frame inventory | Authenticated responsive Next/React integration and Figma/browser sign-off |
| Insight runtime | Small scoped adapter/component fixes where tests can genuinely run here | Multi-domain reads, persistence/cache, queues, projections, model orchestration and monitoring |
| Consequential execution | Proposal contracts, authority/race test cases and handoff | Real domain writes, provider reconciliation and policy/permission enforcement |

The division is based on coupling and validation needs. Work is not complete merely because a stub, interface or mock returns the expected shape. Neither tool's local test pass is independent release acceptance.

## 3. Build packages and dependency map

### CI-00 — Meaning, sources and integration crosswalk

**Purpose:** prevent conflicting metrics and duplicate platform components.

**Inputs:** charter, existing Command Center registry, OM source map/decisions, OP audit and current board/PR inventory.

**Output:** one versioned metric/source catalog identifying existing definitions, proposed extensions, canonical entity links, grain, date/basis/currency, permissions, required coverage and source maturity. Map every question to existing/proposed read capabilities and OP/OM dependencies. Label unresolved policies explicitly rather than invent defaults.

**Here:** preparation and reconciliation. **Integration review:** Product + Technical Lead/data-domain reviewers; these are proposed review responsibilities, not named assignments.

**Acceptance:** every question has traceable facts, required/optional sources and a safe unavailable response; legacy meanings remain intact; sources and capabilities are not marked live based only on filenames.

**Crosswalk:** OP-00; OM-04/OM-05; existing SRC-01–SRC-20 source map.

### CI-01 — Shared read/evidence/answer contracts

**Depends on:** CI-00.

**Output:** reviewed `DomainReadCapability`, `InsightRequest`, `BusinessEvidencePacket`, `NarrativeClaim`, `InsightAnswer` and non-executing proposal-reference contracts. Final production names are subject to shared-package ownership review.

Define current identity/scope, typed facts, source manifests, metric versions, period/currency/basis, independent quality flags, allowed detail links, action boundaries and precise error states. Version with compatibility adapters so existing `/command-center/brief` consumers do not break.

**Here:** strict schema definitions and contract-only tests once scoped. **Codex/Cursor:** adoption into existing `packages/types` and API consumers.

**Acceptance:** invalid scopes, unknown metric versions, incompatible units, unbound source IDs and malformed claims fail validation. Payload projection for the model/client omits server-only or unauthorized fields. Do not put placeholders into live capabilities.

**Crosswalk:** OP-00/OP-01; OM-01, OM-04, OM-05 and OM-06.

### CI-02 — Question recipes and bounded evidence planner

**Depends on:** CI-00/CI-01.

**Output:** reviewed recipes from the 12-question catalog with required and optional capability dependencies, supported filters, resolve/clarify rules, budgets and follow-up constraints. Typed plan selects reads, not arbitrary model-generated SQL or URLs.

**Here:** deterministic recipe resolver, required/optional input selection and fallback tests. Initial fixed intents can work without any model call. **Codex/Cursor:** natural-language routing, real read-tool execution and runtime budget enforcement.

**Acceptance:** unrelated sources are not loaded; unsupported questions are explicit; missing optional sources preserve the supported subset; missing essential facts prevent a definitive conclusion; company/role scope is supplied by the server and cannot be expanded through phrasing.

**Crosswalk:** OP-00/OP-01; OM-05/OM-07. This is a read-plan capability, not mission execution.

### CI-03 — Deterministic quality, calculation and claim guards

**Depends on:** CI-01/CI-02.

**Output:** pure functions for period/basis/version compatibility, covered-scope completeness, source-reference validation, canonical-ID deduplication and answer-state selection. Reuse established decimal calculation functions; any new formulas need policy review and expected-value tests.

**Here:** bounded helpers and unit tests without providers/database. **Codex/Cursor:** connection to authoritative aggregates and real per-source freshness/watermarks.

**Acceptance:** unknown versus zero, provisional versus final, source count versus display cap, currency/date mismatch, stale source and duplicate economic events behave exactly as defined. A source link cannot be invented. Invalid narrative falls back to supported facts rather than retrying indefinitely.

**Crosswalk:** OP-00/OP-01/OP-03; OM-04/OM-05/OM-07.

### CI-04 — Synthetic evaluation pack and acceptance harness

**Depends on:** CI-01; expands alongside CI-02/CI-03.

**Output:** fixture records, expected deterministic facts, required/prohibited claims and policy scenarios. The prepared catalog currently specifies 24 cases. A later approved build turns these cases into executable tests; writing case descriptions does not execute them.

**Here:** fixtures and offline oracle/harness with no external actions. **Codex/Cursor + independent QA:** real route/database and model-tool evaluation, authenticated tests and independent review.

**Acceptance:** seeded missing/stale/denied/conflicting/poisoned data produces safe outputs; reported numbers reconcile; model output never changes source money or authority. Publish passed/failed/skipped and exact head; do not claim provider or production accuracy from mocks.

**Crosswalk:** OP-00 and all domain acceptance; OM-07/OM-13.

### CI-05 — Real source adapters and evidence assembly

**Depends on:** CI-00–CI-04 for the first accepted recipe.

**Output:** current-actor tenant-safe read services, optimized aggregates, capability/readiness registry and a versioned assembled evidence packet. Reuse existing source readers; new aggregate SQL remains in the relevant domain service, not the frontend or prompt.

Start with needs-you, accepted job facts, estimate state and invoice balances. Proposed later adapters add workforce, stock, cost, purchasing, forms, sync and migration evidence as each OP package passes. Unsupported adapters stay disabled with explicit reasons.

**Primary build:** Codex/Cursor in a real repo workspace. **Potential here:** one isolated read adapter and regression suite after exact scope and test environment are available.

**Acceptance:** real PostgreSQL tenant/role tests, deleted-record handling, deterministic aggregation, complete pagination, per-source failures, old/late records, and no writes from read requests. API output does not claim a full-shop answer if source coverage is capped.

**Crosswalk:** OP-01–OP-09 by adapter; OM-04/OM-05. Do not create a second financial ledger.

### CI-06 — First Command Center answer and follow-up surface

**Depends on:** CI-05 plus independent design mapping for affected states.

**Output:** a real authenticated owner/admin read-only vertical slice for “What needs attention today?”; question chips first, then bounded natural-language routing. The answer includes supported situations, evidence, quality/coverage and authorized review/detail links. Existing brief and Reports routes remain usable.

**Primary build:** Codex/Cursor frontend/backend integration. **Here:** component-state contract, copy and bounded components/tests when isolated from auth changes.

Candidate API shape for review: `POST /api/v1/command-center/insights/query` and an authorized run/detail read. These are proposed endpoints, not present capabilities. Persisting conversational diagnostics is distinct from mutating business data and must have an explicit retention policy.

**Acceptance:** real Clerk/tenant data, owner/admin boundaries, narrow-phone/tablet/desktop layouts, source-drilldown authorization, partial failures and deterministic fallback. No model required for basic supported facts. A follow-up retains the intended period and subject but rechecks permissions. No consequential action button wired to a new direct write.

**Crosswalk:** OP-01; OM-06. Preserve PR #445's related UI and source changes without copying incompatible branches.

### CI-07 — Cross-domain specialist analysis

**Depends on:** CI-05/CI-06 and relevant OP domain acceptance.

**Output:** bounded specialist reads/analysis using shared evidence, reconciled findings and one coordinator response. Add workforce/cost/purchasing/forms/accounting/migration recipes incrementally. New specialist calls require demonstrated value versus deterministic composition, not one model call per tab.

**Primary build:** Codex/Cursor. **Here:** recipe/adaptor tests and expert expected-response evaluation packets.

**Acceptance:** domain disagreement remains visible; duplicated jobs/invoices are not summed twice; missing job cost blocks final profit rankings; payroll and accounting basis remain truthful; specialists cannot widen actor permissions or delegate writes through read tools.

**Crosswalk:** all OP packages by question; OM-05/OM-07, with existing Growth/Revenue/Operations/Retention capability owners.

### CI-08 — Proactive stories, saved answers and reports parity

**Depends on:** CI-06 and OP-01 delivery foundations; richer cards also require CI-07.

**Output:** event-driven or scheduled recomputation, material-exception grouping, deduplication/snooze/resolution, saved questions, report snapshots and authorized delivery. Use OP-01 subscriptions/workers rather than a second scheduling engine.

**Primary build:** Codex/Cursor runtime. **Here:** deterministic detector rules and fixture tests, digest/card content and relevance criteria.

**Acceptance:** same definition/cutoff/filter produces identical numeric results in answer/report; changed cutoff is explicit; recipient removal prevents delivery; queue replay does not create duplicate business changes; notifications coalesce rather than flood; resolved issues require current source evidence.

**Crosswalk:** OP-01/OP-09; OM-06/OM-08/OM-10. Proactive awareness does not authorize autonomous action.

### CI-09 — Trusted proposal bridge and staged rollout

**Depends on:** accepted read slices, existing authority/execution services and explicit approval for the relevant action/runtime class.

**Output:** approved proposal types referring to current evidence, policy and expected versions. Existing services still own approval, execution, provider effect and verification. Keep read-only fallback and per-capability rollback/kill switches.

**Primary build:** Codex/Cursor integration plus independent Security/QA/Platform review. **Here:** authority matrix, negative/race cases and validation packet.

**Acceptance:** stale inventory/balance/schedule/consent rechecked at execution; unauthorized or changed payload rejected; ambiguous provider write reconciled before retry; action receipt does not become claimed business success. No automatic payroll submission or purchasing under a read-only question.

**Crosswalk:** OM-02/OM-03/OM-05/OM-13 and applicable OP write domains. Operating Missions runtime remains behind Part I acceptance and founder permission; this package does not bypass that gate.

## 4. Proposed build waves, not invented calendar commitments

| Wave | Deliverable | Can proceed before all new operational modules exist? | Exit evidence |
| --- | --- | --- | --- |
| A: foundation | CI-00–CI-04: catalog, contracts, recipes, pure helpers and evaluation pack | Yes, with approved bounded scope | Reviewed meanings/contracts; executed offline tests once implemented; source and permission crosswalk |
| B: first real answer | CI-05/CI-06 on current accepted jobs, estimates, invoices and needs-you | Yes | Real authenticated read-only answer; tenant/permission/partial-data tests and responsive QA |
| C: richer questions | CI-07 adapters per OP readiness; initial workforce/quantity/import health before full costing | Yes, capability by capability | Domain-backed evidence and correct unsupported/provisional states |
| D: proactive and reporting | CI-08, using OP-01 delivery | Yes for already accepted metrics | Answer/report parity, deduplication, reauthorization and visible delivery state |
| E: recommendations to action | CI-09 and relevant accepted OM runtime | Only after its actual scope/authority gates | Independent race/provider/permission checks and founder-approved activation |

OP costing, PO/valuation, operational forms and accounting builds can run alongside Waves A/B with explicit central-file ownership. Do not block a safe owner brief on Desktop connectivity; do not promise complete margin or book reconciliation before those domains exist. Existing P0 work and active owner assignments retain priority.

## 5. First bounded implementation packet

### CI-FOUNDATION-01: evidence contract and deterministic answer-state rules

**Proposed next code task, not performed in this delivery.** Suitable to build here as an isolated PR or by Codex/Cursor using the same packet.

**Objective:** make it impossible for an answer to silently turn unsupported, missing, partial, stale or unauthorized facts into a complete business claim.

**Inputs:** current Command Center types, OM entity/source definitions, this specification and cases CI-A01–CI-A12. Resolve permission and status vocabulary with the existing contract owner first.

**Candidate files (new paths are proposals):** a versioned evidence contract under `packages/types/src/connected-intelligence/`; pure quality/claim helpers and colocated tests in that module or an approved shared module. No public package export until dependencies and compatibility are reviewed. Do not change the existing brief response in this packet.

**Implementation:** strict input/output schemas; separate read outcome/freshness/completeness/reconciliation; compatible basis/unit/version comparison; source-reference integrity; typed claim classes; deterministic final/partial/unavailable answer state; safe client/model projection. Use exact source IDs and fixture values, not an LLM.

**Out of scope:** database tables/migrations, live API routes, UI redesign, cache/session storage, provider/model credentials, operational writes, report delivery and mission activation.

**Tests:** accepted complete packet; missing labor rate; truncated source; stale scheduling fact; denied wage read without hidden-count disclosure; inconsistent periods/currency; duplicate identity; unsupported capability; unknown reference; provisional source preventing final claim; malformed structured claim; true zero preserved.

**Done for this packet:** actual local contract/unit suite passes; affected TypeScript and lint pass; no application import accidentally activates the module; review confirms no legacy-contract break. Record exact commit and test commands. This is ready for independent review, not release approval.

### Next integration packet: CI-READ-01

After the foundation is accepted, wrap the existing owner/admin Command Center brief and selected domain readers into the new read packet. Preserve current RLS/permissions and v1 API. Surface its truncation and unsupported source flags; do not recalculate legacy values with a new meaning. Add real database/route tests before connecting the owner answer UI. The original current brief already uses an RLS tenant transaction, so this is an additive adapter, not a new authentication system.

## 6. Foundation acceptance matrix

The JSON catalog contains CI-A01–CI-A24. Treat all statuses as `planned_not_executed` until executable checks produce evidence. Critical release requirements are zero unauthorized disclosure, zero unintended business writes, exact arithmetic/reconciliation on deterministic fixtures, and source-grounded claims. Narrative wording can vary; facts, permissions, uncertainty and action state cannot.

Evaluate model routing/explanations separately from deterministic contracts. Run a held-out set after prompt/model changes; preserve failing cases and record evaluator provenance. Self-authored expected answers are preparation, not independent QA. A fluent answer is not sufficient evidence of correctness.

## 7. Governance, integration and handoff checklist

1. Fetch current `dev`, #445, #449 and relevant #442 material; record exact heads and active owners. Read repository `AGENTS.md`/`CODEX.md`; preserve founder issue #420.
2. Start with the linked specification, catalog and CI-FOUNDATION-01. Map to existing OP/OM/FS work; do not create duplicate initiatives or mark fictional agents assigned.
3. Keep preparation-only assets under `docs/` until reviewed for executable adoption. Synthetic examples are not live company settings.
4. Before each domain adapter, verify the endpoint, permission scope, coverage and actual runtime capability; never promote readiness from a filename, flag or test fixture.
5. Preserve legacy metrics/routes and source ancestry. Changes to monetary basis, pay policy, valuation, sensitive permissions or provider capabilities require their domain decision and acceptance.
6. Collect independent exact-head Peer/QA/Security-by-risk/Design evidence and authorized CI. Do not self-approve, merge, deploy or dispatch financial/customer actions under this plan.
7. Update GitHub and the linked Notion plan with the actual code status, evidence and next smallest blocker. Report proposed, coded, tested, reviewed, merged and deployed as separate states.

## 8. What this planning delivery completes

Completed artifacts: the cross-platform specification, ten-package build sequence, concrete next code packet, module/OM integration map, 12 supported-question recipes and 24 proposed acceptance scenarios. All are planning/foundation inputs.

Not completed by this delivery: production shared schemas, pure helper implementations/tests, domain adapters, model router, authenticated answer UI, proactive runtime, reports delivery, accounting connectors or mission execution. No current-head application-test or independent sign-off is asserted.

The canonical documents are on the existing documentation branch for PR #449. This extends the operations spec and preserves PR #445/#442; it is not a competing application build.
