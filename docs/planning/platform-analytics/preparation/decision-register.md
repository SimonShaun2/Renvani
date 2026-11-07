# H01: Decisions and implementation gates

Version 1.0 · November 7, 2026 · Application source `5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58`

This register executes the decision-record portion of PAI-H01. It preserves D01–D09 from the accepted [build plan](../../PLATFORM-ANALYTICS-BUILD-PLAN-2026-11-07.md) and adds the decisions made concrete by H02–H04. **Preparing a proposal does not approve its production configuration.** H01–H04 can be prepared and reviewed while account evidence and policy decisions remain open. The gate applies to the affected implementation or data use, not to independent preparation work.

See [source evidence](source-register.json), [ownership crosswalk](ownership-crosswalk.md), [metric catalog](metric-catalog.v1.json), [identity contract](identity-contract.md), and [export policy](reporting-access-matrix.md). Owner names below are functions from existing project governance, not invented staff assignments or official FS ticket allocations.

## Decision states

| State | Meaning |
| --- | --- |
| Selected direction | The user adopted this architecture or it follows existing project authority. The specific configuration still needs implementation evidence. |
| Prepared definition | This package supplies a concrete, versioned rule and examples. Its owner must accept the rule before enabling the affected metric or export. |
| Implementation gate | The implementer must inspect the actual source/account/configuration and record the result. A vendor capability page is insufficient. |
| Unresolved alignment | Policy, source or account behavior differs or is unknown. Preserve the distinction and route the bounded decision. |

## D01 — Stripe and Postgres ingestion paths

**State:** Selected direction; direct Stripe source remains conditional. **Owner function:** Platform / Integration & Compatibility with Security. **Affected tickets:** PAI-H04/H07, PAI-C01/C03/C04/C05/C07/C17.

Use Stripe financial records plus PostHog's internal reporting workspace. Selected Renvani reporting projections supply application facts. One path owns ingestion for each dataset. Stripe-to-Neon remains an alternative, not a mandatory second copy of every Stripe object.

The current official PostHog source documentation excludes managed-schema sources such as Stripe from column masking. Resource selection alone does not prove that contact, billing, metadata or nested payment-method details are excluded. Before real transfer, inspect the selected resources and nested fields against H04's allowlist. If unwanted fields cannot be prevented from leaving the source, use a reviewed, sanitized Renvani-side projection/export instead. Do not ingest broadly and describe later hiding as minimization. H04 records the precise primary references and transfer gate.

**Closure evidence:** account/environment/resource inventory; provider and connector versions; complete exported field manifest; permissions and entitlement evidence; backfill/update/deletion behavior; approved path and owner. **Until then:** synthetic contract work and account discovery; no claim that a direct connector is configured or compliant with the prepared policy.

## D02 — One primary AI observation path

**State:** Selected direction; implementation choice open. **Owner function:** AI integration / Platform Reliability with Technical Lead. **Affected tickets:** PAI-H03/H04/H07, PAI-C01/C11/C12/C16.

Inspect the existing Langfuse adapter and preserved FS-43 work first. Select one primary capture path after checking actual call coverage, attempt identity, time/token/cost precision, redaction, operating cost and support. A Langfuse-to-PostHog source may be useful, but forwarding an observation does not create a second billable invocation. Imported copies deduplicate; real provider attempts remain separately accountable.

**Closure evidence:** call-site coverage map, capture/import relationship, representative sanitized envelopes, actual account costs and failure behavior. **Until then:** AI panels unavailable or explicitly partial. The existing source stub is not evidence that all model calls are instrumented. PostHog privacy mode alone does not sanitize custom properties or all descriptive strings; H04's allowlist applies to those too.

## D03 — Canonical company and provider identity

**State:** Selected direction, concretized in H03. **Owner function:** Data Contracts / Agent Backend with Security. **Affected tickets:** PAI-H02/H03/H04, PAI-C02/C06/C07/C09/C10/C11.

Trusted server scope establishes canonical company identity. Provider keys include provider, environment/mode, account, resource type and object ID. Mapping carries validity history and provenance; email is never a company-join fallback. Distinguish a platform Stripe customer from a merchant's connected account and the merchant's end-customer objects. Unknown, conflicting or temporally ambiguous mappings are exceptions, not shared-company rows.

**Closure evidence:** reviewed adapter/version, same-object/different-account and test/live collision cases, historical mapping behavior, real authorized tenant negatives. **Until then:** unmapped financial amounts remain visible in internal reconciliation exceptions and excluded from company-attributed totals.

## D04 — Analytics entitlement and staff access

**State:** Implementation gate. **Owner function:** Platform / Security / Product Owner. **Affected tickets:** PAI-H04/H07, PAI-C01/C13–C19.

Company/group analysis is useful, but actual group and access-control entitlements must be verified. SQL aggregation is an acceptable first implementation where paid grouping is unnecessary. Saved filters and group properties are never the tenant security boundary.

Current PostHog documentation distinguishes default organization-member access from paid member/role control. Do not assume an entry-tier organization satisfies H04's role matrix. Restricted organization membership narrows the audience; it does not enforce viewer/read-only or download separation. If the target matrix needs that separation, use supported effective controls or keep those viewers outside the workspace. Record the actual decision and cost. Renvani customer users do not receive access to the cross-company internal project.

**Closure evidence:** actual plan, invited membership, roles/query/download permissions, credential scope, access and revocation tests, recorded owner and approved spend if required. **Until then:** role design only; no assertion that live access controls match the matrix.

## D05 — Region, purpose, retention and processing basis

**State:** Prepared policy; implementation and owner acceptance pending. **Owner function:** Security / data owner / Platform; founder or existing authorized policy owner for commitments. **Affected tickets:** PAI-H04/H07, PAI-C01/C03/C05/C17/C19/C20, PAI-L01.

H04 supplies the field/purpose/access matrix, proposed durations, correction and deletion sequence, and unresolved account-specific choices. Operational reporting, customer-facing use and cross-company learning are separate purposes. Permission for the first is not permission for the third.

Choose the actual provider region and record applicable company/customer commitments before transfer. Event retention, AI large-property retention and synced-warehouse-row retention are distinct mechanisms. Expiry of one does not establish expiry of the others. Verify deletion of tables, copies, derived caches and exports explicitly; provider backup behavior requires evidence. Financial record-retention exceptions need a named policy, restricted location and owner; they do not justify retaining every analytics copy indefinitely.

**Closure evidence:** accepted H04 policy/version; actual project region; applicable terms and customer purpose record; tested purge/correction procedure; owner and operational schedule. **Until then:** proposed targets remain labeled proposed. No arbitrary region or universal erasure guarantee is selected by this preparation.

## D06 — Founder pricing direction versus implementation

**State:** Unresolved alignment. **Owner function:** Founder / Product Owner / financial-domain owner. **Affected tickets:** PAI-H01/H02, PAI-C01/C05/C06/C08; separate existing financial/pricing work must own any change.

The accepted planning input records the founder's **5% direction**. Pinned source currently defines **200 basis points (2%)** for applicable plans and exempts Flat; a deprecated helper also refers to a legacy 5% calculation. Those are different evidence layers. Neither source inspection nor this analytics initiative revises the founder's direction. The current live pricing/configuration and actual customer agreement were not audited here.

Analytics uses actual application-fee and fee-refund postings for their historical currency/account/time scope. It does not reconstruct all historical fees at either 2% or 5%. The discrepancy may be shown as a separately labeled configuration exception when backed by evidence; it cannot be silently corrected by changing reports.

**Closure evidence:** financial owner records intended policy/effective date, current checkout source and Stripe configuration, impacted plans, authorization and required tests for a separately scoped change. **Until then:** actual-fee reporting may proceed once reconciled; no rate migration, retrospective repricing or payment change is included here.

## D07 — Freshness, completeness and operating budget

**State:** Proposed targets from accepted plan; actual feasibility unverified. **Owner function:** Platform Reliability / Measurement. **Affected tickets:** PAI-H02/H07, PAI-C04/C05/C08/C11/C12/C16/C18/C19.

Proposed first-pilot targets remain billing/application data within 60 minutes, AI summaries within 60 minutes, and daily financial/cost reconciliation by 09:00 America/Chicago. Source cutoff, observation time and ingestion time are separate. A recent sync that copied old source data is not fresh evidence. A seven-day pilot is an initial planning target, extended when a required scenario or financial cycle remains unobserved.

**Closure evidence:** real source schedules, volume/cost estimates, source-database load and measured lag; accepted metric-specific bounds. **Until then:** label stale/partial/unavailable states and record actual cutoff. Do not represent targets as achieved service commitments.

## D08 — Export minimization and safe detail

**State:** Selected default-deny boundary, concretized by H04. **Owner function:** Security / Data Contracts / Platform. **Affected tickets:** PAI-H03/H04/H07, PAI-C02–C05/C09–C17.

Only explicitly listed scalar fields and enumerated properties leave the approved reporting boundary. Secrets, raw end-customer contact details, message bodies, prompts/outputs, payment-method details, payroll values and sensitive/free-form notes are excluded by default. Opaque identifiers remain controlled data; pseudonymization is not an automatic anonymization or shared-learning approval.

Role-appropriate drill-through uses authorized source handles and reauthorization in the source system. A PostHog URL or filter cannot grant underlying Renvani record access. Full raw native payloads, free-form error messages, arbitrary metadata and unnecessary user-agent/device/IP properties do not become allowed just because an SDK captures them automatically.

**Closure evidence:** actual outbound payload tests, read-only export principal grants, controlled source links and negative field/role cases. **Until then:** no real source transfer; authoring sanitized definitions and examples is unblocked.

## D09 — Existing work and assignment boundaries

**State:** Reuse map prepared; actual runtime assignments remain open. **Owner function:** Codex Lead / Technical Lead with Product Owner. **Affected tickets:** PAI-H01, all implementation tickets touching shared sources.

Reuse merged #442 mission preparation, #445 workflow work, #449 specifications and #452 RCI H01–H16 foundation. Reconcile preserved FS-43/#142 instrumentation selectively. The current metadata says #142 is closed unmerged; its board preservation note says the work is not done. Neither a stale board status nor a closed PR is a completion signal.

The [crosswalk](ownership-crosswalk.md) records real observed FS references and applicable RCI tickets. It does not invent a one-to-one FS ID for each PAI card. The user's instruction starts this bounded documentation/preparation work; it does not assign production runtime owners or replace existing WIP coordination. Official FS mapping and central-file reservation are C01 outputs before runtime changes.

**Closure evidence:** actual existing FS owner/record, file reservation, accepted contract subset and integration branch. **Until then:** PAI IDs remain local; no official card is marked Done.

## D10 — Metric semantics, including MRR

**State:** Prepared versioned definitions in H02. **Owner function:** Product Owner / financial-domain owner / Measurement with Technical Lead. **Affected tickets:** PAI-H02/H05/H06, PAI-C06/C08/C13.

Use the 24 PA-M definitions exactly as cataloged, including population, source, status, discounts, tax, proration, recurring interval, time basis, refunds and completeness. Platform subscription MRR is distinct from merchant membership revenue, cash received, settlement and accounting recognition. Stripe's dashboard can be a comparison source only after its settings and definitions are aligned.

**Closure evidence:** owner-accepted metric version, sample source-to-result reconciliation, explicit differences from provider-native reports. **Until then:** cataloged rules are reviewable proposals, not approved accounting policy. Historical results retain the definition applied to them.

## D11 — Company activation and first value

**State:** Prepared definition, authoritative milestone evidence required. **Owner function:** Product Owner / Measurement / relevant workflow owner. **Affected tickets:** PAI-H02/H03/H05/H06, PAI-C09/C10/C14/C17.

H02 defines candidate cohort and value milestones; H03 binds them to authoritative lifecycle facts. Approval, task scheduling, provider acknowledgement, booking, completion and collected cash are separate states. The actual selected first-value milestone must be accepted and have an existing backend source before its card is enabled. A client event or synthetic fixture cannot certify value. Current recommendation selection/limits do not enumerate every eligible opportunity, and the capped activity-list reader is not a complete reporting export. C03/C09 must use complete source traversal and an independently captured eligible population.

**Closure evidence:** accepted milestone/version, eligibility/cohort and censoring rules, authoritative event/source, mapping from business record to card. **Until then:** release billing and data-health first; activation/value cards that lack evidence remain unavailable. PAI-C09 is a dependency only where it supplies missing lifecycle facts.

## D12 — Platform cost and contribution coverage

**State:** Prepared definition; coverage and allocations require owner decision. **Owner function:** Financial-domain owner / Platform / AI integration. **Affected tickets:** PAI-H02/H03/H05/H06, PAI-C11/C12/C13/C16.

AI, communications, payment processing, infrastructure and analytics expenses have distinct evidence and allocation bases. Measured usage, price-derived estimate and invoiced expense must remain distinguishable. Do not add an invoice and the usage estimate for the same cost. A known subtotal is not complete cost; missing items remain unknown. Merchant job profitability and Renvani's platform contribution have different populations and ledgers.

**Closure evidence:** source/cost-component inventory, allocation rule/version, period/account/currency match and reconciliation; accepted list of complete versus missing components. **Until then:** label known cost or partial contribution; do not claim complete profit.

## D13 — RCI compatibility and amount precision

**State:** Source-confirmed adapter gap; versioned integration design required. **Owner function:** Data Contracts / Technical Lead, coordinated with RCI-C02/C05. **Affected tickets:** PAI-H02/H03/H05, PAI-C02/C06/C11/C12.

The merged RCI v1 `moneySchema` and foundation money helpers are restricted to two decimal places. Its metric catalog does not register the new PA-M01–PA-M24 IDs. Reuse the existing exact-Decimal, quality, period, scope and provenance design, but do not pass these records unchanged into strict existing fact/metric schemas or round every currency/AI cost to cents.

H02/H03 document exact signed monetary representations, currency minor-unit exponents and sub-minor-unit AI cost precision. C02 coordinates a versioned adapter or compatible contract extension, including consumer impact. C06 implements governed financial projection/calculation adoption; C11 preserves AI precision. No duplicate arithmetic engine or new public exports are implemented by H01–H04.

**Closure evidence:** chosen version/adapter, existing-consumer compatibility tests, zero-/three-decimal currency and AI micro-cost cases, metric registration/projection decision. **Until then:** documents are usable design inputs; direct runtime compatibility is not claimed.

## D14 — Account, source and release evidence

**State:** Existing governing requirement. **Owner function:** Technical Lead / independent review functions / Platform; founder for named PR/head merge. **Affected tickets:** PAI-H08, PAI-C01/C17/C18/C19; later learning releases.

Keep source presence, specification, local validation, independent review, merge, provider configuration, deployment and product acceptance distinct. Before enabling a metric, its actual account/resource inventory, live/test mode, source/API versions, currency/resource amount encoding, source cutoff and coverage must be evidenced. A source read or offline contract example does not establish authenticated tenant isolation, live webhook behavior, reconciliation, deletion, end-user access, mission acceptance or causal benefit. Current AGENTS/CODEX/TEAM govern actual runtime review and founder-only named-PR/exact-head merge.

H01–H04 includes an independent document/contract review and bounded artifact checks. That is not a completion of H05's executable fixture suite, H08's full preparation acceptance or C17's runtime acceptance. H05–H08 and every C/L ticket remain unexecuted by this batch. Original Phase A/B sequencing, financial authority and shared-learning permission remain in force.

## How to close a decision

Record decision ID/version, actual deciding owner, date, exact code/configuration, affected metrics/fields/consumers, chosen option, supporting evidence and remaining limits. Update the owning implementation record and relevant definition version. Never replace an unresolved item with an unlabeled assumption or backdate approval.

Current decisions do not require the user to answer a fresh questionnaire before H01–H04 can be delivered. They identify exactly what the later owner must verify, and the safe behavior for affected features until then.
