# DRAFT — Command Center and Connected Business Intelligence

Version 0.1 | November 6, 2026 | Companion and integration amendment to the Operations/Finance/Migration specification

**Founder requirement:** Command Center and each specialist must assemble the relevant collection of business evidence to answer a question, explain a situation and identify a useful next step. The operator should not have to visit Reports and manually combine separate modules. Reports remains available for analysis, audit, saved views and exports.

**Delivery status:** product specification and engineering plan, not an implemented question-answering service. This document does not authorize provider calls, financial actions, production activation or Operating Missions runtime. Internal data contracts and read-only foundations can be developed within separately approved Phase I scope; consequential mission execution retains its existing acceptance gates.

**Read with:** [build plan and foundation split](../planning/CONNECTED-INTELLIGENCE-BUILD-PLAN-2026-11-06.md), [question and acceptance catalog](../planning/connected-intelligence/foundation-catalog.v0_1.json), and [Operations, Finance, Reporting and Implementation](OPERATIONS-FINANCE-MIGRATION-2026-11-06.md). This amendment makes intelligence integration a first-class requirement of OP-00 through OP-09, not an optional report integration added after those modules ship. It does not replace their domain work or the existing Operating Missions plan.

## 1. Product outcome and platform fit

The experience is **understand → explain → recommend → obtain any required approval → act through trusted services → verify**, not open six screens and assemble a report yourself.

Example desired interaction: an owner asks, “We are busy, so why is this week's margin lower?” Renvani combines the applicable job cohort, accepted scope, completed work, approved labor, materials, cost adjustments and credits. It returns the observed change, the supported contributing factors, which jobs account for it, what is still missing and a proposed next step. It does not claim a causal explanation merely because two metrics moved together, or fabricate costs that are not yet captured.

“Connected intelligence” is an internal capability of the **existing Outcome Intelligence Engine**, not a sixth flagship product, separate financial ledger or new universal agent framework. Keep the existing responsibilities:

| Existing platform element | Responsibility in this design |
| --- | --- |
| Operating Profile and Operating Missions | Supply the business objective, constraints and relevant context; selecting a goal does not grant execution authority. |
| Outcome Intelligence Engine | Coordinate diagnosis, evidence collection, supported reasoning, feasible plans and verified outcomes. |
| Growth | Evaluate demand and acquisition using downstream fulfillment, contribution and customer evidence when authorized and available. |
| Revenue | Explain estimates, conversion, invoice/collection gaps and recovery candidates using capacity, cost and consent constraints. |
| Operations | Explain workforce, schedule/dispatch, materials, purchasing, forms, job readiness and delivery risk. |
| Retention | Explain obligations, callbacks, reviews, renewal and repeat-service opportunities using service and financial history. |
| Command Center | Present the coherent business story, questions, proactive exceptions, decisions, approvals and outcome follow-through. |
| Trusted Execution and domain services | Recheck authority and current facts, perform permitted writes, reconcile uncertainty and record actual outcomes. |
| Reports | Present the detailed, saved, scheduled or exported form of the same governed facts and calculations. |

The first mission family remains **Increase monthly revenue for HVAC**, with estimate recovery through completed work and reconciled financial outcomes as the first end-to-end mechanism. This read architecture supports that direction and the wider HVAC/plumbing platform; it does not silently substitute a new first mission. [S1]

## 2. Existing foundation and actual gaps

Current `dev` was observed at `8d01e752377d2401cb2c6cdf235aa8dcbdde0aeb`. The source review for this amendment is bounded; no application, database, model or authenticated-browser acceptance ran.

The existing owner Command Center brief is a deterministic, read-only composition inside a tenant RLS transaction. Its typed response already carries source references, metric definitions, period information, needs-you items and truncation flags. Its current public contract is owner/admin only and supports a monthly comparison with four defined KPIs. Source labels deliberately avoid customer contact details. Reuse those controls. [S2–S4]

What is not established by that source is a general natural-language question planner, domain-wide evidence contract, conversational follow-up service, payroll/cost/purchasing/forms evidence integration, or a shared answer/report delivery pipeline. Do not call those capabilities built because a brief endpoint exists.

The existing Part II preparation already maps 17 snapshot fields to 20 source groups and separates projections, snapshots, specialist policy, Command Center and Trusted Execution. Extend those contracts rather than create competing snapshots, metric dictionaries or identity models. Preserve its explicit distinction between source availability and operational acceptance. [S5–S6]

The underlying OP audit remains controlling for domain maturity: timesheets and quantity inventory have substantial foundations; full job-cost/PO valuation, QBO financial sync, ongoing QBD sync, forms runtime and implementation readiness still require their specified work. Their data must not appear as certified answers prematurely. [S7]

## 3. Three entry modes, one evidence path

### 3.1 Ask

The owner or authorized operator asks a supported question in Command Center. Follow-up questions retain the resolved subject, period and evidence context, but every follow-up reauthorizes access and refreshes time-sensitive facts. The user can inspect the supporting records without leaving the answer context.

### 3.2 Explain in context

A user opens a job, customer, estimate, timesheet, stock item or import and asks “What happened here?”, “What is blocking this?” or “What should I review?” The same evidence service starts with that entity scope. It must not inherit broader access just because the user can see the page.

### 3.3 Bring attention proactively

Supported events and scheduled checks identify material exceptions: work at risk because materials are unverified, a payroll preparation blocked by missing rates, a sync discrepancy, or a failed required form. Command Center groups related issues into one situation with a reason and clear next step. Routine events do not each become a notification.

A saved question can become a scheduled answer only after separate subscription authorization. Interactive answers, contextual explanations, proactive cards and report exports use the same metric definitions and evidence references. Recipients are rechecked at delivery time.

## 4. Proposed request-to-answer architecture

```text
Question, page context, mission context or supported event
  → authenticated request scope and capability check
  → bounded intent and evidence plan
  → approved domain readers + shared metric definitions
  → deterministic calculations and completeness checks
  → Business Evidence Packet
  → grounded explanation with claim-level evidence
  → Command Center / contextual answer / saved report / digest
  → optional typed proposal through existing authority and execution services
```

The model may select among approved read capabilities and explain validated evidence. It does not own permissions, compute money from prose, invent database fields, run arbitrary SQL over production, or directly execute purchases, payroll, schedule changes or payments.

Start with a supported question catalog and reviewed compositions. Expand flexible question decomposition only after the same bounded tool, security and evaluation contracts pass. Unsupported questions should return an honest limitation and available relevant facts, not a fabricated answer.

### 4.1 Versioned business meaning

Extend the shared metric/source definitions already prepared for the Outcome Intelligence Engine. Each definition records ID/version, label, units/currency, grain, authoritative inputs, allowed dimensions, inclusion/exclusion rules, date basis, cohort identity, formula, treatment of reversals, required source coverage and sensitivity.

Do not use a bare label such as “revenue” or “profit” as a complete metric definition. Completed-job sales, invoices, cash collected, recognized revenue, estimated contribution and final direct gross margin remain different. Existing legacy report definitions are not silently relabeled as stronger metrics. Ratios aggregate from their valid numerator and denominator, not an average of unrelated percentages. A zero denominator produces the defined unavailable/not-applicable state.

Resolve company-local periods and comparable elapsed windows explicitly. Comparison requires compatible basis, definition versions, currency, cohort and coverage. Missing costs do not become zero; missing source rows do not prove no activity. A new definition may coexist with a legacy version during migration, with the difference visible.

### 4.2 Approved domain-read capabilities

A domain exposes a typed read capability, not an unrestricted table dump. Its descriptor includes accepted scope/filter inputs, server-enforced permissions, result schema, supported aggregations, freshness rules, coverage/pagination semantics, cost limits, source versions and known limitations. The server supplies tenant/actor context; model-provided identifiers never establish access.

Readers reuse existing services or reviewed aggregate queries within their domain. They may return aggregate facts and a bounded source manifest. A summary with 20 displayed citations can represent a full query only when completeness of the underlying computation is independently established; a 20-row display cap must not be confused with a complete scan.

Existing Command Center bounded reads disclose truncation. Preserve that behavior while adding aggregate-backed readers and continuations where needed. A source that cannot serve the requested scope returns partial/unavailable explicitly rather than silently truncating. [S2–S4]

### 4.3 Evidence selection, identity and consistency

Choose the smallest relevant evidence set, based on the question, subject, role, period and capability. A payroll exception question does not need marketing conversations; a dispatcher need not receive wage rates to see a labor-readiness issue.

Reuse canonical company, customer, property, opportunity, estimate/version, job/visit, invoice/line, payment/adjustment and source IDs. Extend with reviewed references for time entries, pay runs, stock movements, PO lines/receipts, cost postings, form versions/submissions and migration runs as those domains become real. A relational reference map is sufficient initially; this spec does not require a new graph database.

Compute linked monetary/operational aggregates at an agreed source cutoff. Use an appropriate consistent database snapshot where feasible. Across external systems, record each source's effective/observed/ingested time and watermark; do not claim a globally atomic snapshot that does not exist. Reject or qualify materially mismatched periods and freshness. Late-arriving changes create a new answer version and preserve the earlier evidence history within retention policy.

### 4.4 Business Evidence Packet contract

This is a proposed versioned contract to reconcile with OM-04/OM-05 and current entity references, not a new production schema in this PR.

| Field group | Required contents |
| --- | --- |
| Identity | Packet ID/version, request ID, scoped subject, definition versions and server-bound tenant context |
| Scope | Authorized locations/entities, question intent, period/basis/currency, comparison and normalized filters |
| Facts | Typed scalar/table/series values with units, stable fact IDs and metric references |
| Provenance | Source entity/version references or reproducible aggregate-query manifest; origin, timestamps and covered scope |
| Quality | Read outcome plus separate freshness, completeness, reconciliation and provisional/final labels; no single opaque confidence score |
| Calculations | Formula/version, input fact IDs, exact decimal result and rounding policy |
| Claims | Observed fact, deterministic explanation, association, hypothesis, forecast or recommendation; evidence IDs for each |
| Limits | Missing/unsupported/partial/stale/conflicting data, its impact on the answer and permitted next step |
| Actions | Optional proposal descriptors and required authority; no executable provider credentials or implicit grants |
| Presentation | Structured answer sections, approved source links and drill-down handles, not arbitrary model-produced URLs |
| Trace | Plan/tool/metric/model versions, safe diagnostic IDs and bounded execution/cost metadata |

Keep read outcome separate from data quality: a successful query can still contain incomplete costs; a source can be fresh but unreconciled. A denied read returns a non-disclosing availability message, not hidden names, counts, values or a list of restricted records. Sensitive server metadata is not automatically included in the client/model projection.

### 4.5 Grounded synthesis and the answer contract

Every answer should contain, where relevant:

1. The direct answer to the actual question.
2. The evidence and supported explanation.
3. Operational or economic significance without invented causality.
4. Material uncertainty, missing coverage and freshness.
5. A useful next step, separated from any required approval.
6. Supporting record/definition links and an optional detailed report view.

Numeric values come from validated facts/calculations, not model arithmetic. Claim-to-evidence checks reject unsupported IDs, numbers, comparative statements and overly strong claims. A generic model “confidence: 95%” cannot certify accounting truth. Forecasts need their own model/basis/uncertainty label; a supported correlation is not incremental revenue attributable to Renvani. Fail safely to a deterministic fact summary when narrative verification fails.

A “why” question may receive a bounded explanation of recorded reasons or a decomposition of observed change. Distinguish that from a hypothesis needing further evidence. Do not rank employees or customers on unadjusted, incomplete or inaccessible data.

## 5. Module integration requirements

| Module / OP package | Evidence supplied to the platform | Example answer and readiness boundary |
| --- | --- | --- |
| Reports / OP-01 | Versioned metric results, series, cohorts, snapshots and delivery state | “What changed this week?” uses the same facts in Command Center and a saved report. |
| Timesheets/payroll / OP-02 | Entry/approval states, authorized gross-earning inputs, missing rates and correction state | “Is payroll ready?” reports exact blockers; gross preparation is not take-home pay or a completed payout. |
| Costing / OP-03 | Budget, commitment, provisional/final actual costs, allocations, revisions and missing costs | “Which jobs lost margin?” requires complete comparable cost data; otherwise returns a provisional or unavailable diagnosis. |
| Purchasing/inventory / OP-04 | On-hand, reserved/available quantities, expected/received supply, PO state, cost basis and exceptions | “Can we fulfill next week's work?” does not treat unreceived orders as usable stock or unverified requirements as ready. |
| QBO / OP-05 | Per-entity mapping, financial export state, acknowledgment, reconciliation and basis | “Why do totals differ?” separates period/basis differences from actual sync failures; no blind replay of uncertain writes. |
| QBD / OP-06 | Same accounting evidence plus host/pairing/last-contact capability state | “Are the books current?” identifies Desktop connectivity and lag; file import is not recurring sync. |
| Forms / OP-07 | Pinned template version, requirements, submissions, reviewed findings and closeout blockers | “What is preventing closeout?” links real missing evidence; a model cannot sign or mark an inspection complete. |
| Migration / OP-08 | Entity coverage, origin/cutover, reconciliation, rejected rows, duplicates and acceptance evidence | “Can I trust this baseline?” separates imported history from native activity and discloses gaps. |
| Implementation / OP-09 | Verified configuration, rehearsals, training and go-live acceptance checklist | “What is left before launch?” reports unmet evidence, not a readiness percentage inferred from wizard steps. |

Every module's definition of done must include a reviewed evidence adapter, source references, quality states, permission tests, and at least one cross-domain question or explanation acceptance case. Domain CRUD screens alone do not complete the integration requirement.

## 6. Specialist collaboration and story composition

All specialists use the same evidence service and metric IDs under the initiating actor's permitted purpose and scope. They do not each maintain contradictory private totals or exchange unrestricted raw customer histories.

For a combined question, the coordinator requests bounded domain analyses in parallel only when independent. Each returns typed findings and evidence references. The coordinator deduplicates shared entities, preserves disagreements and unknowns, and produces one answer. A specialist cannot widen access or order a downstream action merely because another specialist asked.

For example, revenue growth with fulfillment risk may combine: Growth's source mix, Revenue's valid recovery opportunities, Operations' real capacity/material limits, and Retention's obligations/callbacks. The final answer shows tradeoffs, not four disconnected recommendations. Safety, existing commitments, consent, capacity and approved economics remain hard constraints before commercial ranking. [S1, S5]

Use deterministic readers for facts and models for bounded interpretation. Start with one coordinator over existing capabilities; separate specialist model calls only when their benefit is demonstrated. A “multi-agent” label does not justify unnecessary latency, duplicated queries or recursive delegation.

## 7. Security, privacy and execution separation

Authorization occurs before retrieval, before including facts in model context, on follow-up, on source-link access and on saved/scheduled delivery. Enforce tenant, role, entity/location and field-level permissions. Aggregate labor cost and individual wages are separate permissions; suppressed data must not be recoverable by comparing totals or repeated narrow queries.

Use tenant and authorization-scope fingerprints in cache keys alongside metric/policy versions, period, filters and source watermarks. Revoke/invalidate on role, tenant, source or policy change. Conversations cannot carry one company's evidence into another workspace. Do not replay a privileged owner's answer to a dispatcher or external accountant without reauthorization and appropriate recomputation/redaction.

Customer notes, messages, uploaded forms and supplier descriptions are untrusted evidence, never operating instructions. Retrieved text cannot change tool permissions, request secrets, grant approval or redirect export destinations. Structured calculations use typed source values; text-derived candidate facts must be labeled and reviewed before entering authoritative state. Indexing or embedding requires the same tenant, deletion and retention controls as the source; a global customer vector store is not proposed.

Log minimal diagnostic metadata by default. Do not put full payroll, credentials or sensitive customer text in shared model traces. Define retention/redaction and access for saved questions, evidence snapshots and feedback. Cross-tenant learning remains the separately authorized, minimized pipeline in the charter, not unrestricted cross-tenant retrieval for answers. [S1]

Read answers cannot execute writes. A proposed purchase, payroll approval, price change, outbound message or reassignment goes through the existing domain authorization, current policy, exact payload/version and idempotency boundaries. Proposal creation, approval, queued execution, provider acknowledgment and verified business outcome are different states. Current balance, stock, consent and capacity must be rechecked immediately before a consequential action.

## 8. Persistence, events, reports and operations

Do not duplicate the source-of-truth ledger. Proposed persisted objects are an insight request/run, a versioned evidence manifest, answer/claim records and optional saved-question subscriptions. Reuse OP-01 report runs/delivery and OM snapshot/projection records where contracts agree; avoid creating a second report scheduler or incompatible snapshot table. Final physical schema and names require the contract review in the build plan.

Use domain events/outbox and source version changes to invalidate or recompute affected insights. Define whether each event name already exists or is proposed before registering consumers. Detectors should coalesce related job/material/time/forms failures, track unresolved/resolved state, honor dismissal/snooze policy and show when a source recovered. Do not mark an issue resolved solely because an agent suggested a fix.

Reports are one presentation of the evidence. At the same definition/version, cutoff and filters, numeric values must match across Command Center, contextual answers and report detail. If a report is newer, show that fact rather than silently presenting different totals. Download/open access is reauthorized; email should minimize sensitive content and favor authenticated detail links.

Bound query range, record traversal, tool fan-out, model tokens and time. Cache reusable authorized aggregates; preserve checkpoints for long reads. Complex requests can return an honest progress/partial state instead of pretending completion. Define and benchmark latency/cost budgets before pilot acceptance; do not invent production SLO achievements in the plan. A slow/unavailable model must not take down deterministic Command Center cards.

## 9. First useful production slice

Implement an **owner/admin read-only “What needs attention today?” answer** using accepted current sources: needs-you items, job/dispatch readiness facts that actually exist, estimates and invoice balances. Begin with deterministic question chips and validated summaries; add natural-language intent routing as the next bounded slice. Include missing/unsupported source sections visibly, but do not imply that unavailable costing, PO or full forms adapters already work.

The answer returns prioritized situations, reason, evidence and an existing authorized review/detail link. No new sends, charges, purchases, schedule writes or payroll mutations. The complete accepted slice must use the real authenticated API and data, not a static mock conversation.

Do not require all OP-00–OP-09 work to finish before this slice. Conversely, do not claim margin analysis, procurement feasibility, net-pay certainty or accounting parity until those dependent domain contracts pass.

## 10. Foundation-versus-complex-build boundary

**Suitable work here:** precise source/metric and question catalogs, contract definitions, adapter interfaces, deterministic completeness and claim-validation helpers, synthetic fixture packs, permission/answer-state matrices, bounded regression tests, UI copy/component contracts, and small read-only adapter patches where the full scoped tests can actually run.

**Codex/Cursor integration track:** real multi-domain query adapters and optimized aggregates, schema/projection migrations, event and worker wiring, authenticated Next/Fastify surfaces, model orchestration/evaluations, authorization-aware cache/conversation persistence, provider accounting integration, resource races and independent release acceptance.

This is a split by integration risk, environment and validation needs, not a claim that one coding tool can do everything or that ChatGPT can only write prose. Any implementation must be published and tested with explicit limits. The current delivery creates specifications and planning catalogs only; it does not claim that the helpers, adapters or runtime have been implemented.

## 11. Acceptance and unresolved decisions

The companion catalog lists 12 business questions and 24 concrete acceptance scenarios. They are proposed fixtures/test cases, not executed tests. Required properties include numeric reconciliation, complete and partial answers, source citations, privacy, unsupported capability, true zero, prompt injection, revoked access, stale records, mixed periods, duplicate outcomes, same-data report parity and no unintended write.

Before promotion, resolve: approved business metric/recognition/valuation policies; role and field grants; freshness/reconciliation requirements per capability; first supported language/intent scope; provider/model data handling; snapshot/retention design; proactive priority policy; measured latency/cost limits; exact Figma frames and independent visual acceptance. Open questions block affected capabilities, not unrelated safe work.

**Release rule:** independent Peer, QA, Security-by-risk, Design/Product evidence and approved exact-head CI, followed by founder approval naming each PR and reviewed SHA. This plan does not itself create assignments, dispatch CI, merge PR #445/#449/#442 or activate any mission.

## Sources and traceability

[S1] [Outcome Intelligence Engine Charter](https://app.notion.com/p/40e317b92d158107a87ef66deb7ba2a1). Current platform responsibilities, first mission family, accounting/evidence/authority boundaries.

[S2] [Existing Command Center brief](https://github.com/SimonShaun2/Renvani/blob/8d01e752377d2401cb2c6cdf235aa8dcbdde0aeb/apps/api/src/services/command-center/command-center-brief.service.ts). Read-only RLS composition and bounded source reads.

[S3] [Existing Command Center types and KPI registry](https://github.com/SimonShaun2/Renvani/blob/8d01e752377d2401cb2c6cdf235aa8dcbdde0aeb/packages/types/src/command-center.types.ts). Owner/admin v1 scope, source/quality contracts and legacy definitions.

[S4] [Existing source labels and routes](https://github.com/SimonShaun2/Renvani/blob/8d01e752377d2401cb2c6cdf235aa8dcbdde0aeb/apps/api/src/services/command-center/command-center-sources.ts). Bounded record references and minimal labels.

[S5] [Part II foundation preparation](https://github.com/SimonShaun2/Renvani/blob/docs/part2-foundation-prep-20261105/docs/operating-missions/preparation/README.md) and [source map](https://github.com/SimonShaun2/Renvani/blob/docs/part2-foundation-prep-20261105/docs/operating-missions/preparation/04-source-map.md). Existing OM work-package anchors and source-read/commit boundaries.

[S6] [Part II Codex handoff](https://app.notion.com/p/40f317b92d15811281d3f387c4d1a9b3). Existing FS initiative and runtime gates; no duplicate initiative.

[S7] [Operations/finance/migration source audit](OPERATIONS-FINANCE-MIGRATION-2026-11-06.md) and [Notion record](https://app.notion.com/p/410317b92d1581169c56d1250513a9ae). Domain maturity and OP-00–OP-09 scope.

[S8] [PR #445 source handoff](https://github.com/SimonShaun2/Renvani/pull/445). Preserve its unmerged six-package workflow work and original UI ancestry; recheck current heads before implementation.
