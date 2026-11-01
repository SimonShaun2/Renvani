"use client";

import { useState } from "react";
import { GROWTH_CHECK_REVIEW_ACTION_REGISTRY, type GrowthCheckFindingReviewBody, type GrowthCheckFindingView } from "@fsm/types";

import { newIdempotencyKey, useReviewFinding } from "@/src/hooks/growth-check-review.hooks";
import { ApiError } from "@/src/lib/api";
import { showToast } from "@/src/stores/toast.store";

import { STATUS_LABEL } from "./labels";
import { Alert, darkButton, fieldLabel, inputClass, secondaryButton } from "./ui";

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
export function ReviewActions({ finding, isOwner, onReload }: { finding: GrowthCheckFindingView; isOwner: boolean; onReload?: () => void }) {
  const review = useReviewFinding(finding.id);
  const actions = GROWTH_CHECK_REVIEW_ACTION_REGISTRY.filter((a) => isOwner || !a.ownerOnly);
  const [action, setAction] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<string>("");
  const [summary, setSummary] = useState("");
  const [stale, setStale] = useState(false);

  const needsReason = action !== null && REASON_ACTIONS.has(action);
  const needsNote = action === "add_note";
  const textValid = needsReason ? text.trim().length >= 3 : needsNote ? text.trim().length >= 1 : true;
  const editValid = action !== "edit" || status !== "" || summary.trim() !== "";

  const submit = () => {
    if (!action) return;
    setStale(false);
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
      onError: (error) => {
        // Figma 366:4217 "Stale" state: inline alert with Reload instead of a toast.
        if (error instanceof ApiError && error.status === 409) setStale(true);
        else showToast({ tone: "error", title: "Could not update finding", description: errorMessage(error) });
      }
    });
  };

  return (
    <section aria-labelledby="gc-actions" className="space-y-3.5">
      <h3 id="gc-actions" className="text-[15px] font-semibold text-[#0f1530]">Review</h3>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            aria-pressed={action === a.key}
            onClick={() => setAction(a.key)}
            className={a.key === "owner_confirm" || action === a.key ? darkButton : secondaryButton}
          >
            {a.label}
          </button>
        ))}
      </div>
      {action ? (
        <div className="space-y-3.5">
          {action === "edit" ? (
            <>
              <label className={fieldLabel}>
                Corrected result
                <select className={`${inputClass} h-11`} value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">Keep current</option>
                  {Object.entries(STATUS_LABEL).map(([k, l]) => (
                    <option key={k} value={k}>{l}</option>
                  ))}
                </select>
              </label>
              <label className={fieldLabel}>
                Corrected summary
                <textarea className={`${inputClass} h-[88px] py-3`} value={summary} onChange={(e) => setSummary(e.target.value)} />
              </label>
            </>
          ) : null}
          <label className={fieldLabel}>
            {needsReason ? "Reason (required)" : needsNote ? "Note (required)" : "Note (optional)"}
            <textarea className={`${inputClass} min-h-11 py-3`} rows={1} placeholder="Add context for your team" value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={!textValid || !editValid || review.isPending}
              className={darkButton}
            >
              {review.isPending ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setAction(null)} className={secondaryButton}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {stale ? (
        <Alert tone="error" role="alert" title="This finding changed since you opened it." detail="Reload and try again.">
          <button
            type="button"
            className={secondaryButton}
            onClick={() => {
              setStale(false);
              onReload?.();
            }}
          >
            Reload
          </button>
        </Alert>
      ) : null}
      {!isOwner ? <p className="text-[12.5px] text-[#5e6684]">Only the shop owner can confirm or reject a finding.</p> : null}
    </section>
  );
}
