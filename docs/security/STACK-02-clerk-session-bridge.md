# STACK-02 — Clerk session bridge + DB tenant context

**Status:** Flag-gated (`clerkAuthParallelJwt`, `tenantSessionScopedWrites` in `@fsm/config/feature-flags`)  
**Owners:** Noah (auth bridge), Kai (tenant write hardening)  
**Pairs with:** STACK-10 (`runTransactionWithTenantSession` / `app.current_company_id`)

## Behavior

1. API `authenticate` tries **in-repo JWT** first (unchanged default).
2. When JWT verify fails and `clerkAuthParallelJwt` is **true** with `CLERK_SECRET_KEY` set, API verifies a **Clerk session token** (`@clerk/backend`). Tests mock `@clerk/backend`; do not use live Clerk keys in CI.
3. Clerk `org_id` (or nested `o.id`) maps to `companies.settings.clerk.organizationId` (`CompanySettings.clerk` in `@fsm/types`).
4. Staff user resolved by stored `users.clerk_user_id` (= `sub`), else linked once by Clerk-**verified** email to an active, unlinked, non-tombstoned user in the company (`resolveStaffUserForClerkSession`). There is **no** first-user fallback: anything else is 401.
5. **Tenant session on writes (flag-gated):** when `tenantSessionScopedWrites` is **true**, critical service writes run through `runTenantAwareTransaction`, which sets `SET LOCAL app.current_company_id` via `runCompanyScopedTransaction` / `runTransactionWithTenantSession`. When **false** (default), behavior matches legacy `runTransactionWithRetry` / `db.transaction`.

## API surfaces

| Surface | Path | Purpose |
| --- | --- | --- |
| Auth plugin | `apps/api/src/plugins/authenticate.ts` | JWT then Clerk parallel path |
| Clerk verify | `apps/api/src/lib/clerk-auth.ts` | Token verify + org claim extraction |
| Org → company | `apps/api/src/services/clerk-tenant.service.ts` | `settings.clerk.organizationId` lookup |
| Scoped writes | `apps/api/src/lib/company-scoped-transaction.ts` | `runTenantAwareTransaction` / `runCompanyScopedTransaction` |
| Request hook | `apps/api/src/plugins/company-scoped-write.ts` | `request.runCompanyScopedTransaction(callback)` after authenticate |

### Critical write paths (tenant-aware)

These use `runTenantAwareTransaction(companyId, …)` today:

- `createCustomer` — `customer.service.ts`
- `createJob` — `job.service.ts`
- `updateCompany` — `company.service.ts` (includes Clerk org mapping in `settings`)

Route handlers should prefer `await request.runCompanyScopedTransaction(async (tx) => { … })` for new multi-table writes when authenticated.

## Env

| Variable | Required | Notes |
| --- | --- | --- |
| `CLERK_SECRET_KEY` | When `clerkAuthParallelJwt` on | Empty disables Clerk verify path |
| `CLERK_AUTHORIZED_PARTIES` | When `isClerkAzpRequired()` is true | Comma-separated frontend origins allowed as the token `azp`; see below |
| `CLERK_WEBHOOK_SECRET` | For `POST /api/v1/webhooks/clerk` | Svix signing secret of the Clerk webhook endpoint |

## Feature flags

| Flag | Default | Effect |
| --- | --- | --- |
| `clerkAuthParallelJwt` | `false` | Accept Clerk session JWT after in-repo JWT fails |
| `tenantSessionScopedWrites` | `false` | Use tenant GUC on `runTenantAwareTransaction` / request scoped helper |

## Tests (no live Clerk)

```bash
pnpm exec vitest run \
  apps/api/src/lib/clerk-auth.test.ts \
  apps/api/src/lib/clerk-company-settings.test.ts \
  apps/api/src/lib/company-scoped-transaction.test.ts \
  apps/api/src/services/clerk-tenant.service.test.ts \
  apps/api/src/plugins/authenticate.test.ts
```

`verifyToken` and Clerk availability are mocked; org mapping tests use in-memory fake DB + `settings.clerk.organizationId`.

## Cutover

1. Enable `clerkAuthParallelJwt` in staging with Clerk dev instance and company `settings.clerk.organizationId` populated.
2. Enable `tenantSessionScopedWrites` when STACK-10 RLS policies are on Neon staging.
3. Keep JWT parallel until Clerk org provisioning and user mapping are complete; then flip default auth in a follow-up ADR addendum.

## Clerk session-token template (FS-159)

Configure in Clerk Dashboard → **Sessions → Customize session token**. Copy-paste exactly:

```json
{
  "email": "{{user.primary_email_address}}",
  "email_verified": "{{user.primary_email_address.verified}}",
  "metadata": "{{user.public_metadata}}"
}
```

Rules:

- Map only `public_metadata` (server-controlled). **Never** map `unsafe_metadata`; the API never reads it.
- Do **not** add a top-level `role` claim. Web (#184) also accepts a top-level `role`, but the API reads only `metadata.role`.
- `sub`, `azp`, and `org_id` (or nested `o.id`) are Clerk default claims; do not override them.
- The staff role lives in the Clerk user's public metadata as `{"role": "owner" | "admin" | "dispatcher" | "office" | "technician"}`.

### How the API uses the claims (`apps/api/src/lib/clerk-auth.ts`)

| Claim | Used for |
| --- | --- |
| `sub` | Clerk user id; mapped to `users.clerk_user_id` first (`resolveStaffUserForClerkSession`). Missing → 401. |
| `org_id` / `o.id` | Mapped to `companies.settings.clerk.organizationId`. Missing → 401. |
| `email` + `email_verified` | Verified-email linking. The email is used only when `email_verified` is `true` (boolean or the string `"true"`); it is trimmed and lowercased. An unlinked, active same-company user with `clerk_user_id IS NULL` and no tombstone (`clerk_unlinked_at IS NULL`) is linked once by a conditional update. Otherwise the email is null and an unlinked session is rejected (401). |
| `metadata.role` | `extractClerkRoleClaim` → `CLERK_ROLE_CLAIM` (`"metadata.role"`). Only the five known roles are accepted; anything else is `null`. |
| `azp` | Authorized-party check (below). |

### `CLERK_AUTHORIZED_PARTIES` (azp check)

- Parsed by `parseClerkAuthorizedParties`: comma-separated, trimmed, trailing `/` stripped. Example: `https://app.example.com,https://staging.example.com`.
- When the list is non-empty it is passed to `verifyToken({ authorizedParties })`, and the API also requires `payload.azp` (trailing `/` stripped) to be in the list. Missing or unlisted `azp` → 401.
- `isClerkAzpRequired()` is true when the `clerkAuthParallelJwt` flag is on, the deployment tier is `staging` (`isClerkAuthParallelJwtEnabled`), or `NODE_ENV=production`. In that case an **empty** list fails closed: every Clerk token is rejected with 401.
- The parsed origins are also added to the API CORS allow-list (`app.ts`).

### Webhook events to subscribe

Endpoint: `POST /api/v1/webhooks/clerk` (Svix-signed with `CLERK_WEBHOOK_SECRET`). Subscribe to the events below.

**Dedupe (#195, `lib/webhook-dedupe.ts`, keyed on `svix-id`):** a delivery first claims the message with a 5-minute processing lease (`PROCESSING_TTL_SECONDS`). On success the claim becomes a `done` marker kept for 24h (`DONE_TTL_SECONDS`). On handler failure the claim is released so Svix's retry can process it. A repeat of a completed message returns `200 {"received": true, "duplicate": true}`. A delivery that overlaps one still processing returns `409 IN_PROGRESS`, so Svix retries later.


| Event | API behavior |
| --- | --- |
| `user.created` | Acknowledged and ignored (no organization yet; the owner is provisioned on membership). |
| `user.updated` | `syncClerkUserUpdated`: syncs the verified primary email to the user linked by `clerk_user_id`. If no user is linked, it links an active, unlinked, non-deleted user whose email equals the verified primary email. Tombstoned users (`clerk_unlinked_at` set) are skipped with a warning. |
| `user.deleted` | `deactivateClerkUser`: `is_active = false`, `clerk_user_id = NULL`, tombstone `clerk_unlinked_at = COALESCE(clerk_unlinked_at, now())`. Logs `clerk_last_owner_deactivated` only if the user was active before the event and no other active, non-deleted owner/admin remains in the company. |
| `organization.created` | `provisionClerkOrganization`: creates the company. |
| `organization.updated`, `organization.deleted` | Currently acknowledged and ignored; subscribe so future handlers need no Clerk change. |
| `organizationMembership.created` | `provisionClerkMembership`: creates or links the staff user (never links by email, since the payload has no verification proof). |
| `organizationMembership.updated` | Currently acknowledged and ignored. |
| `organizationMembership.deleted` | `deactivateClerkMembership`: deactivates the member in that company. |

## Runbook

### (a) Relink a tombstoned user

After `user.deleted`, the user has `clerk_unlinked_at` set and `clerk_user_id = NULL`, and every auto-link path skips them: the session verified-email fallback, the `user.updated` verified-email link, and the `organizationMembership.created` webhook. Confirm the target user, company, and the new Clerk user id with the company owner first.

**Preferred: the admin relink route (FS-165).** An active owner/admin of the target's company calls:

```http
POST /api/v1/users/:id/clerk-relink
Authorization: Bearer <owner/admin session>
Content-Type: application/json

{ "clerkUserId": "user_...", "confirmOverwrite": false, "reactivate": false }
```

- The company comes from the auth context only. A target in another company, soft-deleted, or missing → **404**.
- **Role rules:** only owners and admins can call it (others → **403**). Only an **owner** may relink an owner or admin target; an admin may relink only lower roles (dispatcher, office, technician). Relinking **yourself** is refused → **403**.
- It sets `clerk_user_id` and clears `clerk_unlinked_at` in one tenant-aware transaction. **Active status is unchanged** unless the body sends `"reactivate": true`, which is the only way this route reactivates a user.
- If another user (any company) holds the Clerk id, or a 23505 race fires → **409**, nothing changes. The UPDATE also requires `clerk_user_id` to still equal the value read in the transaction (null-safe); a concurrent change → **409**.
- If the target is already linked to a **different** Clerk id → **409** unless `confirmOverwrite: true`. The overwrite then **revokes the user's refresh tokens** and is logged at warn with old → new ids. A plain tombstone relink revokes nothing.
- Repeating with the same id on an untombstoned user (and no reactivation needed) returns `{"status": "unchanged"}`.
- `clerkUserId` must match `^user_[A-Za-z0-9]+$` (max 255).
- Audit: a structured log line `audit: "clerk_user_relinked"` with `companyId`, `actorUserId`, `targetUserId`, `newClerkUserId` (plus `previousClerkUserId` on overwrite), `tombstoneCleared`, `reactivated`, plus `refreshTokensRevoked` on overwrite. Ids only, no emails. The manual SQL below must follow the same role rules: the requester must be an owner for owner/admin targets, and must not be the target.

**Fallback: manual SQL** (only if the route is unavailable):

Run it in an interactive `psql` session, passing the ids as variables (do not paste them into shared logs):

```bash
psql "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -v user_id='<users.id>' \
  -v company_id='<companies.id>' \
  -v clerk_user_id='<Clerk user id, user_...>'
```

Then run the following, reading each result before continuing:

```sql
BEGIN;

-- 1. The Clerk id must not belong to any other user (expect 0 rows).
SELECT id, company_id FROM users
WHERE clerk_user_id = :'clerk_user_id' AND id <> :'user_id';

-- 2. Inspect the target (expect 1 row, clerk_unlinked_at NOT NULL).
SELECT id, company_id, is_active, clerk_user_id, clerk_unlinked_at, deleted_at
FROM users WHERE id = :'user_id' AND company_id = :'company_id'
FOR UPDATE;

-- 3. Relink and clear the tombstone. Active status stays unchanged. Uncomment the is_active
--    line ONLY if reactivation is intended (the user should regain access).
UPDATE users
SET clerk_user_id = :'clerk_user_id',
    clerk_unlinked_at = NULL,
    -- is_active = true,
    updated_at = now()
WHERE id = :'user_id'
  AND company_id = :'company_id'
  AND deleted_at IS NULL
  AND clerk_unlinked_at IS NOT NULL;
-- Expect UPDATE 1.
```

Finish the transaction **by hand**. There is deliberately no `COMMIT` in the block above:

- Run `COMMIT;` only if step 1 returned 0 rows, step 2 returned exactly 1 row with `clerk_unlinked_at` set, and step 3 reported `UPDATE 1`.
- Otherwise run `ROLLBACK;`. This includes step 3 reporting `UPDATE 0` or failing with a 23505 unique violation (after an error the transaction is already aborted, so `ROLLBACK;` is the only option).

If step 1 returns a row, stop and `ROLLBACK`: resolve which user owns the Clerk id first. Record who ran it, the target user, and the company in the ops log (the manual path writes no audit line).

### (b) Duplicate Clerk org pre-deploy check (migration 0038)

Run on staging/prod before deploying 0038. This uses the exact predicate from migration 0038 (from PR #194); any rows mean the `companies_clerk_organization_id_idx` index will be skipped with a WARNING:

```sql
SELECT ("settings" -> 'clerk' ->> 'organizationId') AS org_id, count(*), array_agg("id") AS company_ids
FROM "companies"
WHERE "deleted_at" IS NULL AND ("settings" -> 'clerk' ->> 'organizationId') IS NOT NULL
GROUP BY ("settings" -> 'clerk' ->> 'organizationId')
HAVING count(*) > 1;
```

The migration does not exclude empty-string org ids. As a diagnostic only, add `AND ("settings" -> 'clerk' ->> 'organizationId') <> ''`.

**Runtime behavior while duplicates exist (#196, fail closed):** `findCompanyByClerkOrganizationId` in `clerk-tenant.service.ts` logs `logger.error({ alert: "clerk_org_ambiguous", clerkOrganizationId, companyIds })` and throws `ClerkOrganizationAmbiguousError`. As a result:

- Clerk sessions for that org get a generic **401**.
- Webhook provisioning and membership sync for that org return `skipped`.
- Other orgs are unaffected.

Alert on `clerk_org_ambiguous` (FS-163). For the rule spec and response, see [`docs/runbooks/clerk-alerts.md`](../runbooks/clerk-alerts.md).

After resolving duplicates, re-run (verbatim from 0038):

```sql
CREATE UNIQUE INDEX IF NOT EXISTS "companies_clerk_organization_id_idx" ON "companies" USING btree (("settings" -> 'clerk' ->> 'organizationId')) WHERE "deleted_at" IS NULL AND ("settings" -> 'clerk' ->> 'organizationId') IS NOT NULL;
```
