# H03 — Company identity and source-record contract

Version 1.0.0 · Prepared November 7, 2026 · PAI-H03

This is the implementation contract for joining Renvani, Stripe, workflow and AI evidence. The accompanying [event registry](event-contracts.v1.json) defines seven logical reporting interfaces and 24 normalized event meanings. These are prepared specifications, with synthetic worked examples below. They do not create tables, public types, authenticated readers, provider integrations or production acceptance.

The source baseline is [`5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58`](https://github.com/SimonShaun2/Renvani/tree/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58). Read [H01 source and ownership evidence](source-register.json), [H02 data meanings](data-dictionary.md), [H04 export rules](export-field-allowlist.v1.json) and [the outcome lifecycle](outcome-lifecycle.md) alongside this contract. A field required internally for lineage is not automatically permitted in PostHog.

## 1. Identity comes from the existing application boundary

`company_id` is Renvani's canonical company UUID. An authenticated server context establishes it; every referenced estimate, job, invoice, payment, action and opportunity must belong to that same company. Analytics must not accept a browser's company property, an email address, an AI-suggested identifier or a parsed UUID as authorization. Existing `tenant-context.service.ts` resolves canonical entities with company scope and excludes deleted entities; RCI `scopeSchema` validates shape and binding but expressly does not authenticate the caller. [Tenant-context source](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/apps/api/src/services/tenant-context.service.ts) · [RCI contract source](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/packages/types/src/connected-intelligence/v1/contracts.ts).

A staff member can work in more than one company. Their identity cannot merge those companies' events. Capture the company at the source operation; a later workspace switch cannot relabel earlier facts. Do not join two companies because a staff member, customer email, phone number, address or external object string matches.

There are three distinct scopes:

| Scope | Meaning | Permitted company identity |
|---|---|---|
| Accepted company fact | Verified business record or company-attributable expense | Non-null canonical company UUID |
| Internal exception | Missing, contradictory or ambiguous source mapping | Unresolved internally; excluded from company financial and outcome totals |
| Explicit platform health or unallocated shared expense | A documented cross-company reporting purpose, with separately authorized access | Null company only when the interface explicitly permits platform scope |

The internal reporting grant, company-facing grant and later learning grant remain different capabilities. A PostHog company group or saved filter does not enforce any of them.

Every metric result also binds an immutable internal query manifest. `query_manifest_ref` resolves the exact company set or complete population snapshot, actual resolved filter values and versions, period/timezone/currency/basis, environment/account mode, source configurations/revisions/cutoffs, metric/query versions and producing server authorization context. A provider account can span many companies, and a filter-definition version does not record the filter values that were used. The external pointer contains no actor or permission payload and grants no access. Current result/drill-through requests reauthorize; a narrower scope requires a newly scoped calculation, not a relabeled broad aggregate. Missing scope denies access; a missing, incomplete or mutable-only manifest cannot support a complete reproducible result.

## 2. Provider identity is a scoped tuple

The canonical provider key is the unambiguous serialized tuple:

`[source_system, environment, account_id, provider_mode, resource_type, object_id]`

The `source_ref` object contains the five source-specific fields; `environment` is part of every record's common envelope. Use canonical tuple serialization or a versioned deterministic digest. A colon-concatenated string without escaping is not sufficient when fields can themselves contain separators.

| Field | Rule |
|---|---|
| `source_system` | Registered source adapter, such as Stripe or the Renvani application |
| `environment` | The actual application environment; test and production never silently mix |
| `provider_mode` | Verified live, test or not-applicable provider mode |
| `account_id` | Provider account/project/connection namespace; use an approved application-instance namespace for native records |
| `resource_type` | Typed source object: charge, refund, application fee, activity event, etc. |
| `object_id` | The original stable source-object ID; not an email or display label |

Do not infer mode from an object prefix. Do not infer a Stripe account scope from the currently selected dashboard account. C02/C05 must bind the actual account and mode reported by the approved source configuration.

Renvani currently stores `companies.stripeCustomerId` for platform billing and `companies.stripeAccountId` for the merchant's Connect account. Those relationships are different. A shared platform Stripe account contains resources for many Renvani companies; mapping that account to one default company would misattribute every other merchant's money. Merchant ownership must follow verified resource-to-company and destination/customer relationships, under the H02 classification rule. [Canonical company and payment schema](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/packages/db/src/schema.ts).

Source pointers are restricted internal identifiers, not unrestricted links or provider payloads. H04 excludes end-customer and staff identities, contact information, arbitrary metadata and raw contents from the external projection. Authorized internal drill-through resolves a pointer through current server permissions; exporting a pointer does not confer access.

## 3. Effective mappings preserve historical ownership

`rpt_company_identity_v1` records a mapping role and a half-open validity interval `[valid_from, valid_to)`. Competing verified mappings for the same scoped object and role cannot overlap. A role distinguishes platform billing customer, connected merchant account, resource owner and other approved relationships.

There are two timelines:

- **Valid time:** when the mapping was actually true in the business/source.
- **Recorded time:** when Renvani observed and accepted that mapping revision, captured by `ingested_at` and `record_revision`.

A current `stripeCustomerId` or `stripeAccountId` does not prove ownership before it was observed. Where historical evidence is missing, record `validity_basis=verified_current_only` and leave earlier facts unresolved. Do not invent a mapping date equal to company creation.

A verified ownership correction creates a new analytical revision, retains prior revision lineage for its permitted retention period, and restates only affected reporting snapshots under an explicit correction policy. It does not alter source payment ownership or customer permissions. Changes to plan/cohort attributes need their own effective history; today's plan must not reclassify yesterday's cohort without a named restatement.

An unresolved or conflicting source is quarantined internally. Surface counts and exact per-currency/per-component exception values in source health where permitted. Do not assign it to the last company viewed, an arbitrary default tenant or a fuzzy match.

## 4. Events, objects and financial components have different identities

| Identity | Grain | Replay/correction rule |
|---|---|---|
| Provider delivery | One provider event receipt | Same scoped receipt suppresses transport duplication |
| Provider object | One account/mode/resource/object | Accept ordered verified revisions; a repeated import is not a new object |
| Financial posting | One classified component of one canonical economic source | PaymentIntent, charge, invoice and payment mirrors do not each create revenue |
| Lifecycle event | One native occurrence or verified receipt facet | Stable event ID; repeated reads/imports preserve it |
| Workflow opportunity | One canonical eligible recovery episode | Repeated scans, proposals, messages and model retries retain the same opportunity |
| Execution attempt | One real authorized attempt | Operational retry can be new; analytics delivery retry cannot |
| AI attempt | One actual model request, including zero-cost or unknown-billing attempts | Imported trace copies deduplicate; real attempts remain usage and separately billed retries retain their costs |
| Allocation set | One full allocation of one source component under one basis | Exactly one accepted set revision per source/basis at a given reporting snapshot |

For native activity rows, retain the stored event UUID. Namespace it by source/environment and a stable semantic facet when one source produces more than one normalized fact. Do not mint a new event ID during backfill or include the current adapter release in the event key. A revised adapter changes `record_revision`, not the fact's existence.

Current `activity_events` stores stable ID, company, event type, entity/job/estimate/invoice links and occurrence time. It also contains payload, summary and actor details that are not approved for blanket export. It lacks a universal opportunity ID, attempt ID, source-schema version, release version or correction sequence. The deterministic adapter must supply only what it can verify and expose missing context as a quality gap. [Schema](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/packages/db/src/schema.ts).

`emitEventWithExecutor` inserts an activity row using its executor; it is not itself a universal reporting outbox or transport deduplication system. Reusing a stored row suppresses repeated analytics deliveries, but two distinct native rows cannot be discarded as duplicates merely because their text or timestamps look similar. Confirm their shared business occurrence using authoritative action/receipt identity, or retain an exception. [Emitter source](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/packages/db/src/events.ts).

## 5. Revision and time contract

Every accepted record carries its schema, adapter and actual source versions; stable record ID; accepted revision; superseded revision; correction reason; occurrence/update/ingestion times; source cutoff; provenance; and independent quality dimensions.

1. An identical known source delivery is a no-op for business counts and amounts.
2. A newer verified source state creates a new accepted reporting revision. Keep the old representation as superseded under the retention policy; current queries select one accepted revision.
3. Conflicting payloads with the same source identity/version enter an exception. Neither arrival order nor lexical provider ID ordering is an adequate conflict resolver.
4. A late old update cannot overwrite a newer accepted source state. If the provider offers no reliable ordering/version, C07 must reconcile the authoritative object and preserve the decision evidence.
5. A real refund, cancellation, new attempt or other business occurrence has its own source identity. An analytical mapping fix is a revision, not an extra business occurrence.
6. Backfilling today's current object snapshot cannot manufacture a historical transition timestamp or source revision. Unknown source history stays unknown. Independently reconciled historical provider transactions can still count in their original requested financial periods; their later ingestion is not another receipt or a new intervention outcome.
7. Replays may rebuild reporting projections and dashboard evidence only. They cannot call existing charge, send, approval, scheduling or action-execution entry points.

The source cutoff describes what has actually been covered. A failed or never-observed source may have an explicitly null cutoff; its freshness is unknown and a current complete metric claim is unavailable. A fresh `ingested_at` does not make stale source evidence fresh. Period filters use half-open UTC intervals resolved from the declared IANA reporting timezone, with company-local time where appropriate. Preserve original instants across daylight-saving boundaries. A timezone-policy change must not silently restate historic periods.

Existing integration outbox services provide scoped operation identity, registered kinds, retry receipts and recovery architecture that C03/C07 can extend where appropriate. They are not permission to replay operational actions from analytics. [Outbox source](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/packages/db/src/integration-outbox.service.ts).

## 6. Compatibility with Connected Intelligence

| Existing capability | Reuse | Required boundary/extension |
|---|---|---|
| RCI scope and read bindings | Verified-scope construction, exact binding, restricted projection design | Shape checks do not authenticate; internal cross-company export requires its own reviewed boundary |
| RCI quality and evidence lineage | Completeness, freshness, reconciliation, finality, source references and period/basis checks | Map snake-case reporting fields through a versioned adapter; do not erase unknowns |
| RCI source/fact schemas | Existing native source concepts | Current source-kind enum lacks Stripe/AI resources; PA-M metric IDs are not registered; direct parsing is not claimed |
| RCI exact arithmetic | Existing Decimal dependency, signed allocation, missing-cost and duplicate rules | Current money/allocateMoney helpers require exactly two decimals; other currency exponents and AI micro-cost require a reviewed extension or adapter |
| Current event/activity consumers | Preserve existing operational meanings and shared source IDs | New normalized meanings belong in the reporting adapter; this artifact adds no DB event enum or public package export |
| Existing bounded activity UI reader | Authorized operational display context | Its 10,000-row read limit and post-read filtering cannot establish complete historical analytics coverage |

[RCI contracts](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/packages/types/src/connected-intelligence/v1/contracts.ts) · [Exact arithmetic](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/apps/api/src/services/connected-intelligence/foundation-math.ts) · [Bounded activity reader](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/apps/api/src/services/activity-event.service.ts).

C02/C03/C06/C07/C09/C11 and RCI-C02 own the relevant runtime adoption. No existing type is broadened, imported or re-exported here. Existing RCI fixture/test results are historical source evidence; they have not been rerun for this documentation deliverable.

## 7. Worked identity examples — synthetic expected behavior

The labels A/B and short object IDs below are invented aliases for readability, not customer records or executable fixture UUIDs. H05 will create and run the separate fixture suite.

| Example | Input | Expected result |
|---|---|---|
| I01: Account collision | Stripe production/live `acct_A/charge/ch_42` belongs to company A; `acct_B/charge/ch_42` belongs to B | Two distinct source keys and postings; never join on bare `ch_42` |
| I02: Live/test collision | Same account/resource/object alias appears in live and test streams | Distinct keys and populations; test data never enters production totals |
| I03: Shared staff | One operator works in A, switches to B, then analytics retries A's earlier event | Earlier event stays A; user identity or current workspace cannot relabel it |
| I04: Missing mapping | A charge lacks a verified company relationship | No company financial count/value is assigned; internal exception and permitted source-health count increase |
| I05: Ambiguous mapping | The same scoped billing customer has overlapping A/B valid intervals | Quarantine overlapping facts until reconciled; no last-write-wins ownership |
| I06: Effective transfer | A verified relationship ends at 2026-10-15T00:00:00Z and B begins at that instant | Earlier facts resolve to A, boundary/later facts to B, subject to actual ownership proof; current state does not overwrite history |
| I07: Repeat import | Native activity event E is observed three times | One semantic event; three delivery attempts may be operational ingestion evidence, not three workflow actions |
| I08: Financial mirrors | One settled service payment appears as invoice, PaymentIntent, charge and Renvani payment references | One canonical classified service-principal posting, with supporting source references; not four receipts |
| I09: Real AI retry | Trace copy of invocation Q/attempt1 is imported twice; attempt2 is a real billed retry | Two billable attempts, not three; failed attempt1 can still carry cost |
| I10: Missing historical version | A November snapshot has no provable October revision | November observed state only; no fabricated October event/version or historical ownership claim |

## 8. H03 handoff and acceptance boundary

The deliverables satisfy the preparation requirement to specify stable identity, lifecycle and allocation meanings with pinned source evidence and concrete expected examples. Implementation still must verify authentic server scope, account/mode mapping, source ordering, full population traversal, real backfill/correction behavior, allowed external fields and integration acceptance.

The next consumer can start with the accepted H03 subset without waiting for later learning work. Missing provider delivery or mature outcome evidence keeps the affected panel unavailable; it does not block separately reconciled billing and source-health reporting. H05 adds executable synthetic fixtures, H08 reviews the full preparation package, and C17–C19 verify and release the selected actual runtime scope.

