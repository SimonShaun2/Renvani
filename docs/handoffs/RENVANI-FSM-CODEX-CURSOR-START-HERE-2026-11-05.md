# Renvani FSM — Codex / Cursor start here

**Recorded:** November 5, 2026. **Scope:** six Phase I FSM workflow packages (WF-01–WF-06). **Status:** implemented on an unmerged feature branch; release verification still HOLD.

## Start from these exact sources

- **Repository:** `SimonShaun2/Renvani`.
- **Working branch:** `feat/fsm-workflow-reliability-20261105` (PR [#445](https://github.com/SimonShaun2/Renvani/pull/445)); do NOT begin from `dev` to inspect the six-package code.
- **Recovered implementation source commit:** `763e1504ee666eb184f3144e7e37b9c0d0bd2205`. The branch may have later docs-only commits; inspect `git rev-parse HEAD`, current PR files, and the merge base on every new session.
- **PR dependency chain:** [#432](https://github.com/SimonShaun2/Renvani/pull/432) → [#435](https://github.com/SimonShaun2/Renvani/pull/435) → [#437](https://github.com/SimonShaun2/Renvani/pull/437) → [#438](https://github.com/SimonShaun2/Renvani/pull/438) → #445. The #445 code commit has #438 as its second parent. Do not cherry-pick the same work twice or independently merge the stack without rechecking history.
- **Full scope and evidence:** [FSM-WORKFLOW-COMPLETION-2026-11-05.md](../build-specs/FSM-WORKFLOW-COMPLETION-2026-11-05.md).
- **Notion:** [Field Service Agents Product & Build HQ](https://app.notion.com/p/3ff317b92d1581df8eb5f7353616f529), [Part I status and acceptance](https://app.notion.com/p/40e317b92d15816d9c87d7afb0327d1e), [Part II foundation handoff](https://app.notion.com/p/40f317b92d15811281d3f387c4d1a9b3). Phase II Operating Missions is a separate, gated track.
- **Figma:** [FSM Agent – Product Design](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-%E2%80%93-Product-Design), including weekly references desktop `604:10228`, tablet `604:10293`, mobile `604:10361`, empty `604:10432`, error `604:10477`, loading `604:10502`. Reference frames do not constitute independent sign-off.

## Resume workflow — in order

1. Read `AGENTS.md`, `CODEX.md`, the PR #445 conversation/changed files, and this handoff. Founder directive #420 controls merge and Phase II scope.
2. Fetch remotes, switch to the feature branch and confirm the actual branch head, PR base, merge ancestry and any new commits. Never treat a PR description or cached SHA as proof of code: this branch previously had a description/head mismatch that was repaired by publishing the recoverable code.
3. Compare the six implemented packages against the corresponding real API contracts, canonical Figma nodes and existing domain services. Do not re-implement completed modules.
4. Run local unit/integration, production typechecks/builds and real isolated PostgreSQL tests, then obtain **approved current-head CI**. Missing or skipped database/provider tests are not passes.
5. Perform authenticated Clerk/tenant/role preview checks, owner/office/technician/customer end-to-end scenarios, accessibility and actual screenshot parity at desktop/tablet/mobile for all touched screens; verify data counts, error states, and Figma differences.
6. Obtain independent Peer, QA, Security-by-risk and Design/Product acceptance with exact head and evidence; record concrete unresolved defects as bounded fixes. Do not self-certify.
7. Leave the PRs draft until the founder explicitly names each PR and exact reviewed head for merge. Follow reviewed dependency order. Merge only with explicit approval; deploy API support before web consumers. No unapproved production promotion.

## Implementation map (avoid duplicate builds)

| Package | Implemented source | Behavior to protect |
| --- | --- | --- |
| WF-01 Technician issues | `apps/web/src/components/mobile/CrewFinishJob.tsx`, `mobile-issue-form.ts` and tests | Seven categories, low/medium/high, trimmed notes, pending lock, current record version, failure recovery; reporting does not approve extra work or change job hold. |
| WF-02 Mobile closeout | `apps/web/src/components/mobile/JobActionBar.tsx`, `mobile-closeout.ts` and tests | Completed/invoiced/paid truthfulness; return to Today; no technician financial permission expansion. |
| WF-03 Customer estimate recovery | `apps/web/app/(public)/approve/[token]/page.tsx`, `apps/web/src/components/estimates/PublicEstimateFlow.tsx`, `estimate-decision.ts` and tests | One decision at a time, ambiguous write requires status GET, confirmed approval stays recorded after refresh failure; request ≠ scheduled visit. |
| WF-04 Integrated office UI | PRs #432/#435/#437/#438, `AppShell.tsx`, `DashboardClient` / settings / operator components | Preserve session guard, dedicated headings, mobile navigation Escape/focus, Revenue Center, Settings and existing operator flows. |
| WF-05 Estimate groups | `apps/api/src/routes/estimates/groups.ts`, `apps/api/src/services/estimate-groups.*`, `packages/types/src/estimate-groups.types.ts`, `apps/web/src/hooks/estimate-groups.hooks.ts`, `EstimateListClient.tsx` | `GET /api/v1/estimates/groups`; tenant-scoped complete Good/Better/Best groups; server-side customer/title/number search and stable group counts/pages, no misleading client-only claims. |
| WF-06 Weekly dispatch | `apps/api/src/routes/dispatch/week.ts`, `apps/api/src/services/dispatch-week.*`, `packages/types/src/dispatch-week.types.ts`, `apps/web/src/components/dispatch/{WeeklyDispatchBoard,DispatchViewRouter}.*`, `apps/web/src/hooks/dispatch-week.hooks.ts` | `GET /api/v1/dispatch/week`; read-only; company timezone, DST, overnight spans, counts, technician filter; weekly mode unmounts day stream. |

## Recorded validation, not merge permission

- Previous isolated validation: **1,190 web Vitest passed** (seven existing TODOs), **90 scoped backend tests passed**, **53 responsive Chromium assertions passed**; API and web TypeScript/builds, scoped ESLint and disposable PostgreSQL migrations passed.
- Source was tested with Node 22.16.0 / pnpm 10.0.0 and synthetic provider settings, not real customer credentials. The broad full API test run did **not** finish in the restricted environment. Do not mark it PASS.
- Browser checks used real React components but synthetic API data and a substituted Next link; this does **not** replace live authenticated preview or independent Design/QA sign-off.
- Source artifacts are in #445; recorded validation comes from the previous run and must be refreshed at the exact current head before merge.

## Suggested checks (use an isolated test DB; never production)

```bash
git fetch origin
git switch feat/fsm-workflow-reliability-20261105
git pull --ff-only
git rev-parse HEAD
pnpm install --frozen-lockfile
pnpm --filter @fsm/web exec vitest run
pnpm --filter @fsm/api exec tsc --noEmit
pnpm --filter @fsm/web exec tsc --noEmit
pnpm --filter @fsm/api build
pnpm --filter @fsm/web build
```

Backend regression suite with **separately provisioned disposable** databases: run `pnpm --filter @fsm/api exec vitest run src/services/estimate-groups.postgres.integration.test.ts src/services/dispatch-week.calendar.test.ts src/services/dispatch-week.postgres.integration.test.ts src/services/workflow-reads.postgres.integration.test.ts src/tenant-guard/tenant-guard-scan.test.ts src/routes/dispatch/schemas.test.ts src/services/estimate.service.test.ts`, setting `WORKFLOW_TEST_DATABASE_URL` and `WORKFLOW_FULL_DATABASE_URL` only to local disposable PostgreSQL instances. A skipped integration suite is NOT a pass.

## Hard boundaries

- **Implementation complete ≠ approved for merge or production.** Keep PR #445 draft and preserve current review/CI rules.
- No production payments, Stripe/Tap to Pay, GPS, live customer actions, new automatic dispatch, new digital signature system, new Operating Missions runtime, schema migrations, provider credentials or consent changes are authorized by this handoff.
- Do not let the six-package status supplant the newer founder Phase I → Phase II sequencing. Finish current original FSM acceptance, then advance Operating Missions only on separately approved tickets.
- If real code conflicts with this note, prefer the checked-out exact current SHA and record a corrected dated evidence entry; do not silently invent implementation status.

## Immediate next task for either agent

**Review and validate**, not rebuild: confirm #445's restored feature-branch code, run approved exact-head CI and isolated DB coverage, perform authenticated role-by-role preview plus responsive Figma comparison, document defects, and request independent sign-offs. Leave draft/HOLD until all gates and founder approval are met.
