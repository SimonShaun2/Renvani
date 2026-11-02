# FS-235 Clerk workspace intent contract

FS-235 gives workspace onboarding one authoritative, user-scoped create-or-resume path. The browser never creates a Clerk organization or chooses one by company name.

## API and browser flow

- `POST /api/v1/onboarding/workspace-intent` accepts only `{ "name": string }`. The API derives the Clerk user ID from a verified organization-free token and rejects sessions that already carry an active organization. A pending intent enqueues the one-shot create job; a claimed or uncertain intent enqueues reconciliation instead.
- `GET /api/v1/onboarding/workspace-intent` returns only the caller's active intent. Neither route accepts a user, intent, organization, owner, or tenant ID from the client.
- Intent states are `pending`, `claimed`, `uncertain`, and `reconciled`. Only a reconciled response includes `organizationId`.
- The web step polls this record, activates only its reconciled organization, refreshes the Clerk token, and then waits for the existing company-status endpoint. Account changes cancel stale polling and activation.

## One-attempt worker boundary

The `clerk-workspace-create` job runs on the existing webhooks queue with `attempts: 1`. Before any provider call, the worker atomically changes `pending` to `claimed`, stores an immutable attempt ID, and writes `workspace.attempt_claimed`. Only that successful compare-and-set permits the Clerk call.

The Clerk adapter creates the organization with:

- `createdBy = clerkUserId`
- private metadata `renvaniIntentId`
- private metadata `renvaniAttemptId`

The returned Backend API organization must match the durable user, intent, and attempt markers. A provider error or untrusted response changes the intent to `uncertain` and enqueues reconciliation; it never rearms creation.

## Reconciliation and webhook ordering

The retryable `clerk-workspace-reconcile` job pages through every organization membership for the verified user, fetches each organization through the secret-key Backend API, and accepts exactly one organization whose creator and private markers match. Zero or multiple matches fail closed. Authenticated retries and signed webhook replays request reconciliation for the same durable user-scoped intent. A deterministic per-intent job ID reuses any active reconciliation job; after its bounded attempts are exhausted, the retained failed job is reset and retried in place, preserving failure evidence until success. No retry creates a second Clerk organization or unbounded fresh reconciliation jobs; unresolved cases remain explicit and retryable. A matching observation compare-and-sets `claimed` or `uncertain` to `reconciled` and records `workspace.organization_reconciled`.

Signed organization and membership webhooks for an unreconciled intent are recorded by Svix ID without retaining names or email addresses, enqueue reconciliation, return `503`, and release the short webhook-dedupe claim. After reconciliation:

- the matching organization proceeds through the existing tenant-safe provisioning service;
- a different organization is recorded as denied and acknowledged with `2xx`;
- membership-first delivery cannot create a tenant or choose an owner;
- only the recorded Clerk organization creator can receive the owner role.
- an organization event without a creator fails closed and cannot create an ownerless tenant;
- company creation and staff grants write tenant-scoped activity events in the same transaction.

The existing creator-already-linked guard remains authoritative and prevents a Clerk user already attached to one company from creating an orphan second tenant.

## Persistence and verification gates

Migration `0061_fs235_clerk_workspace_intent.sql` follows the integrated `0060` migration. The user, attempt, and Clerk organization identifiers are independently unique. Intent and audit queries exclude soft-deleted rows.

Local unit tests cover duplicate requests, one-shot creation, uncertain recovery, paginated reconciliation, marker mismatch, unordered/replayed webhooks, cross-tenant guards, terminal mismatch acknowledgment, browser retry, and account switching. The conditional Postgres test verifies concurrent claim serialization when `NEON_CI_DATABASE_URL` is available. Live Clerk verification, exact-head independent review, Security, QA, and approved batch CI remain release gates.
