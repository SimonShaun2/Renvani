# Start Here: Renvani Platform Analytics

November 7, 2026 · Stripe + PostHog · Plan plus H01–H04 preparation v1.1

## What was selected

Use Stripe's financial records and PostHog's existing analytics interface for Renvani's first internal reporting workspace. Renvani supplies the authoritative business meanings, stable company identity, outcome evidence, and permissions. Keep one primary AI trace path and reuse existing Langfuse work where useful. No custom dashboard application or separate analytical warehouse is required to start.

## Read in this order

1. [Build plan](../planning/PLATFORM-ANALYTICS-BUILD-PLAN-2026-11-07.md).
2. [Preparation we can complete here](../build-specs/PLATFORM-ANALYTICS-01-CHATGPT-FOUNDATION-SPRINTS-2026-11-07.md).
3. [Technical specification and Codex/Cursor tickets](../build-specs/PLATFORM-ANALYTICS-02-CODEX-CURSOR-SPRINTS-2026-11-07.md).
4. [Machine-readable ticket ledger](../planning/platform-analytics/ticket-ledger.v1.json).
5. Current repository AGENTS.md, CODEX.md, applicable FS board records, existing Connected Intelligence foundation/C-track, and the Outcome Intelligence Engine charter linked in the build plan.

## Status and scope

The package now includes the authorized **H01–H04 preparation artifacts**, with source/ownership decisions, 24 metric definitions, identity/event/outcome contracts and export/access/retention rules. Read the [Track A checkpoint](../planning/platform-analytics/preparation/H01-H04-CHECKPOINT.md) and its review/validation receipts. Of 31 local tickets, 4 have preparation deliverables and 27 remain planned: H05–H08, 20 integration tickets and 3 later-learning tickets. Official FS assignments, merged/runtime acceptance and production integration remain separate.

The 12 core H01–H04 deliverables exist. H05's fixture/expected-result suite, H06 dashboards/queries, H07 connector/cost runbook and H08 full preparation acceptance remain future work. Bounded document/contract checks in this checkpoint do not substitute for them.

## Source baseline and reuse

Verified baseline: `dev` at `5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58`. Refresh it before coding. #442, #445, #449, and #452 were verified merged. Reuse mission preparation, workflow services, existing specs, and H01–H16 contracts/calculations. FS-43/#142 is closed unmerged with preserved work; reconcile compatible instrumentation instead of duplicating it.

Some historical Notion/repository prose still says these merged PRs are unmerged. Use current GitHub metadata for source state and separate that from runtime/release acceptance. A merged foundation is not a deployed reporting integration.

## Next work here

H01–H04 now supplies the first preparation subset. Continue with **H05** synthetic fixtures/expected results, **H06** dashboard/query contracts, **H07** provider/cost setup and **H08** full preparation review/handoff when that next scope is started. The expanded decision register records unresolved implementation choices and safe interim behavior.

Small pure validators and synthetic fixtures are appropriate here when subsequently authorized and actually verified. Reuse RCI quality and exact-Decimal design; current two-decimal money/fact schemas need a reviewed adapter/extension for PA metrics and AI precision. New runtime exports, real source connections and production acceptance remain C-track work.

## First Codex/Cursor slice

Begin with **C01** source/ownership/provider discovery. Consume the accepted preparation subset. Implement **C02/C03**, configure **C05** in parallel where account access and field policy allow, connect **C04**, and complete **C06–C08** financial classification/reconciliation. Pull **C10** activation forward after C02/H02/H03 and the selected authoritative milestone source are available. If new C09 work is needed to establish that milestone, defer the affected activation cards and release billing/data-health first.

Configure the eligible **C13/C14** cards and data-health portions of **C16**. Run **C17** for that exact enabled scope, observe **C18**, and release through **C19** with applicable review and founder authority. Billing/data-health does not wait for C09 outcome allocation, C11 AI capture, C12 complete costs, C20 learning readiness, or any L ticket. Activation joins only when its approved milestone already has authoritative source evidence. Missing panels remain unavailable or clearly partial.

Next expand the accepted scope to the existing estimate-recovery lifecycle with **C09**, AI usage with **C11**, cost coverage with **C12**, and **C15** plus the relevant C16 panels. Refresh acceptance for the expansion. Financial outcome cards require the same source reconciliation as the economics cards.

## Non-negotiable implementation constraints

- Platform subscriptions, actual platform fees, merchant payments/memberships, processor costs, and transfers are separate financial concepts.
- Founder pricing direction is 5%; inspected checkout code uses 2% on applicable plans. Analytics reports actual fee records and routes the separate pricing alignment issue. It does not change rates or reinterpret founder direction.
- Company identity is server-verified; provider keys include account and live/test scope. Unknown mappings remain exceptions.
- Database and vendor access must enforce the approved export policy. A PostHog group or saved filter is not a security boundary.
- Inspect actual native connector fields before real transfer. If its payload cannot meet the field policy, use a reviewed filtered export alternative.
- Use one Stripe ingestion path per dataset and one primary AI trace path. Preserve source versions, actual sync freshness, corrections, and deduplication.
- Missing data and costs remain missing. Associated workflow revenue is not incremental lift. Multiple product assists cannot multiply a payment's economic value.
- Domain services own writes. Reporting replay never sends a message, charges, books, approves, or changes a job. Keep operational payment webhooks independent.
- Shared learning has separate rights, dataset, evaluation, and release gates. New mission runtime retains the original Phase A/B sequence.

## Required review evidence

The first accepted integration records the exact application commit, provider accounts/modes, source schema and configuration versions, dashboard/query definitions, allowed fields, access tests, relevant CI, reconciliation samples, actual source-lag/cost measurements, and independent review findings. Record the actual reviewer and evidence; do not assign fictitious reviewers or self-certify runtime QA.

The founder retains merge authority for each named PR and exact reviewed head under current repository rules. Publishing this planning package does not request or authorize an application release, paid service activation, or production data transfer.

## Copyable implementation brief

```text
Work from the current SimonShaun2/Renvani dev head and read AGENTS.md/CODEX.md.
Read the Platform Analytics build plan and both dated specifications linked above.
Reconcile current FS ownership and preserve merged #442/#445/#449/#452 work and FS-43 requirements.
Start with PAI-C01 discovery and the accepted H01/H03/H04/H07 inputs.
Produce a bounded integration slice for stable company identity, approved reporting exports,
and Stripe resource/field coverage. Do not rebuild the existing foundation.
Use actual fee records; preserve the founder 5% direction versus current source discrepancy.
Keep native dashboards internal and all business execution in existing authorized services.
Record what is implemented, what was actually tested, and what remains blocked or disabled.
Do not merge, purchase, transfer production data, or activate missions outside existing authority.
```

## Publication references

- [Notion build plan](https://app.notion.com/p/411317b92d15819bbaa1e440c435716d?pvs=204).
- [Notion preparation specification](https://app.notion.com/p/411317b92d1581938f51d90f152246e9?pvs=204).
- [Notion Codex/Cursor technical specification](https://app.notion.com/p/411317b92d1581cfb465f6b51677013f?pvs=204).

The Notion plan and companion specs are linked from the Product & Build HQ and Connected Intelligence parent. The GitHub publication is a documentation-only branch/PR. Refer to its current head when reviewing this package; application implementation should branch from the verified intended code baseline and use accepted preparation, not assume the documentation branch is a deployed release.
