"use client";

import { useState } from "react";
import { GROWTH_CHECK_REVIEW_ACTION_REGISTRY, type GrowthCheckFindingReviewBody, type GrowthCheckFindingView } from "@fsm/types";

import { newIdempotencyKey, useReviewFinding } from "@/src/hooks/growth-check-review.hooks";
import { ApiError } from "@/src/lib/api";
import { showToast } from "@/src/stores/toast.store";

import { STATUS_LABEL } from "./labels";

const REASON_ACTIONS = new Set(["edit", "mark_not_applicable", "dismiss"]);

const errorMessage = (error: unknown) =>
  error instanceof ApiError && error.status === 409
    ? "This finding changed since you opened it. Reload and try again."
    : error instanceof Error
      ? error.message
      : "Something went wrong";

/**
 * Review actions for one finding. Owner-only answers (owner_confirm/reject/cannot_answer) are rendered only for the
 * account owner; for anyone else they are absent and no request can be sent. The API remains the authority.
 */
export function ReviewActions({ finding, isOwner }: { finding: GrowthCheckFindingView; isOwner: boolean }) {
  const review = useReviewFinding(finding.id);
  const actions = GROWTH_CHECK_REVIEW_ACTION_REGISTRY.filter((a) => isOwner || !a.ownerOnly);
  const [action, setAction] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<string>("");
  const [summary, setSummary] = useState("");

  const needsReason = action !== null && REASON_ACTIONS.has(action);
  const needsNote = action === "add_note";
  const textValid = needsReason ? text.trim().length >= 3 : needsNote ? text.trim().length >= 1 : true;
  const editValid = action !== "edit" || status !== "" || summary.trim() !== "";

  const submit = () => {
    if (!action) return;
    const base = { expectedRevision: finding.revision, idempotencyKey: newIdempotencyKey() };
    const note = text.trim() || undefined;
    let body: GrowthCheckFindingReviewBody;
    if (action === "edit") {
      body = {
        action,
        ...base,
        reason: text.trim(),
        ...(status ? { status: status as "pass" | "fail" | "warning" | "unknown" } : {}),
        ...(summary.trim() ? { summary: summary.trim() } : {})
      };
    } else if (action === "mark_not_applicable" || action === "dismiss") body = { action, ...base, reason: text.trim() };
    else if (action === "add_note") body = { action, ...base, note: text.trim() };
    else body = { action: action as "request_owner_validation", ...base, ...(note ? { note } : {}) };
    review.mutate(body, {
      onSuccess: () => {
        showToast({ tone: "success", title: "Finding updated" });
        setAction(null);
        setText("");
        setStatus("");
        setSummary("");
      },
      onError: (error) => showToast({ tone: "error", title: "Could not update finding", description: errorMessage(error) })
    });
  };

  return (
    <section aria-labelledby="gc-actions" className="space-y-3">
      <h3 id="gc-actions" className="text-sm font-semibold text-neutral-900">Review</h3>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            aria-pressed={action === a.key}
            onClick={() => setAction(a.key)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium ${a.ownerOnly ? "border-emerald-300 text-emerald-800" : "border-neutral-300 text-neutral-800"} ${action === a.key ? "bg-neutral-100" : "bg-white"}`}
          >
            {a.label}
          </button>
        ))}
      </div>
      {action ? (
        <div className="space-y-2">
          {action === "edit" ? (
            <>
              <label className="block text-xs text-neutral-700">
                Corrected result
                <select className="mt-1 block rounded-md border border-neutral-300 px-2 py-1 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">Keep current</option>
                  {Object.entries(STATUS_LABEL).map(([k, l]) => (
                    <option key={k} value={k}>{l}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-neutral-700">
                Corrected summary
                <textarea className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1 text-sm" value={summary} onChange={(e) => setSummary(e.target.value)} />
              </label>
            </>
          ) : null}
          <label className="block text-xs text-neutral-700">
            {needsReason ? "Reason (required)" : needsNote ? "Note (required)" : "Note (optional)"}
            <textarea className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1 text-sm" value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={!textValid || !editValid || review.isPending}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {review.isPending ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setAction(null)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs">
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {!isOwner ? <p className="text-xs text-neutral-500">Only the shop owner can confirm or reject a finding.</p> : null}
    </section>
  );
}
