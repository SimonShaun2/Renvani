# Track A H01–H04: Definitions and boundaries checkpoint

November 7, 2026 · Stripe + PostHog internal analytics · Preparation v1.0

## Scope and state

The user authorized PAI-H01–H04. This batch supplies the source/owner map, versioned metric definitions, identity/event/outcome contracts and permitted export design. **These are usable preparation artifacts; runtime integration remains in the C track.** Review and validation evidence is recorded separately below. Local PAI states describe this artifact delivery, not official FS Done status, merged code or production acceptance.

Application source inspected: `5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58`. Planning baseline: `e374f5007878e547958ae0e3c26098e58420171a`, [draft PR #459](https://github.com/SimonShaun2/Renvani/pull/459). This package is added to the existing planning branch. Refresh its actual head and `dev` before any runtime implementation.

## Delivered contract set

| Ticket | Deliverables | What they settle for the implementer |
| --- | --- | --- |
| PAI-H01 | [Source register](source-register.json), [decision register](decision-register.md), [ownership crosswalk](ownership-crosswalk.md) | Exact code/document/PR evidence, reuse of existing work, owner functions, open decisions and bounded gates |
| PAI-H02 | [24-metric catalog](metric-catalog.v1.json), [financial classification](financial-classification.md), [data dictionary](data-dictionary.md) | Platform versus merchant money, metric formula/population/time/unit/source/quality rules, reconciliation meanings and worked amounts |
| PAI-H03 | [Identity contract](identity-contract.md), [versioned event contracts](event-contracts.v1.json), [outcome lifecycle](outcome-lifecycle.md) | Stable company/provider identity, meaningful lifecycle states, revisions/idempotency, exact payment allocations and assistance limits |
| PAI-H04 | [Export field allowlist](export-field-allowlist.v1.json), [reporting access matrix](reporting-access-matrix.md), [retention and correction policy](retention-correction-policy.md) | Permitted fields/purposes/readers, native-connector acceptance conditions, deletion/correction handling and policy decisions |

The machine-readable JSON files describe proposed versioned reporting contracts and governed definitions. They are not production database migrations, active SDK schemas or a claim that PostHog currently accepts every field or calculation.

## What the source review changes about implementation

1. **Reuse the merged foundations.** #442, #445, #449 and #452 are merged in the inspected baseline. FS-43/#142 is closed unmerged with useful preserved work. Source presence and recorded historical tests do not establish deployed analytics.
2. **Adopt RCI through an explicit adapter/version decision.** The existing RCI v1 money/fact helpers assume two decimal places and its catalog does not register PA-M01–PA-M24. Preserve variable currency exponents and AI micro-costs; coordinate C02/C06/C11 with RCI-C02/C05 before runtime adoption.
3. **Inspect the real Stripe export fields before choosing the native path.** PostHog's managed Stripe source does not have the same column-masking control as eligible SQL sources. If its complete payload cannot meet H04, use the prepared sanitized-export alternative.
4. **Measure business state from authoritative evidence.** Existing activity/event names and queued execution receipts do not by themselves prove delivery, completion or collected cash. Identity and lifecycle contracts preserve each state and the source required to establish it.
5. **Use actual fees while pricing alignment remains separate.** Founder direction recorded in the accepted plan is 5%; inspected applicable checkout source is 2%. The financial catalog uses actual historical fee/refund postings; this batch changes neither price nor checkout behavior.

These findings are supported by the pinned source register and the relevant H02–H04 documents. They are implementation decisions, not a reason to rebuild the reporting stack.

## Acceptance mapping for this batch

| Ticket / criterion | Evidence artifact | Verification boundary |
| --- | --- | --- |
| H01.1 source pin, owner, evidence level and limit | source-register.json | Pinned source/document readback; live accounts not inspected |
| H01.2 existing PR/FS/RCI reuse mapping | ownership-crosswalk.md | Actual PR metadata and bounded board/spec reads; no invented FS assignment |
| H01.3 founder 5% versus source 2% discrepancy | decision-register.md D06; financial-classification.md | Explicit evidence distinction; no pricing change |
| H01.4 owners, affected tickets and phase/release gates | decision-register.md; ownership-crosswalk.md | Owner functions and conditional implementation gates recorded |
| H02.1 complete versioned 24-metric definitions | metric-catalog.v1.json; data-dictionary.md | Definition-field/source/card coverage review; queries not yet implemented |
| H02.2 separate platform and merchant components | financial-classification.md | Hand-calculated classification examples; actual provider reconciliation deferred |
| H02.3 actual fees, MRR/cash/settlement/recognition | metric-catalog.v1.json; financial-classification.md | Explicit status/discount/proration/time rules and worked amounts |
| H02.4 missing costs, currencies, imported history, claim limits | All H02 files | Contract review and negative examples; no complete-profit or lift claim |
| H03.1 trusted company and account/mode/object mapping | identity-contract.md | Synthetic collision examples; authentication/RLS runtime tests deferred |
| H03.2 versioned event envelope and source/time references | event-contracts.v1.json | Proposed field contract mapped to inspected source; adapters still required |
| H03.3 lifecycle fact separation | outcome-lifecycle.md | Separate approval/attempt/ack/delivery/response/booking/completion/collection meanings |
| H03.4 replay, revision, allocation and non-additive assists | identity-contract.md; outcome-lifecycle.md | Worked duplicate/correction/refund/allocation cases; no operational replay |
| H04.1 purposes, internal/customer/learning access | reporting-access-matrix.md | Prepared role/purpose policy; account permissions untested |
| H04.2 default-deny sensitive fields | export-field-allowlist.v1.json | Concrete accepted/denied fields; real payload tests deferred |
| H04.3 read-only identity, vendor exports and fallback | reporting-access-matrix.md; allowlist | Proposed grants/scope and native payload gate; no credentials configured |
| H04.4 retention, withdrawal, corrections and deletion | retention-correction-policy.md | Concrete proposed handling/owners; actual vendor purge/backup limits require proof |

See [H01–H04 review record](h01-h04-review.md) and [bounded validation receipt](h01-h04-validation.v1.json) for actual reviewer findings, corrections, artifact hashes and checks. This receipt is not H05's fixture suite, H08's full preparation review, approved CI or C17's runtime acceptance.

## Decisions still needed before the affected integration

The [decision register](decision-register.md) supplies a route and interim behavior for each item. The main open items are actual Stripe account/object coverage and sanitized/native export choice; accepted metric/activation policy; live provider region, access entitlement and retention; one AI trace path; cost coverage and allocation; RCI contract adaptation; current FS runtime ownership; and the separate pricing alignment. Source/field/policy discovery can run in parallel with the next preparation sprint.

An open policy does not make the entire dashboard project blocked. The initial billing/data-health slice can proceed through its own accepted sources and gates. Activation needs the chosen authoritative milestone. Outcome, AI and full-cost cards remain unavailable or partial until their particular sources are accepted.

## Next work here

H05–H08 remain planned:

- **H05:** turn these definitions and worked examples into the structured synthetic fixture/expected-result acceptance suite. Reuse accepted exact-arithmetic helpers only where compatible; make the precision adapter gap explicit.
- **H06:** build the four dashboard blueprints, card/filter matrix and logical queries from the accepted metric definitions and H05 cases.
- **H07:** prepare the detailed provider configuration/cost/runbook and actual-account evidence checklist using H04's field/access/retention constraints.
- **H08:** independently review the full preparation package, its executed offline evidence and the first implementation handoff.

Those deliverables are not silently claimed complete by publishing this checkpoint. No `preparation/START-HERE.md`, fixture harness or full H08 coverage receipt is substituted for their planned work.

## What Codex/Cursor can pick up

Read C01 and reconcile actual source/FS owners, provider accounts and chosen contract subset. Coordinate C02 identity and RCI adaptation, C03 approved projections/principal, and C05 actual Stripe object/field coverage. H04 gates any real transfer. H05/H07 supply the remaining fixture and configuration evidence; C04/C06–C08 implement sync, classification, corrections and financial reconciliation. No live provider setting or financial behavior was changed by this preparation.

The existing [technical specification](../../../build-specs/PLATFORM-ANALYTICS-02-CODEX-CURSOR-SPRINTS-2026-11-07.md) remains the implementation backlog. The [ticket ledger](../ticket-ledger.v1.json) distinguishes this four-ticket preparation delivery from the remaining four preparation tickets, 20 integration tickets and 3 later learning tickets.
