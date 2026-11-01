# FS-51 — Renvani Figma-to-production implementation handoff

**Status:** Design/engineering review packet only. This document does not set the Notion ticket to Ready, authorize code implementation, establish a passed QA result, or grant permission for production customer sends, live money, deployment, or merge.

**Date:** 2026-11-01  
**Code inspected:** Renvani `dev` at 5baad8775cfa6a5e3c3e163ed6b384a284b12f20 (moving integration branch; recheck changed files before implementing).  
**Existing execution queue:** [FS-51 design system and handoff standards](https://app.notion.com/p/3ff317b92d158197b56eeacd4fbe3db2) in the [Field Service Build Board](https://app.notion.com/p/74b3a1145d3f49d586ac6cdbf174ceb2). Do **not** open duplicate FS-255–258 or FS-51 tickets.

## 1. Authority and intended outcome

Renvani is **one agent-native operating platform** with Growth, Revenue, Operations, Retention, and Command Center as connected outcome areas, not five detached products or a prototype-only app. Build toward **Discover → Book → Dispatch → Serve → Invoice → Collect → Retain**.

Authority order for implementation:

1. Current founder-approved product decisions and [FS-255 Autonomous Operating Foundation](https://app.notion.com/p/40a317b92d1581ceaef7e2d4a2f82bb7), including FS-256 (trusted execution), FS-257 (Business Operating Profile), FS-258 (confirmed follow-up outcome), and current board dependencies.
2. **TEAM.md**, **GITHUB_WORKFLOW.md**, and **CODEX.md**, including pair WIP, exact-head review/CI, E.. CoS integration authority and founder production authority. Historic comments in AGENTS.md and WORKFLOW.md are not authorization to resurrect retired agent/process rules.
3. **Canonical editable product Figma file:** [FSM Agent — Product Design](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design). Use an exact source node for each implemented screen.
4. **Click-path reference only:** [Full Software Clickable Prototype, 89 demo frames](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=399-4217) and [Field Technician Workflow Prototype, 18 demo frames](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=393-87). These show suggested navigation, not production data, rights, rules, provider sends or payment outcomes.
5. Code on the **current dev head** and versioned API contracts are the implementation baseline. Do not reproduce mock numbers, demo messages, example customers, fake payment completions, or the prototype's hard-coded links as real behavior.

The Figma document's *03 Operator App – Desktop*, *04 Crew App – Mobile*, *05 Customer Experience*, and *01 Foundations* pages are editable design sources. The prototype pages are assembled walkthroughs. Prefer the **Renvani / Color** and **Renvani / Radius & Space** Figma variables, **Geist** UI type, and **Newsreader** editorial accents. Reconcile to the existing web CSS/Tailwind tokens before changing any shared theme; no wholesale style rewrite.

### Terminology

- **Source frame present:** an editable Figma design is available.
- **Route/component present:** a code surface exists; no claim of design, data, or business-process parity.
- **Parity verified:** a reviewed implementation has screenshots and behavior tests at agreed breakpoints, including non-happy states.
- **Workflow verified:** an actual validated API/worker/result chain has passed tests; this is distinct from clicking a Figma prototype.
- **Done:** the board ticket's specified peer review, QA, Security by risk, approved batch CI at exact head, and integration merge into dev are evidenced. Promotion to main remains founder-controlled.

## 2. Design → implementation crosswalk

Each row identifies an **existing code surface**, not a claim that it is finished. Product Owner and designers select exact source states, and the responsible pair records the final file split.

| Journey / owner surface | Editable Figma source (exact node/page) | Prototype path | Code to inspect on dev | Acceptance / dependency |
| --- | --- | --- | --- | --- |
| Operator home / daily brief | [Command Center 10:2](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=10-2) | [Full demo launcher 401:2893](https://www.figma.com/proto/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=401-2893&starting-point-node-id=401-2893) | apps/web/app/(app)/command-center; apps/web/src/components/command-center/CommandCenterView.tsx and DailyBriefCard.tsx | FS-29 source-backed brief; separate facts, suggestions and actions; correct empty/loading/error states |
| Approval inbox / agent actions | [Approvals 10:220](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=10-220), [agent settings 10:1678](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=10-1678) | Full demo → AI & Approvals | apps/web/src/components/agent-actions/AgentInbox.tsx, AgentActionPanel.tsx, DeliveryStates.tsx | FS-255/256 and consent PR #301; distinguish approved, queued, provider accepted, delivered/failed, verified outcome; no false "sent" |
| Growth / branded site and direct inquiry | [Business editor 249:5635](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=249-5635); [branded customer site 10:2023](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=10-2023) | Full demo → Website & Leads; Customer booking | apps/web/src/components/growth/BrandedStorefront.tsx, BrandedInquiryClient.tsx; app/(public)/site | Showcase real business-specific services, location, trade and approved claims; source/direct traffic stays a first-class product path |
| Booking requests / scheduling | [Dispatch 10:478](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=10-478); [booking 1:21](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=1-21) | Full demo → Dispatch; Customer booking | app/(app)/booking-requests, app/(app)/dispatch; apps/web/src/components/booking/BookingFlowClient.tsx; app/(public)/book | Request ≠ confirmed booking; live availability and tenant/territory rules; conflict and expired hold paths |
| Jobs / job detail / customer record | [Job detail 1:14](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=1-14), [customer 1:17](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=1-17), [jobs list 144:567](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=144-567) | Full demo → Dispatch / Customers | app/(app)/jobs, app/(app)/customers; apps/web/src/components/jobs and customers | Preserve job/customer/property/asset lineage, role permissions, schedule and task changes, event trail |
| Field technician / day and job | [Crew mobile 19:17](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=19-17) | [Field demo 393:87](https://www.figma.com/proto/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=393-88&starting-point-node-id=393-88) | apps/web/app/(mobile)/mobile/jobs; apps/web/src/components/mobile/TodayJobsList.tsx, MobileJobDetail.tsx, CrewChecklist.tsx, OTWScreen.tsx | 390px touch-first: on-the-way → arrival → tasks, time, evidence, scope review, completion. Pending/rejected/duplicate operation states |
| Field photos / signature / completion | [Crew mobile 19:17](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=19-17); [field signature states 303:87](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=303-87) | Field demo → Job photos / Signature / Done | apps/web/src/components/mobile/CrewFinishJob.tsx, CrewSignature.tsx, mobile-tap-targets.test.ts | Actual storage and signature acknowledgement; no "Saved" on 409/conflict/rejected; retry idempotently |
| Estimate builder / options | [Estimate builder 10:604](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=10-604), [Good/Better/Best 362:4217](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=362-4217) | Full demo → Estimates & Pricing | apps/web/src/components/estimates/EstimateBuilderClient.tsx; components/estimate-option-sets | Prices sourced from catalog and approved scope; owner review, revisions, expiration and customer acceptance are distinct |
| Customer estimate acceptance | [Customer approval 10:1857](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=10-1857) | Full demo → Customer → estimate approval | app/(public)/approve; components/estimates/CustomerEstimateView.tsx | Public token contract, expiry and ownership; approval is not payment or job completion |
| Invoice / payment / payout | [Invoices 10:752](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=10-752), [Payments overview 52:16](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=52-16), [Customer payment 53:323](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=53-323) | Full demo → Invoices & Payments / Customer | app/(app)/invoices, app/(app)/payments, app/(public)/pay; components/invoices and payments | Live charges only with approved payment/Stripe contract; distinguish pending/paid/failed/disputed; backend/webhook evidence |
| Retention / agreements / VIP | [Recurring plans 10:915](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=10-915) and customer plan 54:184 | Full demo → Agreements & VIP | app/(app)/service-agreements; components/service-agreements, components/vip; app/(public)/vip | Plan activation/renewal/consent documented; cancellation, failure, next visit and customer-initiated controls |
| Reports, Growth Check, source evidence | [Reports 1:19](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=1-19), [Growth Check 366:4217](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=366-4217) | Full demo → Reports & Evidence | app/(app)/reporting, app/(app)/growth; components/growth-check, components/reporting | Data freshness, attribution vs causal lift, missing data and permissions visible; no unsourced KPI/ROI |
| Import / first hour / operating policy | [Import review 12:181](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=12-181), [owner interview 331:4113](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=331-4113), [policy 331:4170](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=331-4170), [execution 331:4230](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=331-4230), [activation 331:4300](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=331-4300) | Full demo → Autonomous Foundation | app/(app)/onboarding, app/(app)/settings/import; components/agent-actions; API agent-action registry and worker/outbox | FS-255 → FS-256 → FS-257 → FS-258; versioned tenant policy, provenance, explicit consent and confirmed result required |
| Staff layout / role access / responsive | [Operator 19:16](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=19-16), [Crew 19:17](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design?node-id=19-17) | Full demo (all roles) | apps/web/src/lib/navigation.ts, route-access.ts; components/layout; components/mobile/MobileAppShell.tsx | Screen navigation by role; proper permissions and focus; avoid overflow and pseudo-disabled controls |

### Verified discrepancies / open checks as of inspected head

**Confirmed data-integrity defect:** apps/web/src/components/mobile/TodayJobsList.tsx includes a literal "3 jobs today · $2,973 potential · technician app live", even though it also loads a live job count. It generates on-card dollar values from job-type fallback constants rather than an approved amount. The inspected JobListRecord type in apps/web/src/hooks/jobs.hooks.ts has **no approved price or invoice amount field**. These numbers must not be rendered as actual potential or customer-facing value. Use a real tenant-scoped approved amount with provenance when a contract supplies it, or display an honest non-monetary job summary. Add a test that prevents fallback/revenue/demo copy from returning.

**Known execution-gap requirement (existing FS-255):** the Command Center's "Approve & send" treatment has historically only approved a proposal while a Revenue action executor did not perform a provider send. FS-256/258 own the correction; the UX must not claim delivered, completed or revenue generated after approval. Confirm current dev implementation before remediation.

**Documentation drift:** docs/README.md on dev still points to separate historic App/Marketing Figma files, while the current approved product/design source is the single canonical jiGHTNUJNltWbHA4Il3hk7 file. An existing [canonical-Figma documentation PR #131](https://github.com/SimonShaun2/Renvani/pull/131) addresses that area. Reconcile in its established review path rather than independently rewriting docs/README.md in this PR.

**Not established by this review:** full runtime parity of all 89 clickable screens, passing UI E2E, production deployment, or live provider/Stripe outcomes. Never infer those from Figma navigation or from file presence.

## 3. Product/interaction invariants — must survive visual implementation

1. **One system of record and action.** Humans and agents call the same validated domain services; AI does not drive UI clicks, mutate the DB directly, or invent parallel execution routes.
2. **Tenant isolation.** Every server request scopes to verified tenant; role checks remain on the server; unauthorized tenant resources do not leak existence or data.
3. **Approval ≠ execution.** Render separate draft/review, owner-approved, queued, attempted, provider-accepted, delivered/failed, operational-complete, and verified-outcome states. The status label is backed by the appropriate receipt; never collapse them into a single green checkmark.
4. **Consent and policy version.** Human-approved communication preferences are purpose/channel-specific. No outbound send without current consent and policy permission. Store approved policy version and provenance on the action.
5. **Retry and failure behavior.** Idempotency keys prevent duplicated side effects across refresh/replay. Clearly show conflict, stale policy/data, declined payment, inaccessible site window, provider outage and safe retry/escalation.
6. **Money integrity.** Amounts are string/decimal contracts from authoritative estimates/invoices/Stripe. Do not substitute demo amounts, type-based fallbacks or mock payout states.
7. **Growth is not an afterthought.** Show business website, online visibility and direct traffic, inquiry-to-booking conversion and source lineage as an actual connected product area; do not hide this behind a generic "AI" tab.
8. **No false business outcomes.** Track association vs causality in reporting; show source evidence, recency, missing data, and explicit "not yet verified" states.
9. **Complete when needed, simple by default.** Keep complex detail behind progressive disclosure; do not remove full FSM capabilities or silently ship prototype-only placeholders.
10. **No unauthorized live actions.** This handoff does not change production feature flags, send external messages, publish a public website, launch Stripe transactions or deploy.

## 4. Phased adoption under the *existing* FS board

Treat these as implementation guidance for existing assigned work, **not** new Ready/In Progress tickets or new pair assignments.

- **Design contract (FS-51):** confirm canonical source nodes, typography/tokens, one reusable responsive shell, navigation/state component patterns, and screenshot/keyboard/a11y review procedures.
- **Trusted agent action (FS-255/256/257/258):** first prove valid state distinctions and receipt-backed execution. Do not build a separate agent system. Respect consent PR #301 and pair dependencies.
- **Core office + revenue journeys:** compare Command Center, inquiry, dispatch, job, estimate, payment and retention screens against the exact canonical frames, and fill only verified gaps under their own board tickets.
- **Field and customer journeys:** align 390px mobile field flows, public booking, estimate approval, invoice and signature with actual job status and API/write outcomes, including error paths.
- **Cross-system QA:** demonstrate Discover → Book → Dispatch → Serve → Invoice → Collect → Retain with tenant/policy/consent controls and recorded evidence.

Proposed review roles (not assigned work): Designer 1 Office UX, Designer 2 Field UX, a designated pair for each existing domain ticket, Reviewer 2 UI/accessibility, QA 4 E2E/release, Security for consent/tenant/payments/agent changes, and E.. CoS for the dev integration gate.

## 5. Ticket/PR acceptance evidence checklist

For **each** implementation PR, include:

- Existing Notion FS ticket URL and status; precise acceptance + out-of-scope; no unapproved feature expansion.
- Exact **source Figma node ID**, and prototype click-path reference if it clarifies a workflow. The source design is not a production authority for business-side effects.
- Old/new route + component paths, user roles, API/worker contracts, and state/event/receipt mapping. Declare any schema/consent/policy changes.
- Screenshot comparison at **1440 desktop**, **834 tablet** where applicable, **390 phone**; verify 320–430 responsiveness where supported and no accidental horizontal scroll. Field touch targets at least 44 CSS px and keyboard equivalents for non-touch surfaces.
- Loading/empty/error/permission-denied/conflict/stale/approval-pending/success states. Do not use color alone to convey state. Verify keyboard navigation, semantic labels, focus visibility, validation announcements, reduced motion.
- Functional evidence: jobs and monetary totals from tenant-scoped data; duplicate submission/replay; missing consent; provider fail; payment declined; out-of-date booking availability; tenant cross-read denied.
- Evidence at exact PR head: local commands/results, UI visual QA, relevant unit/integration/E2E, reviewed screenshot links, regression concerns. Run CI only by the authorized batch process.
- No "implemented" or "Done" claim before the designated independent peer, QA, Security by risk, approved batch CI and E.. CoS merge into dev. Main/production only by founder release process.

**Minimum journey tests:** (a) Growth → public inquiry/booking with "request pending" semantics; (b) owner approve estimate with accurate public URL and accepted scope; (c) dispatch a live eligible technician with current availability; (d) field OTW → start → tasks/photos/time → signature → job completion; (e) invoice → customer pay → Stripe-confirmed paid; (f) retention automation after opted-in job event; (g) agent-approved proposal → queued provider action → failure/retry or verified delivery; (h) restricted/other-tenant users denied throughout.

## 6. Next authorized action

FS-51 Product Owner/Design should review this handoff against canonical frames and reconcile status with E.. CoS. Only when a current board ticket is Ready and the assigned pair has a file split/contract should production code change. Do **not** promote this document into an implicit mandate to rewrite the frontend. Keep existing working route/API code and use small, testable, reviewable deltas.

Related sources: [FS-51](https://app.notion.com/p/3ff317b92d158197b56eeacd4fbe3db2) · [FS-255](https://app.notion.com/p/40a317b92d1581ceaef7e2d4a2f82bb7) · [FS-52 code-to-area map](https://app.notion.com/p/400317b92d1581cc9bd4c84cb83c830f) · [TEAM.md](https://github.com/SimonShaun2/Renvani/blob/dev/TEAM.md) · [GITHUB_WORKFLOW.md](https://github.com/SimonShaun2/Renvani/blob/dev/GITHUB_WORKFLOW.md).
