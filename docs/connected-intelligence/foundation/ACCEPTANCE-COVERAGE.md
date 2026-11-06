# H12 | Executable foundation coverage versus runtime acceptance

Every CI-A01–CI-A24 scenario is linked to an actual offline test title carrying its case ID. `node scripts/connected-intelligence/validate-foundation.mjs --full` parses Vitest results and fails if an ID has no passed assertion. It also checks process exit/suite success, not merely the number of passed test cases: a suite that failed to load is not a pass.

This is deterministic contract/helper/fixture evidence. It is not an authenticated application, database RLS, live model/provider, independent QA or production acceptance claim. Shared-types full-suite counts include the scoped foundation tests; do not add those numbers together as unique tests.

| Case | Executed foundation behavior | Remaining runtime owner |
| --- | --- | --- |
| A01 | Exact direct job cost/margin with separate commitment | C13/C18 historical ledger validation |
| A02 | Missing rate/cost blocks final result | C11/C13 real approvals/rates |
| A03 | Computational caps remain partial; display caps separate | C05 complete queries/paging |
| A04 | Missing/future/stale freshness policy cannot certify readiness | C05 actual source watermarks |
| A05 | Wages/restricted source references and derived values suppressed | C04/C08 real permissions/anti-inference |
| A06 | Wrong scope cannot be assembled or projected | C04 real tenant/RLS enforcement |
| A07 | Revoked or changed scope cannot replay evidence | C08/C09 history/cache/delivery |
| A08 | Injected free-text/URLs/grants rejected from structured claims | C07 real retrieval/model adversarial tests |
| A09 | Verified zero retained; failure not converted to zero | C05 real source completeness |
| A10 | Incompatible basis, grain and period rejected | C05/C19 production comparison policy |
| A11 | Mixed currency/unit basis not silently compared | C12/C18 actual conversions |
| A12 | Duplicate observations/economic identity not summed repeatedly | C13/C24 joined domain data |
| A13 | Invented numbers/source IDs rejected | C07 real generated claims |
| A14 | Causal and unsupported forecast claim forms rejected | C07/C24 held-out semantic evaluation |
| A15 | Unavailable capabilities remain disabled; chosen connector only | C19/C20 configured live integrations |
| A16 | Invalid narrative falls back to verified structured facts | C07 real timeout/provider behavior |
| A17 | Actor/location/workspace changes invalidate scope | C08 authenticated session switching |
| A18 | Contact suggestion remains review-only; no execution state | C26 current consent/authority |
| A19 | Read plans and recommendations cannot express business writes | C04/C26 actual route/tool separation |
| A20 | Acknowledgment/uncertainty is not reconciliation or safe retry | C19/C20 provider lost-response recovery |
| A21 | Same-snapshot values reconcile; changed cutoff differs | C09 real report/export delivery |
| A22 | Company-local daily bindings survive DST/month boundary | C05/C11 real calendar/time-entry coverage |
| A23 | Duplicate events group; proposals do not resolve; fresh complete recovery required | C25 actual event/outbox lifecycle |
| A24 | Upload/committing/unreconciled history is not launch acceptance | C22/C23 actual cutover and rollback |

Additional tests cover strict decimal representation, invalid dates/zones, unknown metric versions, source/reference uniqueness, calculation lineage, unsupported links, supplied activity policy, effective-rate splits, time overlaps, immutable exported-input corrections, required forms/artifacts, downstream-change rollback restrictions, missing launch gates, fraction stock, negative corrections, weighted ratios and exact allocation conservation.

Fixture modules reside outside `src` and package exports. The harness checks that no production consumer imports the foundation. Headless UI tests cover state, focus/copy and action contracts, not actual screen-reader/browser or Figma comparison. H14 separately records exact inspected references and missing new frames.

## Review gates

Local execution belongs to the implementing task. Independent Peer, QA, Security-by-risk and Design/Product remain unassigned/pending; no approval signature or FS Done status is invented. Current-head CI requires the existing authorized batch process. Merge and production require founder approval for the named PR and reviewed head. H16 records exact files, reproducible commands and code/working-tree digest rather than claiming a stale SHA was tested.
