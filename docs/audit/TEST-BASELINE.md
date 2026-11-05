# Current test inventory and scoped baseline

**Build specification 10. Source inventory and the declared Revenue Center baseline are complete; full repository/runtime acceptance remains open.**

Inventory source: **b45b4996b64b16859e44a79b171b11cbe52c3e6a** (`dev`, inspected **2026-11-05 UTC**). Executed baseline: **PR #435 at 47e5b0dd4237903e5bc5437a74280812bcf692f5**, tree `c4997d60323e88189c21c790579f1637248922dc`. These are distinct revisions. This document is the current bounded deliverable from [build specification 10](https://app.notion.com/p/40f317b92d158157997dcb3a1266058e), feeding [legacy #8 / FSM-0007](https://github.com/SimonShaun2/Renvani/issues/8). It does not close #8 or revive the old demand for three blanket full-suite runs.

## 1. Denominators and evidence levels

The complete [source inventory](test-inventory.json) contains **555 tracked `*.test.ts` / `*.test.tsx` files**, **4 separately inventoried `*.test.mjs` scripts**, and **71 tracked fixture/support files** under directories named `fixtures` or `test-support`. Every entry includes its source path, workspace and immutable SHA-based URL. TSX accounts for **79** of the 555 files. Source location is used to group the inventory; a file's name does not certify its integration depth.

| Workspace | Tracked TS/TSX test files |
| --- | ---: |
| [apps/api](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/apps/api/package.json) | 222 |
| [apps/web](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/apps/web/package.json) | 137 |
| [apps/webhook](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/apps/webhook/package.json) | 5 |
| [apps/worker](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/apps/worker/package.json) | 23 |
| [packages/ai](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/ai/package.json) | 5 |
| [packages/comms](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/comms/package.json) | 8 |
| [packages/config](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/config/package.json) | 27 |
| [packages/db](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/package.json) | 49 |
| [packages/import-engine](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/import-engine/package.json) | 11 |
| [packages/import-normalize](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/import-normalize/package.json) | 2 |
| [packages/jobs](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/jobs/package.json) | 22 |
| [packages/types](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/types/package.json) | 44 |
| **Total** | **555** |

The historical **42** count is not current. The seven old date-related failures were mapped to **FS-2** and fixed through **PR #27**, as retained in [FS-52 history](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/docs/planning/FS-52-code-to-area-gap-map.md). No new failure is inferred from that old text.

| Evidence term | Meaning in this report |
| --- | --- |
| Source/test exists | File/configuration present at the recorded SHA; it may be conditional, skipped or unexecuted |
| Executed cases | Cases in an actual runner result, with run scope, revision and runtime attached |
| Skipped/pending/todo | Reported separately from passed cases; static markers do not tell us the eventual dynamic skip count |
| Coverage | Instrumented coverage measurement; **not measured** in this package |
| Browser evidence | Observation in an actual browser; a happy-dom render or HTTP stub is not that evidence |
| CI evidence | A named approved workflow run at its recorded head; local tests are recorded separately |

## 2. Execution paths and prerequisites

| Surface | Existing entry point | Source configuration / prerequisites | Evidence here |
| --- | --- | --- | --- |
| Workspace default Vitest suites | `corepack pnpm test` | Root recursively invokes child `test` scripts; each child runs `vitest run`. Review the actual selected service requirements before any broad run | Source inventory only; not executed as one full suite |
| API routes, services, plugins, contracts | `corepack pnpm --filter @fsm/api test` | [Node config](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/apps/api/vitest.config.ts) sets 30s hooks/tests and blanks `RESEND_API_KEY`; default run excludes trusted-execution gap glob. Fixtures/mocks do not establish live provider safety for arbitrary future tests | 222 source files counted; no full API rerun |
| Trusted-execution gap suite | `corepack pnpm --filter @fsm/api test:trusted-execution-gaps` | [separate config](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/apps/api/vitest.trusted-execution-gaps.config.ts) clears the base exclusion and includes only `src/**/trusted-execution-gaps.test.ts` | **1 separately selected file; not run here**. Existing comments describe expected failures; current failures are not asserted without execution |
| Web components and helpers | `corepack pnpm --filter @fsm/web test` | [config](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/apps/web/vitest.config.ts): Node default, TSX test/spec → happy-dom, automatic JSX, `@` alias. Query/router mocks and DOM rendering are common | #435 focused run reused below |
| HTTP-stub integration | Select `src/lib/legacy-estimate-route.http.integration.test.ts` in web | [test](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/apps/web/src/lib/legacy-estimate-route.http.integration.test.ts) starts a loopback HTTP stub; needs a local listening port, not a deployed authenticated browser session | Source exists; not run |
| Worker | `corepack pnpm --filter @fsm/worker test` | [config](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/apps/worker/vitest.config.ts) aliases AI/jobs source and uses env setup. The Clerk workspace PostgreSQL suite requires its own isolated database prerequisite | 23 source files counted; not run |
| Webhook | `corepack pnpm --filter @fsm/webhook test` | [config](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/apps/webhook/vitest.config.ts) aliases a stub queue and shared types; does not establish live webhook/provider acceptance | 5 source files counted; not run |
| Shared packages | `corepack pnpm --filter @fsm/types test` and sibling package scripts | Types/config/import-normalize configs include `src/**/*.test.ts`; db/jobs use their test env setup. Config values used by tests are not evidence of a running database or Redis | Source inventory only |
| Import contract slice | `corepack pnpm test:fs-migrate-import-contracts` | [root script](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/package.json) builds config/normalize/types and runs the named normalize, types, jobs and onboarding-route contract suites | Existing path preserved; not rerun |
| Cross-tenant slice | `corepack pnpm test:cross-tenant` | [root script](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/package.json) plus [API selection](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/apps/api/package.json); source-level/mocked negatives and real RLS execution must retain their different evidence levels | Not rerun; no tenant certification |
| Neon migration/RLS execution | `corepack pnpm test:neon-ci` | Builds package dependencies, invokes [Neon runner](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/scripts/ci/neon-per-pr-branch.mjs), validates staging configuration and uses an isolated database helper; applies migrations and runs db tests when enabled | **Not run**; database credentials, isolation and suitable role privileges required |
| Golden-import E2E | `corepack pnpm test:golden-import-e2e` | [Node runner](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/scripts/ci/golden-import-e2e.mjs) builds packages and invokes [Neon integration test](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/src/golden-import-e2e.integration.test.ts). Needs an approved isolated staging database; the runner uses its supplied database URL and does not itself allocate the per-PR database | **Not run**; preserves the existing QBD/Service Fusion bundle E2E path |
| Node runner wiring | `corepack pnpm test:golden-import-e2e-wiring`; `corepack pnpm test:neon-ci-wiring` | `node --test` wiring checks are separate from their live PostgreSQL counterparts | 2 of 4 Node test scripts; not rerun |
| Strict PostgreSQL paths | `node scripts/ci/fs229-revenue-inquiry-postgres.mjs`; `node scripts/ci/fs235-clerk-workspace-postgres.mjs` | Existing exact-PR conditional workflow steps and isolated PostgreSQL inputs; preserve strict reporter/skip checks | Not run; conditional workflow skip is not an execution PASS |
| Deployed tester smoke | `scripts/tester/e2e-smoke.sh` | [script](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/scripts/tester/e2e-smoke.sh) has host/tier write guards and optional `--dry-run`; actual path can register/import/create/send and requires its approved test environment. Clerk and test checkout include browser gaps | Inventoried only; no smoke writes/payments/messages executed |
| Browser/authenticated operator journeys | [Operator acceptance packet](OPERATOR-ACCEPTANCE.md) | Approved preview/API origins, owner/office/technician accounts and test fixtures; viewport-capable browser for responsive acceptance | Not established by this test inventory |

No tracked Playwright config/spec files were found in this snapshot. That observation does **not** mean the repository has no E2E coverage: the Node golden-import orchestration, its database integration suite and tester smoke are explicit separate paths.

The other two Node test scripts are [scripts/ci/fs229-revenue-inquiry-postgres.test.mjs](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/scripts/ci/fs229-revenue-inquiry-postgres.test.mjs) and [scripts/staging/fs231-two-trade-fixtures.test.mjs](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/scripts/staging/fs231-two-trade-fixtures.test.mjs). A fixture-script unit test does not prove that the live fixture population ran.

## 3. Exclusions, conditions and fixtures

The JSON records source lines for literal `runIf`, `skipIf`, `skip` and `todo` declarations in **15 files**. This is a static inventory, not a count of skipped test cases. Material examples:

1. The default API config excludes the single trusted-execution gap file; it has a dedicated command/config and remains visible in this inventory.
2. [FS-40 gate source](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/apps/api/src/contracts/fs-40-import-outbox-attribution.gates.test.ts) uses `describe.skip`; its historical dependency comment is retained as source text, not accepted as a current blocker decision.
3. API job completion, reporting and inquiry concurrency; worker Clerk provisioning; and eight db integration files have database-gated suites. `NEON_CI_DATABASE_URL` presence/shape is a prerequisite, not proof that the database is isolated or RLS-effective. Several suites create roles or records, so execute only against the approved isolated test database.
4. The web MVP smoke source contains `it.todo` entries. Their comments may be historical; they are not converted into present defects without checking the current source and an actual run.
5. Neon and golden-import runners can emit **SKIP and exit 0** when their database input is absent. Preserve the printed skip reason and executed-case count; a green workflow around an absent optional secret is not a passed database exercise.

Support paths include API fixture builders, mock DB helpers and environment setup; webhook stub queues; config/db/jobs environment setup; and golden-import fixture assets under `packages/config/fixtures`. The full 71-file appendix supplies immutable links. Fixtures are source inputs, not authorization to operate against a live workspace. Test environment names are recorded without secret values.

## 4. Completed scoped baseline: AI Revenue Center / #435

[Component suite](https://github.com/SimonShaun2/Renvani/blob/47e5b0dd4237903e5bc5437a74280812bcf692f5/apps/web/src/components/ai/AiRevenueCenterClient.test.tsx) and [state-helper suite](https://github.com/SimonShaun2/Renvani/blob/47e5b0dd4237903e5bc5437a74280812bcf692f5/apps/web/src/components/ai/revenue-center-state.test.ts) are the declared current Phase A validation slice. The [published PR record](https://github.com/SimonShaun2/Renvani/pull/435) and [preserved result summary](revenue-center-regression-evidence.json) identify the tested files, Git blobs, exact head/tree and limits.

| Stage/check | Actual result | Revision/provenance |
| --- | --- | --- |
| Original focused baseline | 5 passed, 1 failed | Parent `1cc6ecda63e4acdede8cdc6d0bd6b3ecbe115d4f`; obsolete Create Estimate expectation |
| Expanded regression suite before runtime fix | 18 passed, 7 failed, 0 pending; 2 files | Author's intermediate red JSON; failures reproduced missing-data, stale-pagination and pending-refresh defects |
| Expanded suite after runtime fix | 25 passed, 0 failed, 0 pending; 2 files | Author's intermediate green JSON, before the final test type-annotation correction |
| Final independent local QA | **25 passed, 0 failed, 0 skipped; 2 files** | `/root/revenue_qa` reran under **Node 22.16.0**, Vitest 3.2.4; confirmed exact published head/tree |
| Complete web TypeScript | **PASS** | Implementing coordinator's recorded validation at the published tree |
| Targeted ESLint, two edited files | **PASS** | Implementing coordinator's recorded validation at the published tree |
| Independent source review | **Scoped PASS** | `/root/ui_keyboard_check`, exact-head acknowledgment |
| Instrumented coverage | **Not measured** | No coverage report or percentage claimed |
| Authenticated browser / responsive / combined stack | **Not executed for this baseline** | Remains in the operator acceptance packet |
| Approved batch CI for this follow-up | **Not run** | Local test results are not substituted for CI |

The suite contains **22 component cases + 3 helper cases**. The intermediate JSON's `numTotalTestSuites` includes nested describe groups; **2 test files** is derived from its two `testResults` entries. The exact-head independent QA record supports the final published revision; the earlier JSON artifacts are preserved as red/green behavior evidence, not mislabeled as a reporter artifact from the later final run. This inventory did not rerun already verified tests.

The completed scope covers record-only Mark handled; proposal success/failure/navigation timing; both refresh calls and pending-state retention; partial, missing and rejected refetches; successful retry; valid zero/empty/filtered-empty states; hiding failed cached values/actions/pagination; and loading without false zero or empty claims. Query hooks and navigation are mocked. These cases do not implement or certify the asynchronous opportunity scan (#436), real authorization, customer sends, scheduling or payment behavior.

Reproduction commands at the published revision, with the recorded Node/pnpm versions and a frozen dependency installation:

```sh
corepack pnpm --filter @fsm/web exec vitest run src/components/ai/AiRevenueCenterClient.test.tsx src/components/ai/revenue-center-state.test.ts
corepack pnpm --filter @fsm/web exec tsc --noEmit
corepack pnpm exec eslint apps/web/src/components/ai/AiRevenueCenterClient.tsx apps/web/src/components/ai/AiRevenueCenterClient.test.tsx
```

## 5. Additional completed package 11 local evidence

The coordinating agent completed a fresh run at **PR #439, head `935d37b0fa54f68b2ec88eb76ef6e4e30823c161`**, under **Node 22.16.0**: **108 passed, 0 failed, 0 pending across 8 test files**. Complete web TypeScript also passed; the command chain exited 0. This inventory independently parsed the actual JSON result and verified the eight source file blobs. The [website verification report](WEBSITE-VERIFICATION.md) and its [test evidence](website-test-evidence.json) record the source, command and measured results.

| Marketing suite | Passed cases |
| --- | ---: |
| flagship | 28 |
| industry | 11 |
| intake | 21 |
| menus | 15 |
| platform | 7 |
| pricing | 7 |
| site | 10 |
| tour | 9 |
| **Total** | **108** |

```sh
corepack pnpm --filter @fsm/web exec vitest run src/components/marketing/site
corepack pnpm --filter @fsm/web exec tsc --noEmit
```

The earlier **78 cases / 6 suites** remain historical evidence; the fresh 108-case selection also includes intake and tour. No source change was needed for this validation. Existing package build dependencies were built in order before the successful run. Instrumented coverage was not measured. Package 11's browser record separately identifies the desktop observations and the unexecuted **320, 390 and 834 CSS-pixel** widths; these local component tests do not substitute for that viewport evidence.

## 6. CI preservation and remaining acceptance

[Current workflow source](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/.github/workflows/batch-ci.yml) retains label/dispatch gating, default workspace tests, cross-tenant/import contracts, wiring checks and separate conditional database execution. Existing valid CI run records remain attached to their original exact heads; this source inventory neither invalidates nor reruns them. [CI/environment state](CICD-STATE.md) records current configuration conflicts and evidence separately.

Package 10's declared source inventory and #435 scoped baseline are complete. Full #8 acceptance still needs an explicitly selected broader scope, isolated PostgreSQL/Redis and applicable browser/provider fixtures, exact-head runs, actual skips/failures, and instrumented coverage if required for that scope. A source-file count and a local focused PASS cannot certify the entire repository. Preserve the existing Part I boundary and founder merge gates; no ticket is marked Done by this report.

## 7. Inventory reproduction

```sh
git ls-tree -r --name-only b45b4996b64b16859e44a79b171b11cbe52c3e6a
git ls-files '*.test.ts' '*.test.tsx'
git ls-files '*.test.mjs'
```

Filter the immutable tree listing by the exact suffixes, assign each file to its `apps/<name>` or `packages/<name>` manifest, and record source configuration separately from literal conditional markers. Resolve every appendix path at the recorded SHA. For the selected runtime slice, read actual runner reports rather than counting `it()` calls in source. Structural validation verified all 555 unique test paths, the 4 Node scripts, the 71 support/fixture paths and all referenced source inputs.
