import {
  FIELD_WORK_SYNC_CONTRACT_VERSION,
  type FieldWorkSyncOperationInput,
  type SubmitFieldWorkSyncBatchBody,
  type SubmitFieldWorkSyncBatchResponse
} from "@fsm/types";

/**
 * FS-180: tiny offline queue for technician field work, flushed through the
 * existing POST /api/v1/field-work/sync/batches contract. Only note appends are
 * queued for now (they need no baseRecordVersion). Nothing sensitive is stored.
 */

const QUEUE_KEY = "renvani.fieldWork.queue.v1";
const DEVICE_KEY = "renvani.fieldWork.deviceId";

export interface QueuedNoteOperation {
  clientOperationId: string;
  jobId: string;
  type: "job.note.append";
  payload: { content: string };
  queuedAt: string;
}

export interface FlushResult {
  applied: number;
  rejected: Array<{ clientOperationId: string; message: string }>;
  remaining: number;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getDeviceId(): string {
  const store = storage();
  const existing = store?.getItem(DEVICE_KEY);
  if (existing) {
    return existing;
  }
  const created = `web-${newId()}`;
  store?.setItem(DEVICE_KEY, created);
  return created;
}

export function readQueue(): QueuedNoteOperation[] {
  const raw = storage()?.getItem(QUEUE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as QueuedNoteOperation[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedNoteOperation[]) {
  storage()?.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueueNote(jobId: string, content: string): QueuedNoteOperation {
  const operation: QueuedNoteOperation = {
    clientOperationId: newId(),
    jobId,
    type: "job.note.append",
    payload: { content },
    queuedAt: new Date().toISOString()
  };
  writeQueue([...readQueue(), operation]);
  return operation;
}

export function buildSyncBatch(queue: QueuedNoteOperation[], deviceId: string, batchClientId: string): SubmitFieldWorkSyncBatchBody {
  const operations: FieldWorkSyncOperationInput[] = queue.slice(0, 200).map((operation, index) => ({
    sequence: index + 1,
    clientOperationId: operation.clientOperationId,
    jobId: operation.jobId,
    type: operation.type,
    payload: operation.payload
  }));
  return {
    contractVersion: FIELD_WORK_SYNC_CONTRACT_VERSION,
    deviceId,
    batchClientId,
    operations
  };
}

/**
 * Sends queued operations. Applied/duplicate ops leave the queue; rejected or
 * conflicting ops are dropped and reported; on network failure the queue is kept.
 */
export async function flushQueue(
  post: (body: SubmitFieldWorkSyncBatchBody) => Promise<SubmitFieldWorkSyncBatchResponse>
): Promise<FlushResult> {
  const queue = readQueue();
  if (queue.length === 0) {
    return { applied: 0, rejected: [], remaining: 0 };
  }
  const batch = buildSyncBatch(queue, getDeviceId(), newId());
  const response = await post(batch);
  const settled = new Set<string>();
  const rejected: FlushResult["rejected"] = [];
  let applied = 0;
  for (const result of response.results) {
    settled.add(result.clientOperationId);
    if (result.outcome === "applied" || result.outcome === "duplicate") {
      applied += 1;
    } else {
      rejected.push({ clientOperationId: result.clientOperationId, message: result.message ?? result.outcome });
    }
  }
  const remaining = readQueue().filter((operation) => !settled.has(operation.clientOperationId));
  writeQueue(remaining);
  return { applied, rejected, remaining: remaining.length };
}
