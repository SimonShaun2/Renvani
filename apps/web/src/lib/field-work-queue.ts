import {
  FIELD_WORK_SYNC_CONTRACT_VERSION,
  type FieldWorkSyncOperationInput,
  type SubmitFieldWorkSyncBatchBody,
  type SubmitFieldWorkSyncBatchResponse
} from "@fsm/types";

import { ApiError } from "./api";

/**
 * FS-180: tiny offline queue for technician field work, flushed through the
 * existing POST /api/v1/field-work/sync/batches contract. Only note appends are
 * queued for now (they need no baseRecordVersion). Nothing sensitive is stored.
 */

const LEGACY_QUEUE_KEY = "renvani.fieldWork.queue.v1";
const QUEUE_PREFIX = "renvani.fieldWork.queue.v2:";
const DEVICE_KEY = "renvani.fieldWork.deviceId";

/** The signed-in user + company that own a queue. Queues never cross users or tenants. */
export interface QueueOwner {
  userId: string;
  companyId: string;
}

function queueKey(owner: QueueOwner): string {
  return `${QUEUE_PREFIX}${owner.companyId}:${owner.userId}`;
}

function queueKeys(store: Storage): string[] {
  const keys: string[] = [];
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index);
    if (key && (key.startsWith(QUEUE_PREFIX) || key === LEGACY_QUEUE_KEY)) {
      keys.push(key);
    }
  }
  return keys;
}

/** Drops every queued op on this browser (call on sign-out). */
export function clearFieldWorkQueues(): void {
  const store = storage();
  if (!store) {
    return;
  }
  for (const key of queueKeys(store)) {
    store.removeItem(key);
  }
}

/** Removes queues (and the old unscoped key) that belong to anyone other than `owner`. */
function dropForeignQueues(store: Storage, owner: QueueOwner) {
  const own = queueKey(owner);
  for (const key of queueKeys(store)) {
    if (key !== own) {
      store.removeItem(key);
    }
  }
}

export interface QueuedNoteOperation {
  clientOperationId: string;
  userId: string;
  companyId: string;
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

export function readQueue(owner: QueueOwner): QueuedNoteOperation[] {
  const store = storage();
  if (!store) {
    return [];
  }
  dropForeignQueues(store, owner);
  const raw = store.getItem(queueKey(owner));
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    // Belt and braces: ignore any op not stamped with this user + company.
    return (parsed as QueuedNoteOperation[]).filter(
      (operation) => operation.userId === owner.userId && operation.companyId === owner.companyId
    );
  } catch {
    return [];
  }
}

function writeQueue(owner: QueueOwner, queue: QueuedNoteOperation[]) {
  const store = storage();
  if (!store) {
    return;
  }
  if (queue.length === 0) {
    store.removeItem(queueKey(owner));
  } else {
    store.setItem(queueKey(owner), JSON.stringify(queue));
  }
}

export function enqueueNote(owner: QueueOwner, jobId: string, content: string): QueuedNoteOperation {
  const operation: QueuedNoteOperation = {
    clientOperationId: newId(),
    userId: owner.userId,
    companyId: owner.companyId,
    jobId,
    type: "job.note.append",
    payload: { content },
    queuedAt: new Date().toISOString()
  };
  writeQueue(owner, [...readQueue(owner), operation]);
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
 * Network failures, timeouts, 408/429 and 5xx are worth retrying; any other
 * 4xx is permanent (bad note, no access, contract mismatch) and must not block the queue.
 */
export function isRetryableSyncError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status >= 500 || error.status === 408 || error.status === 429;
  }
  return true;
}

type PostBatch = (body: SubmitFieldWorkSyncBatchBody) => Promise<SubmitFieldWorkSyncBatchResponse>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Rejected";
}

/**
 * Sends queued operations. Applied/duplicate ops leave the queue; rejected ops
 * are dropped and reported. A retryable failure keeps the queue and rethrows.
 * A permanent 4xx on the batch is retried op by op so only the bad op is dropped.
 */
export async function flushQueue(owner: QueueOwner, post: PostBatch): Promise<FlushResult> {
  const queue = readQueue(owner);
  if (queue.length === 0) {
    return { applied: 0, rejected: [], remaining: 0 };
  }
  const deviceId = getDeviceId();
  const settled = new Set<string>();
  const rejected: FlushResult["rejected"] = [];
  let applied = 0;

  const record = (response: SubmitFieldWorkSyncBatchResponse) => {
    for (const result of response.results) {
      settled.add(result.clientOperationId);
      if (result.outcome === "applied" || result.outcome === "duplicate") {
        applied += 1;
      } else {
        rejected.push({ clientOperationId: result.clientOperationId, message: result.message ?? result.outcome });
      }
    }
  };
  const persist = () => {
    const remaining = readQueue(owner).filter((operation) => !settled.has(operation.clientOperationId));
    writeQueue(owner, remaining);
    return remaining.length;
  };

  try {
    record(await post(buildSyncBatch(queue, deviceId, newId())));
  } catch (error) {
    if (isRetryableSyncError(error)) {
      throw error;
    }
    for (const operation of queue.slice(0, 200)) {
      try {
        record(await post(buildSyncBatch([operation], deviceId, newId())));
      } catch (singleError) {
        if (isRetryableSyncError(singleError)) {
          persist();
          throw singleError;
        }
        settled.add(operation.clientOperationId);
        rejected.push({ clientOperationId: operation.clientOperationId, message: errorMessage(singleError) });
      }
    }
  }
  return { applied, rejected, remaining: persist() };
}
