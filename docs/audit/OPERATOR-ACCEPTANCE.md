# Operator acceptance packet: build specification 12

**Prepared:** 2026-11-05 UTC. **Scope:** reproducible owner, office and technician acceptance for [#432](https://github.com/SimonShaun2/Renvani/pull/432), [#435](https://github.com/SimonShaun2/Renvani/pull/435), [#437](https://github.com/SimonShaun2/Renvani/pull/437) and [#438](https://github.com/SimonShaun2/Renvani/pull/438). **Design-map owner:** [FS-51 handoff](../design/FS-51-figma-production-handoff.md), supporting [#433](https://github.com/SimonShaun2/Renvani/issues/433).

**Packet complete; authenticated execution BLOCKED.** The current #438 preview redirected a protected settings request to `/login` and displayed the Clerk Development sign-in form. No authenticated owner/office/technician session or approved synthetic fixture set was available. This observation is a sign-in requirement, not an authentication defect or an accepted journey. No authenticated cases below are marked passed.

## 1. Exact source and preview manifest

| ID | PR / full head | Immutable preview | Source scope |
| --- | --- | --- | --- |
| H432 | #432 `98e5e935db39fb2108a67c2268b65f23989ac95f` | https://renvani-4nlag5cb0-simonshaun2-8939s-projects.vercel.app | Login sizing, immediate Escape and owner shell work |
| H435 | #435 `47e5b0dd4237903e5bc5437a74280812bcf692f5` | https://renvani-d8b2dxz71-simonshaun2-8939s-projects.vercel.app | Revenue Center including build spec 1 fixes |
| H437 | #437 `cf133f9353803e1e8d664c23932a845f80160bbc` | https://renvani-6z3k6f66m-simonshaun2-8939s-projects.vercel.app | Operator screens and Estimates request-limit correction |
| H438 | #438 `e7b416f21b460c115eafa8726b940951702c4577` | https://renvani-hnwspkada-simonshaun2-8939s-projects.vercel.app | Settings and keyboard-reachable logo picker |

Vercel records identify READY deployments at these individual source heads. **They are separate snapshots.** The current #432 fixes and newest #435 commit have not been propagated through the whole descendant stack. Do not use H438 as proof of the latest H432/H435 behavior. Record an integrated acceptance head only after stack integration; none exists in this packet. The new documentation branch does not integrate application code.

**API origin:** not verified from an authenticated browser request in this run. Existing project context names `https://renvani-api.onrender.com`; treat it as the expected target pending observation, not a verified pairing for every preview. Record the actual API origin, deployed API source and tenant binding before executing cases.

## 2. Preconditions and fixture contract

Use an explicitly approved non-production workspace with synthetic customers and no live delivery/payment targets. Record its opaque tenant ID only in restricted test evidence. Obtain existing test identities for `owner`, `office` and `technician`; include `dispatcher` separately where the current API distinguishes it. Never share passwords/tokens in reports.

Required fixtures: a confirmed empty tenant or isolated empty dataset; nonempty customers and estimates spanning more than one page; one recommendation supporting proposal creation and one record-only type; an assigned technician job plus an unassigned/other-tenant negative fixture; current company profile and a disposable image file. Provider actions must be disabled or directed to authorized sandbox/capture endpoints. Use an isolated test API or approved fixture controls for slow/error/recovery cases; do not disrupt the shared API to manufacture failures.

Viewport plan: desktop 1363 × 936; narrow 320 × 800 and 390 × 844; tablet 834 × 1112. Actual measured widths belong in each result. Approved frames are still missing/unverified for Revenue Center, Customers list, Estimates list, Timesheets and General/Company Profile; record Design verdict or explicit exception, never infer parity from a link.

## 3. Role expectations derived from source

| Role | UI default / important boundary | Required acceptance interpretation |
| --- | --- | --- |
| Owner | `/dashboard`; owner/admin navigation | Verify actual API authorization, tenant and approval behavior; broad UI links alone do not grant backend permission. |
| Office | `/dispatch`; office route-prefix set and shared office navigation | `office` is a distinct role from `dispatcher`. Estimates and revenue-inquiry API allowlists in the reviewed source do not include office. Record the resulting denied journey and route/menu inconsistency for Product/Technical Lead resolution; do not silently widen permissions. |
| Dispatcher | `/dispatch`; Command Center appears in navigation/prefix access | Command Center brief API is owner/admin only. Observe denial versus usable role-specific content and resolve the product policy explicitly. |
| Technician | `/mobile/jobs`; `/mobile` and `/inventory` prefixes | Mobile layout admits technician/owner; verify assigned-job scoping and server authorization. Selected estimate read permissions do not imply write authority. |
| Admin | `/dashboard`; broader UI route-prefix set | Mobile prefix presence differs from mobile layout's owner/technician restriction. Confirm actual response and policy before claiming admin mobile acceptance. |

Source references at H438: [route-access.ts](https://github.com/SimonShaun2/Renvani/blob/e7b416f21b460c115eafa8726b940951702c4577/apps/web/src/lib/route-access.ts), [navigation.ts](https://github.com/SimonShaun2/Renvani/blob/e7b416f21b460c115eafa8726b940951702c4577/apps/web/src/lib/navigation.ts), [mobile layout](https://github.com/SimonShaun2/Renvani/blob/e7b416f21b460c115eafa8726b940951702c4577/apps/web/app/(mobile)/layout.tsx). API route controls and their source baseline are in [BACKEND-INVENTORY.md](BACKEND-INVENTORY.md); preview/API equivalence remains a prerequisite.

**Booking requests source gap:** navigation exposes `/booking-requests`, but the reviewed middleware role-prefix policy admits no role to that path. FE-002 in the [frontend inventory](FRONTEND-INVENTORY.md) records the gap. Include it in N02 and obtain a bounded Product/Security policy decision before changing access; a page file inside the authenticated layout does not itself grant access.

## 4. Executable scenario matrix

All rows below are **NOT RUN / AUTH REQUIRED**, except the explicitly observed pre-authentication row P00. IDs are stable for evidence and retests. Use the indicated head for isolated checks; repeat relevant cases on the final integrated head.

| ID | Role / head / route | Preconditions and steps | Expected result / evidence |
| --- | --- | --- | --- |
| P00 | Anonymous / H438 / `/settings/company` | Open protected route without a session | **OBSERVED:** redirect to `/login`; Email address, Password, Continue, GitHub, Google and Use phone controls rendered in Clerk Development mode. No application record read/write was performed. |
| A01 | Owner, office, technician / H432 / `/login` | Sign in with each approved existing role; capture final route and API session result | Owner `/dashboard`, office `/dispatch`, technician `/mobile/jobs`; actual tenant and role match fixture. No blank shell or cross-role content. |
| A02 | Test identity / H432 / `/login` | Exercise invalid credential feedback and the visible recovery flow on a disposable authorized account | Explicit error/recovery state; no guessed provider behavior. Password/reset delivery only through an authorized test account. |
| A03 | Test identity / H432 / `/login` | Exercise each enabled provider method selected for acceptance | Successful session verified on Renvani; record unavailable provider configuration separately. Merely displaying GitHub/Google is not a pass. |
| A04 | All roles / H432 / protected destinations | Directly navigate to disallowed routes and a no-role workspace state | Server and UI consistently enforce current policy; no privileged data flash or cross-tenant content. |
| N01 | Owner/office / H432 / `/dashboard` or `/dispatch` | Tab through sidebar/top controls; open mobile navigation and press Escape immediately | Visible focus, logical order, reliable close and focus return; record actual narrow widths. |
| N02 | Owner/office/technician / integrated head | Follow each role's primary navigation and use back/forward | Allowed destination loads; forbidden destinations remain denied. Menu/access discrepancies from section 3 are explicitly dispositioned. |
| D01 | Owner / H432 / `/dashboard` | Use true-zero fixture, then slow and unavailable API responses | Confirmed zeros are values; loading/error are distinct; no fabricated activity or totals. |
| R01 | Owner / H435 / `/ai-revenue-center` | Zero summary plus successful empty recommendations | Zero values remain visible; useful import/customer links resolve; no claim that no response means no opportunities. |
| R02 | Owner / H435 / `/ai-revenue-center` | Trigger Refresh; delay requests independently, including one rejection | Both reads occur once; Refresh stays disabled until both settle; no proposal/action mutation or scan is triggered. |
| R03 | Owner / H435 / `/ai-revenue-center` | Make summary unavailable with healthy list, then list unavailable with healthy summary | Failed section shows retry/unavailable; healthy section remains usable; failed cached rows/actions/pagination disappear. |
| R04 | Owner / H435 / `/ai-revenue-center` | Retry successfully after each failure; exercise type/customer filters | Current data returns; error notice clears; successful empty and filtered-empty wording stays distinct. |
| R05 | Owner / H435 / `/ai-revenue-center` | On an authorized synthetic record, use Mark handled | Only existing action-record endpoint/payload is used. Record-only acknowledgment; no send, booking or charge. Capture sanitized request type and activity result. |
| R06 | Owner / H435 / `/ai-revenue-center` | On a synthetic supported type, create proposal with delayed success then failure | Navigate to `/command-center/approvals` only after success; failed mutation stays on page with error. Never approve/execute a downstream live action in this case. |
| E01 | Owner/dispatcher / H437 / `/estimates` | Read nonempty fixture; change filters and move pages | Request respects API maximum; expected rows and partial-result warning are accurate; no silent missing-page claim. |
| E02 | Office, technician / H437 / `/estimates` and selected detail | Test actual allowed/denied paths from role crosswalk | Record UI/API permission mismatch; do not equate a navigation link with backend authority. No unauthorized write. |
| E03 | Owner/dispatcher / H437 / `/estimates` | Empty, loading, error and recovery fixtures | Each state explicit; stale results do not masquerade as a current successful read. |
| S01 | Owner/office / H438 / `/settings` | Keyboard navigation to General and Company trade; direct-link nested settings | Correct active item and heading; role restrictions observed. General profile is `/settings/general`; `/settings/company` is Company trade. |
| S02 | Owner / H438 / `/settings/general` | Tab to logo file input; activate using keyboard; cancel native dialog | Visible focus and native chooser; cancel does not mutate profile. Source/TypeScript evidence alone is insufficient. |
| S03 | Owner / H438 / `/settings/general` | Use authorized disposable PNG/JPG; test disabled/loading and invalid-file paths | Upload state blocks duplicate interaction; explicit validation/error; preview/save relationship accurate; no external or live customer media. |
| S04 | Owner / H438 / `/settings/general` | Change a fixture field; blur/save; delay request; force error and retry | Accurate saving/success/error feedback; failed save preserves edits; no unsupported successful-save claim. |
| S05 | Owner / H438 / `/settings/general` | Submit whitespace-normalized value; type a newer value while save is pending | Saved snapshot is reconciled only if still current; newer edits survive. **Known existing concurrency finding retained for Codex/#438; not fixed by this packet.** |
| T01 | Technician / H437 or integrated head / `/mobile/jobs` | Open assigned fixture job; attempt unassigned/other-tenant fixture | Correct assignment isolation, usable job context and explicit denied/missing state. No customer data in shared screenshots. |
| T02 | Technician / integrated head / mobile job routes | Traverse task/photo/product/time surfaces in read-only mode | Real authorized data and state boundaries; upload/completion/payment actions need separately approved synthetic action fixtures. |
| V01 | Owner/office/technician / integrated head / above routes | Repeat representative cases at 320, 390, 834 and desktop widths | No clipped primary controls or horizontal overflow; visible focus and measured touch-target evidence. Attach current-head screenshots and Design decision. |

## 5. Result record schema

Create one record per scenario, role, viewport and source head. Do not replace missing evidence with an empty PASS.

```json
{
  "scenarioId": "R02",
  "observedAtUtc": null,
  "role": "owner",
  "sourceHead": "47e5b0dd4237903e5bc5437a74280812bcf692f5",
  "integratedHead": null,
  "previewOrigin": "https://renvani-d8b2dxz71-simonshaun2-8939s-projects.vercel.app",
  "apiOrigin": null,
  "apiSourceHead": null,
  "route": "/ai-revenue-center",
  "viewportCss": null,
  "fixtureReference": null,
  "preconditions": "Approved synthetic tenant and delayed read fixtures",
  "expected": "Both requests settle before Refresh becomes available",
  "actual": "Not run: authenticated test session unavailable",
  "artifacts": [],
  "disposition": "blocked_auth",
  "followUp": "Authenticate approved fixture role and bind preview to API before execution"
}
```

Store screenshots, sanitized request/status observations and tester identity with each executed result. Exclude tokens, cookies, credentials, personal customer data and provider secrets. A missing screenshot is a missing artifact, not a visual pass.

## 6. Evidence already available and remaining work

Build spec 1 has **25/25** focused tests under Node 22.16.0 and independent local QA at H435. H432 contains the 52px login and Escape correction; H437 contains the Estimates request-limit fix; H438 contains the keyboard-accessible logo input and corrected copy. These are existing implementations, not new work proposed here. Their source/build/local evidence remains useful but does not execute this matrix.

To complete acceptance: integrate the intended stack; bind final source, preview and actual API; provide the approved role fixtures; execute the cases; resolve the known save-concurrency and role-policy discrepancies with their existing owners; collect responsive/Design, independent QA, applicable approved CI and founder approval at the resulting head. Do not mark the entire stack accepted because one role, route, test suite or preview build passed.
