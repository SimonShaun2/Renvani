# FS-81 — Queue retries, dead-letter, and replay (v0.1)

**Ticket:** FS-81  
**Owner:** Pair 1 (Ava — platform contract + DLQ wiring; Marcus — replay tooling + tests)  
**Status:** PROPOSED on `cursor/fs-81-queue-retry-dlq-18af`  
**Blocked by:** [FS-93](https://app.notion.com/p/401317b92d1581bf8c25ef10aebae676) for vendor/SaaS queue choice (BullMQ + Redis today only)

## Objective

One enqueue retry policy across all platform queues, provider-neutral types, dead-letter forwarding after retries are exhausted, and safe operator replay—without third-party queue observability vendors.

## Single enqueue default

| Concern | Source of truth |
|---------|-------------------|
| Policy schema | `PlatformQueueRetryPolicyV1` in `packages/types/src/queue-platform/v0/` |
| BullMQ mapping | `platformDefaultJobOptions()` in `packages/jobs/src/queue-retry-policy.ts` |
| Platform queues | `createPlatformQueue` in `packages/jobs/src/queues.ts` uses **`platformDefaultJobOptions()`** only |
| Call-site helper | `buildDefaultEnqueueJobOptions()` delegates to the same mapping (no parallel constants) |

Defaults: **5** attempts, exponential backoff **5s**, `removeOnComplete: 1000`, **`removeOnFail: false`** (failed jobs remain on the source queue for inspection).

Workers: Redis connection + prefix `fsm`, concurrency **5** via `buildDefaultWorkerOptions()`.

## Dead-letter path (durable poison visibility)

After the last failed attempt, `handleWorkerJobFailed` (worker `failed` event) forwards a snapshot when `isJobExhausted(job)`:

| Piece | Location |
|-------|----------|
| DLQ queue name | `{sourceQueue}-dlq` |
| Envelope | `DeadLetterJobEnvelopeV1` (`buildDeadLetterEnvelope`) |
| Failure class | `classifyJobFailureV1` — transient / permanent / unknown |
| Forward | `forwardJobToDeadLetter` |
| Re-enqueue from DLQ | `recoverDeadLetterJob(sourceQueue, request)` — programmatic recovery |

Source-queue replay (failed job still in Redis) vs DLQ recovery:

| Flow | When to use |
|------|-------------|
| `replayFailedJobById` + worker CLI | Break-glass replay for a **non-exhausted** failed source job only; refuses jobs that already have a retained DLQ copy |
| `recoverDeadLetterJob` | Sole recovery authority after exhaustion; the authenticated internal-admin endpoint re-enqueues the DLQ payload with platform defaults |

## Replay tooling (Marcus)

- Library: `replayFailedJobById(queue, { queueName, jobId, expectedCompanyId, requestedByUserId, reason })`.
- The company ID is an equality guard, not authorization. Tenant ownership is checked before job state is read.
- The CLI is disabled unless validated config sets `SOURCE_QUEUE_REPLAY_ENABLED=true`. Enable it only in a restricted, audited trusted-operations shell whose Redis credential is not available to application users.
- CLI: `pnpm --filter @fsm/worker replay-failed-job -- --queue notifications --job-id <id> --company-id <uuid> --operator-id <uuid> --reason "<10-500 chars>"`.
- Successful CLI output emits a structured `queue.source_replayed` audit record. The operations platform must retain stdout; the caller-supplied operator ID and reason provide attribution but do not replace shell authentication. Reasons must contain no secrets, tokens, customer data, or other PII because they are emitted verbatim to the retained audit log.
- Exhausted jobs return `DEAD_LETTER_ONLY`; recover them through the authenticated internal-admin DLQ endpoint. This prevents the retained source job and its DLQ copy from both becoming runnable.

## Wiring

- `apps/worker` `createWorker` → `failed` → `handleWorkerJobFailed` (gated on exhaustion).

## Acceptance traceability (v0.1)

| Criterion | Mechanism |
|-----------|-----------|
| Bounded retries | `PlatformQueueRetryPolicyV1.attempts` |
| Poison visible after exhaustion | DLQ envelope + `{queue}-dlq` |
| Safe replay on source queue | Trusted-ops gate, canonical tenant/operator UUIDs, tenant-before-state check, bounded attempt budget, structured audit output |
| Single recovery authority after exhaustion | Source replay rejects exhausted jobs; authenticated DLQ recovery is the only recovery path |
| Idempotent side effects on retry | Not claimed here; processor/outbox idempotency remains required under FS-15 |

## Out of scope / blocked

- Cloud vendor DLQ (SQS, etc.), schema migrations, admin UI for DLQ browser.
- Alerting/metrics for DLQ depth (platform observability follow-up).
- FS-15 outbox alignment and durable side-effect claims for every enqueue site.
- Live creds / payment / send in CI.
