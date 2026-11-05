# Renvani FSM workflow completion

Date: 2026-11-05
Requested by: Shaun Simon, in the conversation approving the six recommendations.
Source baseline: dev at 007b70b6ea1f46e12d98a9ee337f32a2510ee03c.
Implementation owner: ChatGPT in this task, not Codex.
Publication target: isolated feature branch and draft PR. No merge or production promotion.

## Outcome

Complete bounded gaps in the existing field-to-office and customer-approval journeys. Reuse domain services, permissions, tenant scopes, query hooks and canonical Renvani designs. Do not introduce new payment processing, GPS tracking, signing infrastructure or mission runtime.

## Sequence and delivery boundaries

| Package | Build | Dependencies | Acceptance |
| --- | --- | --- | --- |
| WF-01 | Technician issue reporting | Existing FS-169 contract and report-issue service | All seven supported categories, explicit severity, preserved notes after failure, stale-version retry, duplicate-click protection; no automatic hold/scope approval |
| WF-02 | Mobile closeout and office handoff | Existing completion state and role boundaries | Completed/invoiced/paid states have truthful distinct copy; no generic Create Invoice action for technicians; return to Today; no payment or permission changes |
| WF-03 | Customer estimate approval reliability | Existing token approval API and customer view | Failed approve/decline shows a recoverable error and preserves input; rapid double submission suppressed; acknowledged approval survives refresh failure; refresh retry never replays mutation; request is not scheduled |
| WF-04 | Existing UI stack reconciliation | #432 -> #435 -> #437 -> #438 | Preserve latest ancestor corrections, meaningful dashboard session-guard test, exact-head focused/full tests, authenticated role and responsive acceptance; no superseding parallel redesign |
| WF-05 | Estimate search and pagination | WF-04/#437 Estimates correction; API grouping contract | Search reaches old records, accurate counts, stable pages, full Good/Better/Best groups, stale-response/error tests; do not claim local filtering searches unreturned records |
| WF-06 | Read-only weekly dispatch | Day board contract, company timezone and exact Figma weekly frame | Seven real calendar days, technician filter, previous/next week, existing job detail, explicit partial failure, DST/week/year boundary tests; no drag/reassignment/optimization |

Each package has separate source and validation evidence. A package is not release-complete just because its code or build spec exists.

## File split

WF-01: mobile issue presentation helper, CrewFinishJob, its focused tests.
WF-02: mobile closeout presentation helper, JobActionBar, its focused tests.
WF-03: customer submission helper, PublicEstimateFlow, thin public approve route and focused tests. Reuse CustomerEstimateView unchanged so its form and option-selection behavior remain intact.
WF-04: reuse the original branches, inventory ancestor changes and repair only confirmed failures. Do not merge or force-push reviewed branches.
WF-05: EstimateListClient and estimate hooks plus backend list contract only when group-safe pagination is established. Extend #437 rather than reimplement its API limit fix.
WF-06: separate read-only weekly component and query hook, existing dispatch entry, pure calendar helper and tests; reuse the shared API client and existing details.

## Design evidence and exceptions

Canonical file: jiGHTNUJNltWbHA4Il3hk7.
WF-01: inspected Crew review 10:1917 and issue/scope review 247:35. The latter is a scope-review design, not evidence that reporting a note creates an approval proposal. Expanded general categories/severity need explicit design acceptance; retain the existing presentation and do not claim an exact new Figma match.
WF-02: Crew completion 247:36 and office handoff 253:7231 were located in page metadata. A high-fidelity request for 253:7231 returned HTTP 429; this is NOT a completed visual/design review. Retain real data only.
WF-03: existing source references estimate-option frames 363:121, 363:198, 363:273. Those frames were not independently re-inspected after the Figma rate limit. Preserve the existing view, treat error feedback as a bounded state extension, and retain the pending design gate.
WF-05: no approved estimate-list frame established by #437; approved adaptation remains a gate.
WF-06: exact weekly frame must be located or designed and accepted; the day-board frame is not weekly design approval.

## Safety and data contracts

No migrations, credentials, provider calls, live customer records, payment execution, public tracking links, or role grants. Issue submission is an internal note; scope-change reporting neither approves extra work nor changes price. Preserve optimistic record-version checking. High severity is not an emergency dispatch guarantee. Approval acknowledgement and subsequent scheduling reads are separate facts. UI guards do not replace server idempotency.

## Required tests

WF-01: seven category mappings, severity values, trim/empty/limit validation, stale record, submit failure preserves content, pending prevents duplicates, no implicit hold.
WF-02: every terminal state, nonterminal state, next-job navigation, no invoice creation on paid jobs, no invoice permission escalation.
WF-03: approve success; decline success; rejected writes; duplicate clicks; success then failed GET; retry GET only; token change resets transient state; already-approved/declined/expired handling; customer option selection remains unchanged on failure.
WF-04: dashboard unauthenticated guard regression; upstream diff inventory; all touched route/state tests.
WF-05: more than one API page; old matching estimate; groups split at raw-row boundaries; filter reset; empty vs unavailable; cancelled/stale search; no invented totals.
WF-06: Sunday/Monday boundary, year crossing, leap day, DST changes, invalid timezone, one failed day, empty technician, filters, read-only action audit.

## Release gates

Implementation/self-tests are not independent peer, QA, Security-by-risk or Design/Product approval. Current-head approved CI and authenticated deployed screenshots remain required. Founder approval must name the PR and exact reviewed head. No automatic merge, manual CI dispatch or production promotion is authorized by this package.

## Environment limitation

The GitHub connector can read and publish source. This task's local container cannot resolve github.com and has no installed application dependencies. It has Node 22.16.0 and TypeScript. Record any dependency-free tests and syntax/type-contract checks precisely; do not report Vitest, full Next build, authenticated browser QA or independent review unless actually executed.

## Delivery record for this change

The six-package plan is written. WF-01, WF-02 and WF-03 are implemented as draft source changes with isolated checks. WF-04, WF-05 and WF-06 are NOT implemented or release-complete. None of the six packages is merged, independently accepted or production-enabled by this work.

### Implemented scope

- **WF-01:** Seven existing API categories, low/medium/high severity, note validation, pending locks, retained input on errors, and existing conflict/version recovery. The form does not silently set `putOnHold`. Scope change is a note, not an authorized change order. Existing work-record, checklist, upload and completion regressions are retained.
- **WF-02:** Completed, invoiced and paid jobs have distinct source-backed descriptions and return to the existing Today route. The technician is no longer sent to the staff-only invoice listing. No financial write, invoice permission expansion or automatic invoice creation was introduced.
- **WF-03:** Approval and decline failures expose recovery without clearing input. An unconfirmed write requires a successful status read before another response can be submitted. A positively acknowledged write survives failure of the follow-up read, and the retry action only reads status. Tokens reset transient state, non-actionable estimates remain read-only, and a scheduling request remains a request. The page exports only the default route component; reusable flow logic is in a normal component module.

### WF-04: existing UI stack remains open

Do not recreate or overwrite the existing #432 -> #435 -> #437 -> #438 work. Current #432 head is `98e5e935db39fb2108a67c2268b65f23989ac95f`; its review records a reproducible dashboard unauthenticated-guard test failure (`REDIRECT:/login`), not an established production auth defect. This task did not run or repair that test. #437 already contains the 100-row API-limit correction and honest partial-list copy.

Next bounded build: retrieve the original stack and complete dependency graph in an installed workspace; reproduce and fix the meaningful guard regression; integrate latest ancestors by additive commits without force-pushing reviewed heads; run focused and complete current-head tests and authenticated role/responsive acceptance. Do not cherry-pick only cosmetic changes while omitting upstream correctness fixes. No stack integration or refreshed sign-off is claimed here.

### WF-05: group-safe list contract required

At the inspected baseline, `listEstimates` caps raw tenant rows before filtering, searches only estimate title/number, counts raw rows, slices raw rows into pages, and then drops rows whose customer is unavailable. The UI groups the returned batch locally. A simple frontend Next button would split Good/Better/Best groups and still fail the promised customer-name search. Repeating #437's limit fix would not solve this.

Proposed additive implementation, pending contract review:

1. Add a group-aware staff list read without changing existing consumers silently. Tenant and soft-delete predicates apply to both estimates and customers before counting. Search title, number and customer name. Matching an option includes its whole option set; a single quote is a one-item group.
2. Page group identities, not individual option rows, with a deterministic sort and stable ID tie-breaker. Hydrate all permitted members of each returned group in canonical tier order. Return group count and group-page metadata explicitly; never label raw-option counts as quote counts.
3. Define status filtering for mixed-status groups using the existing group-status rule after inspecting it; do not introduce a second conflicting frontend rule. Keep monetary ordering in exact Decimal/database numeric semantics.
4. Apply filtering/counting in the database rather than presenting a pre-filter maximum window as a complete search. Use a consistent read snapshot or document and test concurrent changes. Missing/deleted customer behavior must agree between counts and returned records.
5. Connect EstimateListClient to the new contract after #437 integration, with query-keyed search/status/page, debounce, page reset and no stale-result substitution. Preserve complete option groups and clearly distinguish no matches from unavailable results.

Required evidence: tenant-negative tests, more than 100 raw options, a group straddling the old boundary, customer-name-only match, old estimate match beyond the initial batch, deleted customer, mixed group statuses, stable ties, concurrent insert/delete, empty/error/retry and full API-to-UI tests. No new endpoint, backend query or pagination UI is claimed implemented in this change.

### WF-06: timezone-correct weekly read required

At the baseline, dispatch.service `getDayBounds` uses UTC midnights, selects jobs by scheduled start, and each daily load reads several whole tenant collections. The day hook opens an EventSource and manages shared stream state. Seven copies of that hook would create excessive reads/streams and could place local-evening work in the wrong day.

Proposed additive implementation, pending contract/design review:

1. Provide one read-only week/range service using the configured company timezone and validated local date. Specify Monday as the proposed first day, subject to product acceptance. Use start-inclusive/end-exclusive instant boundaries derived from local calendar dates, including daylight-saving transitions; never use the browser timezone or seven fixed 24-hour intervals.
2. Query relevant assigned work once using interval overlap, not only start-in-day. Specify treatment of cancelled, completed and overnight jobs, missing end times and inactive technicians; document partial/truncated results rather than silently omitting work. Index/query-plan evidence is required before claiming performance readiness.
3. Scope cache/read authorization by tenant and include timezone and range. Reuse the existing authenticated client and invalidation mechanism with one weekly query, not seven EventSources. No technician visibility expansion.
4. Add a read-only weekly view with technician filter, previous/next week, explicit date/timezone labels and existing job details. No cross-day dragging, reservation, reassignment, optimization or financial action.
5. Inspect or create the exact desktop/tablet/mobile weekly Figma frames and relevant error/empty/partial states before UI implementation and obtain independent acceptance afterward.

Required evidence: America/Chicago spring/fall DST, a timezone different from the browser, UTC-crossing local evening jobs, overnight overlap, leap day, year boundary, invalid/missing timezone, no duplicate jobs, empty crews, unavailable read, performance/query counts and absence of mutations. No weekly component or weekly backend route is implemented in this change.

## Verification actually performed

| Check | Result / limit |
| --- | --- |
| Baseline source integrity | Four copied originals matched their exact Git blob hashes before edits |
| Offline diagnostic | 50 Node/helper and actual-source hook/element simulation checks passed; not React DOM or browser acceptance |
| TypeScript syntax | 11 changed TS/TSX modules transpiled without syntax errors; this is NOT full repository type checking |
| Diff whitespace | Local `git diff --check` passed |
| Regression source | Existing CrewFinishJob tests preserved and extended; new closeout, helper and public-flow Vitest tests written |
| Actual Vitest / pnpm / full Next build | NOT RUN: complete source/dependencies unavailable in this container |
| API/database/tenant integration | NOT RUN; no backend or access-rule modifications |
| Browser / screenshot parity | NOT RUN; Figma context inspection is not live browser acceptance |
| Independent Peer/QA/Security/Design | NOT PERFORMED; implementer self-checks cannot fill these roles |
| CI / merge / production | No manual CI dispatch, merge or production promotion performed |

The downloadable validation supplement contains `scripts/validate-fsm-workflow-completion.cjs`; it is not installed as a second test framework in application source. Its output explicitly states that the hook/element simulation is not React DOM, Vitest, full-app or browser QA. Run the actual focused Vitest tests and complete type checks in the normal Node 22 environment before accepting the PR.

## Pinned evidence

Source inspection baseline: https://github.com/SimonShaun2/Renvani/tree/007b70b6ea1f46e12d98a9ee337f32a2510ee03c

- Existing issue contract: `packages/types/src/technician-mobile/v1/index.ts`.
- Existing issue storage: `apps/api/src/services/technician-mobile.service.ts`.
- Staff invoice boundary: `apps/api/src/routes/invoices/index.ts`.
- Estimate pagination/search: `apps/api/src/services/estimate.service.ts`, `listEstimates`.
- UTC dispatch read: `apps/api/src/services/dispatch.service.ts`, `getDayBounds` and `buildDispatchViewPayload`.
- Stream/query lifecycle: `apps/web/src/hooks/dispatch.hooks.ts`, `useDispatchView`.
- Existing stack entry: https://github.com/SimonShaun2/Renvani/pull/432
- Existing Estimates correction: https://github.com/SimonShaun2/Renvani/pull/437
