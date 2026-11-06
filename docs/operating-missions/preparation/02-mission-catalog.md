# 02 — Mission and shared-method catalog

**Status: prepared, not executed.** Six decision sheets and thirteen shared method records translate [Part II v1.1](https://app.notion.com/p/40e317b92d1581188031e8a0a4c847c9) into reviewable inputs for Codex. [mission-catalog.json](mission-catalog.json) contains the complete planning records. It is not a production TypeScript/Zod export, installed policy, registry entry, feature flag or activation record.

**Source baseline:** `7840884d346ca95788e2668cc78148afa3b6a843`. Reusable domain source exists, but all six OM missions and thirteen OM methods remain **not implemented and not activated** at this pinned preparation baseline. No runtime, provider or deployment acceptance was executed. Actual implementation remains subject to Part I completion/independent acceptance and founder permission for Part II.

The pilot covers HVAC **diagnostic/repair**, **preventive maintenance**, **replacement assessment/installation**, and **supported ongoing agreement**. Approved offerings, qualifications, compatibility, material requirements, calendars, due rules and benefit obligations need authoritative policy under OM-D06. This scope does not remove existing platform trade commitments.

## Field dictionary

| Field | Meaning and unresolved boundary | Status / decision |
| --- | --- | --- |
| `missionType` | Exact stable identifier from spec §1. | fixed_by_source; source/preparation |
| `definitionVersion` | Preparation revision, never an installed production policy version. | preparation_only; source/preparation |
| `allowedVerticals / supportedServiceSituations` | HVAC pilot scope and named service situations; business-approved services and qualification rules remain required. | source_scope_with_policy_gap; OM-D06 |
| `primaryMetricId` | Proposed metric key or explicit unresolved selection; does not create a production metric export. | proposed_mapping; OM-D01 |
| `targetPolicy` | Measure, owner-approved value/change, cohort, local period and approval evidence. | required_run_input; OM-D01 |
| `guardrailRules` | Metric, comparator, threshold/tolerance, hard/soft classification, matured sample and missing-data behavior. | required_policy_decision; OM-D01, OM-D03, OM-D11 |
| `minimumMeasurementCompleteness` | Required linkage/coverage for this target; the later 95% expansion rule is not a universal default. | required_policy_decision; OM-D01, OM-D11 |
| `policyVersions` | Installed eligibility/diagnosis/authority/stop versions; null until reviewed and registered. | not_installed; OM-D04, OM-D06, OM-D13 |
| `requiredInputs` | Named authoritative source, planning freshness and consequential-action recheck; empty history differs from missing facts. | proposed_source_mapping; OM-D06, OM-D07 |
| `readiness` | Separate source presence, OM implementation, runtime acceptance, configuration/authority and activation. | evidence_only; source/preparation |
| `methodId` | Exact proposed identifier, including .v1, from spec §9; later identifier splitting must be explicit. | source_identifier; OM-D13 |
| `methodKind / dependencies` | Proposed strategy/support/coordinator classification and finite dependency relationships; unresolved classification blocks registration. | proposed_mapping; OM-D13 |
| `verificationRule / maturationPolicy` | Required domain result and when it can be evaluated; queued/provider-accepted is not the business result. | source_rule_with_method_details; OM-D06, OM-D11 |
| `decisionRefs` | Unresolved decision IDs in DECISIONS.md; a null value cannot default to success. | preparation_control; source/preparation |

**Required values:** every target has a defined measure, cohort and period, but null owner-approved value/change and approval evidence. Every guardrail retains null comparator, threshold/tolerance, hard/soft class and matured sample until a reviewed rule exists. Missing mandatory values never pass. Baseline establishment may show observed results without claiming `target_met`. Fourteen-day execution review and seven-day operational check are proposed pilot defaults, separate from outcome maturation.

**Freshness shared by all sheets:** source-versioned planning evidence may use the proposed fifteen-minute cache only where field policy permits. Before a consequential action, recheck current source versions, authority, consent/destination, active actions, balances, schedule, qualifications and reservations as applicable. Stale facts and absent history are different conditions; unknown is not zero. JSON input records enumerate each specific recheck and unresolved decision. Proposed capability names are semantic requirements, not proof of installed/executable actions.

## Six mission decision sheets

### Get more bookings — `more_bookings`

**Outcome:** Increase unique net confirmed suitable service commitments within the declared service, geography and booking-type scope. **Primary metric:** `net_confirmed_bookings`.

**Cohort:** Canonical eligible service opportunities and unique commitments; assessments and accepted installation work remain separately typed. **Period:** Declared company-local service/booking dates; retain later completion maturation. Target value/change and approval remain required run inputs.

**Eligibility:** Approved service and geography; actual hours and qualified feasible capacity. New and established shops are eligible; no estimate-recovery backlog is required for external acquisition. Known mandatory service/material requirements are satisfied or a truthful diagnostic/assessment handoff is used.

| Required facts | Existing source IDs | Missing/uncertain behavior |
| --- | --- | --- |
| `offering_and_area`: Approved service, geography, hours and source/page version. | `company_settings`, `product_catalog`, `growth_intake` | Request missing service/area decision; no unsupported promise. |
| `booking_feasibility`: Qualifications, accepted customer window, live capacity/travel and applicable materials. | `booking`, `dispatch`, `inventory` | Offer inquiry or assessment handoff; unknown repair parts do not invent a diagnostic requirement. |
| `acquisition_path`: Authorized account, enforceable spend, working page/form and source binding for Search. | `growth_intake`, `action_service`, `action_receipt` | Keep campaign draft/unavailable; external assessment may still describe prerequisites. |
| `history_and_economics`: Available funnel and cost evidence with completeness labels. | `legacy_outcomes`, `job`, `invoice`, `payment` | Zero local history permits a bounded approved test; do not fabricate prior success or ROI. |

**Allowed methods:** `search_acquisition.v1`, `inquiry_conversion.v1`, `estimate_recovery.v1`, `schedule_correction.v1`, `material_readiness.v1`, `operations_review.v1`. Search and eligible estimate recovery may be the two independent strategies. Conversion and necessary feasibility/verification are bounded support. No mandatory full internal recovery scan before acquisition.

**Authority:** Exact approved service/content/geo/dates/spend envelope before paid creation/activation. Customer contact and booking confirmation require their current capability and customer/tenant checks. **Stops:** Authority or consent invalid; Budget/exposure exhausted; Tracking cannot support controlled execution; Suitable capacity or required feasibility disappears; Unknown consequential provider effect awaiting reconciliation.

**Guardrail slots:** `completion_rate`, `cancellation_rate`, `contribution_before_fixed_overhead`, `revenue_per_eligible_opportunity`. Required policy fields and missing-data rules remain explicit in the JSON; no universal threshold is approved here.

**Verification:** Authoritative customer-accepted confirmed booking with source/opportunity/job lineage; separately follow actual completion, spend and finance facts. A lead or provisional hold is not confirmation. **Maturation:** Use service-situation timing. Diagnostic/assessment, accepted future installation and completed work mature separately; a 14-day review does not collapse them.

**Prepared example `CAT-BOOK-01`:** Established shop; No unsold estimates; Approved supported service and prospective capacity; Search account or spend readiness still unverified. **Expected:** External acquisition remains a candidate; display missing readiness and draft-only status. Do not require recovery backlog or present a live launch.

**Readiness:** source only; implementation not started; runtime acceptance not executed; configuration unverified; no mission grant/activation. Paid Search adapter/account/budget evidence not established; Shared booking-feasibility and source-to-completed-work acceptance missing. **Acceptance anchors:** OM-A01, OM-A02, OM-A03, OM-A11, OM-A12, OM-A13, OM-A15, OM-A31, OM-A34. **Decisions:** OM-D01, OM-D03, OM-D04, OM-D06, OM-D07, OM-D09, OM-D11, OM-D13.

### Increase my monthly revenue — `monthly_revenue`

**Outcome:** Increase eligible earned revenue in the selected company-local business month through a coordinated portfolio. **Primary metric:** `net_earned_service_revenue`.

**Cohort:** Frozen eligible opportunity/work scope; include recognized agreement allocations only where an explicit policy applies. **Period:** Selected business month in the company's IANA time zone; source revisions retain the appropriate service/recognition period. Target value/change and approval remain required run inputs.

**Eligibility:** Declared month, target and scope with an approved revenue policy. Methods capable of producing relevant earned outcomes in the period; future-period opportunities are shown separately. At most two independently selected strategies under one shared budget/resource plan.

| Required facts | Existing source IDs | Missing/uncertain behavior |
| --- | --- | --- |
| `earned_fact_sources`: Performed service, finalized eligible allocations, credits and source revisions. | `job`, `invoice`, `payment`, `legacy_outcomes` | Completed/unfinalized work stays pending/unbilled; never substitute an unsigned estimate. |
| `agreement_recognition`: Explicit approved recognition and included-benefit allocation policy if agreements are in scope. | `agreement` | Full scoped primary total is null when required recognition is unknown; show known performed-service subtotal and unknown agreement component. |
| `cost_and_period_fit`: Historical variable costs, acquisition allocation, available capacity and period-fit assumptions. | `job`, `inventory`, `dispatch`, `legacy_outcomes` | Show incomplete contribution and planning assumptions; block rules requiring complete costs. |

**Allowed methods:** `revenue_portfolio.v1`, `search_acquisition.v1`, `inquiry_conversion.v1`, `estimate_recovery.v1`, `service_options.v1`, `due_service.v1`, `agreement_renewal.v1`, `agreement_enrollment.v1`, `schedule_correction.v1`, `material_readiness.v1`, `operations_review.v1`. The coordinator selects up to two proven strategies and their finite support work. It does not launch copies of narrower missions with separate budgets.

**Authority:** One approved resource/spend envelope and exact plan version. New prices, offers, agreement terms, billing changes and spend expansion need applicable authority; first release never raises media budget automatically. **Stops:** Method cannot meet mandatory economic or resource constraints; Relevant authority expires or changes; Unknown provider effect or unreliable measurement; Approved exposure exhausted.

**Guardrail slots:** `revenue_per_eligible_opportunity`, `contribution_before_fixed_overhead`, `refunds_and_credits`, `completion_and_customer_outcomes`. Required policy fields and missing-data rules remain explicit in the JSON; no universal threshold is approved here.

**Verification:** Current earned-fact revisions reconcile to performed services and explicit agreement recognition; accepted future work, invoices and settled cash remain distinct measures. **Maturation:** The selected month governs earned recognition. Late finalization revises the relevant month auditably; later installation work remains a future-period outcome.

**Financial completeness:** combine eligible `performed_service_revenue` with separately identified `earned_agreement_revenue` only under an explicit recognition policy. Included-benefit fulfillment must not count recognition twice. If a required in-scope agreement component is unknown, the full primary total is null; show known subtotals and the missing component.

**Prepared example `CAT-REV-01`:** Current-month diagnostic completed; Installation accepted for next month; Agreement included in scope without recognition policy. **Expected:** Report known diagnostic earned subtotal and accepted future installation separately. Full scoped earned total is unavailable until required agreement recognition is established.

**Readiness:** source only; implementation not started; runtime acceptance not executed; configuration unverified; no mission grant/activation. New earned-revenue projection and fixed cohorts not implemented; Recognition/cost policy and shared portfolio resource enforcement unresolved. **Acceptance anchors:** OM-A01, OM-A10, OM-A15, OM-A16, OM-A23, OM-A31, OM-A32, OM-A33, OM-A34. **Decisions:** OM-D01, OM-D02, OM-D03, OM-D04, OM-D06, OM-D07, OM-D11, OM-D13.

### Increase my average job value — `average_job_value`

**Outcome:** Improve suitable net value per completed eligible job while preserving opportunity-level revenue, conversion and contribution. **Primary metric:** `average_net_completed_job_value`.

**Cohort:** Frozen eligible service opportunities before treatment; retain declines, nonresponses and smaller/unconverted opportunities in companion measures. **Period:** Declared exposure/service period with service-specific completion maturation; within-service and service-mix comparisons separate. Target value/change and approval remain required run inputs.

**Eligibility:** Verified customer need/request or qualified finding tied to an approved catalog option. Authoritative compatibility, permitted price, feasible incremental time/materials and customer acceptance for changed scope. Eligible opportunities are fixed before showing or withholding an option.

| Required facts | Existing source IDs | Missing/uncertain behavior |
| --- | --- | --- |
| `need_and_compatibility`: Documented need, approved option, equipment/scope compatibility and accepted estimate version. | `estimate`, `product_catalog`, `job` | Request qualified review; stock on hand or model confidence is insufficient. |
| `incremental_feasibility`: Known available materials, duration and qualified capacity. | `inventory`, `dispatch`, `booking` | Return a draft/verification task instead of promising unavailable scope. |
| `opportunity_economics`: Fixed eligibility, conversion/completion, realized net allocations and costs. | `invoice`, `job`, `legacy_outcomes` | Retain missing outcomes and incomplete costs; no mission win from average alone. |

**Allowed methods:** `service_options.v1`, `search_acquisition.v1`, `material_readiness.v1`, `schedule_correction.v1`, `operations_review.v1`. Suitable options are one candidate strategy; a supported higher-value Search campaign may be another. The campaign retains inquiry conversion through its shared method dependency, even though conversion is not a separately selected job-value strategy.

**Authority:** Approved option presentation and customer acceptance. New price, discount, out-of-catalog product or changed accepted scope requires fresh applicable approval. **Stops:** Recommendation is inappropriate or technically unverified; Unavailable time/materials; Required opportunity or contribution safeguard breached; Consent, scope or customer acceptance no longer valid.

**Guardrail slots:** `revenue_per_eligible_opportunity`, `conversion_rate`, `contribution_before_fixed_overhead`, `refunds_rework_and_incremental_duration`. Required policy fields and missing-data rules remain explicit in the JSON; no universal threshold is approved here.

**Verification:** Accepted versioned estimate option is fulfilled, then net realized value/cost and fixed-cohort results are projected; presenting an option is only work performed. **Maturation:** Wait for relevant job completion and adjustments; distinguish within-service change from a shift to different service types.

**Prepared example `CAT-VALUE-01`:** Completed-job average increases; Fewer eligible opportunities convert; Mandatory opportunity guardrail is unset. **Expected:** Show both measures and a required policy/evidence gap. Do not claim target_met from the higher average; do not remove unconverted opportunities.

**Readiness:** source only; implementation not started; runtime acceptance not executed; configuration unverified; no mission grant/activation. Authoritative compatibility/qualification policy and fixed-cohort metric projection not established; Service-option capability-specific grants and end-to-end acceptance missing. **Acceptance anchors:** OM-A01, OM-A11, OM-A15, OM-A17, OM-A34. **Decisions:** OM-D01, OM-D03, OM-D04, OM-D06, OM-D07, OM-D09, OM-D11, OM-D13.

### Get more repeat business — `repeat_business`

**Outcome:** Increase legitimate completed repeat service in an existing-customer cohort while tracking renewals and included benefits distinctly. **Primary metric:** `eligible_repeat_service_completions`.

**Cohort:** Declared existing-customer due-service cohort; renewals, benefit fulfillment, warranty/rework and new agreement acquisition are separate classifications. **Period:** Actual service/benefit/renewal cycle; prospective eligibility and maturity are frozen before exposure. Target value/change and approval remain required run inputs.

**Eligibility:** Authoritative service/equipment history and legitimate due date or agreement obligation. Relationship status, unresolved service commitments, feasible fulfillment and current channel/purpose permission. Unfulfilled included benefits and incompatible unresolved commitments are handled before promotion.

| Required facts | Existing source IDs | Missing/uncertain behavior |
| --- | --- | --- |
| `due_service_and_benefits`: Authoritative interval/obligation, benefit status and relevant customer need. | `agreement`, `job`, `retention` | Create verification/fulfillment task; do not invent maintenance or another installation from age alone. |
| `permission_and_contact`: Current scoped permission, destination, response/decline and shared contact history. | `consent`, `action_service`, `revenue_proposals` | No customer contact without trusted current authority; draft/handoff only. |
| `renewal_and_outcomes`: Eligible existing agreement, customer decision and completed repeat work. | `agreement`, `job`, `invoice` | Keep renewal/response pending through its true cycle; preserve costs/quality from warranty/rework separately. |

**Allowed methods:** `due_service.v1`, `agreement_renewal.v1`, `material_readiness.v1`, `operations_review.v1`. Due-service and renewal strategies share customer contact and fulfillment controls. Newly acquired agreement customers do not enlarge the existing-member renewal numerator. Inquiry/booking support is reached only through the declared method dependencies.

**Authority:** Approved relevant content and channel/purpose-specific customer contact. Changed terms, price, offers or charging behavior require their applicable separate authority. **Stops:** Decline or opt-out; Service already completed or agreement renewed; Conflicting unresolved service evidence; Missing fulfillment capacity or invalid grant.

**Guardrail slots:** `due_cohort_completion_rate`, `benefit_fulfillment`, `contribution_and_customer_outcomes`, `eligible_renewal_lapse`. Required policy fields and missing-data rules remain explicit in the JSON; no universal threshold is approved here.

**Verification:** Verify actual repeat work or eligible renewal/benefit fulfillment from authoritative domain events. A reminder or new lead is not a repeat sale. **Maturation:** Use actual due-service and contract cycle. Fourteen-day execution review cannot declare an unmatured annual renewal a failure.

**Prepared example `CAT-REPEAT-01`:** Existing member has an unfulfilled included benefit; Renewal window opens; A new external lead also buys a membership. **Expected:** Preserve the benefit obligation and eligible renewal cohort. The new member is acquisition, not an existing-member renewal; no result is inferred from the reminder.

**Readiness:** source only; implementation not started; runtime acceptance not executed; configuration unverified; no mission grant/activation. Current trusted contact-to-fulfillment path and shared contact arbitration incomplete; Due/benefit policy and complete mission outcome classification unresolved. **Acceptance anchors:** OM-A01, OM-A09, OM-A10, OM-A18, OM-A23, OM-A32, OM-A34. **Decisions:** OM-D01, OM-D02, OM-D03, OM-D04, OM-D05, OM-D06, OM-D07, OM-D11, OM-D13.

### Get paid faster — `faster_payment`

**Outcome:** Reduce completion-to-invoice and invoice-to-payment delays while reporting current receivables and collected cash separately. **Primary metric:** unresolved between `completion_to_invoice_delay` and `invoice_to_payment_delay` (OM-D01).

**Cohort:** Eligible billable completions and their invoices, with paid and still-open items retained; fixed-horizon rates and aged balances accompany paid-item timing. **Period:** Declared eligibility/enrollment period, contractual due dates and fixed observation horizon in company local time. Target value/change and approval remain required run inputs.

**Eligibility:** Reliable verified billable completion and correct scope. Current invoice/due/delivery status and authoritative payment, credit/refund and dispute evidence. Existing authorized payment route; no assumed autopay or settlement authority.

| Required facts | Existing source IDs | Missing/uncertain behavior |
| --- | --- | --- |
| `billable_completion`: Accepted scope, billable completion, contract milestone and required documentation. | `job`, `invoice`, `estimate` | Create accountable prerequisite task; do not issue unsupported or premature invoice. |
| `current_balance_and_dispute`: Current canonical balances, allocations, due dates, dispute and payment uncertainty. | `invoice`, `payment` | Reconcile first; suppress reminders while balance or payment evidence is unreliable. |
| `delivery_and_permission`: Verified delivery capability, current contact scope and existing supported payment access. | `action_receipt`, `consent`, `payment` | Prepare a draft/handoff; no inference from queued receipt and no new charge route. |

**Allowed methods:** `invoice_readiness.v1`, `collection_followup.v1`, `operations_review.v1`. Route by actual bottleneck: missing documentation, invoice delivery, payment access, eligible overdue reminder or dispute handoff. Retain both paid and open invoices.

**Authority:** Existing invoice issue/delivery and payment-access authority only. No inferred autopay, write-off, settlement, new discount, escalation, processor or bank changes. **Stops:** Paid or disputed invoice; Contact restriction or revoked/expired grant; Unreliable balance or unresolved payment effect; Not contractually overdue for a collection reminder.

**Guardrail slots:** `fixed_horizon_payment_rate`, `aged_open_balance`, `inappropriate_contact_and_dispute_handling`, `invoice_correctness`. Required policy fields and missing-data rules remain explicit in the JSON; no universal threshold is approved here.

**Verification:** Verified prerequisite resolution, valid provider delivery when applicable, and authoritative settled payment allocations. Existing receivable collection never becomes newly generated earned revenue. **Maturation:** Open invoices remain open/censored observations at the declared horizon. Paid-invoice timing and paid-by-horizon rates use separate denominators.

**Always report both delay stages**, plus due-date/fixed-horizon payment rates, aged open balance and overdue cash recovered. Select the primary stage using the declared bottleneck/target before approval. No universal blended delay metric is invented.

**Prepared example `CAT-PAY-01`:** A planning snapshot showed an overdue balance; A later authoritative payment settles it before dispatch; Other cohort invoices remain unpaid. **Expected:** Suppress the stale reminder. Record actual settled cash and retain the unpaid invoices in open-balance and fixed-horizon measures.

**Readiness:** source only; implementation not started; runtime acceptance not executed; configuration unverified; no mission grant/activation. Primary stage/target and observation horizon require explicit selection; Actual delivery, current provider-boundary suppression and mission projection acceptance incomplete. **Acceptance anchors:** OM-A01, OM-A09, OM-A15, OM-A16, OM-A19, OM-A30, OM-A33, OM-A34. **Decisions:** OM-D01, OM-D04, OM-D05, OM-D06, OM-D07, OM-D09, OM-D11, OM-D13.

### Organize my business — `organize_business`

**Outcome:** Resolve evidence-backed issues within a declared review scope and show remaining commitments by condition. **Primary metric:** `verified_issue_resolutions`.

**Cohort:** Canonical tenant/entity/condition episodes within four declared review areas; coverage, deferrals and unresolved findings remain explicit. **Period:** Declared review scope, look-ahead and due dates; completion of a review differs from downstream business outcome. Target value/change and approval remain required run inputs.

**Eligibility:** Evidence-backed condition in a declared review scope. Current source ownership/version and an accountable next step. Reuse active work before creating a new finding/action.

| Required facts | Existing source IDs | Missing/uncertain behavior |
| --- | --- | --- |
| `unfinished_work`: No valid next action, missing billing prerequisite or unfulfilled benefit with authoritative condition evidence. | `estimate`, `growth_intake`, `invoice`, `agreement` | Show missing coverage or source verification need; no finding invented solely from age. |
| `schedule_and_materials`: Known committed work, required skills/windows/travel and verified material state. | `job`, `dispatch`, `booking`, `inventory` | Unknown stock is unverified; create accountable check, and let unrelated work proceed. |
| `suitable_options`: Documented customer need or qualified finding linked to a compatible approved option. | `product_catalog`, `estimate`, `job` | Request qualified review; inventory surplus alone does not establish need. |

**Allowed methods:** `operations_review.v1`, `estimate_recovery.v1`, `service_options.v1`, `due_service.v1`, `invoice_readiness.v1`, `collection_followup.v1`, `schedule_correction.v1`, `material_readiness.v1`. Wave 1 is assessment/draft-only. Full activation later requires at least one approved domain correction and condition-specific verification; scan count or a draft alone does not satisfy it.

**Authority:** Permitted record review and internal drafts use existing authority. Customer contact, schedule changes, stock transfers, purchases and offers need their specific approval/grant. **Stops:** Source cannot establish the condition or its resolution; Required domain authority absent; Incompatible existing commitment or action; Unsupported supplier action remains recommend-only.

**Guardrail slots:** `review_coverage`, `committed_work_risk`, `resolution_evidence_completeness`, `remaining_commitments`. Required policy fields and missing-data rules remain explicit in the JSON; no universal threshold is approved here.

**Verification:** Condition-specific proof: valid next action and due date, accepted documentation, feasible committed schedule, verified/reserved stock or fulfilled benefit. An unresolved estimate outcome remains pending even after its next-action finding resolves. **Maturation:** Review can close with explicit deferred/blocked items; downstream bookings, payments and service outcomes mature independently.

**Four review areas:** `unfinished_work`, `scheduling_and_job_readiness`, `inventory_and_materials`, `relevant_product_and_service_opportunities`. Show each area's coverage, unknown/stale facts, deferrals and remaining owned commitments.

**Prepared example `CAT-ORG-01`:** A job requires a known part; Stock record is stale; Another estimate lacks a valid next action. **Expected:** Create a stock-verification requirement and independently prepare the estimate next action. Neither unknown stock nor a sent reminder proves business resolution.

**Readiness:** source only; implementation not started; runtime acceptance not executed; configuration unverified; no mission grant/activation. OM detectors/finding state and condition-specific resolution acceptance not implemented; Wave 1 assessment must not be advertised as complete execution. **Acceptance anchors:** OM-A01, OM-A10, OM-A11, OM-A20, OM-A25, OM-A34. **Decisions:** OM-D01, OM-D03, OM-D04, OM-D05, OM-D06, OM-D07, OM-D11, OM-D13.

## Shared methods and proposed classification

**Conditional capability gating:** the mission capability list is a catalog of possible requirements, not a simultaneous requirement for every allowed method. Evaluate only the selected method graph and applicable dependency conditions. At least one eligible end-to-end accepted route is needed for mission activation; an unavailable unselected ad connector does not block a complete internal route. Source-table `supportedMissions`/`rootSelectableMissions` describe independent root selection. A child can inherit its selected parent's root mission only through an explicitly accepted finite edge, while retaining all child preconditions and current authority/resource/budget checks; this cannot grant new authority or make that child independently selectable for another root.

The source fixes the thirteen IDs below and defines `strategy | support | coordinator`, but does not explicitly assign every method's kind. These assignments and finite dependency edges remain **proposed under OM-D13**. Portfolio coordinator semantics are explicit in the source; registration still requires an accepted graph. A missing classification cannot pass readiness. Promoting a support method to an independently selected strategy requires a reviewed version/classification decision and slot accounting.

| Exact method | Proposed kind | Scope / source reuse |
| --- | --- | --- |
| `search_acquisition.v1` | strategy | One approved service/geography Google Search campaign plus owned form path. Root missions: `more_bookings`, `monthly_revenue`, `average_job_value`. |
| `inquiry_conversion.v1` | support | Capture, qualify, request missing fields, offer a valid next step and confirm eligible work. Root missions: `more_bookings`, `monthly_revenue`. |
| `estimate_recovery.v1` | strategy | Eligible estimate/inquiry next action and bounded approved follow-up. Root missions: `more_bookings`, `monthly_revenue`, `organize_business`. |
| `service_options.v1` | strategy | Relevant verified catalog options and approved estimate presentation. Root missions: `average_job_value`, `monthly_revenue`, `organize_business`. |
| `due_service.v1` | strategy | Legitimate due service and included benefit fulfillment. Root missions: `repeat_business`, `monthly_revenue`, `organize_business`. |
| `agreement_renewal.v1` | strategy | Eligible existing agreement renewal and customer decision through supported workflows. Root missions: `repeat_business`, `monthly_revenue`. |
| `agreement_enrollment.v1` | strategy | Separately gated new agreement enrollment; eligible acquisition strategies may reference it only under an accepted bounded dependency plan. Root missions: `monthly_revenue`. |
| `invoice_readiness.v1` | strategy | Resolve prerequisites and prepare/deliver the correct invoice through existing authority. Root missions: `faster_payment`, `organize_business`. |
| `collection_followup.v1` | strategy | Current-balance confirmation, approved reminder/payment access and receipt reconciliation. Root missions: `faster_payment`, `organize_business`. |
| `operations_review.v1` | support | Four bounded scan areas with deduplicated evidence-backed findings; scoped readiness input can support other missions. Root missions: `organize_business`. |
| `schedule_correction.v1` | support | Feasible proposal and approved schedule correction through the authoritative domain owner. Root missions: `organize_business`, `more_bookings`, `monthly_revenue`. |
| `material_readiness.v1` | support | Verify stock, reserve known requirements and use approved supported transfers; a prerequisite for relevant committed work. Root missions: `organize_business`. |
| `revenue_portfolio.v1` | coordinator | Coordinate up to two independently selected eligible strategies, one paid channel and one shared resource/accounting envelope. Root missions: `monthly_revenue`. |

Each JSON method record contains preconditions, required source facts/freshness, proposed capabilities, step template, finite dependency list, resource/tool limits, authority, stops, verification, maturation, retry/model rules, acceptance anchors and unresolved decisions. All thirteen have `executable: false`; no adapter/evaluation/grant is inferred from source presence.

### Finite composition

`monthly_revenue` can coordinate **Search acquisition plus eligible estimate recovery: two strategies and one paid channel**. Inquiry conversion and only relevant schedule/material prerequisites are bounded support. A suitable Search test can be proposed with no recovery backlog and without a full Organize scan.

The proposed graph is finite: portfolio → selected strategy (at most two); Search/recovery/due service → conversion when relevant; conversion/options/due service/enrollment → applicable scheduling/material readiness; scheduling → applicable material readiness. Material readiness has no child. Invoice readiness, collection, renewal and operations review call scoped domain services without dynamically selecting other methods. The complete conditional edges are in JSON; they are planning proposals pending OM-D13, not a registered graph.

`operations_review.v1` creates findings and permitted drafts. Any later corrective strategy is explicitly selected within the same limits and separately authorized. A strategy-classified child consumes a strategy slot. No recursive composition, runtime reclassification or duplicate child-mission budget is allowed. All support uses the same contact, resource, model and financial budgets.

## Shared action and result rules

- **Authority:** mission selection permits only applicable reads/drafts. Consequential action requires current capability scope and the exact immutable plan/content/offer, target, channel, resource, exposure and expiry. Existing generic role access is not a spending, pricing or purchasing grant (OM-D04/05).
- **One intent:** derive tenant/opportunity-or-entity/intent/cadence/content-version identity without mission ID. Compatible contributors share one action; incompatible payloads conflict. A canonical outcome is counted once with non-additive contributor links (OM-D07).
- **Contact and cancellation:** proposed pilot cap is two follow-up attempts per seven days per service intent across missions, subject to tighter method cadence. Essential notice exceptions remain open (OM-D05). Cancellation removes sponsorship; continuation needs another independently valid approval covering the identical payload/exposure. Pause stops new dispatch while in-flight work remains visible and reconciled.
- **Plan versions:** a draft replacement does not revoke an approved active plan. Accepted replacement atomically switches the active version; obsolete unstarted work is invalidated and in-flight evidence preserved.
- **Resources:** existing domain services own atomic booking/stock truth. Mandatory qualifications/windows/travel/materials filter before ranking. Verified on-hand minus committed reservations determines available stock; unreceived orders and unknown stock are not availability. Diagnostics use actual known requirements (OM-D06).
- **Results:** execution, domain outcome and estimated effect remain distinct. Separate inquiry, assessment, accepted future work, completion, invoice, earned revenue, cash and contribution. Never use the legacy paid/invoiced/estimated fallback as earned-revenue truth. Unknown mandatory components produce incomplete totals, not zero or success (OM-D01/02/03/11).
- **Time and money:** UTC timestamps, actual company IANA zone for business periods, currency-qualified decimal strings/Decimal arithmetic. No arbitrary tenant time zone or floating-point money.
- **Retries and budgets:** at most three automatic dispatch attempts only for an accepted retry-safe adapter; uncertain provider effects reconcile before retry. Mandatory deterministic receipts, reconciliation and existing commitments continue when new model/spend-dependent work is blocked. Routine scans/eligibility/accounting use zero model calls; specialist caps are prepared separately.

## Source pins and readiness

[04-source-map.md](04-source-map.md) provides source/consumer detail. The JSON pins the following source IDs to this exact base; these are **source-presence evidence only**.

| Source ID | Pinned reusable file |
| --- | --- |
| `tenant_context` | [tenant-context.ts](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/packages/types/src/agent-control-plane/v1/tenant-context.ts) |
| `entity_ref` | [entity-ref.ts](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/packages/types/src/agent-control-plane/v1/entity-ref.ts) |
| `action_service` | [agent-action.service.ts](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/agent-action.service.ts) |
| `action_registry` | [agent-action.registry.ts](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/agent-action.registry.ts) |
| `action_receipt` | [agent-action-receipt.ts](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/agent-action-receipt.ts) |
| `revenue_proposals` | [revenue-agent-proposals.service.ts](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/revenue-agent/revenue-agent-proposals.service.ts) |
| `legacy_outcomes` | [revenue-outcomes.service.ts](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/revenue-outcomes.service.ts) |
| `growth_intake` | [growth-intake-foundation.service.ts](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/growth-intake-foundation.service.ts) |
| `booking` | [booking.service.ts](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/booking.service.ts) |
| `dispatch` | [dispatch-intelligence.service.ts](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/dispatch-intelligence.service.ts) |
| `inventory` | [inventory.service.ts](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/inventory.service.ts) |
| `invoice` | [invoice.service.ts](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/invoice.service.ts) |
| `payment` | [payment.service.ts](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/payment.service.ts) |
| `job` | [job.service.ts](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/job.service.ts) |
| `estimate` | [estimate.service.ts](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/estimate.service.ts) |
| `product_catalog` | [product-catalog.service.ts](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/product-catalog.service.ts) |
| `agreement` | [service-agreement.service.ts](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/service-agreement.service.ts) |
| `company_settings` | [company-settings.types.ts](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/packages/types/src/company-settings.types.ts) |
| `consent` | [outbound-consent.service.ts](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/outbound-consent.service.ts) |
| `retention` | [retention-gates.service.ts](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/retention-gates.service.ts) |
| `queues` | [queues.ts](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/packages/jobs/src/queues.ts) |

| Evidence layer | Current state | Next evidence required |
| --- | --- | --- |
| Source presence | Existing domain/action/tenant/queue sources present | Revalidate source consumers against the implementation head |
| Preparation | Six sheets, thirteen method records, six synthetic mission examples | Resolve affected policy/classification decisions |
| OM implementation | Not started; no installed contracts/registries/runtime exports | Scoped Codex implementation after phase permission |
| Runtime evidence | Not executed | Actual end-to-end evidence tied to code/policy versions |
| Tenant readiness/authority | Unverified; no fabricated account, grant, target or budget | Current tenant-owned configuration and capability authority |
| Activation | Not authorized; all records non-executable | Accepted method/capability/verification/evaluation versions and applicable activation authority |

## Handoff

Use [DECISIONS.md](DECISIONS.md) for OM-D01–OM-D13, [01-ticket-crosswalk.md](01-ticket-crosswalk.md) for existing scope/acceptance anchors and [05-authority-lifecycle-contracts.md](05-authority-lifecycle-contracts.md) for authority/lifecycle preparation. Actual implementation owners remain unassigned; this creates no new ticket or permission.

**Completed preparation:** all exact six mission IDs/labels, thirteen shared method IDs, explicit target/guardrail slots, source/freshness/unknown behavior, capability/authority gaps, finite proposed dependencies and non-executable readiness. The six examples are synthetic and not executed. Artifact consistency checks are not runtime OM-A01 sign-off.
