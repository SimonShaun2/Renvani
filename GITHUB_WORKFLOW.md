# GITHUB_WORKFLOW.md

> **FOUNDER OPERATING OVERRIDE — NOVEMBER 3, 2026 (takes precedence over older approval/agent-status language below).** See [GitHub founder directive #420](https://github.com/SimonShaun2/Renvani/issues/420). **Codex is the currently active builder.** Do not assume named GrokBot or Cursor roles are running; GrokBot/E.. CoS can perform an on-demand independent batch review when invoked. Independent peer, QA, and Security-by-risk reviews must be performed by actual separately identified reviewers or qualified humans, with exact-head evidence; a role name alone is not a review. The **founder gives final authorization for EVERY outstanding and future PR merge**, including into `dev`; E.. CoS technical recommendations are not merge permission. Group compatible outstanding PRs into bounded, dependency-ordered review/CI/merge batches; each named PR and exact head requires founder authorization. Continue original Phase A implementation on independently authorized work without waiting for idle named agents or a blocked PR; Phase B remains founder-gated. Do not repeat completed CI or repository-wide audits. Reuse existing secrets where appropriate; no automatic credential creation/rotation and no false least-privilege or revocation PASS. Do not weaken real security, consent, tenant, migration, reviewer, or release gates.


**Authority:** Founder FSM direction, E.. CoS (PM), `TEAM.md`, and the [Field Service Build Board](https://app.notion.com/p/74b3a1145d3f49d586ac6cdbf174ceb2). **Owner:** Platform with E.. CoS.

## 1. Traceability and readiness

A ticket carries acceptance, dependencies, risk, pair ownership, split, contract/consumers, evidence, PR, exact head, batch, and next action. The Notion board is the execution queue; legacy FSM-NNNN issues require explicit mapping. **Ready** is set by E.. CoS when dependencies and acceptance are clear — not by automatic progression on merge. One In Progress ticket and at most two waiting PRs per pair; fixes first. Every change stays on a **draft PR** until gates complete.

## 2. Branches

| Branch | Role |
|---|---|
| **`dev`** | Protected integration branch. Approved work merges here after gates. E.. CoS is the final merge approver into `dev`. |
| **`main`** | Promotion-only. Shaun merges/releases from `dev`; not the day-to-day integration target. |

`main` is not a direct-write workspace. **F2 decided by Shaun 2026-10-21: PR #1 → `dev`.** [PR #1](https://github.com/SimonShaun2/Renvani/pull/1) is based on `dev` @ `12b23226c0e0c199626940117fc7f0fa89f87375`. Feature/fix branches identify the board ticket and merge order. **No rebase, force-push,** or direct push to `dev` or `main`.

## 3. Tandem PR packet

E.. CoS specifies acceptance and non-goals. Two senior developers on the same ticket agree contract, consumers, file ownership, test ownership, and merge order before code. Partners cross-review and report combined local commands/results. Every PR states ticket, base/head SHA, contracts/migrations, self-review, observability, independent peer reviewer, assigned QA, Security need, and batch membership. The peer reviewer cannot be an implementer.

## 4. CI batches and exact-head gate

CI runs only through an **approved batch** recorded by Platform with E.. CoS authorization. No standalone per-commit, per-PR, or draft CI. Platform records run URL and conclusion at the exact head. Local green tests are not CI.

At the **exact head**: independent **peer review**, assigned **QA** evidence, and **Security** sign-off for tenant/auth/consent/agent/payment/gate-risk changes. A new commit invalidates prior sign-offs. Failed gates return a bounded fix card to the original pair with fresh review.

## 5. Integration, completion and release

After peer review, QA, Security-as-risk, and **approved batch CI** at the exact head, **E.. CoS** issues final merge approval into **`dev`**. Done means merged to `dev` with acceptance met. **Production** is separate: Shaun promotes from `dev` to `main`. No deployment, Vercel, public website, or live payments from these tickets without separate founder authorization.

E.. CoS maintains board state from Cursor, GitHub, and Notion evidence. Do not claim a session is executing merely because its chat exists.
