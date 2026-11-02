# ADR-FS-234: Authoritative outbound consent ledger

**Status:** Product and Technical Lead approved for bounded schema/service implementation; Security, migration, QA, and integration gates pending
**Proposed by:** BE1B
**Date:** 2026-10-28 CT
**Ticket:** [FS-234](https://app.notion.com/p/408317b92d1581d99a23d3780264ae89)
**Depends on:** FS-233 / [PR #301](https://github.com/SimonShaun2/Renvani/pull/301); reconcile [PR #298](https://github.com/SimonShaun2/Renvani/pull/298) preview

## Problem and current approach

Revenue execution needs an affirmative grant for the exact tenant, recipient, channel, and purpose. Customer `prefersEmail`, `prefersSms`, and `doNotContact=false` are preferences, not grants. `booking_requests` contains SMS appointment and marketing booleans but no email grant, consent-specific version, provenance, or reliable revocation order. Its `updated_at` changes for unrelated scheduling work. FS-233 conservatively denies conflicting SMS inquiry histories and all email; it is a temporary safety boundary, not a consent system. Proposal snapshots are historical and must not authorize execution.

## Proposed contract

Use a **current state row plus append-only decision events**. A missing state row means unknown and denies. A preference never creates or renews a grant. The backend owns all writes and emits `activity_events` in the same transaction.

### Canonical schema proposal

Add these tables only to `packages/db/src/schema.ts`, with a generated, unapplied migration after a migration slot is assigned. Both carry UUID `id`, `companyId`, `createdAt`, `updatedAt`, and nullable `deletedAt` per repository rules. Consent rows are never hard-deleted; a revoke event changes current state. Both tables require tenant RLS enabled and forced, in addition to service-layer tenant predicates.

| Table | Fields and constraints |
| --- | --- |
| `outbound_consent_states` | `subjectType` (`customer` or `booking_request`), `subjectId` UUID, `channel` (`email` or `sms`), `purpose` (`appointment` or `marketing`), normalized `contact` (email lowercase/trimmed; SMS E.164), `state` (`granted` or `revoked`), `version` bigint, `decidedAt` database timestamp, `source` and `statementVersion`, `lastEventId`. Unique active key `(companyId, subjectType, subjectId, channel, purpose, contact)`. Index `(companyId, subjectType, subjectId)` for execute-time lookup. |
| `outbound_consent_events` | The same key, `decision` (`grant` or `revoke`), per-key `version`, `occurredAt` database timestamp, source kind and source record ID, statement/copy version, actor type and ID, evidence reference, idempotency key, and prior/current state. Unique `(companyId, subjectType, subjectId, channel, purpose, contact, version)` and unique tenant-scoped idempotency key. Events are append-only; access is restricted and audited because contact/evidence are sensitive. |

The service locks the state key, increments its version, inserts an event, updates the state row, and emits an activity event in one transaction. Concurrent first writes need an insert-conflict retry or equivalent per-key serialization. An event timestamp is evidence; the state version determines order. A new grant after revocation requires a new affirmative capture with current statement copy and provenance. Revocation must be possible from the operator and inbound channel controls and must never be inferred from a proposal edit.

### Identity and evaluation

The current outbound destination must exactly match the normalized contact on the state row. The tenant and subject must match. Booking-to-customer linkage does not silently transfer consent: an explicit, audited transfer with verified destination and source evidence is needed, or the customer captures a new grant. A changed email or phone requires new consent for that destination. Do not use customer preferences or imported historical flags to populate affirmative state without verified source evidence.

At proposal execution, resolve purpose from the registered action type, resolve the actual destination and target under the authenticated tenant, and read the current state. Require `granted`, correct channel/purpose/contact, and current customer contact restrictions. Ignore embedded snapshots except as audit evidence. Before any future provider enqueue and again immediately before provider handoff, recheck state and version; a queued version mismatch or revoked/missing row blocks the send and records the reason. The worker remains idempotent. A provider handoff racing with a later revocation cannot be retroactively recalled; log the exact checked version and handoff time for audit. No live provider send is part of this ticket.

PR #298's read-only preview should report **“eligible at check time; rechecked on execution”** rather than an unconditional `allowed` authorization. Preview uses the same evaluator and never issues a send token. Invalid scope/channel remains blocked rather than silently defaulting to SMS or marketing.

## Capture and rollout

Product Owner and Legal must approve separate, plain-language appointment and marketing copy for email and SMS. Public inquiry and operator surfaces submit explicit unchecked choices, destination, purpose, statement version, and source record. The API validates them with shared Zod contracts and writes through one service. Capture should be independent of the general customer preference fields. Until capture and ledger reads are verified, email and unknown/conflicting SMS remain denied. No automatic grant backfill from defaults, imports, existing inquiry booleans, or proposal snapshots. A later evidence-backed migration can be reviewed separately.

## Ownership and verification

BE1A owns the versioned contract and schema decision with the Technical Lead; BE1B can implement the ledger service and negative tests after that decision. Product Owner owns capture copy and acceptance; Security reviews RLS, provenance, revocation, and send races; UI and #298 owners consume the contract. Coordinate the migration number with current open schema PRs before generation. Test missing/default grant, wrong purpose/channel/contact, revoked-after-proposal, re-grant, forged snapshot, duplicate/idempotent capture, concurrent grants and revokes, deleted or other-tenant subjects, cross-tenant IDs, and a queued action revoked before provider handoff. Use PostgreSQL for concurrency/RLS evidence as well as focused unit and route tests.

## Benefit, cost, and impact

This provides an auditable email-first grant path and removes mutable inquiry timestamps from authorization. It adds two tenant-scoped tables, a write service, API contracts, capture UI, worker checks, migration/RLS review, and monitoring for blocked sends and stale queue items. Consent contact data is sensitive PII: restrict reads, avoid logging raw destinations, define retention/export behavior, and include it in support access audit. The indexed state lookup adds one bounded query to execute-time authorization.

## Alternatives considered

- **Latest booking request:** `updatedAt` is not a consent clock; rescheduling can revive an older grant.
- **Customer boolean columns:** no per-contact, per-channel, per-purpose provenance or ordered revocation history.
- **Proposal snapshot as authorization:** mutable or stale proposal data can override revocation.
- **Append-only events without current state:** selecting the latest event under concurrent writes is harder to serialize and check efficiently; the state row provides a locked, versioned authority while events preserve history.

## Decision and open points

Product Owner approved exact tenant/subject/destination/channel/purpose grants and retention outreach as `marketing` in [FS-234 decision](https://app.notion.com/p/408317b92d1581d99a23d3780264ae89?d=40c317b92d1581be9f71001cfae517ff&pvs=42). Technical Lead approved a tenant-scoped current row plus append-only events, locked per-key ordering, exact idempotency replay, forced RLS, atomic activity event, active-subject and provider-boundary version rechecks in the same [ticket discussion](https://app.notion.com/p/408317b92d1581d99a23d3780264ae89?d=40c317b92d1581be9f71001cfae517ff&pvs=42). Booking-to-customer transfer requires separate verified evidence and is outside this implementation. Product/Legal copy remains required before public capture or send rollout. No grant backfill or live send is approved.

E.. CoS reserved generated migration `0062` only after FS-235 PR #411's `0061` integrates unchanged. This branch carries a schema model and service contract without migration or activation. After `0061` merges, merge current `dev`, generate `0062` with forced tenant RLS and append-only privileges, then run real-PostgreSQL concurrency/RLS tests and exact-head peer, QA, Security, approved CI, and E.. CoS gates. Email and unknown/conflicting SMS stay fail-closed until that work is complete.

### Evidence-source gate after independent review

The current repository has no immutable, server-verifiable affirmative consent capture or inbound/operator revocation record containing the full tenant, subject, destination, channel, purpose, statement copy, actor, and source reference. Existing booking SMS booleans, customer preferences, and activity event IDs cannot establish that tuple. The ledger writer now accepts only an intent and trusted authentication context; its persisted-evidence resolver deliberately returns no evidence, so every grant/revoke fails closed before database mutation. Product Owner and Technical Lead must designate the authoritative persisted source and verification rules for public capture, customer/inbound revocation, and operator revocation before enabling writes. This is a specific contract decision, not permission to backfill, synthesize grants, or add an alternative capture architecture.
