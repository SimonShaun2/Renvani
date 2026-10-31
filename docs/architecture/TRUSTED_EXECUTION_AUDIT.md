# Trusted Execution audit (Ticket A, deliverable 1)

**Initiative:** Renvani Autonomous Operating Foundation.
**Ticket:** A "Trusted Execution". Approved by Shaun via E.. CoS.
**Scope:** this is an audit plus reproducible failing tests. **No fixes, no migration, no provider send, no web changes.**
**Base:** `origin/dev` at `d38d5bf8` (2026-10-31). Every file:line reference below is against that commit.

**Failing tests:** `apps/api/src/trusted-execution/trusted-execution-gaps.test.ts`.
- Run them with `pnpm --filter @fsm/api test:trusted-execution-gaps`, which uses `apps/api/vitest.trusted-execution-gaps.config.ts`.
- They are excluded from the default `vitest run` (`apps/api/vitest.config.ts` `exclude`), so default CI stays green.
- No `it.fails` or `skip` is used.
- Two controls (`CTRL-*`) pass. They prove the harness reaches the code under test, so each `TE-*` failure is an assertion on missing behaviour, not a setup error.

## 1. The contract

Every agent action type must satisfy all seven items:

| # | Contract item | Meaning |
|---|---|---|
| C1 | Input schema | Parameters are validated against a per-type schema at create time, and again at execute time against the approved parameters. |
| C2 | Tenant scope | Every read and write runs inside `runTransactionWithTenantSession(companyId, …)` and is scoped by `companyId`. |
| C3 | Permissions | Auth and role are checked before any input is processed. The actor type is enforced per product, and the executor sees the real actor. |
| C4 | Policy version | The proposal pins a policy version. It is re-checked at approve and execute and recorded on the receipt. |
| C5 | Expected record version | State changes **require** `expectedVersion` (compare-and-set). The target record version is re-checked at execute inside the tenant transaction. |
| C6 | Idempotency key | Create, approve, reject, edit and execute accept a key. A same-key replay returns the first result, and a different payload returns 409. |
| C7 | Result contract | The receipt states what actually happened, using the Figma steps (see §4): **Prepared** → **Approved** → **Queued** → **Provider accepted** → **Delivered** → **Business outcome**, or **Delivery failure**. In code tokens, delivery is `queued` \| `provider_accepted` \| `delivered` \| `failed`. "Succeeded" is never claimed without the side effect, and a failure is persisted as `failed`. |

## 2. Action types × contract

**Sources:**
- Action types: registry `apps/api/src/services/agent-action.registry.ts:97-131` (7 built-in types) plus `services/revenue-agent/revenue-proposal.kinds.ts:93-142` (4 Revenue kinds).
- Executors: `agent-action.executors.ts:124-149` and `revenue-proposal.kinds.ts:108-112`.
- Lifecycle: `agent-action.service.ts`.

**Legend:** PASS, PARTIAL (works but is bypassable or optional) or FAIL. N/A means the type is never executed: it is auto-approved and has no executor, so execute fails closed at `agent-action.executors.ts:77-83`.

### 2a. Items shared by every type (service-level, identical for all 11)

| Item | Status | Evidence (file:line) |
|---|---|---|
| C2 Tenant scope | **PARTIAL** | <ul><li>Approve, reject, edit and execute run in `runTransactionWithTenantSession` (`agent-action.service.ts:314, 379, 450, 531`), as does escalate (`agent-action-escalation.service.ts:39`).</li><li>Every row query uses `agentActionScopedWhere` (`agent-action.service.ts:43-49`).</li><li>Bypasses are listed in §3 (B1–B4).</li></ul> |
| C3 Permissions (role) | **PARTIAL** (auth order fixed in the TE-AUTH PR) | <ul><li>The role gate owner/admin/dispatcher is at `routes/agent-actions/index.ts:18` and `routes/operator/index.ts:22`.</li><li>**Fixed:** `authenticate` and `requireRole` now run in `onRequest`, before `preValidation` (zod), on every `/agent-actions/*` and `/operator/*` route. Unauthenticated callers get 401 and wrong-role callers 403 before any validation (TE-AUTH-01/02, now in the default run, plus TE-AUTH-03/04/05).</li><li>The executor policy call hard-codes `actorType: "user"` (`agent-action.executors.ts:53`).</li></ul> |
| C3 Permissions (actor per product) | PASS | Enforced at create by `registerAgentProduct` (`agent-action.registry.ts:63-93`) through `assertActionAllowedForProduct` (`agent-action.service.ts:185`). |
| C3 Cross-tenant | PASS | 404 via scoped where plus `assertAgentActionTenantScope` (`agent-action.service.ts:135-149`). Covered by control CTRL-02. |
| C4 Policy version | **PARTIAL** | <ul><li>Checked only at create (`agent-action.policy.ts:13-16`, `agent-action.service.ts:184`).</li><li>Approve and execute never re-check `row.policyVersion` (`agent-action.service.ts:305-371, 522-648`).</li><li>The receipt records only the *outbound* decision's version, and only for outbound executors (`agent-action.service.ts:588-595`).</li></ul> |
| C5 Expected record version | **PARTIAL** (approve/execute fixed in fix PR 1) | <ul><li>**Fixed:** approve and execute now **require** `expectedVersion` (`routes/agent-actions/schemas.ts`, `AgentActionGuardedStateChangeBodySchema`): missing → 400, mismatch → 409 (TE-STALE-01/02, now in the default run).</li><li>**Fixed:** operator edit accepts `expectedVersion` (stale → 409) and writes with compare-and-set on `state = awaiting_approval` (TE-STALE-03).</li><li>**Fixed (#370 follow-up PR):** the operator inbox edit PATCH now **requires** `expectedVersion` (`routes/operator/schemas.ts`, `editAgentActionBodySchema`): missing → 400 (TE-STALE-05). The web sends it since #371 (`apps/web/src/hooks/operator-inbox.hooks.ts`, `useEditOperatorInboxItem`).</li><li>**Open:** `expectedVersion` stays optional on reject and escalate, so those still allow a blind write when the client omits it.</li><li>**Open:** the target `recordVersion` check exists (`agent-action.service.ts`, execute), but reads outside the tenant tx (B3).</li></ul> |
| C6 Idempotency key | **PARTIAL** (approve/execute fixed in fix PR 1) | <ul><li>Create: key plus payload-hash match (`agent-action.service.ts`, `assertIdempotencyPayloadMatches`).</li><li>**Fixed:** approve and execute accept an `Idempotency-Key` header. The key and a request hash are stored on the tenant-scoped audit event written in the same transaction. The same key and request replays the current result (200, `replayed: true`); the same key with a different request is a 409 (TE-DUP-01/02/03).</li><li>**Fixed (#370 follow-up PR):** concurrent requests with the same key are serialised by a transaction-scoped advisory lock on company + key taken before the row is read, so the second one replays (200, `replayed: true`) instead of losing the compare-and-set with a 409 (TE-DUP-05/06). A key longer than 128 characters is now a 400 instead of being ignored (TE-DUP-07).</li><li>**Open:** reject, edit and escalate accept no key; a retry still gets 409 from the state machine.</li></ul> |
| C7 Failure handling | **FAIL** | <ul><li>A throw in `beforeExecute` or `applyInTransaction` rolls back the whole execute tx (`agent-action.service.ts:531-629`). The row returns to `approved` with no receipt, and `failed` (an enum value in `packages/types/src/agent-control-plane/v1/agent-action-state.ts`) is never written (TE-FAIL-01).</li><li>The catch at `:642-647` only persists `expired`.</li></ul> |
| C7 Receipt shape | **FAIL** for outbound types | <ul><li>The receipt is a single hard-coded `outcome: "succeeded"` with `note: "No outbound provider send in Batch 4 slice"` (`agent-action.service.ts:577-596`).</li><li>State goes `executing` → `succeeded` (`:598-606`). There is no field for Queued, Provider accepted or Delivered (`queued`/`provider_accepted`/`delivered`) (TE-RCPT-01/02).</li></ul> |

### 2b. Per-type items

| Action type (registry line) | Executor (file:line) | C1 Input schema | C3 Actor rule | C7 Result contract | #301 consent dependency |
|---|---|---|---|---|---|
| `context.resolve` (registry:98) | none; auto-approved | PASS: tool schema via `assertActionTypeMatchesToolName` (service:161-162; tools/registry.ts:3-9) | PASS | N/A (not executable) | no |
| `message.draft` (registry:99-106) | none; auto-approved | PASS: tool schema | PASS | N/A | no |
| `message.send_proposed` (registry:107-118) | `beforeExecute: authorizeOutboundAgentActionExecution` (executors:130-132) | PASS: tool schema at create. Edit patches `body`/`channel`/`subject` through `EditAgentActionParametersSchema` (types operator-inbox.ts:76-80) without re-validating the full tool schema. | PASS | **FAIL**: `succeeded` with no send. Approved, Queued, Provider accepted and Delivered all collapse into `succeeded`. | **yes** (consent read at execute) |
| `revenue.inquiry.qualify` (registry:119-125) | `internalRecordExecutor("bookingRequestId")` (executors:149, 109-122) | **FAIL**: not a tool name, so no parameter schema (service:172-177). Only `bookingRequestId` presence is checked at execute (executors:113). | PASS | PASS: internal metadata, so `succeeded` is accurate | no |
| `loyalty.reminder.propose` (registry:126) | `beforeExecute: assertLoyaltyReminderExecutionAllowed` (executors:124-128; policy.ts:51-60) | PASS: tool schema | PASS (AI only) | **FAIL**: when the flag is on and dry-run is off, it reaches `succeeded` with no send and no `applyInTransaction`. When the flag is off, POLICY_DENIED rolls back with no failed receipt. | **yes** |
| `service.job_brief.propose` (registry:127) | `applyApprovedJobServiceBriefInTransaction` (executors:134-143) | PASS: tool schema plus `ServiceJobBriefProposeParamsV1Schema.parse` at apply (job-service-brief.service.ts:111) | PASS (AI/system) | PASS: internal apply in the same tx | no |
| `scheduling.booking.self_service` (registry:128) | `internalRecordExecutor("jobId")` (executors:146) | **FAIL**: no parameter schema; only `jobId` presence is checked | PASS (system/user) | PASS: internal acknowledgement | no |
| `revenue.invoice_reminder.propose` (kinds:116-121) | outbound gate plus recommendation → `actioned` (kinds:108-112) | **PARTIAL**: params come from an allowlisted builder (revenue-proposal-builders.registry.ts), with no create-time schema | PASS | **FAIL**: `succeeded` and recommendation `actioned` with no send ("approved" reads as "done") | **yes** (appointment scope) |
| `revenue.estimate_followup.propose` (kinds:122-127) | same | PARTIAL | PASS | **FAIL** | **yes** (appointment) |
| `revenue.reactivation.propose` (kinds:128-133) | same | PARTIAL | PASS | **FAIL** | **yes** (marketing) |
| `revenue.plan_offer.propose` (kinds:134-139) | same | PARTIAL | PASS | **FAIL** | **yes** (marketing) |

## 3. Paths that bypass `runTransactionWithTenantSession`

| ID | Path | file:line | Kind |
|---|---|---|---|
| B1 | `createAgentActionProposal` without `existingTx` uses `db.transaction(...)` | `agent-action.service.ts:267` | write |
| B1a | caller of B1 | `scheduling-booking-self-service-inbox.service.ts:23` | write |
| B1b | caller of B1 | `loyalty-reminder-propose.service.ts:85` | write |
| B2 | Revenue inquiry response wraps the proposal create in `db.transaction` | `revenue-inquiry-response.service.ts:69` (create at `:91`) | write |
| B3 | Execute's stale-target check calls `resolveEntityRef`, which reads through the global `db` (a separate connection, outside the tenant tx) | `agent-action.service.ts:547` → `tenant-context.service.ts:196-203`, reads at `:52, 69, 86, 101` | read inside a write path |
| B4 | Lifecycle reads through global `db` | `agent-action.service.ts:294` (list), `:135`/`:651` (get, default executor `db`) | read |
| B4a | Operator inbox and Command Center reads through global `db` | `operator-inbox.service.ts:51, 90, 100, 107, 137, 187, 271` | read |

All of these still filter by `companyId`, so none is a known cross-tenant leak. They do skip the tenant session, so any RLS or session-scoped guard does not apply. `revenue-agent-proposals.service.ts:153, 166`, `agent-action-escalation.service.ts:39` and `job-service-brief.service.ts:27, 98` comply.

## 4. Execution and delivery states: where they collapse

Source: Figma frame **"AOF / 03 Action execution · Delivery states"** (file `jiGHTNUJNltWbHA4Il3hk7`). The desktop frame is node `331:4230`; the tablet (`340:4219`) and mobile (`341:4255`) frames show the same steps. The six steps are **Prepared**, **Approved**, **Queued**, **Provider accepted**, **Delivered** and **Business outcome**. The failure badge reads **"DELIVERY FAILURE"**, under "Failure & recovery": "If provider delivery fails, show a retry, escalation and evidence trail. Never silently turn approval into success." The frame label differences are:

- The mobile frame labels step 6 **"OUTCOME"** rather than "BUSINESS OUTCOME".
- The mobile frame has no "DELIVERY FAILURE" badge; it shows only the "Failure & recovery" text.
- The tablet and mobile frames add the status pills "QUEUED · NOT SENT" and "PENDING RECEIPT" (tablet) or "NOT COMPLETE" (mobile). The desktop frame shows "Delivered" as "Not confirmed; do not mark completed".

### 4a. Name mapping

| Figma step (331:4230) | Earlier name in this doc | Code token (receipt `deliveryState`, TE-RCPT-02) | Code status today (`AgentActionStateV1Schema`, `packages/types/src/agent-control-plane/v1/agent-action-state.ts:3-14`) |
|---|---|---|---|
| Prepared | (none; implied by "proposed") | — | `proposed`, `policy_evaluated`, `awaiting_approval` |
| Approved | `approved` | — | `approved` |
| Queued | `queued` | `queued` | none. Execution goes `executing` → `succeeded`. |
| Provider accepted | `provider-accepted` / `provider_accepted` | `provider_accepted` | none. Collapses into `succeeded`. |
| Delivered | `delivered` | `delivered` | none. Collapses into `succeeded`, and the web shows it as "Completed". |
| Business outcome (mobile: "Outcome") | (none) | — (kept separate from delivery) | none on the action. Revenue writes recommendation `actioned` at execute. |
| Delivery failure (badge "DELIVERY FAILURE") | `failed` | `failed` | `failed` is in the enum but execute never writes it. Other terminal values are `expired`, `cancelled`, `escalated` and `reversed`. |

### 4b. Where each state collapses

| Required distinct state | Where it is represented today | Collapse |
|---|---|---|
| Prepared | `proposed` → `policy_evaluated` → `awaiting_approval` | Distinct, so there is no gap here. |
| Approved | `agent_actions.state = "approved"` (service:330) | The Command Center button labelled **"Approve & send"** (`apps/web/src/components/command-center/NeedsYou.tsx:43-51, 82-83`; also `agent-actions.config.ts:8` and `revenue-agent/proposal.config.ts:24`) calls only `POST /agent-actions/:id/approve` (`operator-inbox.hooks.ts:46`). Execute is a separate call (`:68`) that the Command Center never makes. **Approved reads as "sent".** |
| Queued (`queued`) | nowhere | Collapses into `succeeded`. |
| Provider accepted (`provider_accepted`) | nowhere | Collapses into `succeeded`. |
| Delivered (`delivered`) | nowhere | Collapses into `succeeded`. The web labels it "Completed" (`agent-actions.config.ts:29`). |
| Business outcome | nowhere on the action | Revenue marks the recommendation `actioned` at execute, before any delivery. |
| Delivery failure (`failed`) | The enum value exists, but execute never writes it. | A throw rolls back to `approved` (TE-FAIL-01). Escalate and expire are the only other terminal writes. |

## 5. Placeholder Command Center KPIs

`apps/web/src/components/command-center/command-center.config.ts:26-33` defines `const pending = () => null`. All four KPIs (`direct`, `booked`, `recurring`, `marketing`) use `pending` for `value` and `detail`, and `CommandCenterView.tsx:41-54` renders `EMPTY` ("—"). There is no API call; the comment at `:28` says a period-scoped KPI aggregate endpoint is needed.

| KPI | Returns today | Proposed real source (existing tables/endpoints) |
|---|---|---|
| Direct inquiries | `null` → "—" | `booking_requests` in period by `source` (direct site/app). The same data backs `GET /api/v1/reporting/direct-demand` (`routes/reporting/index.ts:25`). |
| Inquiry → booked | `null` → "—" | `booking_requests` converted to jobs ÷ inquiries in period. This is the Revenue Agent handoff; `reporting/job-sources` is at `:18`. |
| First → recurring | `null` → "—" | Customers whose first job is in period and who then hold an active `service_agreements` or VIP membership row |
| Marketing revenue | `null` → "—" | Paid invoices attributed to campaigns or automations. `GET /api/v1/reporting/revenue-outcomes` is at `:32`. |

The fix is one new read-only endpoint, for example `GET /api/v1/reporting/command-center-kpis?period=`, composed from those queries. The web wiring belongs to Dev C. KPIs have no failing test here because the placeholder lives in `apps/web` and this ticket makes no web edits.

## 6. Gap list and proposed small-PR fix order

| Order | Gap | Category | Failing test | Proposed small PR | Depends on #301 |
|---|---|---|---|---|---|
| 1 | G-FAIL: execute failure is not persisted | failed execution | TE-FAIL-01 | Run executor work in a savepoint. On throw, roll back the side effects and in a second tenant tx write `state=failed` plus a receipt `{outcome:"failed", error code, at}` with an audit `execution_failed`. Rethrow. | no |
| 2 | G-RCPT: outbound "succeeded" without a send | execution and delivery states | TE-RCPT-01, TE-RCPT-02 | Add a receipt `deliveryState` with tokens `queued` \| `provider_accepted` \| `delivered` \| `failed` (Figma steps Queued, Provider accepted and Delivered, plus Delivery failure; frame 331:4230). Business outcome is recorded separately. Outbound executors stop at `queued` (an outbox row, no provider call), and only a provider callback moves the state on to `provider_accepted` or `delivered`. No migration is needed, since the receipt is jsonb and state stays `executing` until delivery. | **yes**: outbound consent must be the #301 current-consent check before anything is queued |
| 3 | G-UI-APPROVE: "Approve & send" only approves | execution and delivery states / UX | (web; documented) | API: optional `POST /agent-actions/:id/approve-and-execute` (one tenant tx, same contract). Web (Dev C): relabel to "Approve", or call the combined endpoint. | yes (same as 2) |
| 4 | G-VER: `expectedVersion` optional; edit has no compare-and-set — **FIXED for approve/execute/edit in fix PR 1** (reject/escalate still optional) | stale records | TE-STALE-01, -02, -03 (pass; default run) | Make `expectedVersion` required on approve/reject/execute/edit/escalate (400 if missing). Edit uses compare-and-set on `updated_at`. Web sends `item.version` (Dev C, same release). | no |
| 5 | G-IDEM: no idempotency key on state changes — **FIXED for approve/execute in fix PR 1** | duplicates | TE-DUP-01, -02 (pass; default run) | Accept an `Idempotency-Key` header. Store `{op, key, resultVersion}` in the audit event payload (no new table) and replay the first result for the same key. | no |
| 6 | G-AUTH-ORDER: validation before auth — **FIXED in the TE-AUTH PR** | unauthorized | TE-AUTH-01, -02 (pass; default run) | Move `authenticate` and `requireRole` to `onRequest` (or validation to `preHandler`) for `/agent-actions/*` and `/operator/*`. | no |
| 7 | G-TX: tenant-session bypasses B1–B4 | tenant scope | (documented; needs Neon/RLS harness) | B1/B2 → `runTransactionWithTenantSession`. B3 → `resolveEntityRef(…, tx)`. B4 reads → tenant session. | no |
| 8 | G-SCHEMA: no per-type parameter schema for `revenue.inquiry.qualify`, `scheduling.booking.self_service` and the 4 Revenue kinds | input schema | (documented) | Add an optional `parametersSchema` to `AgentActionTypeDefinition`, parsed at create and execute. | no |
| 9 | G-POLICY: policy version not re-checked at approve/execute; executor actor hard-coded `"user"` | permissions / policy | (documented) | `assertPolicyVersion(row.policyVersion)` at approve/execute; pass the real actor type. | no |
| 10 | G-KPI: Command Center KPIs are placeholders | KPIs | (web; documented) | Add `GET /reporting/command-center-kpis` (API), then wire the web (Dev C). | no |

**Gap counts by category:**
- stale records: 1 gap (3 tests)
- duplicates: 1 gap (2 tests)
- unauthorized: 1 gap (2 tests)
- failed execution: 1 gap (1 test)
- execution and delivery states: 2 gaps (2 tests; one is web-only)
- tenant scope: 1 gap (7 bypass paths, documented)
- input schema: 1 gap (6 types)
- policy/actor: 1 gap
- KPIs: 1 gap (4 placeholders)

That is **10 gaps and 10 failing tests**, plus 2 passing controls, as audited.

**Status after fix PR 1 (G-VER, G-IDEM):** TE-STALE-01/02/03 and TE-DUP-01/02 pass and moved to `apps/api/src/trusted-execution/trusted-execution.test.ts` in the default run, with TE-STALE-04 and TE-DUP-03/04 added. The gap script now holds 5 failing tests (TE-AUTH-01/02, TE-FAIL-01, TE-RCPT-01/02) plus the 2 controls.

**Status after the TE-AUTH PR (G-AUTH-ORDER):** TE-AUTH-01/02 pass and moved to `trusted-execution.test.ts` in the default run, with TE-AUTH-03/04/05 added (operator surface, escalate, and validation still running for authorised callers). The gap script now holds 3 failing tests (TE-FAIL-01, TE-RCPT-01/02) plus the 2 controls.

## 7. Failing-test output (as audited, 2026-10-31; see the status note in §6 for what now passes)

`pnpm --filter @fsm/api test:trusted-execution-gaps`:

```
 ✓ CTRL-01 owner approves an awaiting action (200) and execute of an internal action succeeds
 ✓ CTRL-02 wrong role (technician) gets 403 and cross-tenant owner gets 404 on approve/execute
 × TE-STALE-01 approve without expectedVersion must be rejected (400)      → AssertionError: expected 200 to be 400
 × TE-STALE-02 execute without expectedVersion must be rejected (400)      → AssertionError: expected 200 to be 400
 × TE-STALE-03 operator edit with a stale expectedVersion must be 409      → AssertionError: expected 200 to be 409
 × TE-DUP-01 double approve with the same Idempotency-Key replays (200)    → AssertionError: expected 409 to be 200
 × TE-DUP-02 double execute with the same Idempotency-Key replays (200)    → AssertionError: expected 409 to be 200
 × TE-AUTH-01 unauthenticated approve with a malformed id must be 401      → AssertionError: expected 400 to be 401
 × TE-AUTH-02 technician execute with a malformed body must be 403         → AssertionError: expected 400 to be 403
 × TE-FAIL-01 adapter throw yields a persisted failed receipt              → AssertionError: expected 'approved' to be 'failed'
 × TE-RCPT-01 message.send_proposed with no provider must not be succeeded → AssertionError: expected 'succeeded' not to be 'succeeded'
 × TE-RCPT-02 outbound receipt carries a distinct deliveryState            → AssertionError: expected [queued, provider_accepted, …] to include undefined
 Test Files  1 failed (1)
      Tests  10 failed | 2 passed (12)
```

## 8. Limitations
- **Test doubles:** the tests use the in-memory fake DB. `runTransactionWithTenantSession` is a plain transaction there, so the B1–B4 tenant-session bypasses are documented but not reproduced by a test; that needs the Neon RLS harness.
- **Mocked outbound policy:** TE-RCPT tests mock `authorizeAgentActionExecution` to "allowed" so that execution is reached without consent rows. This is why the real consent behaviour depends on #301.
- **Target version mocked:** `resolveEntityRef` is mocked to a stable `recordVersion`, and stale-target behaviour is not under test.
- **Web-only gaps:** Command Center KPIs and the "Approve & send" label are web code and have no failing test in this PR.

## 9. Fix status (updated 2026-10-31, after #370 merged)

#370 (fix PR 1: TE-STALE, TE-DUP) is merged into dev. This PR (#380) adds only building blocks: nothing in `executeAgentAction` calls them yet, so the three tests below still fail and stay in the gap script.

| Gap test | Status | Notes |
|---|---|---|
| TE-FAIL-01 | **PARTIAL: building blocks in #380; wiring is the follow-up after #380 merges** | `services/agent-action-receipt.ts` adds `persistAgentActionExecutionFailure`. After the execute tx rolls back, it opens a second tenant tx and does a compare-and-set from `approved`/`executing` to `failed`, writing a failed receipt and an `execution_failed` audit event. The first tx has already rolled back, so no row lock is held and this cannot deadlock. The caller passes `actorType` (no hardcoded `user`). The receipt keeps an AppError's code and message; any other error gets `EXECUTION_FAILED` with a generic message, and the raw (truncated) error text is kept only in the audit event detail. |
| TE-RCPT-01 | **PARTIAL: building blocks in #380; wiring is the follow-up** | Executors declare `delivery: "outbound"` for message.send_proposed, loyalty.reminder.propose and the 4 Revenue kinds. `buildAgentActionExecutionResultForType` returns state `executing` with outcome `queued` for these, never `succeeded`. |
| TE-RCPT-02 | **PARTIAL: building blocks in #380; wiring is the follow-up** | `@fsm/types` adds `AgentActionDeliveryStateV1Schema` (`queued` \| `provider_accepted` \| `delivered` \| `failed`). `ExecutionReceiptV1Schema` gains `outcome: "queued"` and an optional `deliveryState`. |
| TE-AUTH-01/02 | Open on dev; fixed in #382 (separate PR) | Still in the gap script on dev. #382 moves auth and role checks to `onRequest` and moves both tests to the default run. |

Gap script on this branch: 5 failing (TE-AUTH-01/02, TE-FAIL-01, TE-RCPT-01/02) plus 2 passing controls. After #382 merges it is 3 failing.

**Follow-up after #380 merges (in `executeAgentAction`, `agent-action.service.ts`):**
1. Replace the hard-coded receipt and `state: "succeeded"` with `buildAgentActionExecutionResultForType(row.actionType, base)`. Write `result.state` and `result.receipt`, and transition from `executing` to `result.state`. For outbound kinds the row stays `executing` with a `queued` receipt.
2. Keep the `agent.execution_succeeded` audit event (and its idempotency detail) for both outcomes, so a same-key replay still finds it. Alternatively, record queued executes under their own event type and extend `IDEMPOTENT_OPERATION_EVENT_TYPE`.
3. In the catch, when the error happened after the row was loaded and is not an expiry, stale or version conflict, call `persistAgentActionExecutionFailure({ companyId, actionId, actorId, actorType: "user", error })`, then rethrow.
4. Move TE-FAIL-01 and TE-RCPT-01/02 out of the gap script into the default run, and set these rows to fixed.
