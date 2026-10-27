"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

import {
  usePublicBookingSettings,
  usePublicConfirmBooking,
  usePublicSlotHold
} from "@/src/hooks/booking.hooks";
import { ApiError } from "@/src/lib/api";
import { saveConfirmedBookingSnapshot, suggestsRecurringServiceIntent } from "@/src/lib/booking-commit.utils";
import { showToast } from "@/src/stores/toast.store";
import { useBookingFlowStore } from "@/src/stores/booking-flow.store";
import { cn } from "@/src/lib/utils";

function buildConfirmedHref(slug: string, source: string, referenceNumber: string) {
  const params = new URLSearchParams();
  if (source) {
    params.set("src", source);
  }
  params.set("ref", referenceNumber);
  return `/book/${slug}/confirmed?${params.toString()}`;
}

function formatSlotRange(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const dateLabel = startDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric"
  });
  const timeLabel = `${startDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  })} – ${endDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;

  return { dateLabel, timeLabel };
}

export function BookingSlotCommitClient({ slug }: { slug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const source = searchParams.get("src") ?? "direct";
  const referenceFromQuery = searchParams.get("ref")?.trim() ?? "";
  const settingsQuery = usePublicBookingSettings(slug);
  const holdMutation = usePublicSlotHold(slug, referenceFromQuery);
  const confirmMutation = usePublicConfirmBooking(slug, referenceFromQuery);

  const {
    referenceNumber,
    holdToken,
    selectedTechnicianId,
    selectedScheduledStart,
    selectedScheduledEnd,
    serviceCategory,
    serviceType,
    serviceDetail,
    firstName,
    lastName
  } = useBookingFlowStore();

  const [holdReady, setHoldReady] = useState(false);
  const [holdError, setHoldError] = useState<string | null>(null);
  const holdAttemptedRef = useRef(false);

  const resolvedRef = referenceFromQuery || referenceNumber || "";
  const canCommit = Boolean(
    holdToken &&
      selectedTechnicianId &&
      selectedScheduledStart &&
      selectedScheduledEnd &&
      resolvedRef
  );

  const recurringHint = useMemo(
    () =>
      suggestsRecurringServiceIntent({ serviceCategory, serviceType, serviceDetail })
        ? "Recurring or VIP service plans may apply to this visit. We will link your appointment when a plan is on file."
        : null,
    [serviceCategory, serviceDetail, serviceType]
  );

  const slotLabels =
    selectedScheduledStart && selectedScheduledEnd
      ? formatSlotRange(selectedScheduledStart, selectedScheduledEnd)
      : null;

  useEffect(() => {
    if (!canCommit || holdReady || holdAttemptedRef.current) {
      return;
    }

    holdAttemptedRef.current = true;

    void (async () => {
      try {
        await holdMutation.mutateAsync({
          holdToken: holdToken!,
          technicianId: selectedTechnicianId!,
          scheduledStart: selectedScheduledStart!,
          scheduledEnd: selectedScheduledEnd!
        });
        setHoldReady(true);
        setHoldError(null);
      } catch (error) {
        const message =
          error instanceof ApiError
            ? error.payload.message
            : error instanceof Error
              ? error.message
              : "Could not reserve this time slot.";
        setHoldError(message);
      }
    })();
  }, [canCommit, holdMutation, holdReady, holdToken, selectedScheduledEnd, selectedScheduledStart, selectedTechnicianId]);

  async function handleConfirmAppointment() {
    if (!canCommit || !holdReady) {
      return;
    }

    try {
      const result = await confirmMutation.mutateAsync({
        technicianId: selectedTechnicianId!,
        scheduledStart: selectedScheduledStart!,
        scheduledEnd: selectedScheduledEnd!
      });

      saveConfirmedBookingSnapshot(slug, resolvedRef, {
        status: result.bookingRequest.status,
        jobId: result.jobId,
        recurringSchedule: result.recurringSchedule,
        scheduledStart: selectedScheduledStart!,
        scheduledEnd: selectedScheduledEnd!
      });

      router.push(buildConfirmedHref(slug, source, resolvedRef));
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.payload.message
          : error instanceof Error
            ? error.message
            : "Could not confirm your appointment.";
      showToast({
        tone: "error",
        title: "Confirmation failed",
        description: message
      });
    }
  }

  if (!resolvedRef || !canCommit) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] items-center justify-center px-4 py-10">
        <section className="rounded-[30px] border border-neutral-200 bg-white px-5 py-6 text-center shadow-[0_18px_60px_rgba(16,33,99,0.08)]">
          <h1 className="text-xl font-semibold text-neutral-950">Resume from the booking flow</h1>
          <p className="mt-3 text-sm leading-6 text-neutral-500">
            This secure confirmation link is missing slot details. Start again and choose a published time before
            submitting your request.
          </p>
          <a
            href={`/book/${slug}`}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[20px] bg-brand-accent px-5 text-sm font-semibold text-white"
          >
            Back to booking
          </a>
        </section>
      </div>
    );
  }

  const companyName = settingsQuery.data?.booking.companyName ?? "Your service team";

  return (
    <div className="mx-auto w-full max-w-[480px] px-4 py-6">
      <header className="rounded-[28px] bg-neutral-950 px-5 py-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Secure slot hold</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{companyName}</h1>
        <p className="mt-2 text-sm text-white/70">Reference {resolvedRef}</p>
      </header>

      <section className="mt-4 rounded-[30px] border border-neutral-200 bg-white px-5 py-5 shadow-[0_18px_60px_rgba(16,33,99,0.08)]">
        <div className="flex items-center gap-2 text-brand-accent">
          <CalendarDays className="h-4 w-4" />
          <span className="text-sm font-semibold">Your selected visit</span>
        </div>
        {slotLabels ? (
          <div className="mt-4 rounded-[24px] border border-brand-accent/20 bg-brand-accent-light/40 px-4 py-4">
            <p className="text-sm font-semibold text-neutral-900">{slotLabels.dateLabel}</p>
            <p className="mt-1 text-sm text-neutral-600">{slotLabels.timeLabel}</p>
            <p className="mt-2 text-xs text-neutral-500">
              {firstName} {lastName}
            </p>
          </div>
        ) : null}

        {recurringHint ? (
          <div className="mt-4 rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-600">
            <p className="font-semibold text-neutral-900">Recurring &amp; VIP schedules</p>
            <p className="mt-2 leading-6">{recurringHint}</p>
          </div>
        ) : null}

        <div className="mt-4 flex items-start gap-3 rounded-[22px] border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-600">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" />
          <p>
            We temporarily hold this crew calendar slot while you confirm. Nothing is final until you tap{" "}
            <span className="font-semibold text-neutral-900">Confirm appointment</span> below.
          </p>
        </div>

        {holdError ? (
          <div className="mt-4 rounded-[24px] border border-danger/20 bg-danger-light px-4 py-4 text-sm text-danger">
            <p className="font-semibold">Could not reserve this slot</p>
            <p className="mt-1">{holdError}</p>
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold underline"
              onClick={() => {
                holdAttemptedRef.current = false;
                setHoldReady(false);
                setHoldError(null);
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          </div>
        ) : null}

        {!holdReady && !holdError ? (
          <div className="mt-5 flex min-h-12 items-center justify-center gap-2 text-sm text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin text-brand-accent" />
            Reserving your time on the calendar...
          </div>
        ) : null}

        <button
          type="button"
          disabled={!holdReady || confirmMutation.isPending}
          onClick={() => {
            void handleConfirmAppointment();
          }}
          className={cn(
            "mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-[20px] px-4 text-sm font-semibold text-white transition",
            holdReady ? "bg-brand-accent" : "cursor-not-allowed bg-neutral-300"
          )}
        >
          {confirmMutation.isPending ? "Confirming..." : "Confirm appointment"}
        </button>
      </section>
    </div>
  );
}
