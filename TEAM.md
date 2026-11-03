# TEAM.md

> **FOUNDER EXECUTION & MERGE AUTHORITY — NOVEMBER 3, 2026 (current).** See [founder directive #420](https://github.com/SimonShaun2/Renvani/issues/420). **Codex is the active builder and coordinator. No E.. CoS approval, dispatch, CI authorization, review recommendation, or signature is required for any ticket or PR.** GrokBot/E.. CoS is optional advice when the founder independently chooses to use it; never a gate. Codex Lead/Technical Lead and actual Platform owners coordinate Ready/WIP and authorize appropriately scoped CI batches; independent Peer, QA, and Security-by-risk reviews with exact-head evidence remain mandatory. **The founder alone approves EVERY outstanding and future PR merge**, including `dev`, by named PR and exact reviewed head. Compatible PRs may be reviewed and validated in batches, then merged sequentially only after explicit founder approvals; no unsafe big-bang merge. Continue authorized Phase A work without stopping for idle roles or blocked PRs. No Phase B before original Phase A acceptance and founder permission. Preserve genuine security, tenant, consent, migration and release gates. Reuse existing credentials when appropriate, but never claim unproven least privilege or rotation/revocation PASS.

**Authority:** Founder FSM direction, 2026-10-20; [Field Service Agents — Team & Operating Rules](https://app.notion.com/p/3ff317b92d15817b9f64dda55cddb97e). This document supersedes the 15-member staffing draft in this PR. Product sequencing is agent-first, with a full FSM suite as a later optional product offering. Shaun is founder and is not counted among the 26 agent roles.

## 1. Permanent team: 26 role-named agents

Role names describe durable responsibility, not the current ticket. Assignments and pair membership may change through a recorded handoff; the role name remains stable. All current Cursor sessions use Composer 2.5. The Notion roster links each session; a launched chat is not evidence it remains executing.

| Role | Durable responsibility | Current pairing |
|---|---|---|
| E.. CoS (GrokBot) — optional advisor | Can provide nonbinding review on founder request; **no approval, CI, dispatch, or merge authority** | Not active by default |
| Product Owner | Acceptance, scope and direct-job outcomes | Leadership |
| Technical Lead | Architecture, contracts and safe sequencing | Leadership |
| Senior Dev A — Agent Backend | Tenant and agent control plane | Pair 1 with B |
| Senior Dev B — Data Contracts | Shared types, schemas and negative tests | Pair 1 with A |
| Senior Dev C — Revenue Backend | Inquiry, quote and consent services | Pair 2 with D |
| Senior Dev D — Acquisition Web | Direct inquiry and acquisition UX | Pair 2 with C |
| Senior Dev E — Workflow & Web | Web workflow implementation | Pair 3 with F |
| Senior Dev F — Integration & Compatibility | Legacy routes and compatibility tests | Pair 3 with E |
| Senior Dev G — Operator Experience | Approval inbox and office workflow | Pair 4 with H |
| Senior Dev H — Service Workflows | Service events, completion and retention | Pair 4 with G |
| Senior Dev I — Adapters & Imports | Vendor adapters and provenance | Pair 5 with J |
| Senior Dev J — Measurement & Owner Agent | Outbox, attribution and owner brief | Pair 5 with I |
| Designer 1 — Office UX | Design system and office flows | Design |
| Designer 2 — Field UX | Field, mobile and customer flows | Design |
| Reviewer 1 — Backend & Architecture | Independent backend review | Review |
| Reviewer 2 — UI & Accessibility | Independent UI/docs review | Review |
| Reviewer 3 — Integration & Adversarial | Independent integration review | Review |
| QA 1 — Functional Acceptance | Ticket acceptance | QA |
| QA 2 — Integration & Security | Tenant and integration negatives | QA |
| QA 3 — Agent Evaluation | Agent behavior and policy evaluation | QA |
| QA 4 — E2E & Release | Cross-system regression | QA |
| Platform 1 — CI & Environments | Batch CI and local environment | Platform |
| Platform 2 — Reliability & Observability | Monitoring and recovery | Platform |
| Security | Tenant, consent, auth and agent authority | Security |
The historical roster describes 25 role slots; actual available agents must be verified when dispatched. Optional E.. CoS advice does not create an active role or approval requirement. **Retired:** Gayle, Cursor Chief of Staff, and mandatory E.. CoS gates. Founder approves **every PR merge**, including `dev` and `main`, and retains all production, spending, live-money, legal and destructive authority. Listed agent roles are staffing definitions, not proof of active agent sessions.

## 2. Ticket and tandem process

The Product Owner records testable acceptance, non-goals, dependencies and risk. The Technical Lead approves architecture and shared contracts. Before code, a pair writes a file/section split, branch and merge order, versioned contract, owner and consumer list, negative tests and migration plan where needed. Partners work on distinct files or meaningful test/oracle/doc slices, cross-review, and locally test the combined result. One active ticket per pair and at most two waiting PRs per pair. Fixes outrank new work. A handoff is durable in the board, ADR, contract or PR; chat alone is not a handoff.

The five active P0 pair tickets are FS-37, FS-38, FS-36, FS-39 and FS-40 respectively. Preflight findings are proposals. Do not start downstream implementation while its explicit dependencies or pair contract remain unresolved. Open drafts stay In Progress; In Review means review is actually under way; Done requires merged integration evidence and all required gates.

## 3. Risk and approval matrix

| Change | Required evidence before founder-authorized merge into `dev` |
|---|---|
| Standard | Pair self-review and cross-review, distinct peer reviewer, assigned QA, approved batch CI at exact head |
| UX | Above, plus relevant design acceptance and accessibility checks |
| Architecture or shared contract | Above, plus Technical Lead contract decision and consumer/migration evidence |
| Tenant, consent, auth, agent authority or sensitive data | Above, plus Security and QA negatives at exact head |
| Platform/CI | Second platform or Technical Lead review, Security for gate authority, QA where behavior changes |
| Release | QA 4, Platform, Security by risk; then founder promotion **`main`** from `dev` |

The implementer cannot approve their own work as independent QA, peer reviewer, or Security. Final merge authorization belongs exclusively to the founder. A changed PR head invalidates affected sign-offs. A failed gate returns a bounded fix card to the original pair and requires fresh evidence.

## 4. Branches, CI and release

No direct push to **`dev`** or **`main`**; no rebase or force-push of reviewed heads. Feature branches and **draft PRs** are traceable to the board ticket. **`dev`** is the protected integration branch; **The founder** is the final merge approver into `dev`, for each named PR at its reviewed head. **`main`** is promotion-only (Shaun). **F2 decided by Shaun 2026-10-21:** PR #1 base is **`dev`** @ `12b23226c0e0c199626940117fc7f0fa89f87375`.

CI runs **only through approved batches** with enumerated membership, exact head SHA, one authorized run and recorded result. No standalone per-commit or per-PR CI, and local green tests are not CI. No merge or Done without the risk matrix and batch evidence. No deployment, public website or Vercel setup from this process. Stripe and live payment changes remain at the end of the roadmap and need separate founder authority.

## 5. Operating loop and sources

**Codex Lead/Technical Lead** maintains the existing Notion build board, sets Ready upon dependency clearance, reconciles actual GitHub/reviewer evidence, and assigns work within WIP. Product Owner decides scope and acceptance, Technical Lead architecture, Platform coordinates approved CI, and **the founder alone authorizes merges** after independent gates. E.. CoS input is optional and nonbinding. The founder's current product direction and Notion board outrank stale V2 sprint prose until reconciled in a separate change.

Adapted process sources from the paused TrayLoop project: [team README](https://github.com/SimonShaun2/SimonShaun2/blob/dev/trayloop/docs/team/README.md), [tandem process](https://github.com/SimonShaun2/SimonShaun2/blob/dev/trayloop/docs/team/process.md), [ticket template](https://github.com/SimonShaun2/SimonShaun2/blob/dev/trayloop/docs/team/ticket-template.md), [split plan](https://github.com/SimonShaun2/SimonShaun2/blob/dev/trayloop/docs/team/split-plan-template.md). Copy the process, not TrayLoop-specific labels, prices, Stripe implementation or branch names.
