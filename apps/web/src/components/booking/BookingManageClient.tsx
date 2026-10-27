"use client";

import Link from "next/link";
import { useState } from "react";

import {
  useBookingSelfService,
  useBookingSelfServiceCancel,
  usePublicBookingSettings
} from "@/src/hooks/booking.hooks";
import { showToast } from "@/src/stores/toast.store";

export function BookingManageClient({ slug, manageToken }: { slug: string; manageToken: string }) {
  const settingsQuery = usePublicBookingSettings(slug);
  const selfServiceQuery = useBookingSelfService(manageToken);
  const cancelMutation = useBookingSelfServiceCancel(manageToken);
  const [cancelled, setCancelled] = useState(false);

  const booking = settingsQuery.data?.booking;
  const view = selfServiceQuery.data?.selfService;

  async function handleCancel() {
    try {
      await cancelMutation.mutateAsync();
      setCancelled(true);
      showToast({ tone: "success", title: "Your appointment was cancelled." });
    } catch {
      showToast({ tone: "error", title: "We could not cancel online. Please call the office." });
    }
  }

  return (
    <div className="mx-auto w-full max-w-[480px] px-4 py-6">
      <div className="rounded-[28px] border border-neutral-200 bg-white px-5 py-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-neutral-950">Manage appointment</h1>
        <p className="mt-2 text-sm text-neutral-500">
          {view?.companyName ?? booking?.companyName} · #{view?.referenceNumber ?? "—"}
        </p>

        {selfServiceQuery.isLoading ? <p className="mt-6 text-sm text-neutral-500">Loading…</p> : null}

        {selfServiceQuery.isError ? (
          <p className="mt-6 text-sm text-red-600">This link is invalid or has expired.</p>
        ) : null}

        {view && !cancelled ? (
          <div className="mt-6 space-y-4 text-sm text-neutral-700">
            <p>
              Scheduled:{" "}
              <span className="font-medium text-neutral-900">
                {view.confirmation.scheduledStart
                  ? new Date(view.confirmation.scheduledStart).toLocaleString()
                  : "Pending"}
              </span>
            </p>
            <p className="text-xs text-neutral-400">
              Changes must be made at least {view.cutoffHours} hours before your visit.
            </p>
            {view.canCancel ? (
              <button
                type="button"
                onClick={() => {
                  void handleCancel();
                }}
                disabled={cancelMutation.isPending}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-[20px] border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-900 disabled:opacity-60"
              >
                {cancelMutation.isPending ? "Cancelling…" : "Cancel appointment"}
              </button>
            ) : (
              <p className="text-sm text-neutral-500">Online changes are no longer available for this visit.</p>
            )}
          </div>
        ) : null}

        {cancelled ? (
          <p className="mt-6 text-sm text-neutral-700">Your appointment is cancelled. We are sorry we will miss you.</p>
        ) : null}

        <Link
          href={`/book/${slug}`}
          className="mt-6 inline-flex text-sm font-medium text-brand-accent hover:underline"
        >
          Back to booking
        </Link>
      </div>
    </div>
  );
}
