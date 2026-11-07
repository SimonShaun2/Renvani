# H01–H04 preparation review and evidence

November 7, 2026 · Documentation and logical-contract review · Draft PR #459

## Result and scope

The twelve H01–H04 deliverables are supplied. Separate review agents inspected the authored subsets and their cross-contract compatibility; root integrated the findings and checked the combined package. **No material documentation/contract finding remains open in this bounded review.** Proposed business/privacy policies still need their actual owner acceptance before use; live configuration, runtime behavior, official FS completion and merge/release gates remain separate.

This is the requested H01–H04 preparation evidence. It is not the full H08 review of H01–H07, H05's fixture suite, an application's independent QA/Security sign-off, an approved CI batch, or founder approval of a PR merge. The reviewer labels below identify the actual collaborative review tasks; they do not impersonate permanent staff or claim human sign-off.

## Reviewer coverage

| Author / subset | Separate reviewer | Work actually reviewed | Disposition |
| --- | --- | --- | --- |
| Root: H01 and checkpoint | `h04_export_policy` | Source/document metadata; PR/FS/RCI reuse; pricing direction/source discrepancy; decision owners; phase/release boundaries | Closed after access-entitlement wording and SQL-source terminology fixes; consolidated 53-source register checked |
| `h02_metric_catalog`: H02 | Root and `h03_identity_contracts` | Financial classification,24 metric definitions, MRR cutoff and amount rules, dictionary/manifest binding, examples and input/card/source coverage | Closed after historical-backfill, fee-line, scope, MRR and execution-state clarifications |
| `h03_identity_contracts`: H03 | `h02_metric_catalog` | Identity, exact event envelope, source/denominator limitations, lifecycle, signed allocation, currency/AI precision and supporting-input joins | Closed after conditional event-reference fields were declared in the actual event envelope |
| `h04_export_policy`: H04 | `h03_identity_contracts` | Exact fields/types, result metadata, nested allowlists, proposed roles/purposes, retention/correction and deletion limits | Closed after metadata/discount/source-reference/null-cutoff/finite-retention/scope fixes and targeted saved readback |
| Root: shared plan/spec/handoff/ledger | `h04_export_policy` | Four prepared versus 27planned states, unassigned FS fields, runtime flags, deliverable links and first-release dependency language | Closed after billing/data-health versus conditional activation wording was corrected |

No author is presented as the independent reviewer of their own subset. Cross-review is limited to the actual documentation/contract work performed. The final validation receipt hashes all twelve core artifacts so a later review can detect changes.

## Material findings resolved

| Finding | Correction and location | Evidence boundary |
| --- | --- | --- |
| Restricted organization membership could be read as equivalent to read-only/download control | H01 D04 and H04 access matrix explicitly distinguish audience restriction from enforceable viewer/export separation | Actual vendor grants still need C01/C17 evidence |
| Stripe column-masking comparison used imprecise source terminology | Checkpoint uses “eligible SQL sources”; native Stripe remains conditional on complete payload review | Current official docs inspected; no account configuration tested |
| Financial-history wording could discard legitimate backfilled historical cash | H02 preserves authoritative postings in their own requested period; CRM face values/import timestamps cannot create cash or new intervention outcomes | Worked definition/example review, not provider backfill execution |
| Exception policy said counts only while metrics required known monetary exposure | H02/H03/H04 permit minimized health aggregates with known signed/absolute component amounts; raw unresolved rows stay restricted | Source/account/company attribution remains unresolved where evidence is absent |
| A customer-paid fee line and its ApplicationFee remittance could be double counted | H02 explicitly treats the synthetic added-fee example as one economic fee; other retention-from-gross models require declared source/component basis | Actual reconciliation and charging behavior remain C06/C08 work |
| Result metadata used different names and omitted required lineage/truncation context | H02/H03/H04 share the same 19 context keys and closed nested structures | H06 still specifies closed per-metric output shapes; arbitrary payloads are denied |
| Account/mode context alone could cover multiple companies | Immutable internal query manifest binds the exact company population, filter values, period, currency, source versions/cutoffs and producing authority; external ref is opaque and reauthorization is current | A manifest shape is not an authenticated runtime permission test |
| MRR supporting fields did not fully distinguish discount policy/state, trial/pause and price support | Supporting contracts now declare minimized effective-state fields and separate discount versions; nonnegative fixed amounts, 0–100 percent range and exactly-one discount amount/percentage are explicit | Effective history/API interpretation and D10 acceptance still required |
| Historical MRR cutoff wording could admit a source that had not reached the requested instant | H02 requires source coverage through the as-of instant and a proven effective item/discount state | No current mutable snapshot is treated as invented historical state |
| Some event-required references were only available in a joined supporting input | H03 declares the needed conditional envelope fields and exact trusted join/equality rules; H04 permits those constrained fields | All 24 event requirements resolve against the stated envelope; runtime adapter still needed |
| Queued outbound actions could be counted as successful execution | H02 M11 and H03 distinguish queue acceptance, internal committed effect, provider acceptance and delivery | Source names alone do not certify business outcome |
| Unknown source cutoff could force a fabricated timestamp | H03/H04 permit explicit null with unknown freshness and no complete current claim | Failed/never-observed sources remain distinguishable |
| AI “billable attempts” wording could exclude free or unknown-billing failures | H03 and technical spec include all actual invocation attempts; billing/cost evidence is a separate property | Actual capture coverage remains C11 work |
| An unfinished source run or unknown maturity could evade retention indefinitely | H04 specifies finite fallback anchors and separates approved rollups from raw detail retention | Proposed targets are not verified vendor deletion schedules |
| Billing/activation wording obscured activation's conditional C09 source dependency | Shared handoff says billing/data-health proceeds independently; activation joins only with its accepted authoritative milestone | No activation/source readiness is inferred |

## Validation performed

The [bounded validation receipt](h01-h04-validation.v1.json) records the actual command, time, checker digest, results and SHA-256 manifest. It checks the twelve core files, JSON parsing, exact 24 metric IDs, required definition/source/card/example fields, no enabled runtime metrics, source pins/metadata, seven record contracts, common/record/supporting-field compatibility, result metadata, default-deny policy,24 semantic event identities, field-reference coverage, the 31-ticket dependency/status structure and relative repository links.

Root also independently recomputed documented financial/cohort/micro-cost/allocation arithmetic using exact integers, fractions and Decimal. The receipt records 18 specific arithmetic checks. H02's author separately recorded 15 arithmetic spot checks; these overlap and are **not** 33 unique runtime tests. H03/H04 authors ran their bounded field/reference checks and separate reviewers inspected the semantic meaning of the results.

The source register includes 53 distinct pinned repository/document/vendor sources plus six PR-state snapshots. Current application file blob IDs were compared with the complete tree at `5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58`; preserved FS-43 source and initial planning-document pins are separate. This confirms which source was inspected, not whether it is deployed or correct in every runtime path.

The prior `publication-validation.v1.json` is retained as an explicitly historical receipt for the initial planning-only publication. Its old file hashes and all-planned state are not current-execution assertions.

## Still unexecuted

H05 fixtures/expected-result harness, H06 dashboard/query acceptance, H07 actual-account configuration/cost runbook and H08 full preparation handoff remain planned. This batch did not run application tests/builds, RCI's historical test suite, PostgreSQL/RLS negatives, provider/account/source payload tests, real financial reconciliation, purge/backup recovery, vendor dashboards or pilot observations. It did not enable data transfer, shared learning, payments or missions.

The [checkpoint](H01-H04-CHECKPOINT.md), [decision register](decision-register.md) and [ticket ledger](../ticket-ledger.v1.json) route the remaining work. Current repository requirements still govern actual runtime Peer/QA/Security review, approved CI, and founder authorization for each named PR and exact reviewed head.
