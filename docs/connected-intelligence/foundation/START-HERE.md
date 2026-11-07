# Document 1 H01–H16 | Implemented foundation and integration handoff

**Recorded:** November 6, 2026. **Implementation state:** all sixteen foundation deliverables supplied; local validation passed; independent review and release acceptance remain pending. This is actual TypeScript, executable tests and a portable harness, not only the earlier build specification.

**Working branch:** `feat/rci-foundation-h01-h16-20261106`.
**Application-source baseline:** `8d01e752377d2401cb2c6cdf235aa8dcbdde0aeb`.
**Clean implementation commit validated:** `4bdf4573e5f6bf660323f0791aad2f1fed739a49`.
**Implementation/test/config/harness SHA-256 manifest digest:** `354f6dd3e49493ee328c88a0a2b98f5750dcb247ebbd362fd80caaa0eb19b934`.

The branch may have a later documentation-only handoff commit. Re-fetch the actual PR head. Validate its exact source, and do not assume a cached PR description proves what is checked out. No merge into `dev`/`main`, deployment, provider write, payroll submission, purchase, customer send or Operating Missions activation is authorized by this delivery.

## What was delivered

| Sprint / ticket | Actual artifact | Local state and boundary |
| --- | --- | --- |
| H1 / H01 | `source-register.json`; current PR/FS crosswalk; 16 source-path checks | Delivered. Board status and source capability deliberately distinguished; missing owners remain unassigned. |
| H1 / H02 | `catalog.ts`; exact arithmetic helper/tests; identity policy | Delivered. 24 metric definitions including the four existing KPI meanings. Proposed financial policies are not silently approved. |
| H1 / H03 | `POLICY-AND-IDENTITY.md`; scope/read binding and projection rules/tests | Delivered. Shape/equality checks are not authentication or real RLS acceptance. |
| H2 / H04 | `contracts.ts` and strict schemas/tests | Implemented: scopes, periods, source manifests, facts, quality, calculation lineage, claims, answers and non-executing proposals. |
| H2 / H05 | 16 capability descriptors, typed readers and explicit unavailable reader | Implemented. All configured/validated/enabled flags remain false in the foundation catalog. |
| H2 / H06 | 12 recipe definitions and deterministic bounded resolver | Implemented. Required/optional sources, selected accounting connector, fresh-start path and safe unavailable states. |
| H2 / H07 | `quality.ts`, `foundation-math.ts` and tests | Implemented. Exact decimal arithmetic, completeness/freshness, basis compatibility, deduplication, report parity and restricted projection. |
| H3 / H08 | `claims.ts` and grounding/fallback tests | Implemented. Structured numeric/reference validation and fixed safe templates; unrestricted prose is not certified by these checks. |
| H3 / H09 | `brief-adapter.ts` and compatibility tests | Implemented. Legacy meanings, values, comparison, daily scope and caps preserved; source origins/versions not invented. |
| H3 / H10 | Workforce/math/accounting/stock fixtures and tests | Implemented for isolated contracts; not a new payroll, cost ledger or connector. |
| H3 / H11 | Forms, migration and launch-readiness fixtures/helpers/tests | Implemented. Versioned requirements, artifact confirmation, reconciliation, rollback review limits and launch gates. |
| H4 / H12 | Executable Vitest coverage linked to CI-A01–CI-A24 | Implemented and run. Every scenario has offline proof; runtime/provider/independent acceptance is still not executed. |
| H4 / H13 | `attention.ts`, report-parity checks and tests | Implemented as pure rules. No queue, scheduler or notification send was added. |
| H4 / H14 | Headless `presentation.ts`, tests and `UI-STATE-CONTRACT.md` | Preparation delivered. Exact existing Figma references inspected; new answer/drawer/responsive frames remain explicit C06 design gaps. |
| H4 / H15 | Scoped strict tsconfigs, no-production-adoption audit and portable validation script | Delivered and run from a clean checkout. No package exports or application startup imports changed. |
| H4 / H16 | This start-here record, ticket ledger, validation summary and linked Notion status | Delivered for continuing agents. Independent review, approved CI and founder merge remain pending. |

Local task IDs remain RCI-H01–H16. No duplicate FS board records were created and no existing FS ticket was marked Done. Original governing repository instructions, founder directive #420, the master Phase A/B sequence and existing #445/#442 work remain intact.

## Validation receipts

Run recorded at **2026-11-06T16:38:12.551Z**, from a clean checkout of the implementation commit above using **Node 22.16.0**, **pnpm 10.0.0**, existing lockfile dependencies and no real customer/provider credentials.

| Check | Result |
| --- | --- |
| Foundation shared-type/helper tests | **136 passed**, zero failed/pending/TODO |
| Foundation API-side exact arithmetic tests | **43 passed**, zero failed/pending/TODO |
| Complete `@fsm/types` suite | **315 passed**, zero failed/pending/TODO; includes the 136 above |
| Strict TypeScript, including all new tests/fixtures | Passed for types and API math scopes |
| Complete `@fsm/types` build | Passed |
| Scoped ESLint, including validation script | Passed |
| Import-normalize, import-engine and config dependency builds | Passed |
| CI-A01–CI-A24 offline case coverage | **24/24 mapped to executed passing assertions** |
| Isolation/source checks | Zero production consumers/public exports; all 16 mapped source paths/symbols exist |
| Git diff whitespace check | Passed |

Do not add 136 to 315 as if they were distinct tests. The unique combined type/math suite comprises 358 passing tests at this source checkpoint. The foundation itself comprises 179 focused tests.

An earlier broad-types attempt encountered two dependency-loading failures, and the first harness run found an ESLint extension-discovery issue. Those runs were not counted as passes. Building workspace dependencies in the correct order and explicitly including `.mjs` in the lint scope resolved them; the recorded clean-checkout run above passed.

**Not run or claimed:** full API/web application suites, authenticated Clerk/browser/database/RLS tests, actual model/provider calls, production accounting or migration pilots, browser/Figma parity, independent Peer/QA/Security/Design, approved batch CI, or production release. Those are the relevant Document 2 acceptance scopes, not requirements silently satisfied by mocks.

## Reproduce locally

Use the pinned Node/pnpm versions. Install the existing workspace without changing the lockfile, then:

```bash
pnpm install --frozen-lockfile --ignore-scripts
node scripts/connected-intelligence/validate-foundation.mjs --full
```

The script writes logs, Vitest JSON and a validation manifest to a new temporary directory. `--out=/absolute/path` selects a separate evidence directory. It fails on a command error, suite load failure, pending test or missing case mapping. It records actual HEAD/working-tree state and SHA-256 hashes for 23 implementation, test, configuration and harness artifacts. It performs no network/provider call after dependency installation and does not dispatch GitHub CI.

The dependency build order is import-normalize → types → import-engine → config. Strict scoped typechecks include test-only fixtures, while production package build excludes fixtures. No new dependency or lockfile change was needed.

## File/consumer map

- `packages/types/src/connected-intelligence/v1/`: internal, unexported versioned contracts, registry, recipes, source-quality/claim/presentation/readiness helpers, current-brief adapter and colocated tests.
- `packages/types/test-fixtures/connected-intelligence.ts`: explicitly synthetic input factories outside production `src` and public exports.
- `apps/api/src/services/connected-intelligence/`: pure exact-decimal contract arithmetic using the existing Decimal dependency; no DB, route, worker or external integration.
- `packages/types/tsconfig.connected-intelligence.json` and `apps/api/tsconfig.connected-intelligence.json`: strict isolated checks, including new tests.
- `scripts/connected-intelligence/validate-foundation.mjs`: portable H12/H15 local validator.
- This directory: source/FS mapping, identity/policy decisions, Figma/state discovery, case-to-runtime crosswalk and exact-source validation summary.

There is intentionally no new public package barrel, production feature flag, migration, route registration, worker, provider client or React screen. C02 owns public adoption and compatibility decisions after review. Consumers must not import synthetic fixtures into production.

## Codex/Cursor: immediate next task

**Start Document 2 C01/C02, then C04/C05 (the CI-READ-01 integration). Do not rewrite H01–H16.**

1. Read current `AGENTS.md` and `CODEX.md`, this record, the original two-track specifications on #449, the actual #445 source and #442 preparation. Record actual heads and reconcile current FS ownership.
2. Run the portable harness on the checked-out source. Review the schema/permission/financial meaning decisions and the open-policy register. The implementing agent's tests are not independent QA approval.
3. Adopt the internal contracts without changing existing brief v1 consumers. Current authenticated identity and capabilities must be constructed server-side; `scopeSchema` merely validates shape.
4. Implement real tenant/role/entity/field-safe readers for accepted current sources. Bind each result to the exact actor/authorization scope. The model must not supply scope, freshness policy, verification markers or grants.
5. Recheck source completeness, timestamps and calculations before model projection. The `verified_by_reader` calculation marker is reserved for trusted deterministic services, not a model/client assertion. Sensitive derived facts cannot bypass their input restrictions.
6. Build the real read-only “What needs attention today?” surface using C06's reviewed exact frames. Existing generic Command Center/scorecard frames are context, not approval of the new answer and evidence states.
7. Complete actual database/authenticated/UI/model acceptance and independent reviews before founder-approved merge. Keep consequential actions disabled until their separate gates.

## Important limitations carried forward

Financial recognition, overtime/commission/burden, inventory valuation, anti-inference granularity, provider compatibility, source freshness and retention remain reviewed policy inputs. Foundation test values are synthetic, not new company settings. The headless UI contract is not a live screen. The source registry marks new domains and partial integrations honestly. A missing or stale required source prevents the relevant complete claim without blocking unrelated useful facts.

The source-scope/projection controls do not replace database authorization. The fixed-template claim validator does not prove arbitrary narrative semantics. The pure attention grouper requires an authorized complete snapshot and cannot certify a partial event stream as resolved. The report comparator does not implement secure delivery. Every such boundary is assigned to its Document 2 consumer.

## Governing references

[Document 1 specification](https://github.com/SimonShaun2/Renvani/blob/docs/operations-finance-migration-spec-20261106/docs/build-specs/CONNECTED-INTELLIGENCE-01-CHATGPT-FOUNDATION-SPRINTS-2026-11-06.md) · [Document 2 integration plan](https://github.com/SimonShaun2/Renvani/blob/docs/operations-finance-migration-spec-20261106/docs/build-specs/CONNECTED-INTELLIGENCE-02-CODEX-CURSOR-SPRINTS-2026-11-06.md) · [Notion Document 1](https://app.notion.com/p/410317b92d15816fb2ecc54df2028db2) · [Notion connected-intelligence parent](https://app.notion.com/p/410317b92d1581629591d0b192de9444).
