# GITHUB_WORKFLOW.md

> **FOUNDER EXECUTION & MERGE AUTHORITY — NOVEMBER 3, 2026 (current).** See [founder directive #420](https://github.com/SimonShaun2/Renvani/issues/420). **Codex is the active builder and coordinator. No E.. CoS approval, dispatch, CI authorization, review recommendation, or signature is required for any ticket or PR.** GrokBot/E.. CoS is optional advice when the founder independently chooses to use it; never a gate. Codex Lead/Technical Lead and actual Platform owners coordinate Ready/WIP and authorize appropriately scoped CI batches; independent Peer, QA, and Security-by-risk reviews with exact-head evidence remain mandatory. **The founder alone approves EVERY outstanding and future PR merge**, including `dev`, by named PR and exact reviewed head. Compatible PRs may be reviewed and validated in batches, then merged sequentially only after explicit founder approvals; no unsafe big-bang merge. Continue authorized Phase A work without stopping for idle roles or blocked PRs. No Phase B before original Phase A acceptance and founder permission. Preserve genuine security, tenant, consent, migration and release gates. Reuse existing credentials when appropriate, but never claim unproven least privilege or rotation/revocation PASS.

**Authority:** Founder FSM direction, Codex Lead / Technical Lead, `TEAM.md`, and the [Field Service Build Board](https://app.notion.com/p/74b3a1145d3f49d586ac6cdbf174ceb2). **Owner:** Platform with Codex Lead / Technical Lead.

## 1. Traceability and readiness

A ticket carries acceptance, dependencies, risk, pair ownership, split, contract/consumers, evidence, PR, exact head, batch, and next action. The Notion board is the execution queue; legacy FSM-NNNN issues require explicit mapping. **Ready** is set by Codex Lead / Technical Lead when dependencies and acceptance are clear — not by automatic progression on merge. One In Progress ticket and at most two waiting PRs per pair; fixes first. Every change stays on a **draft PR** until gates complete.

## 2. Branches

| Branch | Role |
|---|---|
| **`dev`** | Protected integration branch. Approved work merges here after gates. The founder is the final merge approver for each named PR and exact reviewed head into `dev`. |
| **`main`** | Promotion-only. Shaun merges/releases from `dev`; not the day-to-day integration target. |

`main` is not a direct-write workspace. **F2 decided by Shaun 2026-10-21: PR #1 → `dev`.** [PR #1](https://github.com/SimonShaun2/Renvani/pull/1) is based on `dev` @ `12b23226c0e0c199626940117fc7f0fa89f87375`. Feature/fix branches identify the board ticket and merge order. **No rebase, force-push,** or direct push to `dev` or `main`.

## 3. Tandem PR packet

The Product Owner specifies acceptance and non-goals; Codex Lead / Technical Lead coordinates the assigned engineering work. Two senior developers on the same ticket agree contract, consumers, file ownership, test ownership, and merge order before code. Partners cross-review and report combined local commands/results. Every PR states ticket, base/head SHA, contracts/migrations, self-review, observability, independent peer reviewer, assigned QA, Security need, and batch membership. The peer reviewer cannot be an implementer.

## UI changes — mandatory Figma visual acceptance

Every frontend/UI PR must follow [docs/design/RENVANI_FIGMA_PARITY.md](docs/design/RENVANI_FIGMA_PARITY.md). It must identify the canonical Renvani Figma file and precise desktop/tablet/mobile/state node IDs, actual browser preview URL and exact head, screenshots of the rendered route compared to those frames, actual interactive/auth/accessibility checks, and an independent Design/Product PASS or bounded documented exception plus QA evidence. **No Figma node IDs or no browser comparison means visual acceptance is HOLD, regardless of CI.** Use no retired project brand in active UI. Do not imply historical screenshots represent working staging software.

## 4. CI batches and exact-head gate

CI runs only through an **approved batch** recorded by Platform with Codex Lead / Technical Lead authorization. No standalone per-commit, per-PR, or draft CI. Platform records run URL and conclusion at the exact head. Local green tests are not CI.

At the **exact head**: independent **peer review**, assigned **QA** evidence, and **Security** sign-off for tenant/auth/consent/agent/payment/gate-risk changes. A new commit invalidates prior sign-offs. Failed gates return a bounded fix card to the original pair with fresh review.

## 5. Integration, completion and release

After peer review, QA, Security-as-risk, and **approved batch CI** at the exact head, **the founder** issues final merge approval for the named PR and exact reviewed head into **`dev`**. Done means merged to `dev` with acceptance met. **Production** is separate: Shaun promotes from `dev` to `main`. No deployment, Vercel, public website, or live payments from these tickets without separate founder authorization.

Codex Lead / Technical Lead maintains board state from actual GitHub and Notion evidence. Do not claim a session is executing merely because its chat exists.
