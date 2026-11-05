# Renvani build specifications 2–12: delivery and evidence

**Prepared:** 2026-11-05 UTC. **Specification:** [Renvani GitHub task list and build specification](https://app.notion.com/p/40f317b92d158157997dcb3a1266058e). **Source baseline:** dev `b45b4996b64b16859e44a79b171b11cbe52c3e6a`. **Delivery branch:** `docs/renvani-build-specs-02-12-20261105`. The publishing PR records the resulting exact commit/tree and independent review evidence.

The founder authorized completing the remaining eleven scoped packages. This delivery implements the documentation corrections, source inventories and scoped verification they request. It preserves their explicit limits: runtime acceptance, scanner evidence, architecture changes, CI configuration changes and complex Codex work are not silently converted into documentation PASS claims. This record does not close legacy issues or mark tickets Done.

**Integration reconciliation, 2026-11-05 UTC:** this documentation tree incorporates `dev` at `4daf6b46980fe335ad965dd910c3837fe2182ec1` after the sequential merges of #131, #404, #441, #95, #434 and #430. The [reconciliation ledger](DESIGN-DOCS-RECONCILIATION.md) records their reviewed heads and merge commits. Inventories, counts, source paths and original test/browser evidence retain their dated `b45b4996` or explicitly named PR baselines; they have not been remeasured against the integration head. The current ADR index includes eleven records while preserving the original ten-record audit. Inherited #430 foundation code does not establish affirmative capture or provider activation.

## Package outcomes

| Spec | Deliverable and actual outcome | Status within the requested scope | Remaining boundary |
| --- | --- | --- | --- |
| 1 | Already published to [#435](https://github.com/SimonShaun2/Renvani/pull/435), commit `47e5b0dd4237903e5bc5437a74280812bcf692f5`; 25 focused tests pass, independent review/QA and READY preview recorded | Implementation published; verified unchanged at task start | Full PR integration, authenticated/responsive acceptance, applicable CI and founder merge approval remain |
| 2 | [ADR index and process](../adr/README.md): ten-record original audit, eleven current records, actual source statuses and both naming conventions | Documentation complete | Merged #95 Accepted provenance and #430's qualified source status retained; proposed tenant/payment ADRs stay Proposed |
| 3 | [Canonical Figma/brand contract](../design/RENVANI_FIGMA_PARITY.md), entry point, template and historical annotations; [preservation ledger](DESIGN-DOCS-RECONCILIATION.md) | Documentation complete | Merged #131/#404/#434 changes preserved with their original evidence; no visual parity inferred |
| 4 | [Frontend inventory](FRONTEND-INVENTORY.md) of 112 page files; same [FS-51 map](../design/fs-51-figma-route-map.json) retaining 25 design surfaces | Source inventory/evidence manifest complete | Authenticated behavior, measured accessibility and missing-frame acceptance remain |
| 5 | [CI/environment assessment](CICD-STATE.md) and targeted current/historical documentation corrections | Assessment and documentation complete | Runtime discrepancy, template drift and #419 runtime controls require implementation/acceptance by their owners |
| 6 | [Backend inventory](BACKEND-INVENTORY.md): all 64 registered endpoints in six selected groups | Six-group source evidence complete | No whole-backend or adversarial tenant certification |
| 7 | [Schema inventory](SCHEMA-INVENTORY.md): 83 canonical tables, 35 stale root tables, 62 SQL/journal migrations | Source inventory complete | Live schema equivalence, clean/incremental replay and duplicate removal remain separate |
| 8 | [Worker/outbound inventory](WORKER-INVENTORY.md): all nine queues and selected SMS/email paths | Source inventory complete | Actual delivery, consent/concurrency and queue replay are not certified; #430/#431 retained |
| 9 | [Dependency baseline](DEPENDENCY-AUDIT.md): 13 manifests, 176 declarations, exact lock resolutions and scanner handoff | Source baseline complete | Current advisories/licenses and two independent scanner acceptance not executed |
| 10 | [Test baseline](TEST-BASELINE.md): 555 TypeScript test files, 4 Node test scripts, separate infrastructure paths; actual #435 and #439 evidence | Inventory and declared focused baseline complete | Full legacy #8 acceptance and instrumented coverage remain broader work |
| 11 | [Website verification](WEBSITE-VERIFICATION.md): 108/108 tests and web TypeScript under Node 22.16.0; fresh desktop menu checks | Local and desktop verification complete; responsive verification BLOCKED | 320/390/834 CSS-pixel inspection requires a viewport-capable browser; current-head CI/design/release gates remain |
| 12 | [Operator acceptance packet](OPERATOR-ACCEPTANCE.md): source/preview manifest, role crosswalk, 25 scenario records including observed sign-in prerequisite, fixture and evidence contract | Packet complete; authenticated execution BLOCKED | Current preview redirects to login; approved role fixtures, integrated source/API binding and responsive browser needed |

The nine bounded packages **2–10** have their scoped deliverables completed. Package **11** has completed Node 22 and desktop evidence, with responsive checks still open. Package **12** has its executable packet completed, with authenticated execution still open. This is not a claim that eleven production features were implemented or that the product is release-ready.

## Ownership and integration approach

| Work | Implementing owner | File boundary |
| --- | --- | --- |
| Specs 2–4 | `/root/docs_design_specs` | ADR README, design entry/contract/template/historical references, FS-51 and frontend appendices |
| Specs 6–8 | `/root/backend_source_specs` | Backend, schema, worker reports and supporting JSON |
| Specs 9–10 | `/root/dependency_test_specs` | Dependency/test reports and supporting JSON |
| Specs 5, 11, 12 and publication | `/root` | CI/env docs, website validation, acceptance packet, combined index and evidence publication |

Implementers work on disjoint files in this documentation branch. Cross-review is a quality check, not independent approval of their own PR. Distinct non-implementer peer and QA review are recorded in the publishing PR at the frozen tree/head. No application code, schema, migration, dependency, workflow, branch protection, provider setting or secret was changed in this delivery.

Original input heads remain immutable historical references. The reconciliation ledger records the integrated predecessor changes and their overlap resolution. The stack #432 → #435 → #437 → #438 remains unintegrated. This branch's delta against the current merged `dev` contains documentation/evidence only; #441 cleanup and #430 foundation code are inherited unchanged from `dev`.

## Material findings for the existing Codex work

1. **Runtime mismatch:** root/Render Node 22.16.0 versus two general CI setup steps at Node 20. The smallest proposed correction is recorded, without changing the workflow.
2. **Template drift:** existing env validator finds 23 missing root keys, 6 extra root keys and 49 missing local-template keys. Coordinate with #419; configuration presence is not least-privilege proof.
3. **Role policy differences:** office and dispatcher are distinct; UI navigation/prefix access and several API allowlists differ. `/booking-requests` is linked in navigation but absent from every allowed role prefix. Resolve the intended policy and verify positive/negative access explicitly.
4. **Migration lineage:** source journal/file coverage is complete, while historical timestamp order needs clean/incremental replay evidence. No applied migration history was rewritten.
5. **Outbound delivery:** source paths, disabled/provider boundaries, retries and consent checks are mapped at the original baseline. A queued job, configured schedule or success log does not prove a delivery. #430's merged foundation retains separate affirmative-capture/provider release gates; #431's remaining consent and concurrency work stays open.
6. **Company Profile save verification:** source review identified inherited whitespace-normalization and overlapping-save concerns in both baseline `dev` and #438. No authenticated runtime failure or new #438 persistence regression has been established. Reproduce the behavior in isolated tests and retain S05's expected behavior for runtime acceptance before choosing remediation.
7. **Import dispatch gap:** `migrate-file-batch` has producers and a standalone processor, but the registered imports dispatcher has no case routing that job to the processor. The worker report pins the relevant source and requires a bounded dispatch/error-path regression before claiming execution.
8. **Retention wiring gap:** the registered retention path uses a default input loader returning null, and its `proposal.create.customer_message` enqueue target has no matching operator-dispatch case. Source presence is not an active retention workflow; Codex must reconcile the contract and prove the intended job path in isolation.

The actual async opportunity scan in #436, database acceptance, broader security/tenant architecture and Operating Missions remain outside these bounded packages. Original Part I acceptance and founder permission still govern Part II.

## Verification and publication record

Source appendices include immutable paths/SHAs and separate source presence, existing tests, observed executions and unverified runtime assumptions. Structural checks validate inventories, links, JSON and immutable input blobs; `git diff --check` is required for the final tree. The original environment validator failure is retained as a finding rather than concealed.

Local runtime evidence: #435 **25/25** focused tests at its published tree, reused with provenance; #439 **108/108** tests across eight suites and full web TypeScript under Node 22.16.0, executed for the original delivery. No coverage percentage, authenticated browser PASS or responsive PASS is invented. Historical CI remains attached to its original heads; the reconciled documentation PR requires its own approved batch and affected independent reviews at its final head.

The draft publishing PR is the authoritative record of the new documentation commit and independent reviews. Merge and production promotion remain separate founder decisions after applicable gates. This file records completed bounded work and precise remaining requirements so Codex can continue without repeating the inventory.
