# FS-235 Clerk workspace intent — reservation slice

This slice reserves one workspace creation intent per verified Clerk user. It does **not** create a Clerk organization, activate a session, provision a company, enqueue work, or make the existing browser creation path safe. Do not use its `reserved` response as proof that a workspace exists.

## API

- `POST /api/v1/onboarding/workspace-intent` accepts `{ "name": string }` (trimmed, 1–80 characters). A verified Clerk session token may have no organization claim. The server derives the user ID only from the verified token. The first request reserves the name; later same-user requests with that name return the same intent, and a different name returns `409 CONFLICT`.
- `GET /api/v1/onboarding/workspace-intent` returns `{ "intent": null }` or the caller's reserved intent. Neither route accepts a user ID, intent ID, or tenant ID from the client. Both set `Cache-Control: no-store`.
- The response is `{ "intent": { "id": uuid, "requestedName": string, "status": "reserved", "createdAt": ISO date } }`. The response deliberately contains no organization or company ID.

## Persistence and future boundary

`clerk_workspace_intents.clerk_user_id` is unique and immutable. The service takes a transaction-scoped advisory lock keyed by the verified Clerk subject, inserts the intent, and writes `clerk_workspace_intent_events` in that transaction. These two tables are pre-tenant identity bootstrap records, scoped by Clerk subject because no company exists yet. The later verified-org reconciliation slice must bind a company, emit tenant `activity_events`, and document the transition before exposing authoritative tenant access.

Before a worker ever calls Clerk, it must durably claim this intent. An uncertain external call must not be blindly retried. The later slice must verify the creator and intent marker, reconcile webhook order, and grant owner access only to the verified creator. The current browser `createOrganization` path in #275/#300 must be replaced before this contract can prevent duplicate Clerk organizations.

Migration `0055_fs235_clerk_workspace_intent.sql` intentionally avoids the `0054` filename used by open PR #271. Its journal position must be reconciled with #271 before either migration is integrated. Drizzle Kit's normal generation hit a pre-existing snapshot parent collision; the custom migration scaffold was generated with Drizzle Kit and populated as an unapplied migration.
