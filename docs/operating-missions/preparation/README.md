# Part II foundation preparation

**Prepared for:** Renvani Operating Missions, Part II v1.1. **Date:** 2026-11-05. **Code baseline:** `7840884d346ca95788e2668cc78148afa3b6a843`. **Scope:** documentation, synthetic examples and offline preparation checks.

This package turns the agreed ten-item preparation sequence into bounded inputs for Codex. It reconciles current source/ticket facts, defines the missing decisions, and supplies exact expected behavior for the complex implementation. The original [Part II plan and specification](https://app.notion.com/p/40e317b92d1581188031e8a0a4c847c9) remain the product baseline. See [source provenance](SOURCES.md) and [open decisions](DECISIONS.md).

Preparation does not record Part I release acceptance, launch a mission, connect a provider, create live campaigns, grant business authority or execute application acceptance. Runtime implementation remains gated by Part I acceptance and founder permission. None of the synthetic values is a real tenant policy.

## The ten deliverables

| Order | Deliverable | Concrete output | Codex consumers |
| --- | --- | --- | --- |
| 1 | [Ticket and dependency crosswalk](01-ticket-crosswalk.md) | Existing FS anchors, all 13 core OM packages, 34 core criteria, separate optional Render criteria, source/ownership gaps | OM-01 and all package planning |
| 2 | [Six mission definitions and method catalog](02-mission-catalog.md) | Metric, readiness, authority, stop and verification records; shared method kinds/dependencies marked proposed where unresolved | OM-01, OM-05, OM-08 through OM-13 |
| 3 | [Metrics and accounting examples](03-metrics-and-accounting.md) | Fixed cohorts, source stages, worked event histories, exact Decimal outputs and an offline oracle | OM-04, OM-11, OM-12, OM-13 |
| 4 | [Authoritative source map](04-source-map.md) | All required snapshot fields, 20 source groups, current gaps, execution-time rechecks and missing-data behavior | OM-05, OM-08, OM-09, OM-12 |
| 5 | [Authority and lifecycle contracts](05-authority-lifecycle-contracts.md) | API/event/permission packet plus concrete authority, concurrency and recovery cases | OM-01, OM-02, OM-03 |
| 6 | [Acceptance cases and Codex handoff](06-acceptance-and-codex-handoff.md) | Complete core acceptance mapping, adversarial inputs, exact outputs, evidence requirements and first implementation slices | OM-01 through OM-13 |
| 7 | [Organize detector examples](07-organize-detectors.md) | Four-area rule examples, duplicate/stale/unknown handling, scoped coverage and verified resolution | OM-08, OM-10 |
| 8 | [Specialist evaluation and cost policy](08-specialist-evaluation-and-cost.md) | Bounded capability examples, hostile-input/invalid-output cases and proposed compute limits | OM-07, OM-13 |
| 9 | [Command Center content and states](09-command-center-content.md) | Six cards, 20 concrete states, authority/readiness copy, design-reference map and browser QA script | OM-06 |
| 10 | [External acquisition readiness](10-external-acquisition.md) | 13 evidence gates, 15 route cases, 19 lineage fields and both estimate/customer journeys | OM-09, OM-11, OM-13 |

The JSON companions are reviewable preparation data. They are intentionally outside production packages. Do not copy null decisions, synthetic accounts, example limits or unapproved method classifications into executable schemas/configuration.

## Decisions that remain real decisions

[OM-D01 through OM-D13](DECISIONS.md) cover targets/guardrails and payment primary metric; agreement recognition; complete cost/adjustment allocation; role/capability grants; contact rules; authoritative service/calendar/material rules; canonical identity; exact mission frames; current provider/account/billing/budget proof; model/rate/cost evaluation; evidence thresholds; implementation scope/ownership; and finite method composition.

A missing mandatory rule cannot default to passing. Every proposed value must become an explicit versioned, scoped decision with supporting evidence before it governs a real tenant. Open decisions block only affected implementation/activation, not unrelated preparation or Part I work.

## Start here in Codex

1. Read this index, the crosswalk, decisions and source map. Confirm the current branch base and inherited repository instructions. Use the existing FS-262–269 initiative, preserving FS-257/258 as Part I predecessors. No duplicate initiative or automatic new ticket per OM package.
2. For OM-01, reconcile current authorization and finalize strict shared contracts, identity, error/event semantics and named consumers. FS-263 is a contract anchor, not blanket runtime ownership.
3. After the runtime gate is actually met, isolate OM-02 action/version/claim/authority work from OM-03 outbox/provider/reconciliation work with explicit central-file ownership. Use the prepared race/failure cases to prove real database behavior.
4. Implement OM-04 projections against the accounting fixtures, then OM-05 snapshot/registry/plan/shared-resource integration. The complete source plan/crosswalk governs exact dependencies and allowed parallelism.
5. Continue the agreed delivery waves. Establish the first complete external route early, as OM-09 specifies; internal recovery is not a substitute for acquisition readiness. Optional Render work stays independent and disabled without its separate evaluation authorization.

[The acceptance handoff](06-acceptance-and-codex-handoff.md) provides the bounded patch expectations. These prep documents do not assign an active Codex thread or authorize rollout.

## Validation and evidence boundaries

Run from the repository root:

```bash
python docs/operating-missions/preparation/validation/validate_preparation.py
python docs/operating-missions/preparation/validation/validate_accounting.py
git diff --check
```

The preparation checker validates cross-file identifiers, coverage, references and source paths. The Decimal oracle validates synthetic expected results, replay/order invariance and deliberate invalid mutations. Neither script calls a provider, uses a database, runs a model or proves the application implements these semantics.

All production/API/concurrency/browser/provider/mission-pilot acceptance is **not executed by this package**. The draft PR records the exact published head/tree, independent reviews and actual offline results. Existing Part I pending PRs and operational gates are tracked separately.

## Compatibility constraints to keep visible

- Existing queued outbound receipts do not establish provider delivery or business outcomes.
- The merged consent foundation is not universal proof of capture, send enforcement or concurrent STOP acceptance.
- Existing revenue reports use their own legacy paid/invoice/estimate fallback and materials-only contribution. Add versioned OM projections; do not silently relabel those totals.
- Inventory pagination currently caps at 200 records, so the proposed 250 generic scan page size must yield to the source API.
- Use existing booking, estimate, job, maintenance-plan/visit, inventory, invoice and payment domains. Preserve canonical IDs, historical costs and adjustment provenance.
- An assessment, accepted estimate, performed service, finalized invoice and settled payment are different facts.
- Existing Figma references are useful inputs; exact new mission frames and responsive/browser acceptance remain open.
- A verified total campaign budget is not a daily hard cap. Provider account/version/control evidence remains a separate gate.
