# Renvani FSM workflow completion — implementation and release record

**Date:** November 5, 2026. **Status:** all six packages implemented in a draft, unmerged feature branch. Independent acceptance outstanding.

**Canonical start:** [Codex / Cursor handoff](../handoffs/RENVANI-FSM-CODEX-CURSOR-START-HERE-2026-11-05.md) · [PR #445](https://github.com/SimonShaun2/Renvani/pull/445) · source implementation commit `763e1504ee666eb184f3144e7e37b9c0d0bd2205`.

## Delivered and source contracts

| ID | Scope | Status |
| --- | --- | --- |
| WF-01 | Technician issue categories, severity, notes, optimistic job-version handling and duplicate lock | Implemented; no auto-hold or scope approval |
| WF-02 | Truthful mobile closeout for completed/invoiced/paid and office handoff | Implemented; no permission or payment expansion |
| WF-03 | Recoverable public estimate approval/decline, token and duplicate protections | Implemented; scheduling request remains unconfirmed |
| WF-04 | Upstream UI branch reconciliation #432 → #435 → #437 → #438 | Implemented in #445; preserve original PR ancestry |
| WF-05 | Server-side group-safe estimate search and pagination | Implemented via `GET /api/v1/estimates/groups`, preserving old raw-row endpoint |
| WF-06 | Company-timezone-aware read-only weekly dispatch | Implemented via `GET /api/v1/dispatch/week`, preserving day board |

## Review and QA starting points

- **Estimate grouping:** `apps/api/src/services/estimate-groups.query.ts` and `.service.ts`, `apps/api/src/routes/estimates/groups.ts`, `packages/types/src/estimate-groups.types.ts`, `apps/web/src/components/estimates/EstimateListClient.tsx`.
- **Weekly dispatch:** `apps/api/src/services/dispatch-week.calendar.ts`, `.query.ts`, `.service.ts`, `apps/api/src/routes/dispatch/week.ts`, `apps/web/src/components/dispatch/WeeklyDispatchBoard.tsx`, `DispatchViewRouter.tsx` and the matching query hook.
- **Acceptance tests:** `apps/api/src/services/estimate-groups.postgres.integration.test.ts`, `dispatch-week.calendar.test.ts`, `dispatch-week.postgres.integration.test.ts`, `workflow-reads.postgres.integration.test.ts`, `apps/web/src/components/dispatch/WeeklyDispatchBoard.test.tsx`, `DispatchViewRouter.test.tsx`, `apps/web/src/components/estimates/EstimateListClient.groups.test.tsx`, `apps/web/src/hooks/workflow-read-hooks.test.tsx`.
- **Figma weekly frames:** `604:10228`, `604:10293`, `604:10361`, `604:10432`, `604:10477`, `604:10502` in `jiGHTNUJNltWbHA4Il3hk7`. These are editable implementation references, not independent Design acceptance.

## Verified in prior isolated run

| Check | Recorded result |
| --- | --- |
| Web Vitest | 1,190 passed; seven existing TODO markers |
| Scoped backend Vitest | 90 passed (seven files, including actual PostgreSQL) |
| Browser responsive harness | 53 passed, zero uncaught exceptions; synthetic responses |
| TypeScript checks, API/Next production builds, scoped ESLint | Passed |
| Full repository migrations on disposable PostgreSQL | Passed |
| Broad full API suite | Attempted; no summary; **NOT a pass** |

**Important:** previous tests were run against the earlier source tree with isolated synthetic provider inputs, not against live authenticated staging or production. Re-run and attach exact-current-head CI evidence; no independent QA/security/design sign-off is implied.

## Release HOLD — explicit gates

- Peer, QA, Security-by-risk, independent Design/Product acceptance against current exact head.
- Approved CI at current head, authenticated Clerk/tenant/role preview across owner/office/technician/customer, and representative large-tenant performance.
- Founder approval naming each PR and its reviewed SHA; no merge into `dev` or `main` before that. Deploy additive API support before dependent web.
- Preserve existing authorizations and system-of-record protections. No new migrations, credentials, payments, GPS, Operating Missions actions or live customer sends.

**Source of truth hierarchy:** founder directive / `AGENTS.md` / `CODEX.md` → current branch code and PR metadata → this handoff → dated Notion execution plan. When current GitHub SHA differs, verify history rather than relying on stale PR body.
