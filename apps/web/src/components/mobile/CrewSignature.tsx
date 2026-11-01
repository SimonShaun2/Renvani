"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { JobDetail, SubmitFieldWorkSyncBatchResponse } from "@fsm/types";

import { useJob } from "@/src/hooks/jobs.hooks";
import { api } from "@/src/lib/api";
import { getDeviceId } from "@/src/lib/field-work-queue";
import { uploadFile } from "@/src/lib/upload";

import styles from "./crew-signature.module.css";
import {
  SIGNATURE_COPY,
  buildSignatureBatch,
  deriveSignatureState,
  signatureBatchSucceeded,
  signatureJobLine,
  signatureMetaLine,
  type SignatureStroke
} from "./crew-signature";

const PAD_HEIGHT = 200;
const btnBase = "flex w-full items-center justify-center gap-2 rounded-[12px] py-[14px] text-[15px] font-semibold";
const btnPrimary = `${btnBase} bg-[#f6b400] text-[#0f1530]`;
const btnSecondary = `${btnBase} border border-[#e6dccb] bg-white text-[#0f1530]`;
const btnDisabled = `${btnBase} bg-[#eef0f5] text-[#9aa0b4]`;

function newOperationId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `sig-${Date.now()}`;
}

function canvasToFile(canvas: HTMLCanvasElement): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(new File([blob], "signature.png", { type: "image/png" })) : reject(new Error("empty"))), "image/png");
  });
}

/** Figma 303:87 "Crew / Technician signature": states 303:88 / 303:111 / 303:136 / 303:165 / 303:193. */
export function CrewSignature({ jobId }: { jobId: string | null }) {
  const jobQuery = useJob(jobId);
  const job = jobQuery.data?.job;
  if (!jobId) return <p className="px-4 py-6 text-sm text-[#5e6684]">{SIGNATURE_COPY.noJob}</p>;
  if (jobQuery.isLoading) return <div className="px-4 py-6 text-sm text-[#5e6684]">Loading…</div>;
  if (jobQuery.isError || !job) return <p className="px-4 py-6 text-sm text-[#b42318]">Job not found.</p>;
  return <CrewSignatureForm job={job} />;
}

export function CrewSignatureForm({ job }: { job: JobDetail }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeStroke = useRef<SignatureStroke | null>(null);
  const uploadedAttachmentId = useRef<string | null>(null);
  const operationId = useRef<string>(newOperationId());
  const defaultName = job.signedByName ?? `${job.customer.firstName} ${job.customer.lastName}`.trim();
  const [name, setName] = useState(defaultName);
  const [strokes, setStrokes] = useState<SignatureStroke[]>([]);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState<{ name: string; at: string | Date | null; url: string | null } | null>(
    job.signatureUrl ? { name: job.signedByName ?? "", at: job.signedAt, url: job.signatureUrl } : null
  );

  const state = deriveSignatureState({ saved: Boolean(saved), saving, failed, strokes: strokes.length });
  const locked = state === "saving" || state === "saved";

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const width = canvas.clientWidth || 358;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(PAD_HEIGHT * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, PAD_HEIGHT);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f1530";
    for (const stroke of [...strokes, ...(activeStroke.current ? [activeStroke.current] : [])]) {
      ctx.beginPath();
      stroke.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      if (stroke.length === 1) ctx.lineTo(stroke[0]!.x + 0.1, stroke[0]!.y);
      ctx.stroke();
    }
  }, [strokes]);

  useEffect(() => {
    redraw();
    window.addEventListener("resize", redraw);
    return () => window.removeEventListener("resize", redraw);
  }, [redraw]);

  const point = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX ?? 0) - rect.left, y: (e.clientY ?? 0) - rect.top };
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (locked) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    activeStroke.current = [point(e)];
    redraw();
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!activeStroke.current || locked) return;
    activeStroke.current.push(point(e));
    redraw();
  };
  const onPointerUp = () => {
    const stroke = activeStroke.current;
    activeStroke.current = null;
    if (!stroke) return;
    uploadedAttachmentId.current = null;
    setFailed(false);
    setStrokes((list) => [...list, stroke]);
  };

  const clear = () => {
    uploadedAttachmentId.current = null;
    operationId.current = newOperationId();
    setFailed(false);
    setStrokes([]);
  };

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas || strokes.length === 0 || !name.trim()) return;
    setSaving(true);
    setFailed(false);
    try {
      if (!uploadedAttachmentId.current) {
        const attachment = await uploadFile({ file: await canvasToFile(canvas), entityType: "job", entityId: job.id, caption: "Customer signature" });
        uploadedAttachmentId.current = attachment.id;
      }
      // Re-read the job so the record version is current after the upload.
      const fresh = await api.get<{ job: JobDetail }>(`/api/v1/jobs/${job.id}`);
      const body = buildSignatureBatch({
        jobId: job.id,
        jobUpdatedAt: fresh.job.updatedAt,
        attachmentId: uploadedAttachmentId.current,
        signedByName: name,
        deviceId: getDeviceId(),
        operationId: operationId.current
      });
      const response = await api.post<SubmitFieldWorkSyncBatchResponse>("/api/v1/field-work/sync/batches", body);
      if (!signatureBatchSucceeded(response)) throw new Error("not applied");
      await queryClient.invalidateQueries({ queryKey: ["jobs", "detail", job.id] });
      const after = await api.get<{ job: JobDetail }>(`/api/v1/jobs/${job.id}`).catch(() => null);
      setSaved({ name: after?.job.signedByName ?? name.trim(), at: after?.job.signedAt ?? null, url: after?.job.signatureUrl ?? null });
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const jobHref = `/mobile/jobs/${job.id}`;
  const canAct = strokes.length > 0 && !locked;

  return (
    <div className="flex min-h-screen flex-col gap-[14px] bg-[#fbf6ef] px-4 pb-6 pt-4" data-state={state} data-testid="crew-signature">
      <header className="flex flex-col gap-1">
        <Link href={jobHref} className="text-sm font-semibold text-[#2a3360]">{SIGNATURE_COPY.back}</Link>
        <h1 className="text-[26px] font-semibold text-[#0f1530]">{SIGNATURE_COPY.title}</h1>
        <p className="font-mono text-xs font-medium text-[#2a3360]" data-testid="signature-job-line">{signatureJobLine(job)}</p>
      </header>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="signature-signed-by" className="text-xs font-medium text-[#2a3360]">{SIGNATURE_COPY.signedBy}</label>
        <input
          id="signature-signed-by"
          value={saved ? saved.name || name : name}
          onChange={(e) => setName(e.target.value)}
          readOnly={locked}
          maxLength={255}
          className={`w-full rounded-[10px] border border-[#e6dccb] py-3 pl-3.5 pr-3 text-[15px] text-[#0f1530] ${locked ? "bg-[#f7f3ec]" : "bg-white"}`}
        />
      </div>

      {state === "error" ? (
        <div role="alert" className="rounded-[10px] bg-[#fbe3dc] px-3 py-2.5 text-[13px] font-medium text-[#b42318]">{SIGNATURE_COPY.error}</div>
      ) : null}
      {state === "saved" ? (
        <p className="self-start rounded-full bg-[#e4f1e8] px-3 py-1.5 text-[13px] font-semibold text-[#2f7d4f]" role="status">{SIGNATURE_COPY.saved}</p>
      ) : null}

      <div
        className={`relative h-[200px] w-full overflow-hidden rounded-[14px] border border-[#e6dccb] ${state === "empty" ? "border-dashed" : "border-solid"} ${locked ? "bg-[#f7f3ec]" : "bg-white"}`}
        aria-disabled={locked}
      >
        {saved?.url && strokes.length === 0 ? (
          <img src={saved.url} alt={`Signature of ${saved.name}`} className="absolute inset-0 h-full w-full object-contain" />
        ) : (
          <canvas
            ref={canvasRef}
            aria-label="Signature pad"
            role="img"
            data-testid="signature-pad"
            className={`absolute inset-0 h-full w-full ${styles.pad} ${locked ? "pointer-events-none" : "cursor-crosshair"}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        )}
        <div className="pointer-events-none absolute inset-x-4 bottom-[18px] flex flex-col gap-1.5">
          <div className="h-px w-full bg-[#e6dccb]" />
          <p className="whitespace-pre font-mono text-xs font-medium text-[#5e6684]">{state === "saved" ? SIGNATURE_COPY.readOnly : SIGNATURE_COPY.signHere}</p>
        </div>
      </div>

      {state === "saving" ? <p className="font-mono text-xs font-medium text-[#5e6684]" aria-live="polite">{SIGNATURE_COPY.savingNote}</p> : null}
      {state === "error" ? <p className="font-mono text-xs font-medium text-[#5e6684]">{SIGNATURE_COPY.strokesKept}</p> : null}
      {state === "saved" ? (
        <p className="font-mono text-xs font-medium text-[#5e6684]" data-testid="signature-meta">{signatureMetaLine(saved?.name, saved?.at)}</p>
      ) : null}

      <div className="flex flex-col gap-2.5">
        {state === "saved" ? (
          <button type="button" className={btnPrimary} onClick={() => router.push(jobHref)}>{SIGNATURE_COPY.done}</button>
        ) : (
          <>
            <button
              type="button"
              disabled={!canAct || !name.trim()}
              onClick={() => void save()}
              className={state === "saving" ? `${btnPrimary} opacity-70` : canAct && name.trim() ? btnPrimary : btnDisabled}
            >
              {state === "saving" ? (
                <>
                  <img src="/crew-signature-spinner.svg" alt="" width={16} height={16} className={styles.spinner} />
                  {SIGNATURE_COPY.saving}
                </>
              ) : state === "error" ? SIGNATURE_COPY.retry : SIGNATURE_COPY.save}
            </button>
            <button type="button" disabled={!canAct} onClick={clear} className={canAct ? btnSecondary : btnDisabled}>
              {SIGNATURE_COPY.clear}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
