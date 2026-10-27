"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, CarFront, MapPinned, Phone } from "lucide-react";

import { EmptyState } from "@/src/components/ui/EmptyState";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { useJob, useJobOTW, useSendOTW } from "@/src/hooks/jobs.hooks";
import { isMobileRouteMissing, isVersionConflict, useMarkOnTheWay, useMobileJob } from "@/src/hooks/technician-mobile.hooks";
import { showToast } from "@/src/stores/toast.store";
import { buildOnTheWayMessage, formatDateTime } from "@/src/components/jobs/jobs.utils";

const etaOptions = [5, 10, 15, 20, 30, 45, 60];

export function OTWScreen() {
  const params = useParams<{ jobId: string }>();
  const jobQuery = useJob(params.jobId);
  const otwQuery = useJobOTW(params.jobId);
  const sendOTW = useSendOTW(params.jobId);
  const mobileJobQuery = useMobileJob(params.jobId);
  const markOnTheWay = useMarkOnTheWay(params.jobId);
  const mobileJob = mobileJobQuery.data?.job;
  const canMarkOnly = !isMobileRouteMissing(mobileJobQuery.error) && !isMobileRouteMissing(markOnTheWay.error);
  const [etaMinutes, setEtaMinutes] = useState(15);
  const [message, setMessage] = useState("");

  const job = jobQuery.data?.job;
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

  async function handleMarkOnly() {
    try {
      await markOnTheWay.mutateAsync({
        estimatedArrivalMinutes: etaMinutes,
        ...(mobileJob?.recordVersion ? { recordVersion: mobileJob.recordVersion } : {})
      });
      showToast({ tone: "success", title: "Marked on the way", description: "Dispatch can see you are heading over. No text was sent." });
    } catch (error) {
      if (isMobileRouteMissing(error)) {
        return;
      }
      showToast({
        tone: "error",
        title: isVersionConflict(error) ? "Job changed on another device" : "Could not mark on the way",
        description: isVersionConflict(error) ? "We refreshed the job. Try again." : error instanceof Error ? error.message : "Try again in a moment."
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
    <div className="min-h-[100svh] bg-[#F5F7FB] px-4 py-4">
      <div className="mx-auto w-full max-w-[390px] space-y-4">
        <header className="rounded-[28px] bg-brand-primary px-4 py-4 text-white">
          <Link href={`/mobile/jobs/${job.id}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-white/80">
            <ArrowLeft className="h-4 w-4" />
            HVAC Repair
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">On My Way</h1>
        </header>

        <section className="rounded-[28px] border border-neutral-200 bg-white px-4 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Next Job</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-neutral-950">{job.title}</h2>
          <p className="mt-1 text-sm text-neutral-500">{job.property?.addressLine1 ?? "Address pending"}</p>
          <p className="mt-1 text-sm text-neutral-500">
            {job.scheduledStart ? formatDateTime(job.scheduledStart) : "Time TBD"}
            {job.scheduledEnd ? ` - ${formatDateTime(job.scheduledEnd)}` : ""}
          </p>
        </section>

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
          {canMarkOnly ? (
            <button
              type="button"
              disabled={markOnTheWay.isPending}
              onClick={() => {
                void handleMarkOnly();
              }}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-[22px] border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700 disabled:opacity-60"
            >
              {markOnTheWay.isPending ? "Saving..." : "Mark on my way without texting"}
            </button>
          ) : null}
          {mobileJob?.onTheWayAt ? (
            <p role="status" className="text-center text-xs text-neutral-500">
              On the way since {formatDateTime(mobileJob.onTheWayAt)}
            </p>
          ) : null}
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
