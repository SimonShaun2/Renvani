# 07 — Organize detectors and review examples

**Status: prepared, not executed.** This package specifies deterministic condition checks and 28 synthetic examples for the four Organize review areas. It adds no production detector, schedule change, stock reservation, contact, purchase or model invocation. The companion [fixtures/detector-examples.json](fixtures/detector-examples.json) is planning/test data, not installed policy.

**Source:** [Part II v1.1 §§9.1, 15, 18 and 21](https://app.notion.com/p/40e317b92d1581188031e8a0a4c847c9), pinned repository baseline `7840884d346ca95788e2668cc78148afa3b6a843`. Reuse the source consumers in [04-source-map.md](04-source-map.md), the proposed methods in [02-mission-catalog.md](02-mission-catalog.md), and current authority/lifecycle boundaries in [05-authority-lifecycle-contracts.md](05-authority-lifecycle-contracts.md).

## Review contract

An Organize run declares tenant, review scope, as-of time, company IANA zone, operating calendar, source versions and field freshness. It reports scanned coverage for each area, evidence-backed findings, unknown/stale facts, linked active work and remaining commitments. It does not invent a single organization score or count open estimate value as recovered revenue.

All routine scans, eligibility checks, ranking constraints and resolution calculations use **zero model calls**. A bounded specialist may help interpret genuinely ambiguous notes after deterministic detection, but its interpretation cannot establish stock, qualification, customer acceptance, payment, completion or permission truth.

| Proposed detector | Area | Positive condition | Condition-specific resolution |
| --- | --- | --- | --- |
| `OM-DET-R01` / `no_valid_next_action` | `unfinished_work` | Eligible open estimate/inquiry lacks a valid owned next action after the applicable operating-calendar interval. | A valid accountable next action with due date resolves this condition only; the estimate's business outcome stays pending. |
| `OM-DET-R02` / `missing_invoice_documentation` | `unfinished_work` | Verified billable completion lacks an accepted required document and is unfinalized at least one business day, with no later contractual milestone. | Authoritative acceptance of the required document; invoicing and payment remain separate outcomes. |
| `OM-DET-R03` / `unfulfilled_benefit` | `unfinished_work` | An authoritative included benefit is due in thirty days/overdue and no fulfilled or active fulfillment record covers the obligation. | Authoritative fulfillment linked to the obligation, not a reminder or duplicate paid-service record. |
| `OM-DET-R04` / `infeasible_commitment` | `scheduling_and_job_readiness` | Committed work within fourteen days has a verified qualification/window/travel/time conflict or missing required job prerequisite; verified risk within forty-eight hours is urgent. | Authoritative feasible committed schedule and accepted required prerequisites; a proposal is not correction. |
| `OM-DET-R05` / `unverified_or_short_required_stock` | `inventory_and_materials` | Known requirements for committed work exceed verified on-hand minus committed reservations, or required stock is stale/unverified. | Required stock verified and reserved or a supported approved transfer verified; purchase recommendation/order alone cannot resolve. |
| `OM-DET-R06` / `documented_suitable_need_absent_from_estimate` | `relevant_product_and_service_opportunities` | Documented customer need or qualified finding maps to compatible approved catalog option absent from the current estimate. | Current suitable option added to a permitted draft or accepted appropriate disposition; presenting it does not prove sale, completed work or earned revenue. |

The scheduling detector includes verified missing job prerequisites as well as infeasible commitments; unknown prerequisites require verification rather than an invented technical rule. Inventory separates a verified shortage from unverified stock. Actual service/qualification/material/due policies remain OM-D06; identity and correction continuity remain OM-D07.

## Conditions and cadence to preserve

- **Estimates:** sent/open valid scope, no acceptance/decline/expiry, no newer customer reply awaiting staff, no active duplicate action. Initial follow-up requires at least two business days since meaningful contact; the next requires at least five business days after the prior one. Both must pass the shared cap and current permission.
- **Missed inquiries:** unanswered for thirty operating minutes with no staff response/action. Unclear scope or urgency routes to staff.
- **Invoice readiness:** verified billable completion unfinalized for one business day, unless a contract sets a later milestone. Missing documentation is addressed before invoice issue.
- **Collection:** authoritative positive balance after the contractual due date plus one business day, no dispute/payment uncertainty/contact restriction; later reminder no sooner than seven calendar days. The Organize finding does not create collection authority.
- **Due service/benefits:** authoritative due date within thirty days or overdue. No inferred maintenance interval. Renewal uses the supported existing agreement window: initially thirty days before expiry, with an eligible reminder seven days before expiry; decisions/changed terms stop or revise it.
- **Schedule/material:** committed work in the next fourteen days; verified risk within forty-eight hours is urgent. Known diagnostic requirements differ from undiagnosed repair needs.
- **Options:** documented need/request or qualified finding, current compatible approved catalog, estimate stage, relevant feasibility. Changed accepted scope needs fresh customer acceptance.

These are proposed source pilot defaults, subject to owner-approved policy and the actual operating calendar. No age rule overrides decline, newer replies, consent, eligibility, an active action or an obligation. The shared pilot contact cap is at most two follow-up attempts in seven days per service intent across missions; essential-notice exceptions remain unresolved under OM-D05.

## Finding lifecycle and exact evidence

Use one canonical finding per tenant/entity/condition episode. The fixture identity intentionally excludes mission ID. The production split/merge/continuity rule remains OM-D07: the examples assume a continuing issue whose prior resolution was invalidated, retain the same episode, and preserve closure/reopen history. They do not authorize arbitrary merging of distinct needs.

A duplicate scan updates evidence or links an existing active compatible action. It never creates a second contact budget, reservation or correction. A changed payload or competing resource use follows the shared conflict and authority contract.

A finding can remain open, require verification, resolve from condition-specific evidence, or reopen when an authoritative later event invalidates the resolution. These fixture labels are explanatory states, not new exported runtime enums. Resolution requires the correct source fact:

- A valid owned next action with a due date resolves **missing next action**; the estimate's customer outcome stays pending.
- Accepted required documentation resolves **missing document**; an invoice and cash are separate outcomes.
- A domain-committed feasible schedule resolves **schedule risk**; a suggestion does not.
- Physical stock evidence identifies checker, timestamp, location, item and quantity. Known stock plus an accepted reservation or supported verified transfer resolves material readiness; an unreceived order or purchase recommendation does not.
- Actual contractual benefit fulfillment resolves **unfulfilled benefit**, without duplicate earned-revenue recognition.
- Correctly including a verified suitable option in a permitted draft can resolve **missing option**; it does not establish customer acceptance, a sale or completed work.

Unknown or stale evidence never silently closes a finding. Customer contact, confirmed assignment, transfer, purchase and offer publication need their applicable current authority. Unsupported supplier purchasing stays a recommendation. The fixture's declared approval is synthetic and grants nothing to a real tenant.

## Example coverage

All examples use fictional identifiers and an explicitly declared fixture calendar/time zone. The zone is not a product default. Each includes exact allowed actions, refused actions, expected disposition, source facts and acceptance/decision references. None has execution evidence or a financial success claim.

| Area | Positive | Negative | Stale | Duplicate | Reopen | Resolution |
| --- | --- | --- | --- | --- | --- | --- |
| Unfinished work | OM-DET-01 | OM-DET-02 | OM-DET-03 | OM-DET-04 | OM-DET-05 | OM-DET-06 |
| Scheduling/job readiness | OM-DET-07 | OM-DET-08 | OM-DET-09 | OM-DET-10 | OM-DET-11 | OM-DET-12 |
| Inventory/materials | OM-DET-13 | OM-DET-14 | OM-DET-15 | OM-DET-16 | OM-DET-17 | OM-DET-18 |
| Relevant product/service opportunities | OM-DET-19 | OM-DET-20 | OM-DET-21 | OM-DET-22 | OM-DET-23 | OM-DET-24 |

Additional cases cover missing invoice documentation (OM-DET-25), unfulfilled included benefit (OM-DET-26), truthful partial coverage (OM-DET-27) and independent work continuing while stock verification is blocked (OM-DET-28).

### Partial scans and useful continuation

OM-DET-27 declares 12,420 source records, a proposed generic 250-record page, and a 10,000-record run budget. The effective page is the smaller of that proposed ceiling and the current source adapter limit: the pinned inventory source permits at most 200, so its pages use 200. At checkpoint the run reports 10,000 scanned and 2,420 remaining: unfinished work and scheduling are complete, inventory is partial, and product/service opportunities are unstarted. It persists a synthetic continuation cursor and source versions, displays verified urgent risk immediately, and refuses a complete-review claim. A restarted run must revalidate its scoped cursor/source assumptions rather than pretend mutable data is a frozen full scan.

Prioritize committed work at risk, then material operational/collection delays, then supported opportunities. Due time, severity, evidence quality, expected benefit and effort inform a transparent order; no universal hidden score is invented. Unequal technician job counts alone are not a defect. A stock-check blockage must not hold an unrelated estimate step whose own authority, freshness and resource checks pass.

A review may close with explicitly deferred or blocked items and accountable owners. Its report separates verified resolutions from unresolved commitments and coverage gaps. It cannot label the unresolved items successful.

## Codex handoff

Implement through current tenant-scoped domain readers and existing authoritative action/schedule/inventory services. Preserve source versions, current-action linkage, condition-specific verification, checkpoint/continuation, urgent-event handling and observability. Evaluate fixtures against the eventual implementation; this package only validates structure and coverage. Required decisions remain OM-D01, OM-D02, OM-D05, OM-D06, OM-D07 and the OM-D13 method graph. A fixture policy never approves business policy or runtime activation.
