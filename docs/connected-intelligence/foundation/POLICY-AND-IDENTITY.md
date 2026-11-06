# H01–H03 | Source authority, metric meaning and policy decisions

Recorded November 6, 2026. Foundation artifacts implemented for review; no tenant policy, authority grant, provider capability or independent approval is created by this document.

## Canonical artifacts

The machine-readable source/FS register is `source-register.json`. Executable internal catalogs are `packages/types/src/connected-intelligence/v1/catalog.ts`: 25 metric definitions, 16 disabled capability descriptors and existing legacy meanings imported from the current registry. `recipes.ts` maps all 12 reviewed question IDs to required/optional sources. Both files remain outside public package exports and production consumers.

The live board snapshot is metadata, not proof of a complete product. In particular FS-133 is marked Done while its inspected financial sync foundation remains narrower; FS-222's older Blocked record coexists with Done FS-235 provisioning. No board state or owner was changed. Null ownership means unassigned, not an invented team member. The current implementation lead is this ChatGPT task; independent reviewers remain unassigned.

## Identity and joins

Every operational relation is keyed by tenant plus canonical source ID. Preserve original customer/property/job/visit/estimate/invoice/payment identifiers and record versions. Use connection-specific remote accounting mappings; never overwrite original import sourceSystem/sourceId. Imported origin and cutover must survive all downstream projections. If origin or row version is absent from a legacy summary, label it unknown/unavailable rather than inventing native provenance or a row version.

A completed economic outcome is counted once by its canonical job/allocated invoice-line identity. Collections reconcile payment history, not an additional sale. Assistance links across Growth, Revenue, Operations and Retention are non-additive. Multi-job source amounts allocate exactly to the source total under the reviewed rule; deterministic synthetic allocation uses largest remainder in cents with stable-ID ties. That fixture algorithm is not automatically a tenant accounting policy.

Current versus comparison observations carry resolved company-local dates, basis, grain, currency, definition version, cohort and filter keys. Daily jobs in the legacy brief retain a separate resolved `today` period instead of being silently placed in the monthly KPI window. `effectiveAt` describes the business fact; `observedAt/asOf` describes when the system actually read it. A recent ingestion timestamp cannot certify an old unrefreshed operational fact.

## Metric policy

Read the executable catalog for definitions, grain, exclusions and required evidence. Preserve the four existing Command Center KPI meanings; do not relabel legacy marketing revenue as incremental revenue caused by Renvani. Historical price-book cost is not reconstructed from today's selling price. Direct margin is not net profit. Pay preparation is not take-home pay, paid wages or tax remittance. A purchase commitment is not actual expense. Unreceived stock is not available stock.

The exact arithmetic helper in `apps/api/src/services/connected-intelligence/foundation-math.ts` is a pure fixture/read-calculation utility using the existing Decimal dependency with local high precision. It posts nothing. Missing cost yields null final cost/margin plus a distinctly named known subtotal. A zero denominator yields null percentage, not zero percent. It handles signed corrections, exact allocation, weighted ratios, quantity availability and canonical economic deduplication.

## Permission matrix and privacy

| Data class | Foundation requirement | Actual enforcement owner |
| --- | --- | --- |
| General operational facts | Explicit capability permission plus operational sensitivity grant, tenant/entity/location scope | C04/C05 |
| Financial facts and source links | Separate financial grant; correct legal/company and accounting scope | C04/C19/C20 |
| Aggregate labor | Separately authorized aggregate reader, not raw wage rows hidden behind a new label | C04/C11/C13 |
| Individual earnings/rates | Wages grant and workforce capability; no generic office/dispatcher inference | C04/C11 |
| Internal safety/employee notes | Dedicated sensitivity and purpose; never customer report by default | C04/C14 |
| Saved answer, cache, follow-up, link or delivery | Current server scope equals captured binding; reauthorize at every actual boundary | C08/C09 |

`scopeSchema` validates shape only. A parsed UUID, supplied role label or matching object is NOT authentication. C04 must construct current scope from verified identity, authorization version and domain grants. Pure scope equality and projection tests prove local behavior, not database RLS or identity verification.

The projection omits tenant/actor IDs, permission lists, raw notes and arbitrary URLs. Denied data is represented by a generic unavailable condition, not secret row names/counts. A fact whose source references carry restricted wages is suppressed; an approved aggregate must be independently produced under its own policy. The foundation does not certify protection against every repeated-query inference attack: unrestricted slicing is not supported, and C04/C08 must supply the reviewed anti-inference and access policy.

## Fail-closed policy inputs

No universal freshness default is compiled in. Callers supply a reviewed per-capability maximum age and an explicit current clock; missing policy yields partial/unavailable confidence, not a freshness pass. Attention severity/snooze policy is similarly supplied, versioned and tested with synthetic values. Payroll activity kinds must be explicitly classified paid OR unpaid; unknown or conflicting classification blocks readiness rather than silently dropping compensation.

Open decisions, carried to integration rather than guessed:

| Decision | Owner | Fallback |
| --- | --- | --- |
| Revenue recognition, service/cohort/tax treatment | Product/accounting, C02/C13/C19 | Name observed invoice/collection/job facts precisely |
| Labor burden, overtime and commission allocation | Workforce/payroll specialist, C11 | Incomplete preparation or provisional cost |
| Inventory valuation, unit conversions, backdating | Inventory/accounting, C12/C18 | Quantity-only or explicitly provisional value |
| Wage aggregate and anti-inference granularity | Security/Product, C04/C08 | Suppress affected projection |
| Freshness, source cutoff and consistency budgets | Domain owners, C04/C05 | Cannot conclude current readiness |
| Retention, encryption, provider model data policy | Security/Platform, C08/C07 | No persisted/model integration activated here |
| New query/evidence responsive frames | Design/Product, C06 | H14 design map documents missing exact frames |
| External action authority and runtime phase | Founder/current action owner, C26 | Read-only foundation only |

## Proactive and report rules

Attention grouping consumes an authorized complete source snapshot, not an arbitrary partial event stream. Conflicting same-ID replay is rejected; proposed fixes cannot resolve an issue; partial or stale recovery remains unverified. A policy controls critical snooze behavior explicitly. Generated recommendations do not become operational truth.

Report parity compares scope, definitions, cutoffs, quality, source revisions and values independently of narrative wording. Changed cutoff is `different_snapshot`; same snapshot with changed values is `different_values`; equal source-backed values is `equal`. This comparator is not a cache permission system or provider reconciliation service.

## Review boundary

These are implementable, testable contracts and documented decisions, not approval of real financial/legal policy. H01–H03 artifacts are complete for review; policy approval and live authorization remain integration gates. Current founder issue #420, not stale board descriptions, controls merge authority. Nothing in this package dispatches CI, merges, deploys, sends a message, purchases stock, changes payroll or starts Operating Missions.
