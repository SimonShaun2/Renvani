# H02 | Platform analytics data dictionary

**Prepared:** November 7, 2026 · **Version:** 1.0.0 · **Ticket:** PAI-H02  
**Status:** Prepared reporting definitions and source bindings; runtime projections, adapters, provider grants and dashboard queries remain unimplemented.

This dictionary explains the fields needed by the [24-metric catalog](metric-catalog.v1.json). The [H03 contract registry](event-contracts.v1.json) is the complete machine-readable declaration of the seven core logical records, their common fields, event types and invariants. The tables here give business meaning, current-source limits and the two supporting input shapes owned by H02. A logical shape is not a claim that a physical table, provider column or runtime API exists.

For classification and worked expected totals, read [Financial classification](financial-classification.md). For export permission, read the separate [H04 allowlist](export-field-allowlist.v1.json). A field needed by a calculation does not automatically become an approved export.

## 1. Source binding and evidence levels

All inspected application paths below are pinned to commit `5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58`. Their full commit/blob evidence is included in the catalog's `sources` list and the H01 source register. “Present” describes inspected code/schema only; no production deployment or provider configuration was verified by H02.

| Source | Present evidence | Missing interpretation or integration | Primary metrics |
|---|---|---|---|
| [companies](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/packages/db/src/schema.ts) | `id`, `stripeCustomerId`, `stripeAccountId`, timezone, timestamps | Account/mode validity history, approved cohort attributes and service-ready snapshot; `createdAt` is not automatically readiness | M01–M09; identity health |
| [Stripe adapter](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/apps/api/src/lib/stripe.ts) | Separate platform/merchant creation paths, trusted IDs, destination-charge and requested fee fields | Actual account inventory, API versions, accepted payment/refund/fee states, historical contract state and restricted export | M01–M05 |
| [Pricing helper](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/packages/config/src/stripe-pricing.ts) | Current 200-bps checkout fee, Flat exemption, plan-price constants | Founder 5% versus source/live alignment; constants do not prove contracted or collected amounts | Classification context only |
| [payments/invoices](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/packages/db/src/schema.ts) | Invoice and company IDs, amount/fee/refund summaries, paidAt, Stripe references, tax/discount, import lineage | Full dated component/refund posting history, per-payment currency, exact tax-exclusive principal allocation and source reconciliation | M01, M03–M05, M14 |
| [jobs/activity events](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/packages/db/src/schema.ts) | Stable IDs, company/job/estimate/invoice links, states, timestamps, imported origin | Full pre-decision eligibility population, accepted first-value definition, normalized stage/attempt and missing-link evidence | M06–M14, M24 |
| [Revenue outcomes](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/apps/api/src/services/revenue-outcomes.service.ts) | Existing period-activity funnel, completed-value fallback, materials-only cost | This is not an accepted fixed mature recovery cohort, reconciled cash or platform cost-to-serve reader | Useful source context; no direct alias |
| [Langfuse adapter](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/packages/ai/src/langfuse/client.ts) | Optional audit/import trace stub; some model/token metadata | Complete actual invocation/attempt, cost, timing, independent expected-use inventory and privacy-safe capture | M15–M19 |
| [RCI catalog/contracts](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/packages/types/src/connected-intelligence/v1/catalog.ts) | Versioned metric/basis/grain, strict evidence and disabled capabilities | PA IDs not registered; Stripe/AI source kinds and distribution/result shapes need explicit adoption | All metrics |
| [RCI quality/math](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/apps/api/src/services/connected-intelligence/foundation-math.ts) | Exact Decimal, missing-cost, weighted-ratio and allocation principles | Current helper/schema is two-decimal only; actual source/read/access binding remains an integration task | Exactness and completeness, not new runtime authority |

The current source is USD-oriented in inspected checkout paths. This dictionary preserves currency/precision explicitly so unknown or additional source currencies cannot silently become USD. That is not a claim of deployed multicurrency support.

## 2. Shared field meanings

All seven records inherit the closed common envelope from H03. Names below are canonical snake_case names; adapters translate source field names once and retain their mapping version.

| Field | Type and business meaning | Null/quality rule |
|---|---|---|
| `schema_version`, `adapter_version` | Registered version of the logical record and deterministic source mapping | Required; changing meaning requires a version, not a silent rename |
| `record_id`, `record_revision` | Stable logical identity and accepted analytical revision | Same import repeated retains identity; revision is not another business event |
| `supersedes_revision`, `revision_reason_code`, `record_status` | Correction lineage and accepted/retracted state | Analytical correction is distinct from an actual financial reversal |
| `company_id` | Canonical server-verified Renvani company UUID | Non-null for company records; only explicitly platform-scoped health/shared-cost records may use null |
| `environment` | Registered application environment | Production/test/staging cannot merge implicitly |
| `source_ref` | Closed source identity, described below | Never raw provider JSON or a URL with credentials/tokens |
| `source_schema_version`, `source_revision` | Actual provider/API/schema revision and accepted source version/digest | Unknown remains null and can limit reproducibility; do not invent from ingestion time |
| `occurred_at` | Business effective/occurrence instant in UTC | An ingestion timestamp cannot replace it |
| `source_updated_at` | Reliable source update instant | Null when source does not provide that meaning |
| `ingested_at` | Time this analytical revision was accepted | Does not establish event period or source freshness |
| `source_cutoff_at` | Last independently verified source-coverage cutoff, a UTC instant or null when unknown | Required field presence; unknown/invalid cutoff cannot support “fresh” or a complete-current claim. Failed/never-observed sources must not fabricate a timestamp. |
| `provenance_kind`, `import_batch_ref` | Native/imported/derived/unknown origin and approved lineage pointer | Keep original business time and imported origin after replay |
| `quality_state` | Completeness, freshness, reconciliation, finality and computation truncation | Independent dimensions; a recent but incomplete source can still be partial |

### Closed source identity

`source_ref` has `source_system`, `account_id`, `provider_mode`, `resource_type` and `object_id`; the record also carries `environment`. The canonical provider tuple is:

`[source_system, environment, account_id, provider_mode, resource_type, object_id]`

Values are approved opaque identifiers or registry tokens. A bare `cus_...`, `ch_...`, subscription ID or email is insufficient. Company membership comes from trusted mapping, not from strings supplied by a client. Effective mappings use `valid_from <= occurred_at < valid_to`; unknown historical mapping remains an exception.

Source references can identify a payment/invoice/job needed for authorized drill-through. They do not carry end-customer IDs, contact details, raw names or signed payment links. Failed mapping records stay in a restricted exception path. Approved counts and known component amounts may be exported as health aggregates without exporting the raw record.

### Quality and result availability

`quality_state` mirrors existing RCI semantics:

- `completeness`: complete / partial / unknown.
- `freshness`: fresh / stale / unknown.
- `reconciliation`: reconciled / unreconciled / not_applicable.
- `finality`: final / provisional / not_applicable.
- `computation_truncated`: boolean.

A value of zero is an observed result, not a substitute for null. Empty eligible population, missing policy/source, pending maturity, stale cutoff and incomplete coverage have different result explanations. A display list can be truncated while the underlying complete aggregate is valid; a truncated calculation cannot claim completeness.

## 3. Core logical records

### Company identity — `rpt_company_identity_v1`

Grain: one verified company/source relationship during an effective interval.

| Field group | Meaning | Current binding / use |
|---|---|---|
| `mapping_id`, `mapping_role` | Company identity, platform billing customer, connected merchant account, resource owner or observability project relationship | Current company Stripe references provide useful current-state input; their lifetime history must be verified |
| `valid_from`, `valid_to`, `validity_basis` | Source-effective, verified-current-only or reviewed historical interval | No overlapping competing company owners; do not backdate a current mapping without evidence |
| `resolution_state` | Accepted mapping is verified | Unknown/ambiguous cases are health exceptions |
| `plan_id`, `plan_version` | Effective plan context where proven | Never compute actual fee revenue from a plan label |
| `company_timezone` | Verified IANA timezone | Resolve periods before querying; retain the period's effective timezone |
| `trade_category`, `company_size_band`, `region_code` | Optional approved coarse company attributes | Only H04-approved cohort dimensions; no customer address or staff roster |

### Financial postings — `rpt_financial_posting_v1`

Grain: one canonical classified economic component or actual reversal/adjustment, with analytical revisions kept separately.

| Field group | Type / meaning |
|---|---|
| `posting_id`, `source_component_key` | Stable opaque posting and component identities; a gross object may decompose into several components |
| `financial_component` | Closed vocabulary in [Financial classification](financial-classification.md); never inferred solely from provider resource type |
| `amount_minor` | Canonical signed integer string, including `"0"`; no floats, grouping separators or negative zero |
| `currency`, `currency_exponent` | Uppercase currency code and source/provider encoding exponent; exact major amount = minor amount ÷ 10^exponent |
| `financial_basis` | cash / noncash / movement / expense; basis is not inferred from amount sign |
| `posting_effect`, `posting_status` | original/reversal/adjustment and pending/confirmed/failed; only accepted confirmed cash enters collected-cash measures |
| `reverses_posting_id` | Original economic posting for a real reversal; not the analytical revision pointer |
| `adjustment_target_component`, `adjustment_reason_code` | Registered, source-proven adjustment classification |
| `classification_rule_version` | Implemented version of the H02 classification |
| `related_source_refs` | Closed charge/payment/fee/refund/balance/subscription references; no expanded source payload |
| `payment_id`, `invoice_id` | Optional validated application UUID links; absent allocation remains explicit |
| `pricing_policy_version`, `pricing_evidence_ref` | Actual historical pricing context if known; does not replace observed fee amount |

The provider `amount_refunded` cumulative field is a reconciliation control. To calculate refund posting periods, the adapter needs the distinct actual refund records and their effective dates. The same rule applies to cumulative invoice/payment summaries.

### Eligible opportunity — `rpt_workflow_opportunity_v1`

Grain: one canonical estimate-recovery episode with a pre-decision eligibility snapshot.

| Field group | Meaning |
|---|---|
| `opportunity_id`, `canonical_target_ref` | Canonical episode and estimate/option-set target; estimate options, messages and retries do not multiply opportunities |
| `workflow_id`, `workflow_version` | Existing accepted workflow family/version |
| `eligibility_snapshot_id`, `eligibility_rule_version`, `eligible_at`, `eligibility_evaluated_at` | Immutable population evidence and actual evaluation timing |
| `feature_set_version`, `feature_as_of`, `feature_snapshot_ref` | Approved pre-decision evidence pointer; no post-outcome features or arbitrary feature payload exported |
| `selection_state`, `selection_reason_code`, `policy_version` | not_evaluated/selected/unselected and typed reason; selection is distinct from approval |
| `maturity_policy_id`, `maturity_policy_version`, `maturity_start_at`, `maturity_end_at` | Explicit versioned outcome window; null policy/window prevents mature-cohort claims |
| `evaluation_population_ref`, `source_population_complete`, `observation_cutoff_at` | Full expected eligibility inventory and the evidence cutoff used to assess outcomes |

For initial v1, all applicable observed outcome stages use the opportunity's declared maturity window. Stage applicability is separately versioned. There is no universal duration. Stage-specific windows would be an explicit later definition change, not an unnoticed query filter.

### Lifecycle facts — `rpt_workflow_fact_v1`

Grain: one authoritative lifecycle observation, not a mutable “success” field.

| Field group | Meaning |
|---|---|
| `event_id`, `event_type`, `source_event_type`, `event_schema_version` | Stable event and normalized meaning; H03 event registry maps current source evidence and proposed additions |
| `opportunity_id`, `opportunity_link_state` | linked/unlinked/not_applicable distinction; null opportunity cannot enter recovery numerators |
| `workflow_run_id`, `recommendation_id`, `action_id`, `attempt_id` | Different identities for workflow run, proposal, logical action and real attempt |
| `execution_kind`, `disposition_code` | Typed internal/outbound and outcome/reason classification; no raw message/error text |
| `policy_version`, `release_version`, `evidence_version` | Actual policy/build/source mapping at occurrence; never stamp today's release on historical facts |
| `actor_type` | Optional broad user/system/AI/customer category; no individual identity needed |
| `job_id`, `estimate_id`, `invoice_id`, `payment_id` | Validated company-scoped application links |
| `financial_posting_id` | Pointer to the canonical financial component; money is summed from postings/allocations, not event copies |
| `assist_product_ids` | Non-additive assistance tags |
| `applicable_stage_policy_version` | Defines applicable and deliberately omitted stages without inventing success |

Approval, attempted execution, execution completion, provider acceptance, delivery, customer response, booking, job completion and collection remain separate facts. Catalog terms such as “completed stage” or “attempt succeeded” refer to registered `event_type` evidence and its typed disposition. There is no untyped free-form `fact_state` exported.

### Outcome allocation — `rpt_outcome_allocation_v1`

Grain: one row in one accepted complete allocation-set revision for an exact signed source component.

| Field group | Meaning |
|---|---|
| `allocation_set_id`, `allocation_set_revision`, `supersedes_allocation_set_revision` | Versioned complete set; queries select one accepted revision, never mix rows from revisions |
| `allocation_id`, `allocation_role` | Stable destination row or explicit `unallocated_remainder` row |
| `source_posting_id`, `source_posting_revision`, `source_component_key` | Exact source component being allocated |
| `allocated_amount_minor`, `currency`, `currency_exponent` | Exact signed allocation/remainder preserving source scope |
| `opportunity_id`, `job_id`, `invoice_id` | Validated destination links; null opportunities do not enter the linked recovery amount |
| `allocation_basis`, `allocation_rule_version` | Approved exact-link or allocation rule |
| `allocation_state`, `complete_allocation` | Accepted only after whole-set conservation/scope; complete requires zero remainder and complete source/target evidence |

There is exactly one remainder row, even when its amount is zero. `unallocated_amount_minor` is a human-readable derived label for that row's `allocated_amount_minor`, not another stored field to add again. A nonzero remainder can coexist with an accepted **partial** allocation set; it cannot support complete linked revenue.

### Usage and cost — `rpt_usage_cost_v1`

Grain: a real usage attempt or source expense allocation, with alternative cost representations identified separately.

| Field group | Meaning |
|---|---|
| `usage_id`, `usage_kind` | Canonical identity; invocation_attempt / direct_expense / shared_expense_allocation |
| `cost_scope`, `company_id` | company with verified company ID, or platform with null company; unattributed platform costs remain visible |
| `invocation_id`, `attempt_id`, `trace_id` | Logical call, separately billable real attempt, and capture/import representation; trace ID alone is not the cost deduplication key |
| `workflow_id`, `action_id`, `opportunity_id` | Optional verified attribution; unknown linkage is explicit |
| `provider`, `model`, `model_version`, `release_version` | Actual observed provider/model/instrumentation context |
| `input_tokens`, `output_tokens`, `cached_input_tokens` | Exact nonnegative integer strings or null when not observed; follow the provider's cache/usage semantics |
| `latency_ms`, `latency_definition_version` | Measured nonnegative duration and precise clock/streaming boundary definition |
| `outcome`, `failure_class` | succeeded/failed/cancelled/unknown and a registered error class |
| `amount_decimal`, `decimal_scale`, `currency` | Exact major-unit cost string and preserved scale; null unknown cost is not zero |
| `cost_component`, `cost_basis` | Adopted component plus provider_reported / price_estimated / invoice_allocated / unknown |
| `cost_representation_id`, `adopted_cost` | Alternative measurement identity; at most one adopted representation per canonical usage/component/period |
| `price_version`, `expense_pool_id`, `allocation_version` | Effective estimation or expense-allocation evidence |
| `measurement_coverage` | complete/partial/unknown usage and cost coverage, backed by an independent expected population |

**Cost sign:** `amount_decimal` is positive for an expense and negative for a source-proven expense credit. Converting a `processor_expense` financial posting into cost flips its negative cash-direction sign **once**; a positive expense-refund posting becomes a negative cost credit. M20 then subtracts adopted net cost once. Never subtract an already negative expense twice.

Costs within `cost_scope=platform` and no accepted company attribution cannot silently disappear from platform economics. A company dashboard may show its accepted allocation while the platform view shows the remaining pool. Employee compensation is not an allowed raw cost source; any support cost must use a separately approved aggregate input.

### Source health — `rpt_source_health_v1`

Grain: one versioned source/run/check result, including sanitized exception aggregates.

| Field group | Meaning |
|---|---|
| `health_scope`, `company_id` | Company or authorized platform health scope; no invented company for an unmapped record |
| `source_id`, `source_configuration_version`, `run_id`, `check_id` | Actual configured scope and observed check/run identity |
| `started_at`, `completed_at`, `last_success_at` | Actual attempt/completion/success times |
| `source_cutoff_at`, `lag_seconds` | Verified underlying coverage cutoff and observed lag |
| `expected_record_count`, `observed_record_count`, `matched_expected_record_count` | Expected source keys, actual observed keys and matched expected keys; duplicates/extras do not increase coverage |
| `unmapped_count`, `ambiguous_count`, `mismatch_count` | Distinct unresolved source/component counts under the check definition |
| `exception_amount_minor`, `exception_absolute_amount_minor` | Signed net and sum of absolute exception amounts for one component/currency; offsetting errors remain visible |
| `currency`, `currency_exponent`, `financial_component` | Required context for a financial exception amount |
| `status`, `correction_checkpoint` | Source/check health and accepted reporting recovery point; never operational payment/action state |

Expected count null means unknown inventory. Expected count zero means an empty verified population, not an automatic 100% coverage result. A signed exception amount of zero does not certify zero mismatches. Multiple component/currency amounts require separate rows or a closed typed series, not one mixed-currency scalar.

## 4. Supporting input: platform subscription item

**Name:** `platform_subscription_item_input_v1`  
**Purpose:** Feed M02 from a minimized effective contract snapshot. This is a supporting financial input, not an eighth mandated table and not a cash posting. It inherits company/environment/source/quality provenance from the common envelope.

| Field | Type / required meaning | Missing/unsupported behavior |
|---|---|---|
| `source_ref` | Source identity of the subscription item | No bare item ID |
| `subscription_ref`, `product_ref`, `price_ref` | Closed source references to the contract and accepted product/price inventory | Missing/conflicting purpose prevents platform classification |
| `billing_kind` | Registered platform/merchant purpose resolved by trusted adapter | Only verified platform subscription purpose enters M02 |
| `contract_status` | Actual accepted provider subscription state at the snapshot | Unknown status is an exception |
| `interval` | `month` or `year` for supported v1 items | Other intervals are explicit unsupported items |
| `interval_count` | Positive integer number of intervals per recurring period | Missing/zero is invalid |
| `quantity` | Positive integer contracted licensed quantity | Unsupported transformation or unknown quantity is an exception |
| `unit_amount_decimal_minor` | Exact source price per unit expressed in minor-unit decimal notation, or null if unavailable | V1 adapter must prove supported integer-effective interval amount; unsupported fractional/tiered pricing cannot be approximated |
| `net_recurring_interval_amount_minor` | Exact nonnegative integer string for the accepted price × quantity less adopted recurring discounts for one entire interval | Null if the supported rule cannot be reproduced; never substitute invoice face value |
| `currency`, `currency_exponent` | Original source currency and versioned amount encoding | No assumed USD or two decimals |
| `discount_summary` | Closed array defined below, in accepted application order | Missing is unknown; an observed empty array means no discounts |
| `discount_version` | Effective source discount-state/snapshot version | Different from the reporting calculation policy |
| `discount_policy_version` | Adopted MRR discount calculation/selection policy | Required for comparison and D10 acceptance |
| `trial_starts_at`, `trial_ends_at` | Source-backed effective trial interval or null pair when known absent | Future trial end alone cannot establish an active trial; missing required history is unsupported |
| `paused_at` | Source-backed effective subscription pause instant when known | Do not invent from collection-pause settings |
| `collection_pause_active` | Boolean at the accepted snapshot, or null when unknown | Active collection pause is a D10 exception until contract treatment is reviewed |
| `cancellation_effective_at` | Actual scheduled/ended contract termination instant if known | Request timestamp is not substituted |
| `price_support_state` | supported / unsupported / unknown, determined from accepted price rules | Only supported items enter the supported subtotal |
| `price_support_reason_code` | Closed registered reason for unsupported/unknown price shape | No raw price payload or free text |
| `valid_from`, `valid_to` | Effective interval of this price/status/discount snapshot | Snapshots cannot overlap or fabricate historical state |
| `source_cutoff_at` | Last verified complete subscription/item/discount coverage | Coverage must reach the requested business as-of; cutoff cannot exceed result generation/accepted observation snapshot. valid_from/to select retained historical contract state; current state cannot replace missing history |

The adapter inspects billing scheme, usage type, quantity transformation and item pagination in its authorized source boundary. The exported input uses closed support flags; exporting a full price/discount/customer object is unnecessary.

### Closed discount summary

Each `discount_summary[]` element allows only:

| Key | Type / meaning |
|---|---|
| `kind` | `once`, `repeating`, or `forever` |
| `amount_minor` | Nonnegative integer string or null; fixed discount in the item's currency/interval context |
| `percent_decimal` | Exact decimal percentage string or null; valid range 0–100 |
| `effective_from`, `effective_to` | UTC validity interval; open end allowed |
| `allocation_scope` | `item` or `subscription` |
| `application_order` | Positive integer reflecting actual accepted order |
| `definition_version` | Effective discount interpretation/version |

Exactly one of `amount_minor` and `percent_decimal` is non-null. No names, descriptions, coupon/customer IDs, emails or unbounded metadata are included. A subscription-level fixed discount across multiple items needs a verified allocation; otherwise the affected items are unsupported. One-time entries can be needed to explain exclusion from MRR while receipts reflect their actual cash effect.

MRR query evidence derives `interval_months`, an exact normalized numerator/denominator and one final rounded display. These are calculation outputs, not provider fields. A future adapter must preserve rational annual normalization without creating a second bill or fake cash posting.

## 5. Supporting input: company activation cohort

**Name:** `company_activation_input_v1`  
**Purpose:** Give M06–M09 a stable company denominator and accepted first-value evidence. It inherits common source/quality context and remains separate from provider financial classification.

| Field | Type / business meaning |
|---|---|
| `company_id` | Verified canonical business, not staff user |
| `cohort_id`, `cohort_definition_version` | Stable prepared membership and inclusion definition |
| `service_ready_at` | Accepted backend service-ready timestamp, not automatically company creation, login or first payment |
| `eligible_at`, `eligibility_policy_version` | Company eligibility instant and rule; distinct from an opportunity's `eligibility_rule_version` |
| `activation_milestone_id`, `activation_milestone_version` | D11-selected business milestone; candidate is verified recovery booking linked to eligible estimate |
| `first_value_at` | Earliest valid milestone in the accepted activation window; null when not observed |
| `first_value_source_ref`, `first_value_opportunity_id` | Authoritative fact and canonical opportunity link |
| `activation_window_end_at`, `repeat_window_end_at` | Resolved per-company windows from a versioned policy; no universal numeric duration is adopted here |
| `window_policy_version` | Definition of the activation and repeat windows |
| `observation_cutoff_at` | Common source cutoff used in the current evaluation |
| `mature_through_at` | Latest instant for which required source coverage supports complete outcome observation |
| `readiness_state` | Closed ready / not_ready / unknown state established by the accepted source policy |
| `exclusion_reason_code` | Registered explicit test/internal/demo/ineligible reason; no free-text personal information |

A null `first_value_at` with complete coverage is a known not-yet-activated observation; with missing milestone source coverage it is unknown. A late source correction creates an explicit cohort/result revision. It does not reset readiness to make time-to-value appear faster. Subsequent churn remains in the original eligible denominator.

Repeated value requires an additional **different canonical opportunity** reaching the same accepted milestone inside its repeat window. A new action, retry, employee, session or pageview does not establish a repeat. If D11's accepted milestone is unavailable in current source, activation cards remain unavailable until C09/C10 provide it; initial billing/data-health visibility can still proceed.

## 6. Query result metadata

These 19 keys accompany every metric result or typed metric series. H03/H04 use the same names. H06/C06/C11 must bind the closed scalar/vector/distribution payload for each metric before runtime export; this metadata is not permission for arbitrary JSON output.

| Key | Type / meaning |
|---|---|
| `metric_id`, `metric_version` | One catalog ID and accepted definition version |
| `query_version` | Governed query/calculation implementation version |
| `source_configuration_versions` | Closed bounded list of `{source_id, source_configuration_version}` |
| `generated_at` | Actual result generation instant |
| `source_cutoff_at` | Weakest required verified source cutoff, null when unknown |
| `period_start_at`, `period_end_at` | Half-open resolved UTC interval; null only for an explicitly defined as-of result whose instant is in its manifest |
| `reporting_timezone` | Accepted IANA timezone for calendar interpretation |
| `cohort_id`, `cohort_definition_version` | Fixed population definition; both null together for a metric with no cohort |
| `filter_version` | Effective account/company/window/filter population specification |
| `environment` | Registered environment |
| `account_mode_scope` | Closed bounded list of `{source_system, account_id, provider_mode, environment}` |
| `currency_or_unit` | Closed metric-version-bound unit context, including currency/exponent or scale where monetary; no implicit FX |
| `quality_state` | Complete H03 quality object |
| `query_manifest_ref` | Approved opaque pointer to an immutable internal evidence/scope manifest, not arbitrary URL |
| `display_sources_truncated` | Whether only the displayed source list is bounded |
| `computation_truncated` | Must equal `quality_state.computation_truncated`; true prevents complete claims |

Bounded lists are deduplicated and use registered identifiers, never connection strings, provider keys or customer text. A snapshot's as-of instant and effective input versions must be available in the manifest; a calendar-month label by itself is insufficient.

The immutable internal manifest binds the exact resolved company set or population snapshot, actual resolved filter values and definition versions, period/timezone/currency/environment/account/mode, source revisions/cutoffs and producing authorization context. An account scope or cohort definition alone does not identify which companies were included. A mutable saved-filter reference, truncated population or missing manifest prevents a complete/reproducible claim. The exported pointer grants no access; opening source detail or reading a saved result reauthorizes current company/field scope. Raw membership and authorization details stay in the approved internal manifest boundary, not arbitrary external result payloads.

### Derived result symbols used by the metric catalog

| Symbol | Meaning; not a physical source field |
|---|---|
| `accepted_result(PA-M01)`, `accepted_result(PA-M03)`, `accepted_result(PA-M19)` | Versioned governed query outputs consumed by M20; values and source/quality metadata retained |
| `common_period` | Equality of resolved bounds, reporting timezone and relevant period-basis policy across M20 inputs |
| `common_currency` | Exact compatible currency/amount representation; no conversion guessed |
| `common_cutoff` | Compatible accepted snapshot cutoffs and data versions |
| `stage_window_end_at`, `completion_window_end_at`, `collection_window_end_at` | Narrative aliases for the one opportunity `maturity_end_at` in initial v1, not additional exported columns |
| `canonical_job_id` | Meaning of the verified `job_id`; no second job identity field |
| `source_financial_component_key` | Meaning of `source_component_key`; no duplicate stored key |
| `unallocated_amount_minor` | Sum/label of the explicit remainder row's `allocated_amount_minor`, never a second amount added to conservation |
| `cohort_id`, `eligibility_cohort_id`, `activation_cohort_id` in metric grain labels | The declared query cohort identity with the corresponding versioned population; query metadata canonical key is `cohort_id` |

## 7. Metric-to-input and proposed-card coverage

| Metrics | Required source group | Proposed card intent | Gates before complete result |
|---|---|---|---|
| M01 | Classified confirmed platform receipt/refund postings | Platform subscription receipts | Identity, purpose, cash allocation and financial reconciliation |
| M02 | Effective platform subscription items | MRR and past-due MRR context | D10 definition/settings, supported price/history, exact normalization |
| M03 | Actual application fees/refunds | Net platform fees | Complete fee/refund object coverage; actual source amount |
| M04 | Merchant service-principal postings | Merchant-volume context | Tax/fee decomposition, channel scope and reconciliation |
| M05 | Component reversals/adjustments | Refund and adjustment breakdown | Dated source effects; no cumulative-total duplication |
| M06–M09 | Company cohort and authoritative milestone facts | Eligibility, first value, time to value, repeated value | D11 policy/source; fixed denominator and censoring |
| M10–M12 | Pre-decision opportunity snapshot and lifecycle facts | Eligible cohort, decisions/attempts, stage conversion | Complete population; distinct facts; accepted maturity |
| M13 | Opportunity-to-job and completion facts | Linked completed jobs | Canonical deduplication and actual completion |
| M14 | Reconciled service principal plus signed allocations | Linked collected outcomes | C08 reconciliation; exact allocation set; visible remainder |
| M15–M16 | Actual attempt registry and timing | Attempts/failure and latency | Independent expected inventory; matching clock boundaries |
| M17 | Adopted AI cost representations | AI cost | Preserved precision; retries/deduplication; explicit cost basis |
| M18 | Mature cohort costs and verified completed jobs | Cost per accepted outcome | D12 matching numerator/denominator, nonzero outcome count |
| M19–M20 | Financial inflows and adopted service-cost components | Cost to serve and management contribution | Required component coverage; no MRR/cash mixing |
| M21–M23 | Source/check manifests and sanitized exceptions | Identity/reconciliation/freshness health | Expected key coverage and comparable component/currency basis |
| M24 | Eligibility, stage expectations, link/allocation checks | Link completeness and pending maturity | No-outcome versus missing-link distinction; source coverage |

Every detailed catalog entry includes owner function, actual source references, current implementation gap, planned acceptance cases and its named proposed card. This table does not complete H06 dashboard/query design.

## 8. Compatibility and scope boundary

The inspected [existing RCI catalog](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/packages/types/src/connected-intelligence/v1/catalog.ts) has different metric populations and bases. In particular, `cash.collected` is payment-settlement basis, `sales.completed_net` is completed-job sales, `margin.direct` is merchant direct margin, and the four `legacy.*` KPIs retain their current customer-facing meanings. None is an exact alias for the new platform analytics definitions.

Reuse current exact Decimal dependencies, quality/manifest concepts, source routing restrictions and allocation invariants. D13 must deliberately adopt or adapt PA metric IDs, Stripe/AI source kinds, quantity/distribution result shapes, non-two-decimal currencies and AI micro-cost precision. Current strict `factSchema` rejects unknown metrics; importing this JSON does not implement that adoption.

All source references and expected examples in H02 are documentary preparation. Runtime authentication, source grant enforcement, connector fields, actual query schemas, source currency support, complete outcome joins and vendor/account evidence remain with C tickets. No financial policy, customer permission, experiment or new mission is activated here.

