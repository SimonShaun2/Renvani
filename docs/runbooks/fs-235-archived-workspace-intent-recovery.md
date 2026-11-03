# FS-235 archived workspace intent recovery (support runbook)

Covers a user whose onboarding stops with `409 CONFLICT` "Archived workspace intent requires support review". Founder decision, Nov 3 2026: recovery is a manual, approved, audited support action. It is never automatic.

> **Status: there is no recovery tool yet.** As of dev `74fed505`, the codebase has no restore endpoint, no restore audit event, no support-session implementation, and no code path that archives an intent (only tests set `deletedAt`: `clerk-workspace-intent.service.test.ts` and `clerk-workspace.postgres.integration.test.ts`). Until the tool in §6 ships, support may only **triage (read-only) and escalate**. Do not try to "fix" the record any other way.

## 1. What exists (source of truth)

| Thing                          | Where                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trigger                        | `reserveClerkWorkspaceIntent` in `apps/api/src/services/clerk-workspace-intent.service.ts`. It looks up the intent by `clerkUserId` _including_ soft-deleted rows, under `pg_advisory_xact_lock`. If `deletedAt` is set, it throws `CONFLICT`.                                                                                                                                                                                                                                                                                                  |
| Routes                         | `GET/POST /api/v1/onboarding/workspace-intent` (`apps/api/src/routes/clerk-workspace-intent/index.ts`). These take a verified **organization-free** Clerk session only. They accept no user, intent, org or tenant id from the client.                                                                                                                                                                                                                                                                                                          |
| Tables (migration `0061`)      | `clerk_workspace_intents`: `id`, `clerk_user_id` (unique, **including archived rows**), `requested_name`, `status` ∈ `pending\|claimed\|uncertain\|reconciled`, `attempt_id` (unique), `claimed_at`, `uncertain_at`, `clerk_organization_id` (unique), `created_at`, `updated_at`, `deleted_at`. Plus `clerk_workspace_intent_events`.                                                                                                                                                                                                          |
| Intent audit events (existing) | `workspace.intent_pending`, `workspace.attempt_claimed`, `workspace.attempt_uncertain`, `workspace.organization_reconciled`, `workspace.webhook_deferred`, `workspace.webhook_denied`. Written only by `apps/api/src/services/clerk-workspace-intent.service.ts` (`intent_pending`, plus `webhook_deferred`/`webhook_denied` inside `deferClerkWorkspaceWebhook`) and `apps/worker/src/processors/clerk-workspace.processor.ts`. `apps/api/src/routes/webhooks/clerk.ts` calls `deferClerkWorkspaceWebhook` but writes no intent events itself. |
| Tenant audit (existing)        | `activity_events` (`company.created` and `user.registered`), written by `apps/api/src/services/clerk-provisioning.service.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Contract                       | `docs/contracts/FS-235-clerk-workspace-intent.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

**Intents are pre-tenant.** `clerk_workspace_intents` has **no `companyId`**. The intent is scoped by `clerk_user_id`. A tenant exists only after reconciliation, linked through `companies.settings->'clerk'->>'organizationId' = intent.clerk_organization_id`. There is no `companies.clerk_organization_id` column; uniqueness is the expression index `companies_clerk_organization_id_idx` (migration `0038_fs157_clerk_identity.sql`), live rows only.

Why archived intents are dangerous: the source comment says _"a claimed create may still be in flight after archive"_. A `claimed`/`uncertain` archived intent may correspond to a Clerk organization that already exists, or is about to. Restoring it carelessly could create a duplicate or ownerless tenant.

## 2. Hard rules

1. **No automatic recovery.** No cron, script, job retry or webhook may un-archive an intent.
2. **No ad-hoc database edits.** No manual SQL, Drizzle scripts, Neon console/SQL editor writes, or `psql` writes against any environment, including "just clearing `deleted_at`". The only permitted write is the reviewed tool in §6, once it exists.
3. **Support never writes to Clerk** (no creating, deleting or re-assigning organizations or memberships). Any Clerk write is outside this runbook and is a separate, founder-approved action.
4. **Support sessions are read-only** (Circle S ruling). No documented write exception exists for intent recovery. A support session **must not** perform a restore. _(Support sessions themselves are not implemented in code yet. Treat any support access as read-only.)_
5. **Never act on identifiers supplied by the requester.** Resolve the Clerk user from Clerk/our records and confirm the requester controls that account.

## 3. Authorization

| Role                                                                                                                        | May                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Support (any access)                                                                                                        | Read-only triage (§4 steps 1–4), open the ticket, escalate                                                                                 |
| Tenant roles (`owner`, `admin`, `dispatcher`, `office`, `technician`; `staffUserRoleSchema`)                                | **Nothing.** These roles are company-scoped, and an archived intent has no company yet. No tenant role can authorize or perform a restore. |
| Technical Lead + Security (two people, neither the requester; founder decision Nov 3 2026, 7:35 AM CT, FS-235 runbook item) | Approve a restore on the ticket                                                                                                            |
| Operator of the future restore tool (§6)                                                                                    | Execute it after approval. **Role not implemented / future**: there is no platform-operator role in the codebase today.                    |

Approval is valid only for one intent id, one `clerk_user_id` and one ticket, and is recorded on the ticket before execution.

## 4. Procedure

**Before you start**, open a ticket with: reporter, verified Clerk user id, time of the 409, and the reason the user needs recovery.

1. **Verify identity.** Confirm the requester controls the Clerk user (signed-in session, or Clerk's verified primary email). Record the Clerk user id on the ticket, never an email or name.
2. **Read the intent.** No read-only database role or read replica exists (future), and this runbook grants support no database access. Ask the Technical Lead to obtain these fields and attach them to the ticket, with no writes. For that `clerk_user_id`, record: `id`, `status`, `attempt_id`, `clerk_organization_id`, `deleted_at`, `updated_at`. Confirm that `deleted_at` is set. If it isn't, this runbook doesn't apply.
3. **Read the event history.** Read the `clerk_workspace_intent_events` rows for that `intent_id`, oldest first, and attach them (event types and timestamps, no PII) to the ticket.
4. **Tenant and Clerk checks (read-only):**
   - If `clerk_organization_id` is set: find live `companies` rows where `settings->'clerk'->>'organizationId'` equals it. Record the `companyId`. **Exactly 0 or 1** row is expected; 2 or more is a `clerk_org_ambiguous` incident (`docs/runbooks/clerk-alerts.md`), so stop.
   - Check that the Clerk user isn't already linked to a different company (the creator-already-linked guard in provisioning). If they are, stop. Restoring could create an orphan second tenant.
   - In Clerk, view only (no writes; see §2.3), list the user's organization memberships. Note any org whose private metadata `renvaniIntentId` equals this intent id.
   - **Cross-tenant:** every id above must belong to the same Clerk user. Any mismatch → stop and escalate as a security issue.
5. **Classify and escalate** (§5) with the findings. Expected outcomes:
   - `pending`, no org, no `attempt_id` → safe to restore, if the restore tool exists.
   - `claimed`/`uncertain` → **do not restore** until reconciliation is resolved. A create may have happened.
   - `reconciled` with a matching single company → the user likely needs access to an existing tenant, not a restore.
6. **Execute.** Only via the tool in §6, after two-person approval on the ticket. **Today: not implemented. Stop at step 5.**
7. **Verify after execution:**
   - `GET /api/v1/onboarding/workspace-intent` as the user returns the intent.
   - The status is unchanged from before (a restore must not change `status`, `attempt_id` or `clerk_organization_id`).
   - No new `companies` row exists unless one is expected through normal reconciliation.
   - The audit event is present.
   - Record it all on the ticket.

## 5. Escalation

Support → Technical Lead → Security, for any cross-tenant, identity or ambiguity finding → CoS → founder, for any policy exception. A Clerk write is never part of escalation here; it is a separate, founder-approved action (§2.3). Severity: High if a tenant may be duplicated or ownerless; otherwise Normal.

## 6. Required controls for a restore tool (not implemented / future)

These must exist before any restore can be executed. Each needs its own reviewed PR.

- A server-side restore action that takes an **intent id and ticket reference**, and runs under the same `pg_advisory_xact_lock(hashtext('clerk-workspace-intent:' || clerk_user_id))` as `reserveClerkWorkspaceIntent`.
- Preconditions checked in the same transaction: the row exists and `deleted_at IS NOT NULL`; `clerk_user_id` matches the approved one; an optimistic check on `updated_at` (or a version) matches the value read in §4 step 2, otherwise abort; `status` is allowed (start with `pending` only); no live `companies` row already has `settings->'clerk'->>'organizationId'` equal to a different intent's org.
- Idempotent: restoring an already-active intent is a no-op that returns the current state.
- **Audit:** in the same transaction, insert a `clerk_workspace_intent_events` row (the existing mechanism) with a new event type such as `workspace.intent_restored` (**not implemented / future name**). `details` must hold: actor id, approver ids, ticket reference, reason, and before/after state (`status`, `deleted_at`, `updated_at`). `created_at` gives the "when". If a `companyId` exists, also write an `activity_events` row for that company.
- Callable only by a dedicated platform-operator role with MFA (**not implemented / future**). Never by a support session or a tenant role.

## 7. Rollback / if something went wrong

- Do **not** re-archive or edit rows by hand. Freeze: stop further actions on the ticket and escalate to Technical Lead and Security immediately.
- If a duplicate or ownerless tenant appears, follow `docs/runbooks/clerk-alerts.md` (`clerk_org_ambiguous` / last-owner sections) and keep all evidence.
- A reverse "archive" action is **not implemented / future**. It must have the same controls and audit as §6.
- Record what happened, the ids involved, and the timeline on the ticket. Write a postmortem if any tenant data was affected.
