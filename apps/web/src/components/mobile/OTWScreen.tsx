"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CarFront, MapPinned, Phone } from "lucide-react";

import { cn } from "@/src/lib/utils";
import { formatArrival, getCrewStatusTone } from "./crew-job.utils";

import { EmptyState } from "@/src/components/ui/EmptyState";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { useJob, useJobOTW, useSendOTW } from "@/src/hooks/jobs.hooks";
import { showToast } from "@/src/stores/toast.store";
import { buildOnTheWayMessage, formatDateTime } from "@/src/components/jobs/jobs.utils";

const etaOptions = [5, 10, 15, 20, 30, 45, 60];

export function OTWScreen() {
  const params = useParams<{ jobId: string }>();
  const jobQuery = useJob(params.jobId);
  const otwQuery = useJobOTW(params.jobId);
  const sendOTW = useSendOTW(params.jobId);
  const [etaMinutes, setEtaMinutes] = useState(15);
  const [message, setMessage] = useState("");

  const job = jobQuery.data?.job;
  const latest = otwQuery.data?.notification ?? null;
  const notifications = useMemo(() => (otwQuery.data?.notification ? [otwQuery.data.notification] : []), [otwQuery.data?.notification]);

  useEffect(() => {
    if (!job) {
      return;
    }

    setMessage(buildOnTheWayMessage(job.customer.firstName, etaMinutes));
  }, [etaMinutes, job]);

  async function handleSend() {
    if (!job) {
      return;
    }

    try {
      await sendOTW.mutateAsync({
        estimatedArrivalMinutes: etaMinutes,
        message,
        ...(job.technicianId ? { technicianId: job.technicianId } : {})
      });
      showToast({
        tone: "success",
        title: "On my way sent",
        description: "The customer received the ETA update by SMS."
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "Could not send OTW",
        description: error instanceof Error ? error.message : "Try again in a moment."
      });
    }
  }

  if (jobQuery.isLoading || otwQuery.isLoading) {
    return (
      <div className="space-y-4 px-4 py-4">
        <SkeletonCard className="h-[140px]" />
        <SkeletonCard className="h-[220px]" />
        <SkeletonCard className="h-[160px]" />
      </div>
    );
  }

  if (jobQuery.isError || !job) {
    return (
      <div className="px-4 py-6">
        <EmptyState
          icon={CarFront}
          title="Job unavailable"
          subtitle="This on-the-way flow is only available for jobs you can access."
          compact
        />
      </div>
    );
  }

  const mapsLink = `https://maps.google.com/?q=${encodeURIComponent(
    `${job.property?.addressLine1 ?? ""}, ${job.property?.city ?? ""}, ${job.property?.state ?? ""}`
  )}`;

  return (
    <div className="min-h-[100svh] bg-[#fbf6ef] px-4 py-4">
      <div className="mx-auto w-full max-w-[390px] space-y-4">
        <header className="space-y-3">
          <div className="flex items-center gap-3">
            <Link href={`/mobile/jobs/${job.id}`} className="inline-flex min-h-11 items-center text-sm text-[#5e6684]">
              ‹ Job
            </Link>
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", getCrewStatusTone("dispatched"))}>
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
              On the way
            </span>
          </div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-[#0f1530]">
            Heading to {job.customer.firstName} {job.customer.lastName.charAt(0)}{job.customer.lastName ? "." : ""}
          </h1>
          <p className="text-sm text-[#5e6684]">
            {[job.jobNumber, job.title, job.property?.addressLine1 ?? "Address pending"].join(" · ")}
          </p>
          <p className="text-sm text-[#5e6684]">
            {job.scheduledStart ? formatDateTime(job.scheduledStart) : "Time TBD"}
            {job.scheduledEnd ? ` - ${formatDateTime(job.scheduledEnd)}` : ""}
          </p>
        </header>

        {latest?.sentAt && latest.estimatedArrivalMinutes != null ? (
          <section className="rounded-[14px] bg-[#0f1530] px-5 py-5 text-white">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#f6b400]">ETA sent to customer</p>
            <p className="mt-3 text-[22px] font-semibold">Arriving {formatArrival(latest.sentAt, latest.estimatedArrivalMinutes)}</p>
            <p className="mt-2 text-sm text-white/85">{job.customer.firstName} got a text with your ETA.</p>
          </section>
        ) : null}

        <section className="space-y-3 rounded-[28px] border border-neutral-200 bg-white px-4 py-4 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-neutral-900">Message Preview</p>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="mt-2 min-h-28 w-full rounded-[22px] border border-neutral-200 bg-brand-accent-light/50 px-3 py-3 text-sm leading-6 text-neutral-700 outline-none transition focus:border-brand-accent"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Estimated arrival</span>
              <select
                value={etaMinutes}
                onChange={(event) => setEtaMinutes(Number(event.target.value))}
                className="mt-2 min-h-11 w-full rounded-2xl border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-900 outline-none transition focus:border-brand-accent"
              >
                {etaOptions.map((value) => (
                  <option key={value} value={value}>
                    {value} minutes
                  </option>
                ))}
              </select>
            </label>
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Channel</span>
              <div className="mt-2 flex min-h-11 items-center rounded-2xl border border-neutral-200 bg-neutral-50 px-3 text-sm font-medium text-neutral-500">
                SMS
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={sendOTW.isPending}
            onClick={() => {
              void handleSend();
            }}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[22px] bg-brand-accent px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CarFront className="h-4 w-4" />
            {sendOTW.isPending ? "Sending..." : "Send On My Way"}
          </button>
          <p className="text-center text-xs text-neutral-400">Customer will receive a text notification</p>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <a
            href={mapsLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700"
          >
            <MapPinned className="h-4 w-4" />
            Navigate
          </a>
          <a
            href={job.customer.phone ? `tel:${job.customer.phone}` : undefined}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700"
          >
            <Phone className="h-4 w-4" />
            Call Customer
          </a>
        </div>

        <section className="rounded-[28px] border border-neutral-200 bg-white px-4 py-4 shadow-sm">
          <p className="text-sm font-semibold text-neutral-900">Past Notifications</p>
          {notifications.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">No OTW notifications have been sent for this job yet.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {notifications.map((notification) => (
                <div key={notification.id} className="rounded-[20px] bg-neutral-50 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-neutral-900">{job.customer.firstName} {job.customer.lastName}</p>
                    <span className="rounded-full bg-success-light px-2.5 py-1 text-xs font-semibold text-success">Delivered</span>
                  </div>
                  <p className="mt-2 text-xs text-neutral-500">
                    {notification.sentAt ? formatDateTime(notification.sentAt) : "Sent"} · ETA {notification.estimatedArrivalMinutes ?? "—"} min
                  </p>
                  <p className="mt-2 text-sm text-neutral-600">{notification.message}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
