# Renvani | Document 1 of 2
# ChatGPT Foundation Build Specification, Tickets and Sprints

Version 1.0 | November 6, 2026 | Planning status: drafted; implementation not started by this document

**Companion:** [Document 2: Codex/Cursor integrated build](CONNECTED-INTELLIGENCE-02-CODEX-CURSOR-SPRINTS-2026-11-06.md).

**Outcome:** prepare reusable, tested contracts and bounded components so the existing Outcome Intelligence Engine, Growth, Revenue, Operations, Retention and Command Center can explain the business using the same authorized evidence. Reports remains a detailed view of those facts, not a prerequisite for getting an answer.

**Delivery:** 16 implementation-ready planning tickets across four foundation sprints. These are actual code and test scopes where specified, not a request to write another specification for each ticket. The tickets are not yet implemented, assigned, added to the FS board or approved for release.

## 1. Scope and operating rules

This document covers bounded work suitable for execution here: source and metric catalogs, strict shared schemas, deterministic read-plan and validation helpers, pure adapters, synthetic fixtures, offline regression tests, UI state contracts and verified handoff artifacts. Work that needs production database wiring, migrations, authorization enforcement, model/provider integration, authenticated end-to-end testing or deployment belongs in Document 2.

The division is by integration and validation needs, not exclusive ability of a particular coding tool. A ticket can move lanes only with its scope, ownership and tests preserved. A helper that passes synthetic tests is not proof that the live application applies it.

The current delivery creates two plans. It does not implement their tickets, merge code, assign agents, schedule delivery, enable providers or execute business actions.

### Preserve the existing platform

Use the existing Outcome Intelligence Engine and Command Center. Do not add a sixth flagship product, duplicate financial ledger, second report scheduler, global customer vector store or replacement agent framework. Preserve current manual office/dispatch/field workflows. The first mission family remains Increase monthly revenue for HVAC, with estimate recovery through completed work and reconciled outcomes as the first mechanism. [S1, S2]

The existing Command Center brief already provides deterministic tenant-session composition, source links and truncation flags; its v1 contract is owner/admin and monthly. Treat it as a reusable bounded reader, not proof that general cross-domain questioning exists. [S3]

The prior operational audit identifies reusable timesheet, quantity-stock and migration foundations, alongside unfinished costing, purchasing, forms and accounting work. These tickets must never create fixtures or labels that misrepresent those gaps as live capabilities. [S4]

### Ticket and sprint conventions

RCI-H01 through RCI-H16 are local delivery-plan IDs, not fabricated FS numbers. They decompose existing CI/OP/OM requirements and must be linked to an existing FS ticket wherever one already owns the work. No duplicate initiative or automatic board-status change is implied. Every ticket begins **Draft / unassigned / tests not run**.

H1 through H4 are dependency-defined sprint batches, not dates or a replacement for the master Phase A/A1–A5 and Phase B sequence. Sprint duration and calendar commitments require actual capacity. Finish the exit criteria rather than hiding unfinished work inside the next sprint. Keep one active implementation ticket per execution lane and serialize edits to central shared contracts. Independent review is not supplied by the implementing agent.

Priorities P1/P2 below are relative to this extension, not replacements for existing P0 obligations. Suggested reviewer roles are functions to fill, not assigned people. Runtime/action activation remains subject to existing Phase I acceptance and founder authority. [S1, S2, S5]

## 2. Sprint plan

| Sprint | Goal | Tickets | Entry gate | Exit and handoff |
| --- | --- | --- | --- | --- |
| H1 | Agree meanings, sources and protected scope | H01–H03 | Read current branch, existing board and governing plans | Reviewed source map, metric dictionary and permission/quality decisions; unresolved items named |
| H2 | Build the typed evidence and question core | H04–H07 | H1 decisions sufficient for the first read-only slice | Executable schemas, adapter interfaces, recipes and quality helpers with passing scoped tests |
| H3 | Make answers and domain inputs testable | H08–H11 | H2 contract version frozen for the packet | Verified claim/fallback helpers, pure legacy adapter and domain fixtures; no runtime readiness claims |
| H4 | Validate, prepare the UI and package the handoff | H12–H16 | Relevant H2/H3 outputs; H14 can start earlier | Offline evaluation evidence, detector/report contracts, UI acceptance map and reproducible handoff |

**Do not wait for all four sprints to begin integration.** Document 2 C0 reconciliation/discovery can start beside H1. Its first runtime work can consume the reviewed H04–H09 subset, with the relevant H12 tests and H14 design contract, before unrelated financial fixtures finish. H15/H16 provide a partial, versioned handoff as soon as that subset is ready, then a complete handoff later.

## 3. Shared build specification

### Evidence path

Question or supported event → server-bound actor/tenant scope → reviewed read plan → domain evidence → deterministic calculations and quality checks → claim-grounded answer → Command Center, contextual explanation or Reports.

The model is never the permission authority or financial calculator. A recommendation is not approval; approval is not delivery; a provider acknowledgment is not a verified business outcome.

### Required contracts

| Contract | Required meaning |
| --- | --- |
| DomainReadCapability | Identifier/version, allowed inputs, scope, sensitivity, required permissions, supported grain, coverage/paging and freshness policy |
| InsightRequest | Question/recipe, subject, period/basis, requested dimensions and safe context; identity supplied by trusted server context |
| BusinessEvidencePacket | Typed facts, definition versions, source/query manifests, cutoff/watermarks, separate quality states and calculation lineage |
| NarrativeClaim | Fact, calculation, association, hypothesis, forecast or recommendation; referenced facts and permitted strength |
| InsightAnswer | Direct answer, evidence, impact, limitations, next step and approved detail references |
| ProposalReference | Non-executing action description, evidence/policy/expected-version references and required authority |

Physical production paths are proposals until H01/C02 confirm shared-package ownership. Prefer a versioned module in `packages/types/src/connected-intelligence/` for schemas and pure dependency-light helpers. Keep fixtures under a test-only path. Do not export or import unfinished modules into production startup. Reuse existing decimal and date helpers where compatible.

### Data-quality contract

Read outcome, freshness, completeness, reconciliation and provisional/final status are separate fields. Successful retrieval does not imply complete job cost. A zero is preserved only when it is a valid observed value. An unavailable or denied read must not become zero, and a denial cannot reveal hidden entity names/counts. A displayed citation limit is different from a computational row limit.

Every monetary fact carries currency and basis; every ratio has a defined numerator/denominator and grain. Comparison requires compatible scope, period, version and coverage. Do not silently replace paid cash with invoice value, materials-only contribution with final margin, or assistance attribution with causal lift.

## 4. Sprint H1 | Meaning and source contracts

### RCI-H01 | Reconcile source, FS ownership and branch lineage

**Priority / risk:** P1 / Architecture. **Depends on:** none. **Review:** Technical Lead and existing domain owners. **Maps to:** CI-00, OP-00, OM-04/05.

**Build:** a machine-readable source/capability register and existing-ticket crosswalk. Recheck current `dev`, PR #449, the #445 workflow integration and #442 mission preparation. Record source path/symbol, current branch/head, data owner, accepted capability, known limitation and evidence date. Treat stale Notion status separately from current source and merge metadata.

**Deliverables:** source register, duplicate-work map and reviewable dependencies under `docs/planning/connected-intelligence/`. Distinguish verified existing FS anchors from proposed gaps. Use FS-29/FS-170/FS-171 and migration/provisioning anchors only after checking their current records; do not create replacement tickets.

**Acceptance:** all requested domains and 12 existing question recipes have a source or explicit gap; #445/#442 work is preserved; no planned provider is marked active; every new path is labeled proposed. A reviewer can identify the next owner without reading chat history.

**Handoff:** C01/C02 and all adapter tickets. **Excluded:** code refactors, merges and board status changes.

### RCI-H02 | Build the metric, identity and comparison dictionary

**Priority / risk:** P1 / Money. **Depends on:** H01. **Review:** Product and financial-domain reviewer. **Maps to:** CI-00/03, OP-00/03, OM-04.

**Build:** versioned definitions for inquiry/booking/job cohorts, completed-job sales, invoices, collections, credits/refunds, approved labor, committed/actual cost, direct margin, stock availability, payroll readiness and migration coverage. Specify canonical IDs, grain, formula, unit, period/cutoff, allowed dimensions, exclusions and source quality needed for each claim.

**Deliverables:** dictionary, canonical join map, legacy-definition compatibility notes and exact expected-value examples. Preserve the existing KPI definitions rather than quietly strengthening their labels. Unknown labor cost remains unknown.

**Acceptance:** invoice/payment/assistance links do not double-count one outcome; weighted ratios use the approved numerator/denominator; zero denominator is handled; multi-job allocation reconciles to its source; mixed currency/basis cannot be added without an approved transformation.

**Handoff:** H04/H07/H10 and C05/C13/C19. **Excluded:** inventing statutory revenue recognition, payroll law or valuation policy.

### RCI-H03 | Define permission, privacy and quality policy inputs

**Priority / risk:** P1 / Tenant and sensitive data. **Depends on:** H01. **Review:** Security and Product. **Maps to:** CI-00/01, OP-00, OM-01/05.

**Build:** actor/location/entity/field access matrix and safe model/client projection rules. Separate individual wage access from operational readiness and authorized aggregate cost. Define source-specific freshness/coverage requirements, denial behavior, retention classifications, revocation events and cache-scope inputs.

**Deliverables:** decision table, negative-access cases and unresolved-policy register. Include repeated-query/subtotal inference, workspace switching, delegated accountant access, raw text injection and source-link authorization. Decisions requiring financial/security approval remain unapproved inputs, not hard-coded defaults.

**Acceptance:** a dispatcher cannot reconstruct a restricted wage through total differences; denied reads leak neither values nor existence; revoked recipients receive no cached private answer; production enforcement remains assigned to C04/C08 rather than claimed by a document.

**Handoff:** H04/H08/H12; C04/C08/C09/C27. **Excluded:** new roles, broader grants, provider credentials and global cross-tenant retrieval.

## 5. Sprint H2 | Typed evidence core

### RCI-H04 | Implement strict evidence, claim and answer schemas

**Priority / risk:** P1 / Shared contracts. **Depends on:** H02/H03. **Review:** shared-types owner and Security. **Maps to:** CI-01; the schema portion of CI-FOUNDATION-01.

**Build:** strict schemas for the contracts in Section 3, using existing repo conventions. Include definition version, facts, reproducible source manifest, per-source cutoff, quality, calculation inputs, claim class and non-executing action references. Use opaque server-bound scope references rather than trusting a user-supplied company ID.

**Deliverables:** versioned TypeScript/Zod schemas, examples and colocated valid/invalid contract tests. Production package adoption is C02; no route registration or legacy response mutation here.

**Acceptance:** malformed periods/units, unknown references, unexpected fields, invalid decimal values and final claims over incomplete mandatory facts fail validation. Complete, partial, unavailable and denied cases serialize without restricted server metadata. Legacy Command Center v1 stays unchanged.

**Handoff:** H05–H09 and C02/C04. **Excluded:** database writes, model calls and new live API endpoints.

### RCI-H05 | Implement domain-reader interfaces and capability descriptors

**Priority / risk:** P1 / Architecture. **Depends on:** H04. **Review:** domain owners. **Maps to:** CI-01/05, OP-00–09.

**Build:** typed request/result interfaces for jobs, estimates, invoices, workforce, inventory, costing, purchasing, forms, QBO/QBD reconciliation, migration and implementation readiness. Each descriptor specifies required versus optional evidence, permission purpose, pagination/completeness, watermark and supported filters.

**Deliverables:** interfaces, disabled/unsupported descriptors and synthetic adapters for contract testing only. Distinguish candidate capability, code present, configured, validated and enabled; these must not collapse into one Boolean.

**Acceptance:** unsupported adapters return an explicit capability gap; a tenant using QBO is not blocked by an irrelevant QBD adapter; source page limits are honored; mocked data cannot be imported through production startup. Every interface names its future C-ticket owner.

**Handoff:** C04/C05 and C11–C23. **Excluded:** production SQL, provider requests, inventing missing business records.

### RCI-H06 | Implement the supported-question recipe resolver

**Priority / risk:** P1 / Read planning. **Depends on:** H04/H05. **Review:** Product and read-service owner. **Maps to:** CI-02, OM-05/07.

**Build:** deterministic resolution for the existing 12 question recipes. Specify required/optional readers, subject, resolved dates, metric basis, safe fallback and maximum bounded work. Preserve explicit ambiguity when a missing period or metric would materially change the answer; question chips supply concrete scope without requiring a model.

**Deliverables:** recipe catalog, dependency resolver, selected-capability plan and tests for unsupported/partial requests. Catalog values are versioned rather than embedded in prompts.

**Acceptance:** unrelated data is not fetched; optional failure narrows the answer; essential failure blocks the associated conclusion; known user/company context is not repeatedly requested; prompt phrasing cannot widen permissions; unsupported arbitrary SQL/URLs are rejected.

**Handoff:** C04/C07/C24. **Excluded:** broad natural-language model routing and live tool orchestration.

### RCI-H07 | Implement deterministic quality and compatibility guards

**Priority / risk:** P1 / Money and correctness. **Depends on:** H02/H04/H05. **Review:** independent QA and financial-domain reviewer. **Maps to:** CI-03; remaining pure portion of CI-FOUNDATION-01.

**Build:** functions selecting complete/partial/unavailable answer state from required source quality; period, currency, grain and definition compatibility checks; canonical-ID deduplication and safe ratio/decimal handling. Existing tested arithmetic stays authoritative; do not create an alternative payroll or general ledger engine.

**Deliverables:** pure functions, failure-reason codes and regression tests. Use explicit fixture clocks and source cutoffs.

**Acceptance:** true zero survives; missing cost never increases final margin; source truncation forbids a full-shop claim; incompatible comparisons are stopped; duplicate economic IDs are not added twice; stale critical data blocks readiness. The $1,000 synthetic job with $354 direct cost yields $646 direct margin, with its unused $300 PO commitment separate.

**Handoff:** H08–H13; C04/C05/C13. **Excluded:** actual postings, valuation decisions and live auth enforcement.

## 6. Sprint H3 | Grounded answers and domain fixtures

### RCI-H08 | Implement claim validation and deterministic fallback

**Priority / risk:** P1 / Grounding. **Depends on:** H04/H06/H07. **Review:** QA and Security. **Maps to:** CI-03/04, OM-07.

**Build:** structured checks that every factual/numeric claim references permitted packet facts and registered calculations. Validate source handles and claim strength. Support a deterministic fact summary when model output is malformed, unsupported or unavailable. Separate observations, hypotheses, forecasts and proposed next steps.

**Deliverables:** claim/reference/numeric validators, safe link resolver contract and fallback answer formatter. Do not claim these structural checks alone prove arbitrary prose is semantically correct; model evaluation remains C07/C27.

**Acceptance:** fabricated values, unknown record IDs, unapproved formulas, model-created URLs, causal overclaims and executed-action wording are rejected or downgraded correctly. Evidence remains visible after narrative failure; no unbounded retry loop.

**Handoff:** C07/C24/C27. **Excluded:** model configuration, provider calls and claims of perfect hallucination prevention.

### RCI-H09 | Build a pure adapter for the existing Command Center brief

**Priority / risk:** P1 / Compatibility. **Depends on:** H04/H05/H07. **Review:** current Command Center owner and QA. **Maps to:** CI-05/06; preparation for CI-READ-01.

**Build:** a pure transformation from the existing typed brief into the proposed evidence/answer format. Retain legacy KPI definitions, periods, source references, source-display truncation and computational truncation separately. Include needs-you and existing review links without inventing costs or new actions.

**Deliverables:** transformation, compatibility tests and fixtures for populated/empty/partial/unavailable states. Confirm the exact current input contract before coding.

**Acceptance:** every carried value and definition matches the source brief; legacy missing/truncated flags survive; no unsupported financial claim is created; the adapter makes no database, network or authentication calls. Existing consumers continue to use v1 unchanged.

**Handoff:** C05/C06. **Excluded:** treating this pure adapter as a tenant-authenticated endpoint or live UI.

### RCI-H10 | Build workforce, cost, inventory and accounting contract fixtures

**Priority / risk:** P1 / Money. **Depends on:** H02/H05/H07. **Review:** relevant domain reviewer and independent QA. **Maps to:** CI-04, OP-02–06.

**Build:** synthetic fixtures and deterministic expectations for missing/effective-dated rates, overtime allocation inputs, committed versus actual cost, receipt/issue/bill non-duplication, fractional units, reservations, returns, historical cost changes, accounting mappings and uncertain provider outcomes.

**Deliverables:** test-only fixture modules and expected result assertions compatible with H04/H05. Model competing policy choices as separate unapproved scenarios; do not silently choose a lawful payroll policy or final valuation method.

**Acceptance:** purchase commitment is not expense; transfers preserve value; a later catalog change does not rewrite historical cost; unknown rate blocks complete payroll/margin; imported paid history is not re-exported as a new sale; a lost acknowledgment requires reconciliation.

**Handoff:** C11–C13/C16–C21. **Excluded:** financial state changes, payroll processing and live accounting certification.

### RCI-H11 | Build forms, migration and go-live readiness fixtures

**Priority / risk:** P1 / Data integrity. **Depends on:** H03/H05/H07. **Review:** operations/migration owner and QA. **Maps to:** CI-04, OP-07–09.

**Build:** versioned form requirement/submission cases, pending uploads, offline conflicts, import entity coverage, rejected rows, partial enqueue failures, source/cutover provenance, downstream-change rollback limits and implementation evidence gates.

**Deliverables:** readiness schemas/examples and test fixtures for migrated and fresh-start businesses. Separate mandatory unmet prerequisites from optional capabilities. Legacy forms that cannot be reconstructed remain read-only artifacts rather than fabricated executable templates.

**Acceptance:** form editing does not rewrite prior submissions; missing photos do not pass inspection; uploaded/committing is not reconciled; source IDs and counts reconcile; fresh-start can legitimately omit historical imports; stale configuration invalidates only affected launch gates.

**Handoff:** C14/C15/C22/C23. **Excluded:** file processing, migration execution, legal signature certification or business launch approval.

## 7. Sprint H4 | Evaluation, UI preparation and handoff

### RCI-H12 | Turn the acceptance catalog into an executable offline suite

**Priority / risk:** P1 / Security and QA. **Depends on:** H06–H11 as relevant. **Review:** independent QA/Security. **Maps to:** CI-04, existing CI-A01–CI-A24.

**Build:** executable assertions for every applicable existing acceptance case. Add independent negative mutations for wrong tenant/scope, leaked wages, missing sources, fabricated numbers, mixed cutoff, duplicate outcome, poisoned supplier text, unauthorized actions and replayed history. Unimplemented runtime/provider cases remain explicitly planned and mapped to C27, not skipped and counted as passing.

**Deliverables:** reproducible harness, case-to-test matrix, commands, actual pass/fail/not-executed results and exact-head evidence.

**Acceptance:** all fixture arithmetic and contract expectations execute; deliberate invalid mutations fail; model/database/browser cases are not mislabeled offline passes; early first-slice subset can be handed over separately.

**Handoff:** every C-ticket and C27. **Excluded:** claiming independent QA from self-run tests or production accuracy from fixtures.

### RCI-H13 | Implement pure proactive-detector and report-parity rules

**Priority / risk:** P2 / Operational correctness. **Depends on:** H06/H07/H08 and relevant H10/H11 data shapes. **Review:** Product and QA. **Maps to:** CI-08, OP-01, OM-08/10.

**Build:** testable rules for grouping related issues by canonical situation, ranking documented severity, snooze/deduplication semantics and resolving only from fresh source evidence. Define an answer/report comparison function using definition/version/cutoff/scope rather than rendered wording.

**Deliverables:** pure detector functions, proposed event-to-capability invalidation map and equality tests. Clearly label event names that are not yet implemented.

**Acceptance:** multiple events produce one situation where appropriate; proposed fixes do not mark it resolved; identical evidence yields identical numeric results; differing cutoff is labeled, not falsely reconciled. Notification preferences and authority remain external inputs.

**Handoff:** C09/C25. **Excluded:** queues, email/SMS sends, second schedulers and live subscriptions.

### RCI-H14 | Prepare exact UI states and design acceptance mapping

**Priority / risk:** P1 / Product experience. **Depends on:** H04/H06; may run beside H3. **Review:** independent Design/Product and QA. **Maps to:** CI-06/08, OM-06.

**Build:** answer-card, evidence drawer, contextual question, follow-up, missing-data and review-link behavior contracts. Locate actual canonical Figma frames for desktop/tablet/mobile and loading/empty/error states. Mark missing frames as design work, never invent node IDs. Preserve existing owner, office and field navigation.

**Deliverables:** exact-node mapping where it exists, state/copy matrix, accessibility assertions and component-test cases. Bounded presentational components can be built here only after their design and data contract are accepted; this ticket does not presume frames already exist.

**Acceptance:** uncertainty is visible; one question is answerable without visiting Reports; sources remain inspectable; restricted facts are absent; required touch/focus/navigation behavior is specified. Mock renders are not authenticated/Figma acceptance.

**Handoff:** C06/C15/C23 and C27. **Excluded:** unapproved redesign, fake product screenshots and replacement auth flows.

### RCI-H15 | Package portable contracts and incremental integration harness

**Priority / risk:** P1 / Integration. **Depends on:** reviewed H04–H09 and relevant H12 tests; final package adds H10–H14. **Review:** shared-package owner and QA. **Maps to:** CI-01–05.

**Build:** lock the accepted contract version, export manifest, known consumers, compatibility notes and a dependency-light harness Codex/Cursor can run in the real repo. Coordinate final file paths with C02; do not create a competing shared package or force production imports from documentation.

**Deliverables:** versioned foundation commit, changed-file manifest, synthetic-data marker, test commands and adoption checklist. Ship a minimal accepted subset early, then additive extensions with explicit version notes.

**Acceptance:** a clean checkout reproduces scoped type/unit/lint results; fixtures cannot enter production bundles; current v1 users do not break; unresolved decisions and runtime-unexecuted tests remain listed. No hidden reliance on chat state or secret values.

**Handoff:** C02/C04/C05, then all domain integrations. **Excluded:** build/deploy configuration changes unrelated to the package.

### RCI-H16 | Publish the exact-head handoff and acceptance ledger

**Priority / risk:** P1 / Release traceability. **Depends on:** H15; partial handoff allowed for accepted first-slice subset. **Review:** Technical Lead and independent QA. **Maps to:** CI-00/04, all OP/OM consumers.

**Build:** a start-here record containing exact branch/SHA, ticket/FS mappings, completed and pending acceptance, source baselines, decisions, commands, known risks and next smallest integration task. Keep GitHub and the existing Notion plan linked without rewriting governing instructions.

**Deliverables:** signed-off artifact manifest where reviews actually exist, dependency matrix, ownership record and reproducible handoff. No reviewer name or PASS is fabricated.

**Acceptance:** each artifact is readable from the recorded branch; claimed checks have actual evidence; no planned ticket is marked implemented; existing #445/#442 code/docs are not rebuilt; changed heads invalidate affected approvals. C01/C02 can start without waiting for the final all-domain handoff.

**Handoff:** C01–C28. **Excluded:** merges, production promotion, new live board assignments or automatic Phase II start.

## 8. Handoff map and release boundaries

| Foundation output | First integration consumer | Later consumers |
| --- | --- | --- |
| H01–H03 source/meaning/security | C01/C02/C04 | All operational and accounting adapters |
| H04–H07 schemas/recipes/quality | C04/C05 | C07/C09/C11–C25 |
| H08/H09 grounded answer and brief adapter | C05/C06/C07 | C24/C25 |
| H10 financial fixtures | C11/C12/C13 | C16–C21 |
| H11 readiness fixtures | C14/C15 | C22/C23 |
| H12 executable acceptance | C10 early pilot | C27 final risk-based acceptance |
| H13 detector/report rules | C09 | C25 |
| H14 UI/design mapping | C06 | C15/C23/C27 |
| H15/H16 versioned handoff | C02 incremental adoption | All subsequent consumers |

**First code sequence:** H01 source reconciliation → H02/H03 decisions → H04 schemas → H05/H06/H07 → H08/H09 and first-slice H12 tests → partial H15/H16 handoff → C04/C05/C06. Domain fixture work and design discovery proceed in parallel where dependencies permit.

### Definition of done for a foundation ticket

Code/deliverable exists; scoped tests actually ran; type/lint checks apply to the changed code; limitations and decisions are explicit; exact SHA and commands are recorded; relevant independent review is requested/completed truthfully; the downstream consumer and interface version are identified. Code written, tested, independently reviewed, merged, deployed and accepted are separate states.

No foundation ticket authorizes customer messages, payroll submission, purchases, payment activity, production accounting writes or deployment. All necessary production authorization and acceptance is in Document 2. There is no requirement to route useful read-only preparation through an obsolete E.. CoS gate; current founder/technical-lead governance remains controlling. [S5]

## 9. Source and traceability index

[S1] [Outcome Intelligence Engine charter](https://app.notion.com/p/40e317b92d158107a87ef66deb7ba2a1): platform responsibilities, first mission family and authority/evidence boundaries.

[S2] [Connected Intelligence specification](COMMAND-CENTER-CONNECTED-INTELLIGENCE-2026-11-06.md) and [original build plan](../planning/CONNECTED-INTELLIGENCE-BUILD-PLAN-2026-11-06.md), planning head `a49fb3def59302b705a7136b8a29d2bb7a3c2ed9`. This two-document split supplies its detailed tickets; it does not discard the prior scope.

[S3] Current source baseline recorded in the prior focused audit: `8d01e752377d2401cb2c6cdf235aa8dcbdde0aeb`. [Brief](https://github.com/SimonShaun2/Renvani/blob/8d01e752377d2401cb2c6cdf235aa8dcbdde0aeb/apps/api/src/services/command-center/command-center-brief.service.ts); [types](https://github.com/SimonShaun2/Renvani/blob/8d01e752377d2401cb2c6cdf235aa8dcbdde0aeb/packages/types/src/command-center.types.ts).

[S4] [Operations/finance/migration audit and specification](OPERATIONS-FINANCE-MIGRATION-2026-11-06.md): OP-00–OP-09 and source limitations. No new audit or application test is claimed by this sprint decomposition.

[S5] [Repository operating instructions](https://github.com/SimonShaun2/Renvani/blob/dev/AGENTS.md), [founder directive #420](https://github.com/SimonShaun2/Renvani/issues/420), [master plan](https://app.notion.com/p/40c317b92d15812b8ed9c7ead55480e4) and [Part II handoff](https://app.notion.com/p/40f317b92d15811281d3f387c4d1a9b3). Re-fetch current instructions before code changes.

[S6] [Existing question and acceptance catalog](../planning/connected-intelligence/foundation-catalog.v0_1.json): CI-Q01–CI-Q12 and CI-A01–CI-A24. Case descriptions are planning inputs, not executed tests.
