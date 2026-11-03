"use client";

interface OwnerPanelNoticeProps {
  message: string;
  retry?: () => unknown;
  pending?: boolean;
}

/** Neutral failure state: no invented zero, no raw provider error, manual retry only. */
export function OwnerPanelNotice({ message, retry, pending = false }: OwnerPanelNoticeProps) {
  return (
    <div className="space-y-3 text-[13px] text-[#5e6684]" role="status" data-testid="owner-panel-unavailable">
      <p>{message}</p>
      {retry ? (
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-[10px] border border-[#e6dccb] bg-white px-4 font-medium text-[#0f1530] hover:bg-[#fbf6ef] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1530] disabled:opacity-60"
          disabled={pending}
          onClick={() => { void retry(); }}
        >
          {pending ? "Retrying…" : "Try again"}
        </button>
      ) : null}
    </div>
  );
}
