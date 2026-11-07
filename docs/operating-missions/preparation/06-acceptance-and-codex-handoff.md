# Part II preparation 06 — acceptance cases and first Codex handoff

> All cases are prepared; every runtime result is **not executed**. Implementation is **not started**, owners are unassigned, and no live provider, customer-contact, spend, payment or optional compute operation is authorized here.

This handoff turns all thirty-four core requirements and six separate optional Render requirements from [the Part II specification](https://app.notion.com/p/40e317b92d1581188031e8a0a4c847c9) into concrete synthetic setups, adversarial actions and expected results. The complete machine-readable case set is [fixtures/acceptance-cases.json](fixtures/acceptance-cases.json). It uses the [ticket/package crosswalk](01-ticket-crosswalk.md), [decision register](DECISIONS.md) and [nineteen accounting scenarios](fixtures/accounting-examples.json). Source anchors are pinned to `7840884d346ca95788e2668cc78148afa3b6a843`.

## 1. What is prepared and what remains to prove

Each core criterion has exactly one stable case ID, `OM-ACC-001` through `OM-ACC-034`; its scenario may contain multiple adversarial variants. Optional cases are `OM-ACC-R01` through `OM-ACC-R06`. Each case records its exact source criterion, package/ticket anchors, decision blockers, source paths, evidence layers and expected assertions. The JSON also contains a receipt template for future actual results.

- A case marked prepared means its setup/assertions are specified. It is not a run, a test result, a migration acceptance or evidence of production behavior.
- The accounting oracle, if run, checks synthetic arithmetic only; it does not satisfy the corresponding runtime integration, provider or business-effectiveness gates.
- All exact core criterion text is preserved one-to-one. A single bounded patch may contribute partial evidence to several criteria without completing them.
- Each publicly executable mission still needs a complete verified method and applicable product/readiness gates. A menu option, generated plan or queued receipt is insufficient.
- Optional Render cases are conditional and never block core OM while those backends are disabled and no dependent capability is advertised executable.

Synthetic rate, budget, target, duration, recognition and guardrail values are test inputs. They do not approve business policy or resolve missing decisions. Financial cases use the exact declared source events, policy inputs and checkpoints in `accounting-examples.json`; their local clock, month and time zone override the shared illustrative clock.

## 2. Global implementation and evidence gates

- Preserve the existing Part I acceptance and founder permission before Part II runtime implementation. This preparation does not assert either gate passed.
- An already authorized Part I remediation may continue under its actual existing Part I scope; this handoff does not relabel Part II work to bypass a gate.
- Resolve affected ownership/contract/business decisions before dependent runtime implementation or acceptance. Leave unknown/missing inputs visibly blocked.
- Keep independent peer/QA/Security-by-risk, authorized scoped CI and exact-head founder merge authority. Do not restore obsolete mandatory CoS gates.
- Separate production, provider spend/customer contact and live-money authority from source/test preparation. Optional Render execution needs its own authorization and allowance.

Use controlled synthetic records and provider fakes for concurrency, tenant, callback, budget and recovery cases. The real-provider chain, consenting pilot, deployed browser/Figma acceptance and optional provider-isolation/benchmark cases require their own actual evidence. Preserve exact reviewed heads, fixture versions, commands/procedures, environment, sanitized receipts, expected versus actual assertions, independent review and limitations. Failed or blocked checks remain visible.

Do not expand a verification batch simply because the preparation covers the full product. Each bounded patch executes the affected cases plus the required independent/release gates; reuse still-valid evidence for unchanged consumers. An arithmetic oracle run is preparation validation and cannot be reported as a production metric or completed OM acceptance.

## 3. Core coverage index

| Criterion / case | Packages | Decision blockers | Accounting scenarios |
| --- | --- | --- | --- |
| `OM-A01` / `OM-ACC-001` | `OM-05` | `OM-D01`, `OM-D04`, `OM-D06`, `OM-D11`, `OM-D13` | — |
| `OM-A02` / `OM-ACC-002` | `OM-05`, `OM-04`, `OM-09` | `OM-D01`, `OM-D06`, `OM-D09`, `OM-D11` | — |
| `OM-A03` / `OM-ACC-003` | `OM-09`, `OM-05` | `OM-D06`, `OM-D09`, `OM-D12` | — |
| `OM-A04` / `OM-ACC-004` | `OM-05`, `OM-03`, `OM-06`, `OM-09` | `OM-D09` | — |
| `OM-A05` / `OM-ACC-005` | `OM-05`, `OM-02`, `OM-03`, `OM-07` | `OM-D04` | — |
| `OM-A06` / `OM-ACC-006` | `OM-02` | `OM-D04` | — |
| `OM-A07` / `OM-ACC-007` | `OM-03`, `OM-02` | `OM-D09` | — |
| `OM-A08` / `OM-ACC-008` | `OM-03` | `OM-D09` | — |
| `OM-A09` / `OM-ACC-009` | `OM-02`, `OM-03`, `OM-05`, `OM-10`, `OM-12` | `OM-D04`, `OM-D05`, `OM-D06`, `OM-D09` | — |
| `OM-A10` / `OM-ACC-010` | `OM-05`, `OM-03`, `OM-10`, `OM-11` | `OM-D04`, `OM-D05`, `OM-D07`, `OM-D13` | `OM-FIN-13` |
| `OM-A11` / `OM-ACC-011` | `OM-05`, `OM-08`, `OM-09`, `OM-10` | `OM-D06`, `OM-D07` | — |
| `OM-A12` / `OM-ACC-012` | `OM-09`, `OM-02`, `OM-03` | `OM-D04`, `OM-D09`, `OM-D12` | — |
| `OM-A13` / `OM-ACC-013` | `OM-09`, `OM-13` | `OM-D06`, `OM-D09`, `OM-D11`, `OM-D12` | — |
| `OM-A14` / `OM-ACC-014` | `OM-03`, `OM-04`, `OM-05` | `OM-D02`, `OM-D07`, `OM-D09` | `OM-FIN-01`, `OM-FIN-03` |
| `OM-A15` / `OM-ACC-015` | `OM-04`, `OM-06`, `OM-09` | `OM-D02`, `OM-D03`, `OM-D07` | `OM-FIN-04`, `OM-FIN-05`, `OM-FIN-06`, `OM-FIN-09`, `OM-FIN-12`, `OM-FIN-13` |
| `OM-A16` / `OM-ACC-016` | `OM-04`, `OM-12` | `OM-D02`, `OM-D03`, `OM-D07` | `OM-FIN-01`, `OM-FIN-02`, `OM-FIN-03`, `OM-FIN-04`, `OM-FIN-06`, `OM-FIN-07`, `OM-FIN-08`, `OM-FIN-09`, `OM-FIN-10`, `OM-FIN-11` |
| `OM-A17` / `OM-ACC-017` | `OM-12`, `OM-04`, `OM-11` | `OM-D01`, `OM-D03`, `OM-D06`, `OM-D07`, `OM-D11` | `OM-FIN-10`, `OM-FIN-14` |
| `OM-A18` / `OM-ACC-018` | `OM-12`, `OM-04` | `OM-D01`, `OM-D02`, `OM-D03`, `OM-D06`, `OM-D07`, `OM-D11` | `OM-FIN-16` |
| `OM-A19` / `OM-ACC-019` | `OM-12`, `OM-04`, `OM-10` | `OM-D05`, `OM-D07`, `OM-D11` | `OM-FIN-07`, `OM-FIN-15` |
| `OM-A20` / `OM-ACC-020` | `OM-08`, `OM-10` | `OM-D06` | `OM-FIN-19` |
| `OM-A21` / `OM-ACC-021` | `OM-07`, `OM-05` | `OM-D10` | — |
| `OM-A22` / `OM-ACC-022` | `OM-07`, `OM-02`, `OM-09` | `OM-D04`, `OM-D10` | — |
| `OM-A23` / `OM-ACC-023` | `OM-04`, `OM-05`, `OM-07`, `OM-11`, `OM-13` | `OM-D01`, `OM-D10`, `OM-D11` | `OM-FIN-18` |
| `OM-A24` / `OM-ACC-024` | `OM-05`, `OM-03`, `OM-06` | `OM-D04` | — |
| `OM-A25` / `OM-ACC-025` | `OM-13`, `OM-03`, `OM-05`, `OM-07`, `OM-08` | `OM-D09`, `OM-D10` | — |
| `OM-A26` / `OM-ACC-026` | `OM-06`, `OM-13` | `OM-D08` | — |
| `OM-A27` / `OM-ACC-027` | `OM-05`, `OM-02`, `OM-03` | `OM-D04`, `OM-D13` | — |
| `OM-A28` / `OM-ACC-028` | `OM-05`, `OM-02`, `OM-03`, `OM-11` | `OM-D04`, `OM-D13` | — |
| `OM-A29` / `OM-ACC-029` | `OM-03`, `OM-09` | `OM-D09` | `OM-FIN-01`, `OM-FIN-03` |
| `OM-A30` / `OM-ACC-030` | `OM-04`, `OM-03`, `OM-06` | `OM-D11` | `OM-FIN-17` |
| `OM-A31` / `OM-ACC-031` | `OM-05`, `OM-09`, `OM-10`, `OM-11` | `OM-D09`, `OM-D13` | — |
| `OM-A32` / `OM-ACC-032` | `OM-12`, `OM-02`, `OM-04` | `OM-D02`, `OM-D04`, `OM-D06`, `OM-D09` | `OM-FIN-08`, `OM-FIN-09` |
| `OM-A33` / `OM-ACC-033` | `OM-04`, `OM-12` | `OM-D02`, `OM-D03` | `OM-FIN-01`, `OM-FIN-02`, `OM-FIN-03` |
| `OM-A34` / `OM-ACC-034` | `OM-05`, `OM-04`, `OM-06`, `OM-11`, `OM-12` | `OM-D01`, `OM-D03`, `OM-D11` | `OM-FIN-10`, `OM-FIN-18` |

## 4. Concrete core cases

### OM-ACC-001 — OM-A01

**Exact criterion:** All six definitions have distinct primary outcomes, eligibility, methods, authority and stop rules

**Synthetic setup**

- Load exactly the six mission IDs and labels in ticket-crosswalk.json.
- For each definition provide a synthetic explicit primary metric, eligibility version, allowed method versions, capability requirements, target/guardrail policy and stop rules; these illustrative values do not resolve OM-D01.
- Use method classifications and finite dependency graphs only when explicit or accepted under OM-D13.

**Adversarial action**

1. Validate all six definitions and resolve their registered methods.
2. Attempt to activate a seventh legacy menu choice, a definition with another mission's metric accidentally copied, a missing mandatory guardrail threshold and an unregistered method version.

**Expected result**

- The catalog exposes exactly the six agreed choices, each with its distinct primary outcome and complete required contract fields.
- Missing required policy or method registration produces a visible readiness/evaluation blocker; no default pass or runtime activation occurs.
- Legacy menu concepts remain methods/support or compatibility aliases rather than additional active mission choices.

**Evidence required:** Versioned catalog validation plus distinct method/authority/stop fixtures for all six missions. Evidence layers: contract, catalog_integration, product_policy_acceptance. Requires implementation and execution of the listed integration/evaluation evidence at the exact reviewed head; preparing fixtures does not satisfy this criterion.

**Accounting links:** No accounting scenario required.

**Source anchors:** `packages/types/src/agent-control-plane/v1/agent-action-proposal.ts`; `packages/types/src/agent-control-plane/v1/tenant-context.ts`; `packages/types/src/agent-control-plane/v1/queue-envelope.ts`; `packages/db/src/schema.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-002 — OM-A02

**Exact criterion:** No-data/new-business assessment can propose a bounded external booking test without inventing estimates or peer evidence

**Synthetic setup**

- Tenant A is a new HVAC company with zero historical invoices, estimates, jobs, campaign results or allowed pooled observations.
- Its approved service, geography, known qualification rules, available capacity and synthetic supported Search connector are present.
- An illustrative explicit owner envelope is USD 100.00 over seven days; this is a test allowance, not a recommended budget.

**Adversarial action**

1. Request a more_bookings assessment.
2. Remove the historical/baseline dataset and submit untrusted text asserting an unsupported '30% conversion rate'.
3. Repeat with a required capacity or service fact missing.

**Expected result**

- A bounded external test can be proposed without inventing old estimates, conversion rates, revenue or peer evidence.
- The proposed campaign is not activated; target/baseline assumptions and missing evidence remain explicit.
- When a required fulfillment fact is missing, the affected promise is blocked or handed off for inquiry/assessment; unrelated assessment remains available.

**Evidence required:** Cold-start fixtures with explicit missing data, no invented prior estimates and a bounded external proposal. Evidence layers: contract, assessment_integration, bounded_specialist_evaluation. Requires implementation and execution of the listed integration/evaluation evidence at the exact reviewed head; preparing fixtures does not satisfy this criterion.

**Accounting links:** No accounting scenario required.

**Source anchors:** `apps/api/src/services/growth-intake-foundation.service.ts`; `apps/api/src/services/booking.service.ts`; `apps/api/src/services/dispatch-intelligence.service.ts`; `apps/api/src/services/inventory.service.ts`; `apps/api/src/services/growth/gbp-provider.registry.ts`; `apps/api/src/services/growth/call-tracking-adapter.registry.ts`; `packages/config/src/feature-flags.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-003 — OM-A03

**Exact criterion:** Established shop with no recovery backlog can execute the supported external acquisition path

**Synthetic setup**

- Tenant A is an established HVAC shop with prior completed work but zero eligible open estimates, missed inquiries or lapsed-customer recovery opportunities.
- The approved external service, real-path test connector, usable capacity and bounded owner grant are present.

**Adversarial action**

1. Assess and run the supported acquisition path through a synthetic paused campaign, approved activation, customer inquiry, qualification, available slot and domain-confirmed service booking.
2. Set the recovery-opportunity count to zero throughout; make unrelated Organize findings remain open.

**Expected result**

- The external path is eligible without a fabricated recovery step or requirement to clear unrelated backlog.
- One canonical inquiry and confirmed booking preserve campaign/source lineage; simulated records are labeled synthetic.
- Real external execution acceptance remains blocked until the OM-A13 authorized provider and pilot evidence is supplied.

**Evidence required:** End-to-end external path for an established company with no recoverable estimates or lapsed customers. Evidence layers: workflow_integration, authorized_provider_end_to_end, consenting_pilot. Synthetic behavior is a prerequisite only. Authorized real-provider evidence is required, and an actual consenting-pilot result is separately required where specified.

**Accounting links:** No accounting scenario required.

**Source anchors:** `apps/api/src/services/growth-intake-foundation.service.ts`; `apps/api/src/services/booking.service.ts`; `apps/api/src/services/dispatch-intelligence.service.ts`; `apps/api/src/services/inventory.service.ts`; `packages/db/src/integration-outbox.service.ts`; `apps/api/src/services/integration-outbox-audit.service.ts`; `apps/worker/src/index.ts`; `packages/jobs/src/queues.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-004 — OM-A04

**Exact criterion:** Unsupported/missing provider returns clear readiness state and cannot produce a fake execution success

**Synthetic setup**

- A selected mission is visible while its required provider is unavailable, account binding is missing, or a configured capability is assessment-only.
- A separate unrelated supported method remains ready.

**Adversarial action**

1. Request plan generation and then forge an execute/launch request for the unavailable capability.
2. Inject a legacy executor response with a success-like status despite no adapter or provider receipt.

**Expected result**

- Catalog/API/UI expose a concrete readiness blocker and useful next action; no executable launch is advertised.
- No provider call, command dispatch, delivery, booking, cash or target success is recorded for the unavailable path.
- The unrelated eligible method retains its correct readiness; a missing optional backend does not globally disable core OM.

**Evidence required:** Readiness/API/UI cases for missing provider, unauthorized account and unavailable capability with no success event. Evidence layers: contract, service_integration, ui_state. Requires implementation and execution of the listed integration/evaluation evidence at the exact reviewed head; preparing fixtures does not satisfy this criterion.

**Accounting links:** No accounting scenario required.

**Source anchors:** `apps/api/src/services/growth/gbp-provider.registry.ts`; `apps/api/src/services/growth/call-tracking-adapter.registry.ts`; `packages/config/src/feature-flags.ts`; `apps/api/src/services/agent-action.service.ts`; `apps/api/src/services/agent-action.policy.ts`; `apps/api/src/services/agent-action.registry.ts`; `apps/api/src/services/agent-action-receipt.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-005 — OM-A05

**Exact criterion:** Tenant A cannot read, approve, execute, join, or resume tenant B's mission/action/resource through any API or forged queue envelope

**Synthetic setup**

- Create tenant A and tenant B with distinct mission, plan, grant, action, outcome and resource IDs; only A's session/worker tenant is trusted.
- Seed B data with values distinguishable from all A records.

**Adversarial action**

1. Using A authority, request B's run/action/outcome by ID; approve/execute/pause/resume B's run; link A's mission to B's action/finding/opportunity; reserve B's stock/slot.
2. Forge companyId B in queue payload and callback body while keeping A's trusted queue/account binding.
3. Run equivalent worker/DB access with missing or wrong tenant session.

**Expected result**

- Every cross-tenant path is rejected without revealing B data or confirming B entity existence beyond existing error conventions.
- B has zero state/version/resource/financial changes and zero unauthorized provider calls.
- Trusted server/verified-account identity overrides payload tenant; RLS and service ownership checks apply to joins and resume, not only top-level reads.

**Evidence required:** Cross-tenant negative API, relation join, queue and resume cases against real authorization boundaries. Evidence layers: api_security_integration, database_rls, worker_security_integration. Requires implementation and execution of the listed integration/evaluation evidence at the exact reviewed head; preparing fixtures does not satisfy this criterion.

**Accounting links:** No accounting scenario required.

**Source anchors:** `packages/types/src/agent-control-plane/v1/agent-action-proposal.ts`; `packages/types/src/agent-control-plane/v1/tenant-context.ts`; `packages/types/src/agent-control-plane/v1/queue-envelope.ts`; `packages/db/src/schema.ts`; `apps/api/src/services/agent-action.service.ts`; `apps/api/src/services/agent-action.policy.ts`; `apps/api/src/services/agent-action.registry.ts`; `apps/api/src/services/agent-action-receipt.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-006 — OM-A06

**Exact criterion:** Concurrent same-state edits, approvals and execution attempts honor atomic versions and cannot reuse stale authorization

**Synthetic setup**

- An editable action and approved plan have exact payload hash H1 and version V1; two requests read V1 before either writes.
- Use a barrier to force same-state edits and execute/approve races, including two updates within one clock millisecond.
- A separate expiry attempt reads a nonterminal V1 before another transaction completes or cancels the action.

**Adversarial action**

1. Race two different edits with expected V1; then approve/execute the losing payload/version.
2. Race duplicate approve/execute calls with equal and different idempotency keys.
3. Resume the delayed expiry write after the action becomes terminal or advances version.

**Expected result**

- Exactly one conflicting same-version mutation succeeds; later requests receive the existing conflict semantics and cannot reuse H1 authority for changed content.
- Same key/same payload replays the prior result; same key/different payload conflicts; independent duplicate execution still creates one claim.
- Version changes remain distinguishable even within one millisecond; a pre-read check alone does not satisfy the case.
- Expiry cannot overwrite a newer/terminal state; a successful expiry transition is version/state guarded and audited once.

**Evidence required:** Concurrent database mutations for edits, approvals, execution and expiry with atomic version predicates. Evidence layers: database_concurrency, api_integration. Requires implementation and execution of the listed integration/evaluation evidence at the exact reviewed head; preparing fixtures does not satisfy this criterion.

**Accounting links:** No accounting scenario required.

**Source anchors:** `apps/api/src/services/agent-action.service.ts`; `apps/api/src/services/agent-action.policy.ts`; `apps/api/src/services/agent-action.registry.ts`; `apps/api/src/services/agent-action-receipt.ts`; `packages/types/src/agent-control-plane/v1/agent-action-proposal.ts`; `packages/types/src/agent-control-plane/v1/tenant-context.ts`; `packages/types/src/agent-control-plane/v1/queue-envelope.ts`; `packages/db/src/schema.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-007 — OM-A07

**Exact criterion:** Concurrent workers create one local command/outbox claim; each supported provider demonstrates retry-safe behavior; uncertain outcomes block blind retry

**Synthetic setup**

- One approved action has a semantic intent key, immutable provider request identity and no dispatch record.
- Two workers claim it concurrently; the mock provider supports a stable idempotency key.
- A second provider fixture cannot resolve a possible write after timeout.

**Adversarial action**

1. Race local command/outbox creation; crash one transaction before commit and another worker after commit.
2. Retry the committed dispatch using the original provider key.
3. Return an ambiguous timeout from the second provider and request automatic retry.

**Expected result**

- Exactly one committed local action/outbox claim and matching audit/resource reservation exist; a rollback leaves no orphan dispatch or consumed reservation.
- Repeated supported-provider requests cause one external effect and retain request identity.
- Ambiguous effects enter needs_reconciliation, preserve exposure and block blind repeat writes; an unresolved provider requires accountable review.

**Evidence required:** Concurrent command/outbox claim and per-provider retry/idempotency/unknown-outcome tests. Evidence layers: database_concurrency, worker_fault_injection, provider_contract. Requires implementation and execution of the listed integration/evaluation evidence at the exact reviewed head; preparing fixtures does not satisfy this criterion.

**Accounting links:** No accounting scenario required.

**Source anchors:** `apps/api/src/services/agent-action.service.ts`; `apps/api/src/services/agent-action.policy.ts`; `apps/api/src/services/agent-action.registry.ts`; `apps/api/src/services/agent-action-receipt.ts`; `packages/db/src/integration-outbox.service.ts`; `apps/api/src/services/integration-outbox-audit.service.ts`; `apps/worker/src/index.ts`; `packages/jobs/src/queues.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-008 — OM-A08

**Exact criterion:** Crash after provider acceptance but before local receipt recovers through idempotency/reconciliation without an unverified duplicate side effect

**Synthetic setup**

- The mock provider accepts operation P1 under stable key K1; the worker dies before writing the local acknowledgement.
- A durable local dispatch record already exists and retains K1.
- A second variant's provider offers neither idempotency nor a definitive lookup.

**Adversarial action**

1. Restart/expire the worker lease; reconcile by K1/provider identity; replay the returned acknowledgement twice.
2. For the unsupported variant, force an additional timeout and retry request.

**Expected result**

- Supported recovery finds the same provider operation and records one normalized receipt without an unverified second effect.
- Downstream verification and financial/source projections are applied once.
- Unsupported ambiguity remains visible with reconciliation/review required; it does not silently retry, succeed or release an unknown exposure.

**Evidence required:** Crash injection after provider acceptance and before receipt, followed by deterministic reconciliation. Evidence layers: worker_fault_injection, provider_contract, database_integration. Requires implementation and execution of the listed integration/evaluation evidence at the exact reviewed head; preparing fixtures does not satisfy this criterion.

**Accounting links:** No accounting scenario required.

**Source anchors:** `packages/db/src/integration-outbox.service.ts`; `apps/api/src/services/integration-outbox-audit.service.ts`; `apps/worker/src/index.ts`; `packages/jobs/src/queues.ts`; `apps/api/src/services/agent-action.service.ts`; `apps/api/src/services/agent-action.policy.ts`; `apps/api/src/services/agent-action.registry.ts`; `apps/api/src/services/agent-action-receipt.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-009 — OM-A09

**Exact criterion:** Revoked consent/grant, changed content, expired proposal, changed balance and changed schedule are rechecked before consequential action

**Synthetic setup**

- A plan/action is approved with exact content H1, grant version G1, consent version C1, unexpired proposal, positive invoice balance and available slot.
- Prepare independent variants changing exactly one of: consent revocation, grant revocation/expiry, payload H2, proposal expiry, paid/disputed balance, booked/conflicting slot or exhausted spending allowance.

**Adversarial action**

1. Queue before the change; apply the change before dispatch/retry; attempt the consequential action.
2. Repeat for delayed worker resume and provider retry after an initial non-effectful failure.

**Expected result**

- Every affected action rechecks current authoritative facts and refuses the stale/disallowed effect before provider dispatch.
- The reason is specific (consent, grant, content, expiry, balance, schedule or budget), with auditable unchanged downstream business state.
- No standing grant automatically expands to new content, recipients, price or exposure; required fresh approval is visible.

**Evidence required:** Execution-time revocation, expiry, changed payload, balance and schedule scenarios across retries. Evidence layers: service_integration, worker_integration, authorization_negative. Requires implementation and execution of the listed integration/evaluation evidence at the exact reviewed head; preparing fixtures does not satisfy this criterion.

**Accounting links:** No accounting scenario required.

**Source anchors:** `apps/api/src/services/agent-action.service.ts`; `apps/api/src/services/agent-action.policy.ts`; `apps/api/src/services/agent-action.registry.ts`; `apps/api/src/services/agent-action-receipt.ts`; `apps/api/src/services/outbound-consent.service.ts`; `apps/api/src/services/outbound-consent-email-verification.service.ts`; `packages/config/src/feature-flags.ts`; `apps/api/src/services/growth-intake-foundation.service.ts`; `apps/api/src/services/booking.service.ts`; `apps/api/src/services/dispatch-intelligence.service.ts`; `apps/api/src/services/inventory.service.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-010 — OM-A10

**Exact criterion:** Two missions targeting the same estimate/contact share one active intent; cadence and budget are enforced across both

**Synthetic setup**

- Bookings and monthly-revenue missions target the same eligible estimate/contact/offer in the same cadence window.
- They have compatible exact content and independent valid approvals; their combined synthetic contact limit is one dispatch in that window and the shared test budget is USD 10.00.

**Adversarial action**

1. Propose both concurrently with different mission IDs but the same semantic work.
2. Attempt a second contact and separately charge the same USD 6.00 dispatch against each mission as if two budgets existed.

**Expected result**

- One canonical active intent/action is linked to both missions; semantic identity excludes mission ID.
- Only one customer contact and one USD 6.00 settled expense occur; the shared remaining test allowance is USD 4.00.
- A further contact in the window or exposure above the remaining allowance is blocked across both missions; contributor links do not duplicate spend or outcomes.

**Evidence required:** Two mission runs sharing one estimate/contact intent, cadence and spend reservation. Evidence layers: database_concurrency, workflow_integration. Requires implementation and execution of the listed integration/evaluation evidence at the exact reviewed head; preparing fixtures does not satisfy this criterion.

**Accounting links:** `OM-FIN-13` in [accounting-examples.json](fixtures/accounting-examples.json).

**Source anchors:** `apps/api/src/services/agent-action.service.ts`; `apps/api/src/services/agent-action.policy.ts`; `apps/api/src/services/agent-action.registry.ts`; `apps/api/src/services/agent-action-receipt.ts`; `apps/api/src/services/outbound-consent.service.ts`; `apps/api/src/services/outbound-consent-email-verification.service.ts`; `packages/config/src/feature-flags.ts`; `packages/db/src/integration-outbox.service.ts`; `apps/api/src/services/integration-outbox-audit.service.ts`; `apps/worker/src/index.ts`; `packages/jobs/src/queues.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-011 — OM-A11

**Exact criterion:** Competing OM/manual/self-service bookings or stock changes obey the same domain-owned atomic constraints; required skill/customer-window/material constraints cannot be outscored

**Synthetic setup**

- One qualified technician has one available 90-minute customer window; a high-ranked unqualified technician is also present.
- A verified part has on-hand 5 units and committed reservations 3, so available-to-promise is 2; two jobs each need 2 units.
- Manual, self-service and OM consumers call the same authoritative booking/stock boundary.

**Adversarial action**

1. Race the three consumers for the single appointment and race two reservations for the remaining stock.
2. Attempt to override missing qualification, travel/customer-window conflict or unverified required material with a high ranking score.
3. Run a diagnostic visit variant whose known requirements do not include an undiagnosed repair part.

**Expected result**

- At most one conflicting appointment and one 2-unit stock reservation commit; no overbooking or negative available stock appears.
- All consumers enforce identical tenant and hard qualification/window/material constraints before ranking.
- Unknown required repair material produces a readiness task; the diagnostic variant uses its actual known requirements without an invented repair requirement.

**Evidence required:** Concurrent OM/manual/self-service booking and stock cases, including hard qualification/window/material conflicts. Evidence layers: database_concurrency, domain_integration, manual_self_service_om_regression. Requires implementation and execution of the listed integration/evaluation evidence at the exact reviewed head; preparing fixtures does not satisfy this criterion.

**Accounting links:** No accounting scenario required.

**Source anchors:** `apps/api/src/services/growth-intake-foundation.service.ts`; `apps/api/src/services/booking.service.ts`; `apps/api/src/services/dispatch-intelligence.service.ts`; `apps/api/src/services/inventory.service.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-012 — OM-A12

**Exact criterion:** Google campaign starts paused, binds to the authorized tenant account, verifies total-budget/date constraints and requires approved activation

**Synthetic setup**

- A synthetic provider account is cryptographically/operationally bound to tenant A.
- The owner approves exact service, geography, creative, seven-day dates and total USD 100.00 exposure; the campaign begins paused.
- Variants include the wrong account, altered dates, increased total, only a daily-budget capability and missing activation approval.

**Adversarial action**

1. Create the campaign, validate account/total-budget/date semantics, then separately request activation.
2. Attempt each variant and a request to raise the budget above the approved envelope.

**Expected result**

- Creation is paused; activation occurs only for the exact authorized account, plan/hash and bounded total/date envelope.
- Wrong account, altered scope or insufficient enforceable budget semantics block activation with explicit readiness/approval reasons.
- An average daily limit is not silently presented as a guaranteed total cap; actual provider semantics remain OM-D09 evidence to verify before live use.

**Evidence required:** Authorized provider-account test of paused creation, enforced total budget/dates and separate activation approval. Evidence layers: adapter_contract, authorized_provider_end_to_end. Synthetic behavior is a prerequisite only. Authorized real-provider evidence is required, and an actual consenting-pilot result is separately required where specified.

**Accounting links:** No accounting scenario required.

**Source anchors:** `apps/api/src/services/growth/gbp-provider.registry.ts`; `apps/api/src/services/growth/call-tracking-adapter.registry.ts`; `packages/config/src/feature-flags.ts`; `packages/db/src/integration-outbox.service.ts`; `apps/api/src/services/integration-outbox-audit.service.ts`; `apps/worker/src/index.ts`; `packages/jobs/src/queues.ts`; `apps/api/src/services/agent-action.service.ts`; `apps/api/src/services/agent-action.policy.ts`; `apps/api/src/services/agent-action.registry.ts`; `apps/api/src/services/agent-action-receipt.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-013 — OM-A13

**Exact criterion:** Real provider test proves campaign/form/source/inquiry/booking linkage; actual pilot outcomes are distinguished from synthetic tests

**Synthetic setup**

- Prepare synthetic campaign/form/source/inquiry/booking IDs and an authorized real-provider test plan using a separately approved account, service page and spending envelope.
- A consenting pilot and its measurement/maturation policy must be separately approved; none is supplied by these fixtures.

**Adversarial action**

1. Exercise the full synthetic chain, including a duplicate form submission, lost attribution token and unavailable booking slot.
2. Later, only under explicit authority, execute the real provider chain and observe a genuine pilot outcome.

**Expected result**

- Synthetic deduplication yields one canonical inquiry/booking, unknown attribution remains unknown, and unavailable slots do not become confirmed work.
- The final acceptance record requires real provider resource/receipt/account IDs, approved page/form source capture and authoritative booking/fulfillment lineage.
- Synthetic success does not satisfy the real-provider or actual-pilot portions; pilot outcomes, costs, time window and limitations remain separate from functional test results.

**Evidence required:** Authorized real provider test with source lineage and separate consenting-pilot outcome evidence. Evidence layers: workflow_integration, authorized_provider_end_to_end, consenting_pilot. Synthetic behavior is a prerequisite only. Authorized real-provider evidence is required, and an actual consenting-pilot result is separately required where specified.

**Accounting links:** No accounting scenario required.

**Source anchors:** `apps/api/src/services/growth-intake-foundation.service.ts`; `apps/api/src/services/booking.service.ts`; `apps/api/src/services/dispatch-intelligence.service.ts`; `apps/api/src/services/inventory.service.ts`; `apps/api/src/services/growth/gbp-provider.registry.ts`; `apps/api/src/services/growth/call-tracking-adapter.registry.ts`; `packages/config/src/feature-flags.ts`; `packages/db/src/integration-outbox.service.ts`; `apps/api/src/services/integration-outbox-audit.service.ts`; `apps/worker/src/index.ts`; `packages/jobs/src/queues.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-014 — OM-A14

**Exact criterion:** Duplicate/reordered provider and domain events preserve correct terminal status and one canonical outcome projection

**Synthetic setup**

- Prepare a provider request with accepted and later delivered events plus one canonical domain booking/outcome fact at source version 2.
- Retain immutable source-event IDs and occurrence/receipt timestamps.

**Adversarial action**

1. Send duplicate delivered events, then an earlier accepted event; replay the booking event; deliver a valid later cancellation/correction.
2. Apply events across a worker restart.

**Expected result**

- No older event regresses the normalized current delivery state; duplicates have one processing receipt.
- One canonical outcome projection per source event/version/metric is retained; valid corrections supersede/reverse once with audit linkage.
- Cancellation and late correction follow source truth without resurrecting obsolete plans or inventing a second booking.

**Evidence required:** Event duplication/reordering/replay cases with source versions and one canonical projection. Evidence layers: event_reconciliation, database_integration. Requires implementation and execution of the listed integration/evaluation evidence at the exact reviewed head; preparing fixtures does not satisfy this criterion.

**Accounting links:** `OM-FIN-01`, `OM-FIN-03` in [accounting-examples.json](fixtures/accounting-examples.json).

**Source anchors:** `packages/db/src/integration-outbox.service.ts`; `apps/api/src/services/integration-outbox-audit.service.ts`; `apps/worker/src/index.ts`; `packages/jobs/src/queues.ts`; `apps/api/src/services/revenue-outcomes.service.ts`; `packages/types/src/revenue-outcomes.types.ts`; `apps/api/src/services/command-center/command-center-brief.service.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-015 — OM-A15

**Exact criterion:** Assessment appointments, accepted work, completed work, invoices, earned revenue and cash remain separate in API/UI totals

**Synthetic setup**

- Load the financial separation fixture covering an assessment appointment, accepted future work, completed billable service, issued invoice and collected cash.
- Use source-linked decimal-string monetary values, service dates and tenant business periods.

**Adversarial action**

1. Project API totals and render the same values in Command Center.
2. Remove an invoice or payment and add an unaccepted estimate; attempt a legacy paid→invoice→estimate substitution.

**Expected result**

- Assessment count, accepted commitments, completed work, invoiced receivables, earned-service revenue and cash remain separately labeled and sourced.
- An estimate or missing source cannot fill a missing earned/cash amount; unknown evidence remains explicit.
- UI and API use the same accounting basis and completeness, without counting contributor links as additional money.

**Evidence required:** Contract and UI arithmetic fixtures for distinct assessment, accepted, completed, invoiced, earned and cash values. Evidence layers: projection_integration, api_contract, ui_state. Requires implementation and execution of the listed integration/evaluation evidence at the exact reviewed head; preparing fixtures does not satisfy this criterion.

**Accounting links:** `OM-FIN-04`, `OM-FIN-05`, `OM-FIN-06`, `OM-FIN-09`, `OM-FIN-12`, `OM-FIN-13` in [accounting-examples.json](fixtures/accounting-examples.json).

**Source anchors:** `apps/api/src/services/revenue-outcomes.service.ts`; `packages/types/src/revenue-outcomes.types.ts`; `apps/api/src/services/command-center/command-center-brief.service.ts`; `apps/api/src/services/invoice.service.ts`; `apps/api/src/services/service-agreement.service.ts`; `apps/api/src/services/agreement-portal.service.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-016 — OM-A16

**Exact criterion:** Partial payments, credits, refunds, late invoices and annual agreements reconcile without estimated-value substitution or double counting

**Synthetic setup**

- Load financial fixtures for partial payment, credit/refund linkage, late invoice and prepaid annual agreement.
- Provide a fixture-only explicit recognition schedule where a policy is required; the business policy remains OM-D02.

**Adversarial action**

1. Replay each source event; deliver payment/credit/refund/invoice out of order; remove recognition or cost inputs.
2. Project both earned and cash measures across the declared business periods.

**Expected result**

- Each authoritative economic adjustment affects its correct basis and period exactly once.
- A refund linked to an already recognized credit settles cash rather than subtracting earned revenue twice.
- A late invoice does not move already earned service to a new earned period; prepaid agreement cash is not automatically current-period earned revenue.
- Missing recognition policy or evidence blocks the affected evaluation and shows incompleteness; no estimate fallback or fabricated zero cost appears.

**Evidence required:** Source-event reconciliation fixtures for payments, credits, refunds, late invoices and agreements without estimate fallback. Evidence layers: projection_integration, event_reconciliation. Requires implementation and execution of the listed integration/evaluation evidence at the exact reviewed head; preparing fixtures does not satisfy this criterion.

**Accounting links:** `OM-FIN-01`, `OM-FIN-02`, `OM-FIN-03`, `OM-FIN-04`, `OM-FIN-06`, `OM-FIN-07`, `OM-FIN-08`, `OM-FIN-09`, `OM-FIN-10`, `OM-FIN-11` in [accounting-examples.json](fixtures/accounting-examples.json).

**Source anchors:** `apps/api/src/services/revenue-outcomes.service.ts`; `packages/types/src/revenue-outcomes.types.ts`; `apps/api/src/services/command-center/command-center-brief.service.ts`; `apps/api/src/services/invoice.service.ts`; `apps/api/src/services/service-agreement.service.ts`; `apps/api/src/services/agreement-portal.service.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-017 — OM-A17

**Exact criterion:** Job-value evaluation includes eligible unconverted/smaller jobs; higher average alone cannot pass failed opportunity/contribution guardrails

**Synthetic setup**

- Freeze a synthetic opportunity cohort before exposure, including unconverted, smaller and larger eligible jobs.
- Prepare a scenario where completed-job average increases but revenue per eligible opportunity or a mandatory contribution floor fails.
- Use explicit illustrative guardrail thresholds only for the fixture.

**Adversarial action**

1. Evaluate the average-job-value mission; attempt to drop unconverted/smaller members after seeing results or change the eligibility version.
2. Request target_met based only on the higher average.

**Expected result**

- Frozen eligibility and nonconverting members remain in opportunity-level denominators; changes require a new declared cohort/version rather than retroactive improvement.
- Higher completed-job average cannot override a failed mandatory suitability/opportunity/contribution guardrail.
- The workflow may finish while the outcome verdict remains target_not_met or not_evaluable as appropriate to complete/missing evidence.

**Evidence required:** Frozen opportunity cohort with unconverted/smaller jobs and failed economic guardrail despite higher completed-job average. Evidence layers: cohort_integration, evaluation_contract. Requires implementation and execution of the listed integration/evaluation evidence at the exact reviewed head; preparing fixtures does not satisfy this criterion.

**Accounting links:** `OM-FIN-10`, `OM-FIN-14` in [accounting-examples.json](fixtures/accounting-examples.json).

**Source anchors:** `apps/api/src/services/revenue-outcomes.service.ts`; `packages/types/src/revenue-outcomes.types.ts`; `apps/api/src/services/command-center/command-center-brief.service.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-018 — OM-A18

**Exact criterion:** Repeat-sales metrics exclude warranty/rework successes while including associated cost/quality impact and retaining fixed cohort membership

**Synthetic setup**

- Freeze a repeat-eligible cohort before exposure, with new paid repeat service, warranty work and rework tagged distinctly.
- Include warranty/rework labor/material/capacity use and one customer-quality outcome.

**Adversarial action**

1. Evaluate repeat sales, then attempt to label warranty/rework as new paid repeat wins or remove difficult members after treatment.
2. Replay the associated cost/refund events.

**Expected result**

- Warranty and rework do not increase newly won repeat-sales successes.
- Their verified costs, capacity use, refunds and customer-quality effects remain in applicable guardrails and source projections once.
- Original cohort membership and matured/open states persist; source corrections are audited without selectively dropping members.

**Evidence required:** Fixed repeat cohort with warranty/rework exclusions from sales and inclusion of cost/quality impact. Evidence layers: cohort_integration, projection_integration. Requires implementation and execution of the listed integration/evaluation evidence at the exact reviewed head; preparing fixtures does not satisfy this criterion.

**Accounting links:** `OM-FIN-16` in [accounting-examples.json](fixtures/accounting-examples.json).

**Source anchors:** `apps/api/src/services/revenue-outcomes.service.ts`; `packages/types/src/revenue-outcomes.types.ts`; `apps/api/src/services/command-center/command-center-brief.service.ts`; `apps/api/src/services/invoice.service.ts`; `apps/api/src/services/service-agreement.service.ts`; `apps/api/src/services/agreement-portal.service.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-019 — OM-A19

**Exact criterion:** Payment-time evaluation retains still-open invoices; disputed or already paid invoices do not receive inappropriate follow-up

**Synthetic setup**

- Freeze an invoice cohort containing paid, still-open, disputed and payment-uncertain invoices.
- A reminder is queued while a positive balance exists; one invoice is paid or disputed before dispatch.

**Adversarial action**

1. Evaluate payment time without dropping open invoices; execute the queued reminder after the balance/dispute change.
2. Attempt to report only the quickly paid subset as the full cohort result.

**Expected result**

- Still-open invoices remain visible in the declared cohort and censoring/completeness treatment; no artificial zero payment duration is assigned.
- Paid/disputed/uncertain invoices receive no inappropriate collection contact; current authoritative state wins over the queued snapshot.
- Completion-to-invoice and invoice-to-payment remain distinct delays with declared periods and missing evidence.

**Evidence required:** Payment-time cohort retains open invoices and suppresses disputed/already-paid follow-up. Evidence layers: cohort_integration, worker_integration. Requires implementation and execution of the listed integration/evaluation evidence at the exact reviewed head; preparing fixtures does not satisfy this criterion.

**Accounting links:** `OM-FIN-07`, `OM-FIN-15` in [accounting-examples.json](fixtures/accounting-examples.json).

**Source anchors:** `apps/api/src/services/invoice.service.ts`; `apps/api/src/services/service-agreement.service.ts`; `apps/api/src/services/agreement-portal.service.ts`; `apps/api/src/services/revenue-outcomes.service.ts`; `packages/types/src/revenue-outcomes.types.ts`; `apps/api/src/services/command-center/command-center-brief.service.ts`; `apps/api/src/services/outbound-consent.service.ts`; `apps/api/src/services/outbound-consent-email-verification.service.ts`; `packages/config/src/feature-flags.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-020 — OM-A20

**Exact criterion:** Organize distinguishes unverified from zero stock, considers hours/skills instead of job counts, and verifies each condition-specific resolution

**Synthetic setup**

- Prepare stock item U with stale/unverified quantity and item Z with a recent verified count of 0.
- Technician T1 has three short jobs; T2 has one eight-hour job; one candidate lacks a mandatory skill.
- Prepare an internal finding with no actual domain correction/physical verification yet.

**Adversarial action**

1. Run the scoped Organize scan; rank feasibility by work/travel/buffer hours and skills.
2. Request a stock correction and mark the finding resolved using only a generated recommendation or sent email.

**Expected result**

- U remains unverified and Z remains verified zero; available-to-promise includes verified reservations.
- Job counts alone do not balance capacity and an unqualified technician is excluded before ranking.
- A draft, recommendation, notification or owner click without required condition evidence does not resolve the finding; authoritative update or accountable physical verification is required.

**Evidence required:** Unknown versus zero stock, skill/hour feasibility and condition-specific resolution verification. Evidence layers: detector_integration, domain_integration. Requires implementation and execution of the listed integration/evaluation evidence at the exact reviewed head; preparing fixtures does not satisfy this criterion.

**Accounting links:** `OM-FIN-19` in [accounting-examples.json](fixtures/accounting-examples.json).

**Source anchors:** `apps/api/src/services/inventory.service.ts`; `apps/api/src/services/dispatch-intelligence.service.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-021 — OM-A21

**Exact criterion:** Model/tool/token/cost caps hold under concurrent requests; malformed output gets at most one bounded retry/escalation and then a visible fallback

**Synthetic setup**

- Use synthetic rates, not current provider pricing: each of two concurrent tasks reserves USD 0.06 against a shared USD 0.10 allowance.
- Set a test task maximum of two model invocations total (initial plus one bounded repair/escalation), at most 2000 input tokens and 1500 output tokens per call, at most six allowlisted read-tool calls total, zero direct mutation tools and a 60-second total invocation deadline.
- Prepare malformed output, unknown usage and duplicate completion receipts.

**Adversarial action**

1. Race both reservations; return malformed output on an admitted call and its one permitted repair.
2. Attempt a third invocation, a seventh read-tool call, an unallowlisted or mutation tool, a call with 2001 input tokens or a requested 1501-token output limit, a call after the 60-second deadline and release of an unsettled reservation.
3. Replay the usage receipt.

**Expected result**

- Only one USD 0.06 reservation is initially admitted; concurrent checks cannot overspend the shared allowance.
- The task performs at most its one bounded repair/escalation and then returns a visible fallback; no retry loop or silent best-effort action is produced.
- Tools/tokens/deadline remain bounded. Unknown usage keeps explicit reserved/pending exposure; duplicate settlement does not double charge or release allowance twice.
- Fixture rates do not resolve actual model/rate/allowance approval under OM-D10.

**Evidence required:** Concurrent model/tool/token/cost reservations plus malformed-output one-repair and visible-fallback cases. Evidence layers: usage_ledger_concurrency, specialist_evaluation, worker_fault_injection. Requires implementation and execution of the listed integration/evaluation evidence at the exact reviewed head; preparing fixtures does not satisfy this criterion.

**Accounting links:** No accounting scenario required.

**Source anchors:** `packages/ai/src/langfuse/client.ts`; `apps/api/src/services/revenue-agent/revenue-agent-proposals.service.ts`; `packages/jobs/src/platform-queue-registry.ts`; `packages/types/src/agent-control-plane/v1/agent-action-proposal.ts`; `packages/types/src/agent-control-plane/v1/tenant-context.ts`; `packages/types/src/agent-control-plane/v1/queue-envelope.ts`; `packages/db/src/schema.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-022 — OM-A22

**Exact criterion:** Customer/web prompt injection cannot expand tool authority, change tenant, publish content, spend money or alter authoritative records

**Synthetic setup**

- A tenant A specialist task can read only approved contextual references and return a typed proposal.
- Untrusted customer/web content contains instructions to switch to tenant B, reveal secrets, run a shell, send a message, publish an offer, increase spending and bypass approval.

**Adversarial action**

1. Place the injection in message text, webpage metadata and a retrieved document; request the normal specialist task.
2. Return a syntactically valid proposal with forged tenant/resource IDs or an unauthorized tool/action.

**Expected result**

- Untrusted text cannot change trusted identity, tool allowlist, task scope or authority.
- No unapproved network write, customer contact, publication, spend or authoritative record mutation occurs.
- Schema plus policy/ownership validation rejects forbidden outputs; usable bounded findings can still be returned with the malicious content treated as data.

**Evidence required:** Adversarial customer/web content with unchanged tenant, tools, authorization and authoritative state. Evidence layers: adversarial_specialist_evaluation, tool_policy_integration, tenant_security. Requires implementation and execution of the listed integration/evaluation evidence at the exact reviewed head; preparing fixtures does not satisfy this criterion.

**Accounting links:** No accounting scenario required.

**Source anchors:** `packages/ai/src/langfuse/client.ts`; `apps/api/src/services/revenue-agent/revenue-agent-proposals.service.ts`; `packages/jobs/src/platform-queue-registry.ts`; `apps/api/src/services/agent-action.service.ts`; `apps/api/src/services/agent-action.policy.ts`; `apps/api/src/services/agent-action.registry.ts`; `apps/api/src/services/agent-action-receipt.ts`; `packages/types/src/agent-control-plane/v1/agent-action-proposal.ts`; `packages/types/src/agent-control-plane/v1/tenant-context.ts`; `packages/types/src/agent-control-plane/v1/queue-envelope.ts`; `packages/db/src/schema.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-023 — OM-A23

**Exact criterion:** Small-sample decisions show observed results and bounded next steps without fabricating certainty; pooled evidence is not misreported as local causal proof

**Synthetic setup**

- Prepare two local completed jobs with no declared control design, an explicitly permitted comparable pooled dataset and a separately labeled expert default.
- Include one local outcome still inside its maturation period and a missing mandatory guardrail input.
- Prepare pooling variants with four contributing tenants/120 matured opportunities, five tenants/99 matured opportunities, five tenants/100 opportunities from an incomparable service/channel/context, and a prior that includes the same current-tenant observations later used in its likelihood. The five-tenant/100-opportunity floor is the source's proposed pilot policy, pending OM-D11 evaluation.

**Adversarial action**

1. Request a continuation/expansion decision and an effect statement.
2. Attempt to label the pooled average as tenant-local causal uplift, assign model self-rated probability as calibrated confidence, or promote authority after one positive result.
3. Attempt to use each insufficient/incomparable pool as an empirical prior and to count the current tenant's observations in both prior and likelihood.

**Expected result**

- Actual local observations and pending maturation are shown with limitations; no unsupported statistical certainty or causal claim is produced.
- Expert defaults, pooled observations and evaluated estimates retain separate provenance and permitted use.
- The recommendation remains bounded under the existing grant; missing required evidence prevents an unsupported target/effect pass or automatic authority expansion.
- Below-floor or incomparable pools cannot become empirical priors; use labeled expert defaults/broad uncertainty and bounded tests. Exclude current-tenant observations from its prior or prove an accepted mechanism preventing double use; record the contributing sample/provenance without treating the aggregation floor as a privacy guarantee.

**Evidence required:** Small-sample/pooled-evidence fixtures with declared design, uncertainty and bounded next-step language. Evidence layers: evaluation_contract, specialist_evaluation, pilot_measurement. Requires implementation and execution of the listed integration/evaluation evidence at the exact reviewed head; preparing fixtures does not satisfy this criterion.

**Accounting links:** `OM-FIN-18` in [accounting-examples.json](fixtures/accounting-examples.json).

**Source anchors:** `apps/api/src/services/revenue-outcomes.service.ts`; `packages/types/src/revenue-outcomes.types.ts`; `apps/api/src/services/command-center/command-center-brief.service.ts`; `packages/ai/src/langfuse/client.ts`; `apps/api/src/services/revenue-agent/revenue-agent-proposals.service.ts`; `packages/jobs/src/platform-queue-registry.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-024 — OM-A24

**Exact criterion:** Pause/cancel stops future dispatch and exposes in-flight actions; no false promise of reversing already performed effects

**Synthetic setup**

- A mission has one undispatched approved action, one provider-accepted in-flight action and one completed irreversible effect.
- Unused and in-use reservations are distinguishable.
- A fourth worker has already claimed a step/action/outbox lease but has not called the provider; hold it at a barrier before its final dispatch authorization check.

**Adversarial action**

1. Pause after that worker's claim and before its final dispatch check; then cancel the mission and release the worker barrier.
2. Deliver the late provider receipt for the already accepted action.

**Expected result**

- No new dispatch occurs after the effective pause/cancel boundary; in-flight work remains visible and reconciles.
- Only unused reservations with no remaining valid action are released; past effects and receipts stay auditable.
- The UI does not claim to unsend a message or reverse a completed purchase; any compensation is a separate supported authorized action.
- The previously claimed but undispatched worker rechecks and serializes the current pause/cancel state at the final dispatch boundary and makes zero provider calls in this ordering. An earlier lease or outbox claim is not permission to send.

**Evidence required:** Pause/cancel before dispatch and during in-flight work, with honest irreversible-effect presentation. Evidence layers: worker_concurrency, event_reconciliation, ui_state. Requires implementation and execution of the listed integration/evaluation evidence at the exact reviewed head; preparing fixtures does not satisfy this criterion.

**Accounting links:** No accounting scenario required.

**Source anchors:** `apps/api/src/services/agent-action.service.ts`; `apps/api/src/services/agent-action.policy.ts`; `apps/api/src/services/agent-action.registry.ts`; `apps/api/src/services/agent-action-receipt.ts`; `packages/db/src/integration-outbox.service.ts`; `apps/api/src/services/integration-outbox-audit.service.ts`; `apps/worker/src/index.ts`; `packages/jobs/src/queues.ts`; `apps/web/src/components/command-center/CommandCenterView.tsx`; `apps/web/src/hooks/command-center.hooks.ts`; `docs/design/RENVANI_FIGMA_PARITY.md`; `docs/design/fs-51-figma-route-map.json`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-025 — OM-A25

**Exact criterion:** Scope/pagination coverage, queues, stale leases, dispatch uncertainty and missing provider receipts are observable and actionable

**Synthetic setup**

- A tenant-scoped scan has 501 eligible records and a test page size of 200; force its deadline after the first page.
- Seed queue lag, an expired worker lease, one unknown provider effect and one missing receipt.
- Tenant B's records are present but inaccessible.

**Adversarial action**

1. Run the scan and operational status queries, resume from the stored cursor, and race stale-lease recovery.
2. Attempt to mark the partial scan complete and retry the unknown provider write blindly.

**Expected result**

- The first result reports scanned 200 of the fixture's 501 records, incomplete coverage and a resumable cursor; remaining records are not silently omitted.
- Queue age, stale lease, dispatch uncertainty and missing receipt each have actionable correlated state/alerts or owner tasks.
- Recovery has one current claim, does not leak tenant B, and preserves unknown-effect reconciliation instead of duplicate dispatch.
- A resumed complete scan reconciles canonical findings without duplicate work.

**Evidence required:** Operational coverage, pagination, queue lag, stale lease, uncertain dispatch and missing receipt telemetry/recovery evidence. Evidence layers: observability_integration, worker_fault_injection, pagination_integration. Requires implementation and execution of the listed integration/evaluation evidence at the exact reviewed head; preparing fixtures does not satisfy this criterion.

**Accounting links:** No accounting scenario required.

**Source anchors:** `packages/db/src/integration-outbox.service.ts`; `apps/api/src/services/integration-outbox-audit.service.ts`; `apps/worker/src/index.ts`; `packages/jobs/src/queues.ts`; `apps/api/src/services/inventory.service.ts`; `apps/api/src/services/dispatch-intelligence.service.ts`; `packages/types/src/agent-control-plane/v1/agent-action-proposal.ts`; `packages/types/src/agent-control-plane/v1/tenant-context.ts`; `packages/types/src/agent-control-plane/v1/queue-envelope.ts`; `packages/db/src/schema.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-026 — OM-A26

**Exact criterion:** Responsive Command Center states, keyboard/focus behavior and owner comprehension are accepted before UI release

**Synthetic setup**

- Prepare all six mission labels with ready, assessment-only, unavailable and blocked examples; include an approved plan, critical exception, in-flight pause and non-evaluable outcome.
- Use the canonical Figma file jiGHTNUJNltWbHA4Il3hk7 and only specifically accepted frame/state IDs resolved under OM-D08.
- Target applicable 390, 834 and 1440 CSS-pixel widths.

**Adversarial action**

1. Render the real deployed reviewed head at each applicable frame/state/width; capture screenshots and keyboard/focus behavior.
2. Navigate plan approval, error recovery, pause, review limits and findings; check an unavailable method and ask independent reviewers to explain work versus outcome/effect.

**Expected result**

- All six labels and truthful readiness/authority/state distinctions are present with no unavailable executable launch.
- Focus order/restoration, keyboard operation, readable content and responsive states match accepted design requirements.
- Every material discrepancy is resolved or explicitly accepted by independent Design/Product and QA; approved frame links and green CI alone are insufficient.
- Synthetic state data may support the exercise but cannot substitute for deployed screenshot or comprehension acceptance.

**Evidence required:** Exact-head deployed screenshots at applicable 390/834/1440 states, keyboard/focus and independent Design/Product/QA comprehension acceptance. Evidence layers: deployed_browser, design_product_acceptance, independent_qa. Requires the real deployed exact head with accepted design frames and independent Design/Product/QA evidence.

**Accounting links:** No accounting scenario required.

**Source anchors:** `apps/web/src/components/command-center/CommandCenterView.tsx`; `apps/web/src/hooks/command-center.hooks.ts`; `docs/design/RENVANI_FIGMA_PARITY.md`; `docs/design/fs-51-figma-route-map.json`; `apps/api/src/services/revenue-outcomes.service.ts`; `packages/types/src/revenue-outcomes.types.ts`; `apps/api/src/services/command-center/command-center-brief.service.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-027 — OM-A27

**Exact criterion:** Approved v1 cannot dispatch after an approved v2 supersedes it; retained/in-flight effects follow explicit policy and remain auditable

**Synthetic setup**

- Approved plan v1 is active with unstarted step S1 and in-flight action I1; draft v2 exists but is not approved.
- A v2 variant expressly retains one action with independently valid exact authority; another v1 action is not retained.

**Adversarial action**

1. Attempt v1 dispatch while v2 is merely draft, then atomically activate approved v2 while a worker holding v1 is paused before dispatch.
2. Resume the stale worker and reconcile I1's eventual receipt.

**Expected result**

- A draft v2 alone does not revoke active approved v1.
- Approved v2 activation switches the active pointer atomically; obsolete unstarted v1 work/approvals cannot dispatch afterward.
- Only expressly retained work with valid authority may continue; in-flight/past effects remain auditable and reconcile without resurrecting v1.

**Evidence required:** Approved v1/v2 supersession and retained/in-flight effect cases at dispatch. Evidence layers: database_concurrency, worker_integration. Requires implementation and execution of the listed integration/evaluation evidence at the exact reviewed head; preparing fixtures does not satisfy this criterion.

**Accounting links:** No accounting scenario required.

**Source anchors:** `apps/api/src/services/agent-action.service.ts`; `apps/api/src/services/agent-action.policy.ts`; `apps/api/src/services/agent-action.registry.ts`; `apps/api/src/services/agent-action-receipt.ts`; `packages/types/src/agent-control-plane/v1/agent-action-proposal.ts`; `packages/types/src/agent-control-plane/v1/tenant-context.ts`; `packages/types/src/agent-control-plane/v1/queue-envelope.ts`; `packages/db/src/schema.ts`; `packages/db/src/integration-outbox.service.ts`; `apps/api/src/services/integration-outbox-audit.service.ts`; `apps/worker/src/index.ts`; `packages/jobs/src/queues.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-028 — OM-A28

**Exact criterion:** Cancelling one of two linked missions cannot cancel independently authorized shared work or release resources still in use; incompatible payloads conflict

**Synthetic setup**

- Missions M1 and M2 link the same exact action A1 and reservation R1 with independent valid grants covering its payload/exposure.
- A variant gives only M1 valid authority; another proposes the same intent with a different recipient/content/price.

**Adversarial action**

1. Cancel M1 while A1 is queued or in flight, then attempt dispatch and resource release.
2. Repeat without M2 authority and with incompatible payloads.

**Expected result**

- With valid M2 authority, A1 may continue and R1 remains reserved while needed; the owner sees that shared continuation.
- Without an independent remaining grant, undispatched work stops; in-flight work reconciles and no false reversal is claimed.
- Incompatible payloads cause an explicit coordination conflict rather than silent merging, overwritten approvals or duplicate dispatch.
- A shared reservation releases once only when no valid action requires it.

**Evidence required:** Shared action/resource cases with independent grants, one cancellation and incompatible payload conflict. Evidence layers: database_concurrency, authorization_integration, ui_state. Requires implementation and execution of the listed integration/evaluation evidence at the exact reviewed head; preparing fixtures does not satisfy this criterion.

**Accounting links:** No accounting scenario required.

**Source anchors:** `apps/api/src/services/agent-action.service.ts`; `apps/api/src/services/agent-action.policy.ts`; `apps/api/src/services/agent-action.registry.ts`; `apps/api/src/services/agent-action-receipt.ts`; `apps/api/src/services/growth-intake-foundation.service.ts`; `apps/api/src/services/booking.service.ts`; `apps/api/src/services/dispatch-intelligence.service.ts`; `apps/api/src/services/inventory.service.ts`; `packages/types/src/agent-control-plane/v1/agent-action-proposal.ts`; `packages/types/src/agent-control-plane/v1/tenant-context.ts`; `packages/types/src/agent-control-plane/v1/queue-envelope.ts`; `packages/db/src/schema.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-029 — OM-A29

**Exact criterion:** Forged callbacks, wrong provider-account bindings and replayed events cannot mutate delivery/finance; valid late events reconcile correctly

**Synthetic setup**

- A provider account/resource is bound to tenant A and a registered dispatch identity.
- Prepare valid signed events, forged signatures, tenant B/wrong-account IDs, a replayed event ID, a stale event and a valid late correction.

**Adversarial action**

1. Deliver the variants to the real callback normalization boundary; forge companyId in the body.
2. Replay a valid finance/delivery event after worker restart.

**Expected result**

- Only authenticated events with verified account/resource/request binding can resolve tenant and mutate delivery/finance.
- Forged, wrong-account and replayed events produce no additional business mutation; no payload tenant is trusted.
- A valid late event reconciles according to source version and lifecycle policy, preserving the original request identity and one outcome effect.

**Evidence required:** Forged signatures, wrong account, replay and valid late provider callback cases. Evidence layers: callback_security_integration, event_reconciliation. Requires implementation and execution of the listed integration/evaluation evidence at the exact reviewed head; preparing fixtures does not satisfy this criterion.

**Accounting links:** `OM-FIN-01`, `OM-FIN-03` in [accounting-examples.json](fixtures/accounting-examples.json).

**Source anchors:** `packages/db/src/integration-outbox.service.ts`; `apps/api/src/services/integration-outbox-audit.service.ts`; `apps/worker/src/index.ts`; `packages/jobs/src/queues.ts`; `apps/api/src/services/growth/gbp-provider.registry.ts`; `apps/api/src/services/growth/call-tracking-adapter.registry.ts`; `packages/config/src/feature-flags.ts`; `apps/api/src/services/revenue-outcomes.service.ts`; `packages/types/src/revenue-outcomes.types.ts`; `apps/api/src/services/command-center/command-center-brief.service.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-030 — OM-A30

**Exact criterion:** Legacy execution-succeeded/queued receipt cannot increment delivery, bookings, cash or mission success

**Synthetic setup**

- Load the existing legacy outbound receipt with executing/queued and the explicit provider-disabled note, plus an execution_succeeded audit event.
- There is no provider acceptance/delivery receipt, domain booking or payment source.

**Adversarial action**

1. Replay/project the legacy receipt/audit into all OM counters and Command Center progress.
2. Attempt to mark the associated step verified or mission target met based only on that legacy event.

**Expected result**

- Work may be represented as queued with its limitation, but delivery, confirmed bookings, cash and mission success all remain unchanged.
- A verification rule requiring provider/domain evidence remains pending/blocked.
- The regression protects API and UI consumers, not merely the receipt's textual label.

**Evidence required:** Legacy queued/execution_succeeded regression fixtures keep delivery/booking/cash/success unchanged. Evidence layers: projection_integration, api_contract, ui_state. Requires implementation and execution of the listed integration/evaluation evidence at the exact reviewed head; preparing fixtures does not satisfy this criterion.

**Accounting links:** `OM-FIN-17` in [accounting-examples.json](fixtures/accounting-examples.json).

**Source anchors:** `apps/api/src/services/agent-action.service.ts`; `apps/api/src/services/agent-action.policy.ts`; `apps/api/src/services/agent-action.registry.ts`; `apps/api/src/services/agent-action-receipt.ts`; `apps/api/src/services/revenue-outcomes.service.ts`; `packages/types/src/revenue-outcomes.types.ts`; `apps/api/src/services/command-center/command-center-brief.service.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-031 — OM-A31

**Exact criterion:** Paid acquisition plus estimate recovery executes bounded conversion/verification dependencies within the two-strategy, one-paid-channel limits

**Synthetic setup**

- Declare search acquisition and estimate recovery as the two synthetic selected strategies, one paid channel and a finite graph of conversion, feasibility, fulfillment, measurement and reconciliation support nodes.
- Use only accepted per-method kinds/graphs under OM-D13; the monthly coordinator consumes no strategy slot.
- All nodes share one contact, resource, model and spending envelope.

**Adversarial action**

1. Execute the finite graph with legitimate support dependencies.
2. Attempt a third independent strategy, second paid channel, recursive/dynamic child composition, duplicate monthly sub-mission budget or a support node hiding an independent strategy.

**Expected result**

- The legitimate graph executes its bounded support/verification work within two independently selected strategies and one paid channel.
- A third independent strategy, second paid channel and recursive/unbounded composition are rejected under the current policy. A reviewed revised plan must still obey two strategies, one paid channel and a finite nonrecursive graph; ordinary plan approval cannot bypass those caps or authorize recursion.
- Support nodes still consume shared contact/cost/resource limits; outcome contributors and portfolio links do not duplicate business facts.

**Evidence required:** Finite paid-acquisition and recovery graph enforcing two strategies, one paid channel and bounded support dependencies. Evidence layers: planner_contract, workflow_integration, budget_concurrency. Requires implementation and execution of the listed integration/evaluation evidence at the exact reviewed head; preparing fixtures does not satisfy this criterion.

**Accounting links:** No accounting scenario required.

**Source anchors:** `packages/types/src/agent-control-plane/v1/agent-action-proposal.ts`; `packages/types/src/agent-control-plane/v1/tenant-context.ts`; `packages/types/src/agent-control-plane/v1/queue-envelope.ts`; `packages/db/src/schema.ts`; `apps/api/src/services/agent-action.service.ts`; `apps/api/src/services/agent-action.policy.ts`; `apps/api/src/services/agent-action.registry.ts`; `apps/api/src/services/agent-action-receipt.ts`; `apps/api/src/services/growth-intake-foundation.service.ts`; `apps/api/src/services/booking.service.ts`; `apps/api/src/services/dispatch-intelligence.service.ts`; `apps/api/src/services/inventory.service.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-032 — OM-A32

**Exact criterion:** New agreement is not active without accepted terms, fulfillment obligations and a supported authorized billing path

**Synthetic setup**

- Prepare a draft agreement with versioned terms, required benefits, fulfillment capacity, an existing supported authorized billing route and an explicitly accepted recognition policy for the proposed new enrollment.
- Create independent missing/changed variants for customer acceptance, terms version, benefit obligations/capacity, billing support, owner/customer billing authority and the required recognition policy.

**Adversarial action**

1. Attempt activation under each variant, then process a fully eligible accepted agreement through existing agreement services.
2. Attempt an automatic new charge or unsupported processor flow as a shortcut.

**Expected result**

- Any missing requirement prevents active status and shows the specific blocker; drafting, signing the wrong version or simulated billing success cannot activate it.
- The valid new-enrollment case records exact accepted terms, obligations, supported authorization and accepted recognition policy without creating a second agreement or financial ledger. Missing recognition blocks this new enrollment; an already active legacy agreement with missing recognition remains a separate source-state/completeness case and is not silently deactivated.
- No new automatic charging/payment behavior is authorized by this case; earned revenue uses the separately approved recognition policy.

**Evidence required:** Agreement terms/obligations/billing readiness cases including unavailable or unauthorized activation. Evidence layers: agreement_domain_integration, authorization_integration, projection_integration. Requires implementation and execution of the listed integration/evaluation evidence at the exact reviewed head; preparing fixtures does not satisfy this criterion.

**Accounting links:** `OM-FIN-08`, `OM-FIN-09` in [accounting-examples.json](fixtures/accounting-examples.json).

**Source anchors:** `apps/api/src/services/invoice.service.ts`; `apps/api/src/services/service-agreement.service.ts`; `apps/api/src/services/agreement-portal.service.ts`; `apps/api/src/services/agent-action.service.ts`; `apps/api/src/services/agent-action.policy.ts`; `apps/api/src/services/agent-action.registry.ts`; `apps/api/src/services/agent-action-receipt.ts`; `apps/api/src/services/revenue-outcomes.service.ts`; `packages/types/src/revenue-outcomes.types.ts`; `apps/api/src/services/command-center/command-center-brief.service.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-033 — OM-A33

**Exact criterion:** USD 1,000 service, USD 100 credit and linked USD 100 refund produce USD 900 revenue and USD 900 net cash without replay duplication

**Synthetic setup**

- Use the canonical financial fixture: USD 1000.00 earned service and received cash; a USD 100.00 revenue credit; a USD 100.00 refund explicitly linked to that credit.
- Retain source IDs, correction linkage and business period.

**Adversarial action**

1. Project original events, then the credit and linked refund; repeat each event and replay the full stream.
2. Deliver refund before credit in the reorder variant and reconcile when both are present.

**Expected result**

- Net earned-service revenue is exactly USD 900.00 and net cash is exactly USD 900.00 once source linkage is complete.
- The refund does not subtract revenue a second time; replay does not change either total or create duplicate facts/contributors.
- Before necessary linkage arrives, affected completeness/reconciliation is explicit rather than assuming an unrelated second revenue reduction.

**Evidence required:** Decimal-string USD1000 service, linked USD100 credit/refund and duplicate replay producing USD900 earned and net cash. Evidence layers: projection_integration, event_reconciliation. Requires implementation and execution of the listed integration/evaluation evidence at the exact reviewed head; preparing fixtures does not satisfy this criterion.

**Accounting links:** `OM-FIN-01`, `OM-FIN-02`, `OM-FIN-03` in [accounting-examples.json](fixtures/accounting-examples.json).

**Source anchors:** `apps/api/src/services/revenue-outcomes.service.ts`; `packages/types/src/revenue-outcomes.types.ts`; `apps/api/src/services/command-center/command-center-brief.service.ts`; `apps/api/src/services/invoice.service.ts`; `apps/api/src/services/service-agreement.service.ts`; `apps/api/src/services/agreement-portal.service.ts`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

### OM-ACC-034 — OM-A34

**Exact criterion:** Workflow completion is separate from outcome verdict; target reached with failed mandatory guardrail is not mission success; missing necessary evidence is explicit

**Synthetic setup**

- Prepare one completed workflow whose explicit synthetic target is reached but mandatory contribution/completion guardrail fails.
- Prepare a second case whose missing evidence can still mature, and a third whose review window has ended with necessary evidence permanently unavailable.
- No causal experiment result is present.

**Adversarial action**

1. Evaluate all three without altering declared thresholds/cohorts; request mission success from workflow completion alone.

**Expected result**

- A completed workflow with a failed mandatory guardrail does not receive target_met; the failure and actual verified results remain visible.
- Missing evidence yields pending while maturation is possible and not_evaluable when required evidence cannot be obtained under the declared policy.
- Workflow state, target verdict and causal-effect status are independent; no causal estimate or automatic grant expansion follows from completion or a met target.

**Evidence required:** Workflow-complete, target-met/guardrail-failed and missing-evidence verdict cases. Evidence layers: evaluation_contract, api_contract, ui_state. Requires implementation and execution of the listed integration/evaluation evidence at the exact reviewed head; preparing fixtures does not satisfy this criterion.

**Accounting links:** `OM-FIN-10`, `OM-FIN-18` in [accounting-examples.json](fixtures/accounting-examples.json).

**Source anchors:** `apps/api/src/services/revenue-outcomes.service.ts`; `packages/types/src/revenue-outcomes.types.ts`; `apps/api/src/services/command-center/command-center-brief.service.ts`; `apps/web/src/components/command-center/CommandCenterView.tsx`; `apps/web/src/hooks/command-center.hooks.ts`; `docs/design/RENVANI_FIGMA_PARITY.md`; `docs/design/fs-51-figma-route-map.json`. All are existing paths at the pinned baseline; planned OM modules are not claimed to exist.

## 5. Conditional optional Render cases

These six criteria gate only a separately authorized optional capability. Disabled/unadvertised optional backends do not block core OM. Workflows evaluation is independent of Sandbox adoption; the benchmark does not require provisioning a Sandbox.

### OM-ACC-R01 — OM-R-A01

**Exact criterion:** Disabled optional backends leave core OM behavior unchanged; unsupported isolated tasks report unavailable rather than running untrusted code in the application worker

**Synthetic setup**

- All optional backend flags are disabled; core OM uses its existing permitted BullMQ/domain-service path.
- Request a capability whose registered method explicitly requires isolated execution.

**Adversarial action**

1. Run the affected core regression paths; submit the isolated task and forge a requested application-worker fallback.

**Expected result**

- Core behavior is unchanged under disabled optional flags.
- The isolated capability reports unavailable with an explicit blocker; no untrusted code/browser task runs inside the ordinary application worker.
- Disabling an optional backend does not turn queued/command-complete status into a business outcome or advertise a dependent capability as executable.

**Required later evidence:** core_regression, backend_selection_integration. Applies only to a separately authorized optional backend/capability. Actual provider controls and receipts must be verified at evaluation time; disabled/unadvertised optional backends do not block core OM.

**Packages:** `OM-R01`, `OM-R02`. **Decision blockers:** `OM-D09`, `OM-D10`, `OM-D12`. **Runtime:** not executed.

### OM-ACC-R02 — OM-R-A02

**Exact criterion:** Sandbox has no production credentials or direct FSM/database access; tenant/artifact boundaries, public-destination allowlists, redirect/private-network rejection and prompt-injection tests pass

**Synthetic setup**

- Create a synthetic read-only inspection task for an approved public fixture URL with explicit tenant/task/artifact identity and a bounded destination allowlist.
- The provider fixture exposes no production credentials, database connection, FSM write route or unrestricted metadata endpoint.

**Adversarial action**

1. Try direct and redirected access to localhost, private/link-local/metadata addresses and a disallowed host, including DNS resolution changes.
2. Submit cross-tenant artifact IDs, forged signed URLs and prompt injection requesting credentials or an FSM write.

**Expected result**

- Destination checks hold through DNS/redirect handling; disallowed/private destinations cannot be fetched.
- The task has no production secret/direct FSM or database access, and tenant/artifact identity checks reject mismatches.
- Only permitted read-only findings are returned; actual provider isolation/network controls still need authorized verification beyond these synthetic denials.

**Required later evidence:** adapter_security_integration, authorized_provider_isolation, independent_security_review. Applies only to a separately authorized optional backend/capability. Actual provider controls and receipts must be verified at evaluation time; disabled/unadvertised optional backends do not block core OM.

**Packages:** `OM-R01`. **Decision blockers:** `OM-D09`, `OM-D10`, `OM-D12`. **Runtime:** not executed.

### OM-ACC-R03 — OM-R-A03

**Exact criterion:** Returned findings/artifacts are validated against task identity, schema, size and evidence requirements; command/flow success cannot mark a booking, payment, inventory change or mission outcome complete

**Synthetic setup**

- A registered synthetic task expects a bounded typed findings schema, a fixture-only maximum artifact size of 1048576 bytes, exact input/code hashes and tenant/task identity; the oversized variant has 1048577 bytes.
- Prepare artifacts with valid data and variants with wrong tenant/task, invalid schema, excess size, missing evidence, checksum mismatch or embedded action instructions.

**Adversarial action**

1. Return each artifact with a provider-completed status and attempt to consume it into the mission.
2. Request booking/payment/inventory/mission success from command completion alone.

**Expected result**

- Only artifacts matching identity, schema, size, hashes and evidence rules are accepted as untrusted findings/proposals.
- Invalid results are rejected/quarantined with a visible failure; no downstream action uses them.
- Provider command/flow completion never verifies a booking, payment, inventory change or mission target without authoritative domain evidence.

**Required later evidence:** artifact_validation, tenant_security, domain_projection_regression. Applies only to a separately authorized optional backend/capability. Actual provider controls and receipts must be verified at evaluation time; disabled/unadvertised optional backends do not block core OM.

**Packages:** `OM-R01`, `OM-R02`. **Decision blockers:** `OM-D09`, `OM-D10`, `OM-D12`. **Runtime:** not executed.

### OM-ACC-R04 — OM-R-A04

**Exact criterion:** Timeout, duplicate trigger, lost create response, provider interruption and late receipt reconcile one attempt; backend fallback cannot duplicate work; cleanup is verified or visibly escalated

**Synthetic setup**

- Persist one application task/attempt and provider request key before create; simulate provider creation followed by lost create response.
- Prepare timeout, duplicate trigger, interruption, late receipt and cleanup failure variants.

**Adversarial action**

1. Retry/reconcile by the original request identity and attempt an automatic fallback while the original execution is uncertain.
2. Deliver duplicate late receipts and run cleanup after timeout/cancel.

**Expected result**

- One logical attempt is reconciled; a possible existing provider run is located or visibly escalated rather than duplicated.
- Fallback cannot create a second live effect while the first attempt is unknown/in flight.
- Late receipts update the existing attempt once without reexecuting its next step; termination/cleanup is verified by receipt or a visible accountable escalation.

**Required later evidence:** worker_fault_injection, authorized_provider_reconciliation, cleanup_evidence. Applies only to a separately authorized optional backend/capability. Actual provider controls and receipts must be verified at evaluation time; disabled/unadvertised optional backends do not block core OM.

**Packages:** `OM-R01`, `OM-R02`. **Decision blockers:** `OM-D09`, `OM-D10`, `OM-D12`. **Runtime:** not executed.

### OM-ACC-R05 — OM-R-A05

**Exact criterion:** Runtime/concurrency/infrastructure limits hold under retries; missing allowances block new work; cleanup continues; waiting for owner approval/customer response keeps no Sandbox or Workflow run alive

**Synthetic setup**

- Use fixture-only limits: one concurrent isolated task, 60-second runtime, USD 0.20 reserved infrastructure allowance, one bounded retry and explicit cleanup allowance.
- A second task arrives concurrently; another lacks a reserved allowance; one task reaches an owner/customer wait.

**Adversarial action**

1. Race admissions, exhaust runtime/allowance, deliver duplicate usage receipts and revoke permission for new work.
2. Pause for owner approval, then attempt to keep a provider run alive or block necessary cleanup because new-work budget is exhausted.

**Expected result**

- Concurrent admissions, runtime, retry and infrastructure exposure stay within the declared fixture limits.
- Missing/exhausted allowance blocks new tasks; unknown usage remains pending exposure and settlement is idempotent.
- Cleanup/termination continues under its declared control path, and waiting for an owner or customer leaves no Sandbox/Workflow run alive.
- Model and infrastructure budgets remain separate; these test values do not define approved provider rates or production limits.

**Required later evidence:** budget_concurrency, authorized_provider_metering, cleanup_evidence. Applies only to a separately authorized optional backend/capability. Actual provider controls and receipts must be verified at evaluation time; disabled/unadvertised optional backends do not block core OM.

**Packages:** `OM-R01`, `OM-R02`. **Decision blockers:** `OM-D09`, `OM-D10`, `OM-D12`. **Runtime:** not executed.

### OM-ACC-R06 — OM-R-A06

**Exact criterion:** Equivalent BullMQ/Workflows benchmark records output parity, startup/runtime latency, recovery, concurrency and total cost; architecture review records adopt/defer for named capabilities with working rollout flags and rollback

**Synthetic setup**

- Define one deterministic bounded validation/aggregation task with the same versioned code, input hash, public/synthetic input and output schema on BullMQ and Workflows.
- Neither arm requires creating or adopting a Sandbox. Establish equal concurrency, retry and interruption scenarios plus an approved evaluation allowance.

**Adversarial action**

1. Execute both authorized benchmark arms; inject timeout/retry/interrupted-run cases; capture output, startup/runtime latency, recovery, concurrency and costs.
2. Calculate model, compute, memory, artifacts/retention, transfer, retries and reconciliation costs; test disable/rollback.

**Expected result**

- Outputs and correctness/recovery semantics are equivalent under the declared workload or every difference is recorded as a failed/limited comparison.
- Cost comparison includes all declared components and counts worker savings only when worker capacity can actually be reduced.
- The architecture decision records adopt or defer for named capabilities with measured tradeoffs and a working flag/rollback path; no automatic Workflows or Sandbox adoption follows.

**Required later evidence:** authorized_provider_benchmark, architecture_decision, rollback_evidence. Applies only to a separately authorized optional backend/capability. Actual provider controls and receipts must be verified at evaluation time; disabled/unadvertised optional backends do not block core OM.

**Packages:** `OM-R02`. **Decision blockers:** `OM-D09`, `OM-D10`, `OM-D12`. **Runtime:** not executed.

## 6. First bounded Codex sequence

The source plan begins OM-01 → OM-02 → OM-03. The five handoff steps below divide those first packages into reviewable patches; they are not new tickets, active assignments or authorization to implement Part II. Existing Part I repairs can continue under their actual Part I authority. The accepted Part I/founder gate still applies when entering Part II runtime.

| Handoff | Package | Bounded purpose | Dependencies |
| --- | --- | --- | --- |
| `OM-H01` | `OM-01` | Reconcile current baseline, authority and consumer contracts | — |
| `OM-H02A` | `OM-02` | Atomic action revisions, expiry and idempotency compatibility | `OM-H01` |
| `OM-H02B` | `OM-02` | Capability-specific grant checks and exact approved payload | `OM-H02A` |
| `OM-H03A` | `OM-03` | One atomic local action, resource and dispatch intent | `OM-H02A`, `OM-H02B` |
| `OM-H03B` | `OM-03` | Authenticated receipts and bounded uncertain-effect recovery | `OM-H03A` |

### OM-H01: Reconcile current baseline, authority and consumer contracts

**Entry gate:** Read-only/doc reconciliation may proceed under preparation authority. Any runtime implementation still needs the existing accepted Part I scope and founder authorization.

**Patch scope**

- Re-pin dev and every affected PR/head at the time of work; retain the crosswalk's historical 7840884d baseline as provenance.
- Reconcile FS-257/258 and FS-262–269 scope/owners without duplicate tickets or status promotion.
- Confirm consumer map, exact mutation/receipt/accounting contracts and current source evidence; explicitly resolve the first patch's applicable decisions.
- Select a concrete bounded existing-ticket scope, file coordination and required independent review/CI evidence before coding.

**Exit evidence**

- Current-head source/consumer addendum and accepted scope/authority record.
- Explicit implementation owner and independent reviewer chosen by the authorized coordinator; this handoff leaves them unassigned.
- Required Part I acceptance/founder permission recorded before Part II runtime starts; unresolved fields remain blockers.

**Cases contributing partial evidence:** `OM-ACC-005`, `OM-ACC-006`, `OM-ACC-007`, `OM-ACC-008`, `OM-ACC-009`, `OM-ACC-030`. **Decision blockers:** `OM-D04`, `OM-D05`, `OM-D09`, `OM-D12`. Completing this patch does not automatically complete every listed criterion or the broader mission runtime.

### OM-H02A: Atomic action revisions, expiry and idempotency compatibility

**Entry gate:** Applicable Part I/Part II implementation authority and accepted mutation contract; shared schema/consumer coordination if revision storage changes.

**Patch scope**

- Make same-state edits and all consequential state changes compare the accepted version at the authoritative mutation boundary, with a version that cannot collapse distinct same-millisecond writes.
- Guard expiry by matching tenant, nonterminal state and expected version, with one audit event; protect completed/cancelled/newer actions from delayed expiry.
- Preserve same-key/same-request replay and same-key/different-request conflict semantics across affected callers.
- Update the minimal affected shared contract/API/service consumers together and retain tenant isolation.

**Exit evidence**

- Deterministic concurrent DB tests demonstrate one winner for conflicting same-version writes, safe replay, same-millisecond version distinction and no terminal expiry overwrite.
- Affected consumer compatibility, tenant negatives and audit assertions are recorded at exact reviewed head.
- Independent peer/QA and Security-by-risk evidence; scoped CI only when authorized. Founder exact-head merge approval remains separate.

**Cases contributing partial evidence:** `OM-ACC-005`, `OM-ACC-006`, `OM-ACC-009`, `OM-ACC-027`. **Decision blockers:** `OM-D04`, `OM-D12`. Completing this patch does not automatically complete every listed criterion or the broader mission runtime.

### OM-H02B: Capability-specific grant checks and exact approved payload

**Entry gate:** OM-D04 role/capability and OM-D05 contact-policy decisions resolved for the selected capability; accepted FS-257/258 consent/profile boundaries where required.

**Patch scope**

- Add only the reviewed tenant, actor/capability, service/customer, content/hash, channel, exposure, schedule, validity and revocation checks required by the selected scope.
- Bind approval to an exact plan/action version and payload; reject material changes outside explicit bounded substitutions.
- Recheck current grants, consent, source versions and resource/balance facts at consequential dispatch and resume.
- Keep unsupported capability or incomplete policy visibly unavailable.

**Exit evidence**

- Revocation/expiry/content/source-change tests reject queued and resumed stale authority before any provider write.
- Tenant and role/capability negatives plus current consent boundaries are independently reviewed.
- No grant, scope or autonomy expands as a side effect of model confidence or successful prior work.

**Cases contributing partial evidence:** `OM-ACC-004`, `OM-ACC-005`, `OM-ACC-006`, `OM-ACC-009`. **Decision blockers:** `OM-D04`, `OM-D05`, `OM-D06`, `OM-D12`. Completing this patch does not automatically complete every listed criterion or the broader mission runtime.

### OM-H03A: One atomic local action, resource and dispatch intent

**Entry gate:** Reviewed action/outbox transaction seam and explicit schema/worker ownership; selected supported provider request identity contract.

**Patch scope**

- Compose resource reservation, action/dispatch intent and audit events in one tenant transaction using the existing outbox infrastructure.
- Preserve canonical intent/request identity and enforce unique local claims under concurrent workers.
- Perform network I/O after commit; persist lease/attempt/unknown-effect state needed for safe recovery.
- Keep pending/queued records distinct from provider acceptance, delivery and domain verification.

**Exit evidence**

- Rollback tests leave no orphan action/outbox/resource reservation; concurrency produces one committed dispatch claim.
- Fault injection before/after commit and lease recovery retain request identity and never convert queued work into delivered/outcome success.
- Review confirms no second execution ledger and no network call inside the DB transaction.

**Cases contributing partial evidence:** `OM-ACC-005`, `OM-ACC-007`, `OM-ACC-008`, `OM-ACC-010`, `OM-ACC-024`, `OM-ACC-030`. **Decision blockers:** `OM-D04`, `OM-D09`, `OM-D12`. Completing this patch does not automatically complete every listed criterion or the broader mission runtime.

### OM-H03B: Authenticated receipts and bounded uncertain-effect recovery

**Entry gate:** OM-D09 supported provider idempotency/lookup/callback semantics resolved; separate authorization for any real-provider test.

**Patch scope**

- Normalize authenticated account-bound callbacks into immutable/source-versioned receipt facts.
- Handle duplicate, reordered and valid late events plus a crash after provider acceptance and before local receipt.
- Persist needs_reconciliation when an effect is uncertain; query by stable request/provider identity before another write and route unresolved ambiguity to accountable review.
- Expose uncertain dispatch, stale leases and missing receipts while preserving pause/cancel and current-authority checks.

**Exit evidence**

- Crash/retry/callback adversarial tests prove one supported-provider effect and one local normalized result, or explicit unresolved reconciliation without blind retry.
- Forged/wrong-account/replay events cannot mutate delivery/finance; legitimate late events reconcile correctly.
- Authorized controlled provider evidence is recorded separately from mock tests. Broader OM criteria remain incomplete until all applicable consumers/packages pass.

**Cases contributing partial evidence:** `OM-ACC-007`, `OM-ACC-008`, `OM-ACC-009`, `OM-ACC-014`, `OM-ACC-024`, `OM-ACC-025`, `OM-ACC-029`, `OM-ACC-030`. **Decision blockers:** `OM-D05`, `OM-D09`, `OM-D12`. Completing this patch does not automatically complete every listed criterion or the broader mission runtime.

### Source facts driving this sequence

The current action service derives its token from `updatedAt`, checks expected version after a read, and uses a state-based transition predicate. Its delayed expiry helper writes through a tenant-scoped predicate without the same explicit nonterminal/version guard. The existing integration-outbox creation helper opens its own transaction. Outbound action receipts say queued/provider disabled and remain distinct from provider delivery. These are targeted source-review risks to resolve with meaningful concurrency/recovery evidence, not claims of reproduced production failures.

OM-H02A therefore needs a version strategy that preserves distinct same-state writes, including within one millisecond, at the atomic SQL mutation boundary. OM-H03A then needs one transaction for authorized action, resource claims, dispatch intent and audit, with the provider call after commit. OM-H03B proves stable identity, authenticated receipts and reconciliation after uncertainty. This order makes the later shared mission coordinator depend on demonstrated boundaries.

## 7. Source and evidence recording

| Existing source path | Pinned source |
| --- | --- |
| `AGENTS.md` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/AGENTS.md) |
| `TEAM.md` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/TEAM.md) |
| `apps/api/src/services/agent-action-receipt.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/agent-action-receipt.ts) |
| `apps/api/src/services/agent-action.executors.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/agent-action.executors.ts) |
| `apps/api/src/services/agent-action.policy.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/agent-action.policy.ts) |
| `apps/api/src/services/agent-action.registry.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/agent-action.registry.ts) |
| `apps/api/src/services/agent-action.service.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/agent-action.service.ts) |
| `apps/api/src/services/agreement-portal.service.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/agreement-portal.service.ts) |
| `apps/api/src/services/booking.service.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/booking.service.ts) |
| `apps/api/src/services/command-center/command-center-brief.service.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/command-center/command-center-brief.service.ts) |
| `apps/api/src/services/dispatch-intelligence.service.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/dispatch-intelligence.service.ts) |
| `apps/api/src/services/growth-intake-foundation.service.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/growth-intake-foundation.service.ts) |
| `apps/api/src/services/growth/call-tracking-adapter.registry.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/growth/call-tracking-adapter.registry.ts) |
| `apps/api/src/services/growth/gbp-provider.registry.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/growth/gbp-provider.registry.ts) |
| `apps/api/src/services/integration-outbox-audit.service.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/integration-outbox-audit.service.ts) |
| `apps/api/src/services/inventory.service.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/inventory.service.ts) |
| `apps/api/src/services/invoice.service.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/invoice.service.ts) |
| `apps/api/src/services/outbound-consent-email-verification.service.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/outbound-consent-email-verification.service.ts) |
| `apps/api/src/services/outbound-consent.service.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/outbound-consent.service.ts) |
| `apps/api/src/services/revenue-agent/revenue-agent-proposals.service.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/revenue-agent/revenue-agent-proposals.service.ts) |
| `apps/api/src/services/revenue-outcomes.service.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/revenue-outcomes.service.ts) |
| `apps/api/src/services/service-agreement.service.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/service-agreement.service.ts) |
| `apps/web/src/components/command-center/CommandCenterView.tsx` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/web/src/components/command-center/CommandCenterView.tsx) |
| `apps/web/src/hooks/command-center.hooks.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/web/src/hooks/command-center.hooks.ts) |
| `apps/worker/src/index.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/worker/src/index.ts) |
| `docs/architecture/TRUSTED_EXECUTION_AUDIT.md` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/docs/architecture/TRUSTED_EXECUTION_AUDIT.md) |
| `docs/design/RENVANI_FIGMA_PARITY.md` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/docs/design/RENVANI_FIGMA_PARITY.md) |
| `docs/design/fs-51-figma-route-map.json` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/docs/design/fs-51-figma-route-map.json) |
| `docs/planning/agent-control-plane-consumers.md` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/docs/planning/agent-control-plane-consumers.md) |
| `packages/ai/src/langfuse/client.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/packages/ai/src/langfuse/client.ts) |
| `packages/config/src/feature-flags.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/packages/config/src/feature-flags.ts) |
| `packages/db/src/integration-outbox.service.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/packages/db/src/integration-outbox.service.ts) |
| `packages/db/src/schema.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/packages/db/src/schema.ts) |
| `packages/jobs/src/platform-queue-registry.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/packages/jobs/src/platform-queue-registry.ts) |
| `packages/jobs/src/queues.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/packages/jobs/src/queues.ts) |
| `packages/types/src/agent-control-plane/v1/agent-action-proposal.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/packages/types/src/agent-control-plane/v1/agent-action-proposal.ts) |
| `packages/types/src/agent-control-plane/v1/http-route-schemas.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/packages/types/src/agent-control-plane/v1/http-route-schemas.ts) |
| `packages/types/src/agent-control-plane/v1/queue-envelope.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/packages/types/src/agent-control-plane/v1/queue-envelope.ts) |
| `packages/types/src/agent-control-plane/v1/tenant-context.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/packages/types/src/agent-control-plane/v1/tenant-context.ts) |
| `packages/types/src/revenue-outcomes.types.ts` | [View at 7840884d](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/packages/types/src/revenue-outcomes.types.ts) |

Record actual evidence against the stable case/criterion IDs using the JSON receipt template. Keep `result: not_executed` until the procedure is run. A blocked case should identify its missing decision, provider authority, fixture/source input or dependent package. Do not manufacture a passing runtime status from a prepared assertion.

## 8. Preparation validation

Structural checks verify exact one-to-one source criterion text, unique case IDs, thirteen-package and decision references, existing pinned source paths, all linked OM-FIN scenario IDs, substantive setup/actions/expected/evidence fields, conditional optional gates, and not-started/not-executed/unassigned status. These checks are local artifact validation only. No application tests, CI batches, providers, deployed UI, migrations or business-effectiveness experiments run as part of this case preparation.
