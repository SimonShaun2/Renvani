# 10. External acquisition readiness and lineage

**Status:** readiness contract and synthetic cases prepared. No account was connected, campaign created, spending authorized or route accepted. **Source:** [Part II v1.1](https://app.notion.com/p/40e317b92d1581188031e8a0a4c847c9), sections 10, 16, 17 and 21. **Pinned code:** `7840884d346ca95788e2668cc78148afa3b6a843`.

The [machine-readable packet](external-acquisition.json) contains 13 evidence gates, 15 concrete cases and 19 required lineage fields. It gives OM-09 a bounded first route and honest failure behavior. The current FS-266 scope covers owned inquiry-to-booking attribution and explicitly excludes an ad-buying tool; the paid connector needs an explicit implementation scope/owner under [OM-D12](DECISIONS.md), not silent ticket expansion.

## First route and existing domain reuse

The first paid method is Google Search to an owned service page and form. Use provider campaign/cost evidence plus first-party intake and booking events. GA4, Search Console, GBP, Meta, LSA and call tracking are separate capabilities; absence of one is not a reason to fabricate its evidence or require every connector.

Existing [public booking services](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/booking.service.ts), [estimate lifecycle](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/estimate.service.ts), job/technician workflows, invoice and payment services remain the operational authority. Mission work adds approved intent, provenance and verification around them; it does not build a second FSM.

Two supported journey specifications are prepared:

| Path | Required stage and identity behavior |
| --- | --- |
| Inquiry → emailed estimate → accepted service | Resolve the tenant from trusted site binding, validate scope and preserve one opportunity. Send only current approved estimate content with applicable consent/authority. Customer acceptance of the correct version plus live qualification/slot/material feasibility permits existing domain conversion/confirmation. Unanswered or unsigned estimates are not accepted work. |
| Inquiry → on-site assessment → technician-confirmed scope → customer acceptance → work order | Record the diagnostic/assessment booking separately from later repair or installation. Field evidence can support a revised estimate but cannot substitute for customer acceptance. Preserve the same underlying need's lineage and distinct service stages. Use the existing supported conversion relationship; whether to extend a job or create a linked job must follow an explicit canonical identity decision, not a guess. |

Then follow actual work, required photos/material use, finalized service allocations, mobile payment settlement, adjustments and any separately authorized review or membership/retention action. Payment collection is not earned revenue again. An assessment is not an accepted installation. A second legitimate service need may create another opportunity; two records for the same need may not inflate the denominator.

## Readiness gates

| Gate | Required proof |
| --- | --- |
| OM-EXT-G01: Authorized account and trusted tenant binding | Verified provider account/resource ownership and required account access; server mapping to company, never a public companyId. |
| OM-EXT-G02: Pinned supported API and adapter | Pinned API/client version, supported Search resource operations, test evidence and adapter revision. Public documentation alone does not pass this gate. |
| OM-EXT-G03: Credential boundary | Existing trusted adapter secret references and scopes verified; no secret or authenticated browser session in model/fixture/Notion context. |
| OM-EXT-G04: Billing and currency | Usable billing state, account currency, approved tax/fee treatment and current account restrictions. |
| OM-EXT-G05: Truthful offering and fulfillment | Approved current service/area, qualifications, duration, customer windows and available fulfillment path. |
| OM-EXT-G06: Exact approved plan and content | Plan version/hash, approved service page and creative, recipients where applicable, capability-specific grant, dates and exposure. |
| OM-EXT-G07: Enforceable total exposure | Provider-native CUSTOM_PERIOD total budget, finite dates and non-shared budget; decimal conversion; full exposure reserved once. |
| OM-EXT-G08: Any daily hard limit | Explicit owner requirement. If required, independently verified compatible enforcement; total budget, average daily budget and polling do not establish this. |
| OM-EXT-G09: Owned page and form | Exact approved page/version, successful validated form submission, rate limiting, trusted site binding and source preservation. |
| OM-EXT-G10: Canonical opportunity and attribution | Conservative deduplication, ambiguous match handling, allowed source identifiers and stable canonical stage identities. |
| OM-EXT-G11: Verified supported booking handoff | Authorized controlled proof of a working intake-to-booking path. No pre-existing customer or booking is required to launch. Every later real confirmation independently needs current customer acceptance, qualification, live slot/resources and the declared booking type. |
| OM-EXT-G12: Authenticated receipts and recovery | Verified callbacks/account binding, request IDs, dedupe/source order, cost cursor, uncertain-effect reconciliation, pause and late-result handling. |
| OM-EXT-G13: Defined result and economic evidence | Declared booking type, fixed cohort, accounting/adjustment definitions, maturation, coverage and approved experiment exposure. Unknown return inputs remain unknown. |

All real-account gates are currently **not verified in this preparation**. Booking readiness means a verified working handoff, not an already acquired customer. No-history acquisition can launch only after applicable readiness and authority pass; each later customer still passes acceptance and live feasibility checks. Each implementation receipt must record who/what verified it, timestamp, account/environment, adapter/API version, relevant test evidence and invalidation conditions. A stored feature flag or public documentation is not customer readiness.

## Current public budget evidence

Checked on 2026-11-05:

- Google's [budget creation documentation](https://developers.google.com/google-ads/api/docs/campaigns/budgets/create-budgets) describes `CUSTOM_PERIOD`, `total_amount_micros` and a non-shared budget for the total-budget route.
- Its [budget overview](https://developers.google.com/google-ads/api/docs/campaigns/budgets/overview) includes Search with finite campaign dates.
- Its [total-budget help page](https://support.google.com/google-ads/answer/10486938/about-campaign-total-budgets) says this control has no daily spending limit and an existing campaign cannot switch budget type.

**Preparation implication:** retain the spec's native total-budget first route, with explicit account/version verification. Do not relabel an average daily budget or periodic polling as a hard daily cap. Reverify provider documentation and account behavior when implementing; no specific API version is pinned by this prep.

The synthetic exposure case uses USD 100.00 media plus USD 10.00 known additional charges, under an example USD 110.00 approval. Exactly 100,000,000 provider micros represent the media amount. The shared tenant exposure reservation is USD 110.00 once, even if two missions sponsor the campaign. These values are examples, not a recommendation, current fee quote or owner-approved budget. Missing real fee/tax treatment blocks approval of an unsupported exposure claim.

## Concrete adversarial cases

| Case | Situation | Required behavior |
| --- | --- | --- |
| OM-EXT-01 | no history external route | Assess Search using labeled assumptions; do not require an estimate backlog. Paid activation still needs every applicable gate. |
| OM-EXT-02 | provider unavailable | Return assessment_only with missing account/API/billing/control evidence. Do not expose an executable launch or report a provider resource. |
| OM-EXT-03 | paused before activation | Create only paused resources under valid authority; independently verify exact page/form/source path and native budget before any approved activation. |
| OM-EXT-04 | decimal exposure | Convert media to exactly 100000000 provider micros. Reserve 110.00 once across mission sponsors; do not treat fees as media or use floating-point rounding. |
| OM-EXT-05 | unknown fees | Block activation until the approved exposure envelope accounts for applicable additional charges or a supported reviewed bound; unknown is not zero. |
| OM-EXT-06 | hard daily ceiling | Leave campaign drafted. Do not claim that total budget or average daily budget enforces a daily hard maximum. |
| OM-EXT-07 | public tenant spoof | Resolve only company A from verified binding, reject/ignore untrusted override according to public API contract, and never read or create company B records. |
| OM-EXT-08 | duplicate and ambiguous intake | Deduplicate exact verified replay; preserve two ambiguous customer matches for review. Do not merge distinct people or create a second opportunity from replay. |
| OM-EXT-09 | email estimate path | Keep one underlying opportunity through inquiry, estimate acceptance, canonical job/work order and confirmed service. Only customer-accepted current scope plus live feasibility can confirm the declared service type. |
| OM-EXT-10 | onsite assessment then work | Count only the confirmed assessment in its declared assessment cohort. Technician findings and a proposed repair estimate are not accepted repair work. Customer acceptance and valid domain conversion are separate required facts. |
| OM-EXT-11 | unknown provider effect | Mark needs_reconciliation; query by original request/provider identity. Do not create a second campaign or resend on an assumed failure. |
| OM-EXT-12 | spoofed callback | Reject before normalization and tenant outcome mutation. Matching payload identifiers cannot replace verified provider/account binding. |
| OM-EXT-13 | late cancelled result | Preserve real financial evidence and reconcile it into the correct projection; do not restart cancelled steps or describe already incurred spend as reversed. |
| OM-EXT-14 | untracked call | Use supported staff intake, preserve unknown/unverified attribution, and do not credit the campaign without permitted reliable linkage. |
| OM-EXT-15 | lead volume no expansion | Report observed inquiries only. Do not increase budget or claim profitable growth; apply approved maturation and economic evidence rules. |

## Lineage and attribution contract

Store source facts once with stable source ID/version, occurrence and receipt times, trusted tenant, approved campaign/plan binding and raw evidence reference. Preserve explicit stage/type links from inquiry through estimate, assessment, accepted service, fulfillment, invoice, payment, credit/refund and agreement obligation.

The current [attribution type](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/packages/types/src/lead-attribution.types.ts) supports an explicit sanitized whitelist: UTM fields, referrer host, link ID and ad ID. It does not authorize arbitrary raw click IDs, URLs or personal data. Any permitted provider/click identifier extension needs a reviewed versioned contract and source mapping. A legacy fallback to “direct” cannot establish paid attribution.

Identity is conservative: exact verified replays are deduplicated; ambiguous people are not auto-merged; merge/correction provenance is retained. Keep reschedules on the existing booking identity. Cancellation changes net confirmation status rather than deleting history. Do not count the same opportunity, service allocation or campaign spend twice because multiple missions contribute.

Normalize authenticated provider events to receipt facts. Verify signature/token, replay rules, authorized account and resource binding before deriving the tenant. A matching campaign ID in an unauthenticated payload is insufficient. Uncertain provider effects remain in reconciliation, including after pause/cancellation; late real outcomes may update evidence without restarting cancelled work.

## Codex slice and exit evidence

OM-09 should first implement the connector contract and paused-resource path behind the existing action/outbox boundary, using the accepted OM-01/02/03/04/05 foundations. Show account/version proof, exact native-budget exposure, one reserved shared campaign, source-preserving form intake, both customer journeys, authoritative confirmations, domain outcomes, authenticated callbacks and crash/replay reconciliation.

A provider route pass proves the route functions. Mission pilot acceptance additionally needs actual bounded observed results, accounting/coverage, approved maturation and target/guardrail evaluation. Synthetic forms, a provider acceptance response or a queued receipt cannot stand in for those outcomes. No Part II runtime activation occurs before Part I acceptance and founder permission.
