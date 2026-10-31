# Field work sync API (FS-87) — v1.0.0

Offline-safe batch sync for field technicians. Provider-neutral contract for web and future mobile clients.

## Endpoint

`POST /api/v1/field-work/sync/batches`

**Auth:** Bearer JWT (`owner`, `admin`, `dispatcher`, or `technician`).

**Technician scope:** Technicians may only sync operations for jobs assigned to their technician profile.

## Request body

| Field | Description |
| --- | --- |
| `contractVersion` | Must be `1.0.0` |
| `deviceId` | Stable device identifier (1–128 chars) |
| `batchClientId` | Client-owned batch id for durable queue grouping |
| `resumeBatchId` | Optional server `batchId` when resuming after interruption |
| `operations` | Ordered operations (1–200) |

Each operation includes:

- `sequence` — monotonic within the batch (used for resume acknowledgments)
- `clientOperationId` — idempotency key (unique per company)
- `jobId` — target job
- `type` — see below
- `baseRecordVersion` — required for optimistic-lock types (`rv1:{entityType}:{entityId}:{iso8601}`)
- `payload` — type-specific

### Operation types

| Type | Conflict policy | `baseRecordVersion` |
| --- | --- | --- |
| `job.status.update` | Reject stale job version | Job |
| `job.note.append` | Safe merge (append) | Not required |
| `job.task.update` | Reject stale task version | `job_task` |
| `job.signature.capture` | Reject stale job or differing existing signature | Job |

`job.signature.capture` payload: `{ signedByName, attachmentId }` (preferred) or legacy `{ signedByName, signatureUrl }` — exactly one. `attachmentId` must be a PNG/JPEG/WebP attachment (≤5 MB) on the same job in the same company, otherwise the op is `rejected` with `code: "SIGNATURE_ATTACHMENT_INVALID"`. The server stores an internal object reference; job reads return a short-lived signed URL in `signatureUrl` (legacy full URLs are returned unchanged).
| `job.media.register` | Idempotent via `clientOperationId` | Not required |

## Response

Returns `batchId`, `lastAcknowledgedSequence`, and per-operation `results` with `outcome`:

- `applied` — mutation committed
- `duplicate` — same `clientOperationId` replayed with identical payload
- `conflict` — includes `conflict.liveRecordVersion` and `reason`
- `rejected` — authorization or validation failure for that operation, or **same `clientOperationId` with a different payload** (no silent overwrite)

Conflict resolution helpers live in `@fsm/types` (`field-work-sync/v1/conflict.ts`).

## Local storage (client guidance)

- Persist the outbound queue encrypted at rest; do not store full customer PII beyond what is required for the active job packet.
- Retain `clientOperationId`, `batchClientId`, `deviceId`, and last server `batchId` until acknowledged.
- On connectivity restore, submit pending operations; rely on idempotent replay rather than generating new client ids.

## Resume

1. Submit remaining operations with the same `deviceId` + `batchClientId` (and optional `resumeBatchId`).
2. Already-acknowledged `clientOperationId` values return `duplicate` without side effects.
3. Advance using `lastAcknowledgedSequence` from the response.
