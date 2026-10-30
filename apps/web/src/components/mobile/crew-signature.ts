import { buildRecordVersionV1, type SubmitFieldWorkSyncBatchBody, type SubmitFieldWorkSyncBatchResponse } from "@fsm/types";

export type SignaturePoint = { x: number; y: number };
export type SignatureStroke = SignaturePoint[];
export type SignatureState = "empty" | "drawing" | "saving" | "error" | "saved";

export const SIGNATURE_COPY = {
  back: "‹ Back",
  title: "Customer signature",
  signedBy: "Signed by",
  signHere: "✕  Sign here",
  readOnly: "Read-only",
  save: "Save signature",
  saving: "Saving…",
  savingNote: "Saving signature…",
  clear: "Clear",
  retry: "Retry",
  error: "We couldn't save the signature. Try again.",
  strokesKept: "Your strokes are kept.",
  saved: "✓ Signature saved",
  done: "Done",
  noJob: "Open this from a job to capture a signature."
} as const;

export function deriveSignatureState(input: { saved: boolean; saving: boolean; failed: boolean; strokes: number }): SignatureState {
  if (input.saved) return "saved";
  if (input.saving) return "saving";
  if (input.failed) return "error";
  return input.strokes > 0 ? "drawing" : "empty";
}

/** "J-4519 · No-heat diagnostic" (frame shows a third "Example" marker, which is annotation only). */
export function signatureJobLine(job: { jobNumber: string; title: string }): string {
  return [job.jobNumber, job.title].filter(Boolean).join(" · ");
}

/** "Dana Whitfield · Oct 29, 2026 · 11:58 AM" */
export function signatureMetaLine(name: string | null | undefined, signedAt: string | Date | null | undefined): string {
  const parts: string[] = [];
  if (name) parts.push(name);
  if (signedAt) {
    const d = new Date(signedAt);
    if (!Number.isNaN(d.getTime())) {
      parts.push(d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
      parts.push(d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
    }
  }
  return parts.join(" · ");
}

/** One `job.signature.capture` op on the existing field-work sync contract (#245). */
export function buildSignatureBatch(input: {
  jobId: string;
  /** Base for a fresh op; ignored when `baseRecordVersion` is given (e.g. liveRecordVersion after a conflict). */
  jobUpdatedAt?: string | Date;
  baseRecordVersion?: string;
  attachmentId: string;
  signedByName: string;
  deviceId: string;
  operationId: string;
}): SubmitFieldWorkSyncBatchBody {
  return {
    contractVersion: "1.0.0",
    deviceId: input.deviceId,
    batchClientId: `batch-${input.operationId}`,
    operations: [
      {
        sequence: 1,
        clientOperationId: input.operationId,
        jobId: input.jobId,
        type: "job.signature.capture",
        baseRecordVersion: input.baseRecordVersion ?? buildRecordVersionV1("job", input.jobId, new Date(input.jobUpdatedAt ?? Date.now())),
        payload: { attachmentId: input.attachmentId, signedByName: input.signedByName.trim() }
      }
    ]
  } as SubmitFieldWorkSyncBatchBody;
}

export function signatureBatchSucceeded(response: SubmitFieldWorkSyncBatchResponse): boolean {
  const outcome = response.results[0]?.outcome;
  return outcome === "applied" || outcome === "duplicate";
}

/** The op being sent: its client id and the base record version it was first sent with. */
export interface SignatureOp {
  id: string;
  base: string | null;
}

export type SignatureAttempt =
  | { kind: "saved" }
  /** conflict (sync outcome or HTTP 409): new op id, base = liveRecordVersion when the server gave one. */
  | { kind: "conflict"; liveRecordVersion: string | null }
  /** rejected (sync outcome or HTTP 400/422): new op id and a re-read base; replaying the same id would be rejected again. */
  | { kind: "rejected" }
  /** network / 5xx: nothing was decided, so the same op id and base are safe to replay. */
  | { kind: "transient" };

export function classifySignatureResponse(response: SubmitFieldWorkSyncBatchResponse): SignatureAttempt {
  const result = response.results[0];
  if (result?.outcome === "applied" || result?.outcome === "duplicate") return { kind: "saved" };
  if (result?.outcome === "conflict") return { kind: "conflict", liveRecordVersion: result.conflict?.liveRecordVersion ?? null };
  return { kind: "rejected" };
}

export function classifySignatureError(error: unknown): SignatureAttempt {
  const status = (error as { status?: unknown } | null)?.status;
  if (status === 409) {
    const payload = (error as { payload?: { liveRecordVersion?: unknown; conflict?: { liveRecordVersion?: unknown } } }).payload;
    const live = payload?.conflict?.liveRecordVersion ?? payload?.liveRecordVersion;
    return { kind: "conflict", liveRecordVersion: typeof live === "string" ? live : null };
  }
  if (status === 400 || status === 422) return { kind: "rejected" };
  return { kind: "transient" };
}

/** Which op the next retry sends. */
export function nextSignatureOp(current: SignatureOp, attempt: SignatureAttempt, newId: () => string): SignatureOp {
  if (attempt.kind === "conflict") return { id: newId(), base: attempt.liveRecordVersion };
  if (attempt.kind === "rejected") return { id: newId(), base: null };
  return current;
}
