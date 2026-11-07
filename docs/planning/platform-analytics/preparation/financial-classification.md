# H02 | Financial classification and reproducible examples

**Prepared:** November 7, 2026  
**Definition version:** 1.0.0  
**Ticket:** PAI-H02 — preparation supplied for review; no runtime metric is enabled.

The [24-metric catalog](metric-catalog.v1.json) is the normative definition index. This document explains its financial classification, MRR policy, exact arithmetic and expected examples. The [data dictionary](data-dictionary.md), [H03 contracts](event-contracts.v1.json) and [decision register](decision-register.md) define the supporting fields and unresolved integration choices.

The examples below are synthetic and hand-calculated. They are acceptance expectations, not production measurements, a fixture suite, or evidence that Stripe/PostHog synchronization works. H05 owns executable synthetic fixtures; C06/C08 own actual financial classification and reconciliation.

## 1. Authority and what the inspected source establishes

The pinned application baseline is `5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58`. The [Stripe adapter](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/apps/api/src/lib/stripe.ts) has distinct platform subscription metadata (`platform_mvp`), merchant maintenance subscriptions and VIP memberships. Service checkout adds a separate fee line and requests a Connect application fee. A recurring merchant fee price can describe the same economic fee that an actual ApplicationFee remits; they must not be added twice.

The [canonical schema](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/packages/db/src/schema.ts) separates a company's platform Stripe customer from its connected merchant account. Local payments distinguish the invoice portion, service fee and refunded invoice portion. However, the invoice portion can include tax; it is not automatically tax-exclusive service principal. Local payment rows have no currency field and use two decimal places. Provider currency and component evidence must therefore be established before using them in these metrics.

The current [revenue-outcomes reader](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/apps/api/src/services/revenue-outcomes.service.ts) uses paid amount, otherwise invoice amount, otherwise estimate amount for completed revenue and provides a materials-only contribution. Preserve that existing meaning. It cannot supply verified collected principal, complete platform costs, or a mature recovery-cohort result.

**D06 pricing remains unresolved:** founder direction is **5%**; the inspected [checkout fee helper](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/packages/config/src/stripe-pricing.ts) applies **200 basis points (2%)** on applicable plans, with Flat exempt. Historical analytics uses actual fees and actual fee refunds. This preparation changes no price, refund rule or checkout behavior and does not certify the live account.

## 2. Classification order

Classification is a deterministic, versioned read operation. A model cannot choose the company, component, financial state or accounting basis.

1. Resolve the exact source identity: provider, application environment, provider account, live/test mode, resource type and object ID. Verify the company's effective mapping and the expected source inventory.
2. Read the accepted provider state/revision and cash evidence. A request, invoice face value or browser success event is not confirmation that funds were received.
3. Establish the business purpose using trusted product/price mappings, server-authored billing metadata and validated local references. An unknown or conflicting `billingKind` is an exception. Missing metadata does not make every remaining subscription a platform subscription.
4. Decompose each economic source into explicit components. Do not subtract an assumed rate to recover principal. Unknown taxes, principal splits or other residuals stay visible.
5. Link a confirmed refund or adjustment to its original component, amount, currency and effective posting time. A current cumulative total is a reconciliation control, not another new posting.
6. Deduplicate on canonical component identity and accepted revision. Repeated webhooks, backfills, a charge and its balance reference, or a native/imported trace copy cannot produce extra economics.
7. Reconcile identical account/mode/currency/component/cutoff populations. Source classification and allocation completeness determine whether the final figure is complete or a known subtotal.

Source objects remain authoritative for their own facts. Reporting creates no charge, refund, transfer, booking, message or job write. Historical corrections change analytical revisions or actual signed reversal records according to their provenance; they do not silently re-execute business work.

## 3. Component vocabulary and sign

The following vocabulary matches `rpt_financial_posting_v1`. It is a logical analytics contract, not a new database enum or a new ledger.

| Component | Meaning and sign in the reporting posting | Included measurement |
|---|---|---|
| `platform_subscription_principal` | Positive, verified Renvani subscription principal received | M01 |
| `platform_subscription_principal_refund` | Negative, actual refund of that principal | M01 and M05 diagnostic |
| `platform_subscription_adjustment` | Signed, source-proven adjustment targeted to subscription principal | M01 only for the accepted cash basis; M05 |
| `platform_application_fee` | Positive, actual platform fee posting | M03 |
| `platform_application_fee_refund` | Negative, actual fee-refund posting | M03 and M05 |
| `platform_fee_adjustment` | Signed, source-proven adjustment to the same fee basis | M03 and M05 |
| `merchant_service_principal` | Positive service principal after discount; tax, tips, surcharge and platform fees excluded | M04; source for M14 allocation |
| `merchant_service_principal_refund` | Negative actual refund of that service principal | M04, M05 and applicable M14 allocation |
| `merchant_service_adjustment` | Signed, source-proven cash adjustment to service principal | Same accepted component basis |
| `merchant_recurring_principal`, `merchant_recurring_principal_refund` | Positive/negative merchant maintenance or VIP principal | Separate merchant context; never platform MRR or M01 |
| `tax`, `tax_refund` | Positive tax collection / negative return | Separate tax component; not platform or service-principal revenue |
| `tip`, `tip_refund` | Positive tip collection / negative return | Separate tip component |
| `card_surcharge`, `card_surcharge_refund` | Positive separately classified surcharge / negative return | Separate component; no surcharge enabled by this document |
| `processor_expense`, `processor_expense_refund` | Negative expense posting / positive source-backed expense credit | M19 cost adapter converts cash direction once to cost magnitude |
| `transfer_movement`, `payout_movement`, `reserve_movement` | Signed movement of already classified funds | Reconciliation/settlement context; no new revenue |
| `unapplied_customer_cash` | Confirmed funds not yet allocated to an invoice/service component | Visible residual; excluded from attributed principal until resolved |
| `noncash_credit` | Credit adjustment with no new cash receipt/refund | Separate noncash control; do not add to M01/M04 |
| `unclassified` | Insufficient or conflicting evidence | Restricted exception path and sanitized M21/M22 aggregates |

The named principal/fee refund components have nonpositive amounts. An actual reversal of a refund is a new source-backed adjustment or reversal of that reversal, with its own identity; do not mutate the original refund into a positive refund row. Adjustments require `adjustment_target_component`, `adjustment_reason_code`, `financial_basis`, an accepted source reference and lineage.

A disputed payment, reserve movement or payout failure is not automatically a final revenue loss. Preserve the actual financial effect and classify its component only when the source and adopted policy support that classification. An unresolved classification cannot disappear inside a “miscellaneous revenue” total.

### Cash, availability and accounting

M01/M03/M04 use the defined provider-confirmed receipt/refund posting basis. They are not bank-settled cash, statutory revenue recognition, or a complete financial statement. M02 is a recurring contract snapshot. M13 is completed work; M14 is linked collection. The same economic amount must not be added once for each stage.

Stripe [balance transactions](https://docs.stripe.com/api/balance_transactions/object) distinguish gross amount, fees, net balance impact, availability and source currency. Compare like fields and time bases. In particular, a charge in presentment currency cannot be compared directly with a converted settlement balance entry; an actual versioned FX bridge is required. This v1 catalog supplies no implicit currency conversion policy.

A source-backed historical Stripe transaction can be backfilled later and still count in its **original requested financial period**. Ingestion time does not make it a new current receipt. Imported CRM invoice/estimate values alone never establish cash. Historical business outcomes remain baseline and cannot become evidence of a new Renvani intervention.

## 4. Platform MRR preparation policy

**Policy ID:** `mrr-platform-contract-v1`. **Decision:** D10. These rules are specified for consistent preparation and independent review. Finance/Product must accept the reporting definition, verify actual Stripe settings and confirm supported contract history before C06 enables MRR or claims parity with Stripe.

Stripe's [Billing analytics documentation](https://docs.stripe.com/billing/subscriptions/analytics) describes active/past-due contract MRR, configurable discount treatment and trial exclusions; report and chart timezones can differ. The exact preparation choices below are Renvani's proposed v1 reporting definition, not a statement that the account is already configured that way.

| Topic | Prepared v1 rule |
|---|---|
| Population | Only validated Renvani platform subscription products/prices and company mapping; merchant subscriptions and their fee line items are excluded. |
| Supported price | Licensed, per-unit month/year items; positive integer interval count and quantity; exact supported amount representation and effective discount state. A zero-price item contributes zero. |
| Status | Include `active` and `past_due`; disclose past-due MRR as a separate subset. Exclude `trialing`, `canceled`, `unpaid`, `incomplete`, `incomplete_expired` and `paused`. Unknown statuses are exceptions. |
| Trial | Exclude the trialed item's recurring amount for its effective trial interval. A legacy whole-subscription trial excludes the whole contract. If item-level history cannot be interpreted under the actual API version, mark the item unsupported. |
| Recurring discount | Deduct effective permanent/repeating discounts at the snapshot. Apply the verified provider ordering and item/subscription allocation. No coupon names or free text are needed. |
| One-time discount | Exclude one-time invoice coupons from contract MRR. They can reduce actual cash receipts. Record this chosen setting when comparing with Stripe. |
| Mixed/stacked discounts | Support only after the adapter reproduces the actual rule/order and fixed-discount allocation. Otherwise report the supported subtotal and explicit unsupported-item count. Never approximate by a headline percentage. |
| Proration | Do not sum proration invoice lines into MRR. Use the current effective recurring quantity/price; pending updates remain pending until effective. |
| Cancellation | Scheduled end-of-period cancellation remains included until actual contract termination. A cancellation request timestamp is not necessarily the effective end. |
| Delinquency | Past due stays in contract MRR and has its own subtotal; unpaid is excluded. Neither state proves collected cash. |
| Paused collection | An active subscription with a collection pause is an explicit exception until the effective contract-value treatment is accepted; a status string alone cannot settle it. |
| Unsupported | Metered, tiered, transformed-quantity, ambiguous mixed, unknown interval, missing item pagination, unsupported decimal-price or missing historical-state inputs. A narrow supported population may be reported by that name; no complete-total claim. |
| Normalization | Divide the exact net recurring interval amount by interval months: month = interval count; year = 12 × interval count. Aggregate exact rationals and round once per currency for display. |
| Historical snapshot | Requires effective source history. Never reconstruct past contract prices by applying today's plan or discount to every prior month. |

The `net_recurring_interval_amount_minor` supporting input is an exact integer interval value produced from accepted effective price/quantity/discount evidence. Initial adapters must either reproduce the provider's relevant minor-unit treatment or refuse unsupported fractional pricing. The monthly rational can be fractional even when the interval value is an integer; retain its numerator and denominator.

Refunds can reduce M01 cash while MRR remains unchanged until the recurring contract changes. An annual cash receipt belongs in its actual receipt period; it is not divided into twelve cash-receipt entries simply because MRR divides annual contract value by twelve. No source price constant is treated as proof of live contracted price.

## 5. Exact amount and allocation rules

- Provider amounts retain exact signed minor units, source currency and the **provider/resource encoding** exponent. Do not assume ISO currency convention alone resolves every provider exception. Stripe documents [currency and amount encoding exceptions](https://docs.stripe.com/currencies).
- AI usage costs retain exact decimal strings and their scale. Do not round each attempt to cents. Missing cost is `null`; a known subtotal has a separate label.
- Ratios sum their numerator and denominator before division. Percentages from different companies/cohorts are not averaged.
- Every allocation set identifies the exact source posting/revision, one accepted set revision, its destinations and an explicit remainder row. All rows preserve company/currency/exponent/sign.
- Sum all `allocated_amount_minor` rows, including `allocation_role=unallocated_remainder`, to exactly the signed source amount. Allocated magnitudes are bounded by source magnitude. A nonzero remainder prevents `complete_allocation=true`.
- Multiple product assists are descriptive links, not multiple copies of the same payment or job. A query never fixes a many-to-many join by summing the duplicated amounts.
- Only one cost representation is adopted per canonical usage/component/period. Provider-reported, price-estimated and invoice-allocated amounts remain distinguishable; replacing an estimate with its bill does not add a second expense.
- Exact financial source reconciliation has zero unexplained minor-unit tolerance on the same basis. Opposing object-level differences cannot cancel into a false reconciliation pass.

The existing [RCI arithmetic](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/apps/api/src/services/connected-intelligence/foundation-math.ts), [strict contracts](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/packages/types/src/connected-intelligence/v1/contracts.ts) and [quality helpers](https://github.com/SimonShaun2/Renvani/blob/5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58/packages/types/src/connected-intelligence/v1/quality.ts) provide reusable principles. Their current money schema and allocation helper accept two decimal places. D13 requires a versioned compatible precision/metric/source adapter before these new records enter runtime; do not copy a second arithmetic engine or force micro-costs into two decimals.

## 6. Synthetic expected examples

All amounts, companies, times and policies below are fictitious. A duration chosen for one example is a fixture input, not an adopted product policy.

### EX01 — Gross payments do not all belong to Renvani

One platform subscription collects USD 100 principal plus USD 10 tax. A separate merchant service payment collects USD 1,000 service principal, USD 80 tax, USD 10 tip and a separately charged USD 20 platform fee line, for USD 1,110 gross. This example mirrors the inspected added-fee checkout model: the actual USD 20 ApplicationFee/remittance is evidence for that same economic fee component, not another incoming USD 20. A merchant VIP payment collects USD 60 principal and has a verified zero platform fee.

| Expected output | Amount |
|---|---:|
| M01 platform subscription net receipts | USD 100 |
| M03 actual net platform fees | USD 20 |
| M04 merchant service principal | USD 1,000 |
| Separate merchant recurring principal | USD 60 |
| Separate tax total | USD 90 |
| Separate tips | USD 10 |
| Sum of classified incoming components | USD 1,280 |

The gross control is `110 + 1110 + 60 = 1280`; the component control is `100 + 20 + 1000 + 60 + 90 + 10 = 1280`. Platform inflows for contribution are only `100 + 20 = 120`. Transfers and payouts add no revenue. The actual USD 20 fee wins regardless of the founder/source pricing discrepancy. A source-backed USD 30 processor expense is a cost, not another application fee.

If another accepted charge design retains a fee inside the invoiced gross instead of adding it, do not add that fee on top of gross or silently redefine service principal as merchant settlement. The adapter must declare the source/component basis and reconcile the corresponding receipt, fee and movement relationships first. This example does not establish an additive decomposition for every Connect charge model.

### EX02 — MRR is a contract snapshot

| Synthetic platform item at cutoff | Monthly contribution |
|---|---:|
| Active USD 100/month, quantity 2, effective repeating 10% discount | USD 180 |
| Active USD 1,200/year | USD 100 |
| Past-due USD 50/month | USD 50, also in past-due subset |
| Active USD 80/month with future end-of-period cancellation | USD 80 |
| Trialing USD 70/month | USD 0, excluded by status |
| Merchant membership USD 40/month | Excluded from platform population |

Supported MRR is `180 + 100 + 50 + 80 = USD 410`. If the USD 50 item later becomes unpaid, the next accepted snapshot is USD 360. The annual receipt may be USD 1,200 in one month; its MRR contribution is still USD 100. A USD 25 one-time coupon on a separate USD 100/month contract can produce USD 75 principal cash while leaving that item's contract MRR at USD 100.

For two annual USD 10 contracts, exact normalized minor units are `1000/12 + 1000/12 = 2000/12`. One aggregate rounding gives **USD 1.67**; summing separately rounded USD 0.83 displays would incorrectly give USD 1.66. If a platform item uses an unsupported weekly/tiered arrangement, the catalog must report an unsupported item and a restricted supported subtotal, not claim complete MRR.

### EX03 — Partial refund, fee refund and signed allocation

A confirmed USD 1,000 service-principal posting has USD 600 allocated to opportunity A, USD 350 to B and USD 50 explicitly unallocated. A later USD 200 principal refund allocates **−120** to A, **−70** to B and **−10** to the remainder.

| Expected cumulative view | Amount |
|---|---:|
| M04 net service principal | USD 800 |
| A net allocated collection | USD 480 |
| B net allocated collection | USD 280 |
| M14 verified allocated subtotal | USD 760 |
| Explicit remaining unallocated amount | USD 40 |

Conservation is `480 + 280 + 40 = 800`. The linked subtotal is partial; no complete-allocation claim is allowed. A positive USD 20 allocation in the negative refund set would violate sign preservation.

An original actual USD 20 fee remains USD 20 after the principal refund. If an actual USD 5 fee refund appears later, M03 becomes USD 15; it is not recomputed from the merchant's remaining principal. A later correction that allocates the original remainder gives collection A = 650/B = 350 and refund A = −130/B = −70, remainder zero. The new accepted net allocation is A = 520/B = 280, total USD 800. The prior allocation revision remains traceable and is not added again.

In a posting-period view, collection, principal refund and fee refund occur in their own periods. In the cohort-as-of view, the linked components produce the latest net amount. A late-ingested genuine historical posting changes its original period's result revision, not today's cash total.

### EX04 — Paid invoice, duplicates and currency

A platform invoice for USD 100 is discharged using USD 40 noncash credit and a confirmed USD 60 payment. M01 receipt is **USD 60**, not USD 100. Three deliveries of the same payment event still produce USD 60 once. A failed payment attempt and an unpaid USD 500 invoice produce no additional collected cash.

USD `amount_minor="100"`, exponent 2 is USD 1.00. JPY `amount_minor="100"`, exponent 0 is JPY 100 under that source encoding. They remain separate currency results. Neither USD 101 nor a unitless 200 is a valid total. This tests representation; it does not claim the deployed application supports JPY.

### EX05 — Activation denominator and censoring

For this example only, the activation window is ten elapsed days and the repeat window is five elapsed days. At observation day 12:

- A became ready on day 0, reached the accepted milestone on day 1 and reached it again for a different opportunity on day 2.
- B became ready on day 0 and reached first value on day 3; no repeat occurred by day 8.
- C became ready on day 8 and has no first value yet.
- D became ready on day 0 and has no first value by the end of its window.

M06 is **4 companies**. M07 has **2 observed activations**, **3 mature companies**, **1 pending company**, and a mature activation rate of **2/3 = 66.67%**. Shared staff and multiple logins change none of these counts.

M08 completed times are one and three days. Nearest-rank activated-only p50 is one day and p90 is three days; the label must say **among activated companies**. C is right-censored at four days and D at ten days. Neither is recorded as a completed time. M09 has one repeating company among two mature activated companies, **50%**. Retrying A's original opportunity would not count as repeat value.

### EX06 — Eligible cohort, attempts and observed outcomes

Ten opportunities are eligible; six have a fully observed mature window and four remain pending. Among the mature six: one was unselected, one declined, one had a failed actual outbound attempt, one failed then received provider acceptance on retry, and two received provider acceptance on their first actual attempt.

M10 is **10 opportunities**, with six mature and four pending. M11 reports **4 logical actions attempted**, **5 actual outbound attempts**, **3 provider-accepted attempts** and **2 failed execution attempts**. Internal committed-execution success is a separate series; an outbound queued receipt proves none of these provider successes. The unselected and declined opportunities stay in the cohort.

If verified mature-cohort facts show three deliveries, two responses and two bookings, M12 is **50% delivered**, **33.33% responded** and **33.33% booked** on the six-opportunity denominator. Four pending opportunities remain visible. Approval alone changes none of the delivery/booking numerators.

If one canonical job is completed and two products assisted it, M13 is **1 job**. It is not two. The completed job can still have no payment; that is not a missing link when the complete source confirms no payment. Conversely, if a confirmed source payment exists but its required opportunity allocation is missing, M24 records a linkage exception and M14 stays partial/unavailable for the affected financial claim. A genuine pending outcome is not automatically a data defect.

### EX07 — AI retries, missing telemetry and micro-costs

Two logical invocations create three observed attempts:

| Attempt | Outcome | Observed latency | Adopted estimated cost |
|---|---|---:|---:|
| A1 | Failed | 100 ms | USD 0.0004 |
| A2 | Succeeded | 300 ms | USD 0.0006 |
| B1 | Succeeded | 200 ms | USD 0.0005 |

Importing A2 again does not create a fourth attempt. M15 has two invocations, three observed attempts and **1/3 = 33.33%** observed known-terminal failure rate. A declared all-outcome latency view has nearest-rank p50 = **200 ms**, p95 = **300 ms**, with outcome breakdown; M16 must not silently compare this with a success-only distribution.

M17 known cost is `0.0004 + 0.0006 + 0.0005 = USD 0.0015`. Rounding every attempt to cents would erase real cost. If an independent dispatch inventory shows a fourth actual attempt with lost telemetry, attempt coverage is **3/4 = 75%**. Total cost and whole-population failure rate are then unknown/partial; the observed figures retain their labels.

### EX08 — Cost coverage and contribution

In an aligned synthetic period, M01 is USD 500 and M03 is USD 50. Known adopted costs are AI 10, processing 15, communications 5 and infrastructure 20. Aggregate support cost is missing.

Known cost is **USD 50**. M19 complete cost is `null`. M20 known contribution is `500 + 50 − 50 = USD 500`, explicitly partial. It is not complete profit.

When approved aggregate support cost of USD 30 is supplied, complete cost under this explicitly limited service-cost definition is **USD 80** and management contribution is **USD 470**. If the exact same mature cohort has five verified completed jobs and all USD 80 costs belong to that cohort/window, M18 is **USD 16 per completed outcome**. With no verified outcomes the ratio is unavailable, while spend remains visible.

An infrastructure pool of USD 20 allocated A = 12 and B = 8 is counted once as `12 + 8 = 20`, not as pool 20 plus allocations 20. If an accepted AI provider bill of USD 12 replaces an adopted USD 10 estimate for the same expense, revised cost is **USD 82** and contribution **USD 468**; the bill and estimate are not additive.

### EX09 — Offsetting exceptions and misleading freshness

Two unresolved source components of +USD 100 and −USD 100 produce M21 count **2**, signed net **USD 0** and absolute exposure **USD 200**. A zero net does not mean no identity problem.

For reconciliation, expected A = 100/B = 100 but observed A = 90/B = 110 gives M22 **2 object mismatches**, signed aggregate delta **0** and absolute difference **20**. This does not reconcile.

A source expects ten keys, matches eight and has two extra/duplicate rows, for ten raw observed rows. M23 coverage is **8/10 = 80%**, not 100%. At check time 10:00, a verified source cutoff of 08:30 is **90 minutes old**, even if ingestion ran at 09:59. Under the proposed 60-minute D07 target it is stale. If expected key inventory or cutoff is unknown, coverage/freshness stays unknown.

## 7. Metric and example coverage

| Example | Metrics | Planned acceptance cases |
|---|---|---|
| EX01 | M01, M03, M04, M20 context | AT02–AT04 |
| EX02 | M02 | AT02, AT08, AT17 |
| EX03 | M03–M05, M14 | AT05, AT06, AT11, AT16 |
| EX04 | M01, M04, M05, exact-money invariant | AT07, AT10, AT12, AT17 |
| EX05 | M06–M09 | AT01, AT12, AT26 |
| EX06 | M10–M14, M24 | AT13–AT16, AT26, AT32 |
| EX07 | M15–M17 | AT17–AT19, AT27 |
| EX08 | M17–M20 | AT18, AT19, AT26 |
| EX09 | M21–M24 diagnostic semantics | AT09, AT18, AT23, AT26 |

Each catalog entry also names its proposed dashboard/card intent, authoritative sources, exact grain, source drill-through and implementation owner ticket. These are H02 coverage links. H06 still owns the complete card/filter/query blueprint.

## 8. Open integration decisions

D10 accepts MRR and validates actual source configuration. D11 accepts service-ready and first-value definitions plus maturity windows and verifies their source evidence. D12 accepts cost components, period allocation and the denominator for cost per verified outcome. D13 adopts compatible metric IDs, source kinds, amount precision and result shapes. D14 verifies actual account/resource/API/currency coverage. D06 pricing is separate and does not block reporting actual historical fees.

This document supplies a concrete reviewable reporting policy and expected arithmetic. It is not evidence of enabled metrics, provider configuration, independent runtime QA, shared-learning permission or a merged/released change.

