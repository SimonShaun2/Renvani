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

Defaults: **5** attempts, exponential backoff **5s**, `removeOnComplete: 1000`, **`removeOnFail: false`** (failed jobs remain on the source queue for inspection and `replayFailedJobById`).

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
| `replayFailedJobById` + worker CLI | Job is in **`failed`** state on the source queue; required `expectedCompanyId` guard |
| `recoverDeadLetterJob` | Job was forwarded to **`{queue}-dlq`**; re-enqueues payload to source with platform defaults |

## Replay tooling (Marcus)

- Library: `replayFailedJobById(queue, { queueName, jobId, expectedCompanyId })`
- CLI (staging/ops): `pnpm --filter @fsm/worker replay-failed-job -- --queue notifications --job-id <id> --company-id <uuid>`

## Wiring

- `apps/worker` `createWorker` → `failed` → `handleWorkerJobFailed` (gated on exhaustion).

## Acceptance traceability (v0.1)

| Criterion | Mechanism |
|-----------|-----------|
| Bounded retries | `PlatformQueueRetryPolicyV1.attempts` |
| Poison visible after exhaustion | DLQ envelope + `{queue}-dlq` |
| Safe replay on source queue | Tenant guard in `replayFailedJobById` |
| Idempotent side effects on retry | Existing processor idempotency (unchanged here) |

## Out of scope / blocked

- Cloud vendor DLQ (SQS, etc.), schema migrations, admin UI for DLQ browser.
- Alerting/metrics for DLQ depth (platform observability follow-up).
- FS-15 outbox alignment for every enqueue site.
- Live creds / payment / send in CI.
