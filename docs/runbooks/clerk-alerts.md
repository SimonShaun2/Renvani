# Clerk alert runbook (FS-163)

Alert-worthy Clerk conditions in the API. Each one emits a structured pino log line with a top-level `alert` field. No alert rule exists in the repo, because no observability vendor or log sink has been chosen yet. `docs/infrastructure/staging/service-inventory.md` lists physical hosts as "TBD until FS-93 ADR" and "Observability vendor and log sinks" under "Unknown until FS-93". This doc is the contract that the alert rule should be built against once a sink exists.

## Log format

pino writes JSON to stdout (Render captures stdout). Error level is `"level":50`. Fields used below are top-level:

| alert | logger `name` | level | other fields | source |
|---|---|---|---|---|
| `clerk_org_ambiguous` | `clerk-tenant` | error (50) | `clerkOrganizationId`, `companyIds` (array) | `apps/api/src/services/clerk-tenant.service.ts` (`findCompanyByClerkOrganizationId`) |
| `clerk_last_owner_deactivated` | `clerk-user-sync` | error (50) | `companyId`, `userId` | `apps/api/src/services/clerk-user-sync.service.ts` |

The payloads are ids only, with no emails, tokens, or secrets. Both are covered by unit tests (`clerk-tenant.service.test.ts`, `clerk-user-sync.service.test.ts`), so renaming a field breaks a test.

## Rule spec (to implement in the log sink)

| Rule | Match | Fire | Dedupe key | Severity | Route |
|---|---|---|---|---|---|
| Clerk org ambiguous | `alert = "clerk_org_ambiguous"` | first occurrence | `clerkOrganizationId`, 24h window | **High**: every session and webhook for that org fails closed (401 / skipped) | team alert channel; page on-call in business hours |
| Clerk last owner deactivated | `alert = "clerk_last_owner_deactivated"` | first occurrence | `companyId`, 24h window | **Medium**: the company has no active owner/admin, but users can still sign in | team alert channel |

The notification body includes the alert name, the id fields above, the environment, and a link to this runbook. Do not include the raw request.

Example query, for any JSON log search (Better Stack, Datadog, Render log search, etc.):

```
level:50 AND alert:"clerk_org_ambiguous"
level:50 AND alert:"clerk_last_owner_deactivated"
```

Ad-hoc check without a sink: in Render → API service → Logs, search `clerk_org_ambiguous` or `clerk_last_owner_deactivated`.

Test fire (Done-when check): once the rule exists, emit one line from a staging shell, e.g.
`node -e 'require("pino")({name:"clerk-tenant"}).error({alert:"clerk_org_ambiguous",clerkOrganizationId:"org_test_fs163",companyIds:[]},"FS-163 test alert")'`
and confirm the notification arrives in the team channel.

## Response

### `clerk_org_ambiguous`

More than one non-deleted company shares the Clerk org id. Impact: that org is locked out (fail closed, #196); other orgs are unaffected.

1. Run the duplicate-org query: `docs/security/STACK-02-clerk-session-bridge.md`, runbook **(b) Duplicate Clerk org pre-deploy check**. Confirm that the `company_ids` match the alert's `companyIds`.
2. With the company owner, decide which company is canonical. Soft-delete the other, or unset its `settings.clerk.organizationId`.
3. Re-run the 0038 `CREATE UNIQUE INDEX IF NOT EXISTS "companies_clerk_organization_id_idx" …` statement from the same section, verbatim, so duplicates can't recur.
4. Verify that a member of the org can sign in, then close the alert.

### `clerk_last_owner_deactivated`

A Clerk webhook deactivated the last active, non-deleted owner/admin of `companyId`:
- **`organizationMembership.deleted`** sets `is_active = false` and keeps `clerk_user_id`.
- **`user.deleted`** sets `is_active = false`, sets `clerk_user_id = NULL`, and sets the `clerk_unlinked_at` tombstone.

1. Check what remains. This uses the same predicate as `alertIfLastOwnerDeactivated` in `clerk-user-sync.service.ts`: same company, `is_active = true`, `deleted_at IS NULL`, role owner/admin. `users.deleted_at` is the soft-delete column (shared `timestamps`, migration 0000); soft-deleted users never count.
   ```sql
   SELECT id, role, is_active, deleted_at, clerk_user_id IS NOT NULL AS linked, clerk_unlinked_at
   FROM users
   WHERE company_id = '<companyId>' AND role IN ('owner','admin')
   ORDER BY (is_active AND deleted_at IS NULL) DESC, role;
   ```
   A remaining owner/admin is a row with `is_active = true AND deleted_at IS NULL`. If one exists, the alert is informational.
2. If this was intended (the company is offboarding), record it and close the alert.
3. Otherwise, confirm with the company who should be owner, then **relink and reactivate** them. A relink alone does not reactivate: the user stays `is_active = false` unless reactivation is explicit.
   - **Route** (`POST /api/v1/users/:id/clerk-relink`, FS-165), called by another active owner of the same company, with `{"clerkUserId": "...", "reactivate": true}`:
     - If they were only removed from the org (Clerk user not deleted), pass the **same** Clerk id (no `confirmOverwrite` needed). The response is `relinked` with `reactivated: true`. Without `reactivate` the same call returns `unchanged` and the user stays inactive.
     - If their Clerk user was deleted, pass their new Clerk id. This clears the tombstone and reactivates.
   - **Role rules (route and manual SQL alike):**
     - Only an **owner** may relink or reactivate an owner/admin target. An admin caller gets **403**.
     - Relinking yourself returns **403**.
     - The target must belong to the caller's company and must not be soft-deleted (otherwise **404**).
   - **If no active owner is left** (the deactivated user was the last one, and an admin cannot act on owner/admin targets), the route cannot be used. The **manual SQL** in `docs/security/STACK-02-clerk-session-bridge.md`, runbook **(a) Relink a tombstoned user**, is the only path. Uncomment its `is_active = true` line to reactivate, and keep the `deleted_at IS NULL` guard. Apply the same rules: get written confirmation from the company's verified owner (an existing admin cannot authorize an owner/admin restore), never let the person being restored approve their own change, and record who approved it in the ticket.
4. Re-run the query in step 1 and confirm one row now has `is_active = true AND deleted_at IS NULL`. Then close the alert.

## Not done in repo (needs Shaun / credentials / vendor decision)

- Choose and provision the log sink or observability vendor (open in FS-93). Possible new spend.
- Configure the Render log stream or drain on the API service (Render dashboard credentials).
- Create the two alert rules above in the sink and connect the team alert channel (Slack or similar).
- Decide who is paged and the on-call hours.
- Run the test fire above and record the evidence on FS-163.
