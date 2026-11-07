# Renvani Platform Analytics: Stripe + PostHog Build Plan

Version 1.0 · November 7, 2026 · Specification and implementation backlog

## 1. Decision and intended result

The founder selected the Stripe + PostHog recommendation in the Renvani project conversation. Use Stripe for payment and subscription records, PostHog for the first internal analytics workspace, and Renvani for governed business facts, outcome definitions, permissions, and execution. Preserve useful Langfuse work with one primary AI trace path. Configure dashboards in PostHog rather than introducing a custom dashboard application as a prerequisite.

The first useful release answers: which companies are activating, what Renvani is collecting from subscriptions and actual application fees, what data is missing, and whether those figures reconcile. The next release connects one existing estimate-recovery workflow to completed work and collected payment, alongside measured AI usage and clearly identified cost coverage. Later, separately accepted work uses permitted evidence for controlled learning.

This package is a plan and detailed specification. It does not claim that connectors, SDKs, reporting projections, dashboards, production access, experiments, or shared learning have been implemented. Ticket IDs are local planning identifiers, not assigned FS board numbers. No official board assignment, runtime test pass, merge approval, paid subscription, or production activation is implied.

## 2. Package navigation

Notion mirrors: [Build plan](https://app.notion.com/p/411317b92d15819bbaa1e440c435716d?pvs=204) · [Preparation here](https://app.notion.com/p/411317b92d1581938f51d90f152246e9?pvs=204) · [Codex/Cursor specification](https://app.notion.com/p/411317b92d1581cfb465f6b51677013f?pvs=204).

### Build plan

- This document: scope, milestones, sprints, dependencies, release gates, and decision register.

### Build specifications

- [01: Work we can complete here](../build-specs/PLATFORM-ANALYTICS-01-CHATGPT-FOUNDATION-SPRINTS-2026-11-07.md): eight preparation tickets covering contracts, synthetic examples, dashboard definitions, and the implementation handoff.
- [02: Codex/Cursor integration](../build-specs/PLATFORM-ANALYTICS-02-CODEX-CURSOR-SPRINTS-2026-11-07.md): technical architecture, reporting contracts, metric catalog, runtime tickets, acceptance cases, rollout, and later learning.
- [Start here](../handoffs/PLATFORM-ANALYTICS-START-HERE-2026-11-07.md): execution order and first implementation slice.
- [Ticket ledger](platform-analytics/ticket-ledger.v1.json): machine-readable ticket details, dependencies, status, and acceptance criteria.

The specifications contain complete ticket cards. The ledger is a planning artifact; mapping these cards to existing FS work happens before implementation, without generating duplicate execution queues.

## 3. Verified starting position

Source baseline: [`dev` at `5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58`](https://github.com/SimonShaun2/Renvani/commit/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58), checked November 7, 2026. Re-fetch the actual branch head before coding. Source evidence is distinct from deployment or live-provider evidence.

| Area | Verified position | Build implication |
|---|---|---|
| Company/Stripe identity | Company billing customer and connected merchant account are separate fields | Reuse stable company IDs; add explicit environment/account-scoped mapping and coverage checks |
| Renvani subscriptions | Platform customer and subscription creation use `billingKind: platform_mvp` | Classify company subscription revenue explicitly |
| Merchant payments and memberships | Destination charges, application fees, service agreements, and VIP subscriptions exist in the same adapter | Do not aggregate every payment or subscription as Renvani revenue |
| Payment linkage | Local payments carry company/invoice references, Stripe intent/charge IDs, fee amount, and refund amount | Build reconciliation from these references and provider objects |
| Activity events | Company, entity, job, estimate, invoice, actor, and time references exist | Extend/reuse events; they do not yet prove a complete analytics or outcome pipeline |
| PostHog | Planned stack component; complete current instrumentation was not established in the bounded audit | Reconcile preserved FS-43 work before adding SDKs or adapters |
| Langfuse | Existing adapter is explicitly a STACK-07 stub and no-ops without configuration | Complete usage/cost coverage where needed; choose one trace owner |
| Internal platform administration | Owner/admin role plus the internal-company check exists | Reuse for any application-side administrative access; vendor permissions are separate |
| Revenue outcome service | Period activity and materials-only contribution are explicitly limited | Do not call these validated cohorts, complete profit, or causal lift |
| Connected Intelligence | H01–H16 merged; pure contracts/quality/calculation foundation, runtime adoption not established | Reuse the accepted foundation and existing C-track readers/metrics |

### Existing work to reuse

| Work | State verified for this plan | Relationship |
|---|---|---|
| [PR #442](https://github.com/SimonShaun2/Renvani/pull/442) | Merged | Existing Operating Missions preparation; preserve authority and outcome boundaries |
| [PR #445](https://github.com/SimonShaun2/Renvani/pull/445) | Merged, current baseline | Reuse estimate, scheduling, dispatch, field, and completion workflow integration |
| [PR #449](https://github.com/SimonShaun2/Renvani/pull/449) | Merged | Existing Connected Intelligence and operational build specifications |
| [PR #452](https://github.com/SimonShaun2/Renvani/pull/452) | Merged | H01–H16 schemas, quality/claim rules, calculations, fixtures, and offline tests |
| [PR #142 / FS-43](https://github.com/SimonShaun2/Renvani/pull/142) | Closed, unmerged; preserved work | Review/port only compatible missing observability work; do not assume it is deployed |
| [Connected Intelligence C01/C02/C04/C05/C09/C10](../build-specs/CONNECTED-INTELLIGENCE-02-CODEX-CURSOR-SPRINTS-2026-11-06.md) | Existing integration plan | Shared source reconciliation, metric/read contracts, reporting definitions, and acceptance; this package adds internal platform analytics |

Older Notion and repository continuity prose still describes some merged PRs as unmerged. Live GitHub metadata governs the source state above. This plan does not infer current production acceptance from a merge.

## 4. Scope and ownership boundaries

### Configure or integrate

- PostHog organization/project settings, selected data sources, identity mapping, queries, dashboards, and narrowly scoped alerts.
- Stripe's existing reports and direct PostHog connector, with explicit account and resource coverage.
- Selected Postgres reporting data, using an integration role whose access is limited to approved exports.
- Existing AI observability where useful, with consistent invocation IDs and cost provenance.

### Build in Renvani

- Versioned metric meanings and reporting contracts that agree with customer-facing evidence.
- Classification of platform subscriptions, actual fees, merchant collections, and merchant memberships.
- Company and source identity mapping, deduplication, correction handling, and reconciliation.
- The lifecycle from eligible opportunity through action, booking, completed work, and reconciled collection.
- Missing-data states, cost coverage, and the controlled learning/release process.

### Outside this release

No new customer-facing analytics product, custom master-dashboard UI, replacement financial ledger, unrestricted production SQL agent, second scheduler, checkout pricing change, new mission runtime, cross-company training, automatic customer messaging, or automated business action from PostHog. Metabase, ChartMogul, Baremetrics, a separate warehouse, and Stripe-to-Neon ingestion are optional alternatives only when a documented gap warrants them.

The owner-facing Command Center and Reports remain Renvani surfaces under their existing build plans. Internal dashboards may link to authorized source detail but cannot grant action authority.

## 5. Track split

| We can start here | Codex/Cursor integration |
|---|---|
| Source and decision register; map existing FS/RCI work | Reconcile actual repository ownership and current runtime configuration |
| Metric catalog, financial classification, identity/event contracts | Implement adapters, reporting projections, migrations, roles, and read boundaries |
| Field allowlist and access/correction requirements | Prove actual export minimization and vendor access policies |
| Synthetic fixtures, expected results, bounded pure validators | Verify real Stripe changes, database/RLS behavior, backfills, and failures |
| Dashboard card/query contracts and setup runbooks | Configure dashboards against real source schemas and instrument real workflows |
| Cost worksheet, acceptance matrix, handoff | Run authenticated integration acceptance, pilot, operations, and release |

The split is by coupling and validation needs, not an exclusive capability claim. Small isolated code/fixture work can be completed here when authorized and genuinely tested. Writing a ticket does not complete that work.

## 6. Sprint sequence

Sprints are logical delivery batches, not committed calendar weeks. No assignee or deadline is invented. One active implementation slice per lane; coordinate shared schema/configuration ownership.

| Sprint | Primary track | Outcome | Exit gate |
|---|---|---|---|
| H1: Definitions and boundaries | Here | Source map, metric catalog, identity/events, field/access policy | Definitions have authoritative sources and explicit financial/access meanings |
| H2: Offline evidence and handoff | Here | Synthetic cases, dashboard blueprints, connector/cost runbook, reviewed handoff | Expected results and requirement coverage agree; runtime gaps remain visible |
| C0: Integration readiness | Codex/Cursor | Current source/FS reconciliation, provider project setup plan, trace-path decision | Known owner boundaries, approved export contract, measured configuration prerequisites |
| C1: Billing and company data | Codex/Cursor | Reporting identity/projections, Stripe sync, Postgres sync, financial reconciliation | Correctly classified billing and activation data usable in an internal read-only release |
| C2: Workflow and AI evidence | Codex/Cursor | One real lifecycle, stable outcome joins, AI usage/cost, source health | Complete accepted workflow examples and honest pending/partial states |
| C3: Dashboards and economics | Codex/Cursor | Four configured dashboards, cost allocation, operational ownership | Every enabled card has a definition, source, freshness, and coverage |
| C4: Pilot and operations | Codex/Cursor | Independent acceptance, bounded pilot, monitoring/rollback, documented release | Reconciled evidence at the reviewed code and vendor configuration versions |
| L1: Controlled learning extension | Later Codex/Cursor | Permitted dataset, offline/shadow evaluation, separately authorized experiment | Data rights, comparable populations, evaluation, and release authority all demonstrated |

The first billing/data-health release can ship before later outcome, AI-cost, or learning cards are ready. Activation first-value cards join that release only when the selected approved milestone already has authoritative source records; otherwise keep those cards unavailable until the lifecycle evidence exists. Those cards remain disabled or explicitly unavailable. Read-only reporting does not wait for payroll, inventory valuation, or QuickBooks completion. Claims requiring those sources do wait for their acceptance.

## 7. Milestones and measurable acceptance

### M0: Preparation ready for integration

Accepted source/decision map, metric and identity contracts, export allowlist, synthetic expected results, dashboard card matrix, connector runbook, and dependency-checked ticket ledger. A pure offline validator may prove defined invariants; it cannot certify vendor syncing, access controls, or runtime accuracy.

### M1: Internal billing, readiness, and supported activation visibility

An authorized staff member can inspect company activation and correctly separated Renvani subscription/fee amounts. For the accepted account, mode, currency, and cutoff, sampled financial objects and aggregate totals reconcile exactly in minor units, with every exception explained. Unknown mappings, test data, and stale imports are visible and excluded from inappropriate totals. No customer can access the internal analytics workspace.

### M2: One complete outcome and cost loop

An existing estimate-recovery workflow is traceable from eligibility to action, response, completed work, and payment. Failed, unselected, and pending opportunities are retained. Multiple assists do not multiply the economic outcome. AI usage and available costs link to company/workflow/version; missing components remain explicit. Assistance is not labeled incremental lift.

### M3: Operable internal platform analytics

Four dashboards, access controls, reconciliation, source-health monitoring, spend controls, correction/deletion handling, and outage/replay recovery are accepted. Configuration IDs and query definitions are recorded beside the code version. Disabling reporting does not disrupt payments, bookings, jobs, or existing action execution.

### M4: Learning readiness and bounded improvement

Only later: permitted minimized datasets, held-out companies and future time periods, baseline comparisons, shadow observations, and an appropriately designed experiment. Each promotion identifies the dataset/model/policy version and affected population. No universal improvement promise and no release from a dashboard correlation alone.

## 8. First dashboard package

| Dashboard | First decisions supported | Required interpretation |
|---|---|---|
| Renvani economics | Subscription receipts, MRR, actual net fees, cost coverage, contribution | Separate cash, recurring contract value, merchant volume, and estimated/allocated costs |
| Company activation | Readiness, first value, time to first value, repeated successful workflow use | Company-level activity; employee logins alone are not customer success |
| Workflow outcomes | Eligible opportunities, execution, bookings, completed jobs, linked collected service amount | Frozen denominator, maturity window, pending outcomes, unique opportunity identity |
| AI and data health | Invocation outcomes, cost/latency, missing links, stale sources, reconciliation gaps | Output evaluation differs from business improvement; dashboard freshness is measured |

Every card carries metric/version, period/timezone, currency or unit, population, source cutoff, completeness, and source links where permitted. Zero, empty, unavailable, stale, and partial states are distinct. Leadership views prioritize the business decision over implementation detail; diagnostic views expose the supporting evidence.

## 9. Decisions and bounded dependencies

| ID | Decision / default | Resolution owner and scope |
|---|---|---|
| D01 | Direct Stripe-to-PostHog is the first ingestion candidate; selected Postgres exports supply application facts | Platform/data implementation verifies supported objects and permissions; one ingestion path per dataset |
| D02 | Prefer existing Langfuse trace work if fit is demonstrated; otherwise use PostHog AI capture behind an adapter | Technical owner selects one primary path in C0 using a short compatibility and cost comparison |
| D03 | Company ID is canonical; Stripe account, object, and live/test scope are mandatory | Backend/data contract owner; unknown mappings are quarantined, never inferred from email |
| D04 | Native PostHog company/group analytics is useful but paid; SQL aggregation is an acceptable first slice if grouping entitlement is absent | Product/platform owner records selected entitlement and cost before enabling |
| D05 | Export only approved fields; choose provider region, retention, staff access, and processing basis before real data transfer | Existing platform/security/data owners; prepare the concrete configuration first |
| D06 | Founder direction is 5%; inspected checkout source still applies 2% on applicable plans | Financial owner maps the separate pricing reconciliation task. Analytics uses actual fees; this project neither changes prices nor replaces founder direction |
| D07 | Pilot freshness targets: billing/application data within 60 minutes; AI summaries within 60 minutes; daily cost/reconciliation by 09:00 America/Chicago | Proposed operational targets, verified against source schedules and provider behavior; changes require explicit definition/version updates |
| D08 | Raw prompts, message bodies, contact details, payment-method details, and payroll details are excluded by default | Data/security owner approves any narrowly justified exception; table-level source selection alone may not ensure column minimization |
| D09 | Local planning cards map to existing FS work before coding | Codex lead; reuse FS-43 and RCI scopes, no duplicate framework or invented FS number |

Provider access and policy decisions need not stop drafting contracts, fixtures, or runbooks. The implementation ticket records actual blockers and continues independent authorized work.

## 10. Release, review, and program boundaries

Follow current AGENTS.md, CODEX.md, and founder directive #420. Codex coordinates implementation. Independent peer, QA, and Security-by-risk reviews and appropriately authorized CI remain. Founder approval of each named PR at its exact reviewed head governs merges; production/provider activation follows the applicable existing authority. This planning request does not authorize a deployment, purchase, or live-payment change.

Native PostHog dashboards are an internal vendor surface. Any later custom or embedded Renvani UI requires exact canonical Figma frames and real browser/design acceptance. Existing Phase A acceptance and founder direction continue to govern new mission runtime; observational reporting does not activate Phase B.

Review evidence must identify both the application commit and vendor configuration/query versions. Rollback disables exports/analytics capture or hides affected cards, revokes the dedicated connection when required, and preserves operational payment and business-event processing. Historical data corrections must propagate under the agreed policy; rebuilding a projection must never resend a message, charge, or book a job.

## 11. Source register

### Renvani sources

- [AGENTS.md](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/AGENTS.md) and [CODEX.md](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/CODEX.md).
- [Stripe adapter](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/apps/api/src/lib/stripe.ts), [pricing helper](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/packages/config/src/stripe-pricing.ts), and [canonical schema](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/packages/db/src/schema.ts).
- [Langfuse adapter](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/packages/ai/src/langfuse/client.ts), [internal-admin guard](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/apps/api/src/lib/require-renavi-internal-admin.ts), and [revenue outcomes](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/apps/api/src/services/revenue-outcomes.service.ts).
- [H foundation handoff](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/docs/connected-intelligence/foundation/START-HERE.md).
- [Outcome Intelligence Engine charter](https://app.notion.com/p/40e317b92d158107a87ef66deb7ba2a1), [Connected Intelligence parent](https://app.notion.com/p/410317b92d1581629591d0b192de9444), and [master build sequence](https://app.notion.com/p/40c317b92d15812b8ed9c7ead55480e4).

### Vendor references checked November 7, 2026

- [PostHog Stripe source](https://posthog.com/docs/data-pipelines/sources/stripe): object coverage, account scope, mutable updates, webhook and sync behavior.
- [PostHog Postgres source](https://posthog.com/docs/data-pipelines/sources/postgres): selected syncs versus live query, supported refresh modes, and operational constraints.
- [PostHog groups](https://posthog.com/docs/product-analytics/group-analytics), [dashboards](https://posthog.com/docs/product-analytics/dashboards), and [pricing](https://posthog.com/pricing): company analysis and configuration/cost prerequisites.
- [PostHog AI observability](https://posthog.com/docs/ai-observability), [AI evaluations](https://posthog.com/docs/ai-evals), [privacy mode](https://posthog.com/docs/ai-observability/privacy-mode), and [Langfuse source](https://posthog.com/docs/data-pipelines/sources/langfuse).
- [Stripe Billing analytics](https://docs.stripe.com/billing/subscriptions/analytics) and [Connect data](https://docs.stripe.com/data/query-connect-data).
- Alternative only: [Stripe-to-Postgres preview](https://docs.stripe.com/data/data-pipeline/real-time-sync-to-postgres) and [Neon configuration](https://docs.stripe.com/data/data-pipeline/real-time-sync-to-postgres/configure).

Vendor capabilities and prices are external dependencies, not proof of Renvani configuration. Recheck relevant setup documentation during C0 and record the actual account entitlement, source schemas, API versions, and measured freshness.
