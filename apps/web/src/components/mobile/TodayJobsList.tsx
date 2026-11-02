"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { CarFront, ChevronRight, MapPinned, Phone, SunMedium } from "lucide-react";

import { EmptyState } from "@/src/components/ui/EmptyState";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import type { JobDetail, MobileJob } from "@fsm/types";
import { useMobileToday, useTodayJobDetails } from "@/src/hooks/jobs.hooks";
import { useBreakpoint } from "@/src/hooks/useBreakpoint";
import { ApiError } from "@/src/lib/api";
import { cn } from "@/src/lib/utils";
import { useAuthStore } from "@/src/stores/auth.store";

import { TabletJobsList } from "./tablet/TabletJobsList";

export interface TodayCardJob extends MobileJob {
  customer: JobDetail["customer"] | null;
  property: JobDetail["property"] | null;
  detailState: "loading" | "unavailable" | "ready";
}

function formatTimeWindow(job: MobileJob) {
  if (!job.scheduledStart) {
    return "Time TBD";
  }

  const start = parseISO(job.scheduledStart);
  const startLabel = format(start, "h:mm a");

  if (!job.scheduledEnd) {
    return startLabel;
  }

  return `${startLabel} - ${format(parseISO(job.scheduledEnd), "h:mm a")}`;
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function getStatusClasses(status: string) {
  switch (status) {
    case "in_progress":
    case "dispatched":
      return "bg-brand-accent-light text-brand-accent";
    case "on_hold":
      return "bg-[#fff4d6] text-[#7a5600]";
    case "completed":
    case "paid":
      return "bg-success-light text-success";
    default:
      return "bg-mint-100 text-mint-700";
  }
}

function jobStatusLabel(status: string) {
  switch (status) {
    case "dispatched": return "Dispatched";
    case "in_progress": return "In progress";
    case "on_hold": return "On hold";
    case "scheduled": return "Scheduled";
    default: return status.replaceAll("_", " ");
  }
}

export function TodayJobsList() {
  const { isTablet } = useBreakpoint();
  const authUser = useAuthStore((state) => state.user);
  const todayQuery = useMobileToday();
  const mobileJobs = todayQuery.data?.jobs ?? [];
  const detailQueries = useTodayJobDetails(mobileJobs.map((job) => job.id));
  const jobs: TodayCardJob[] = mobileJobs.map((job, index) => {
    const detailQuery = detailQueries[index];
    // React Query can retain a prior response after a failed refetch. Treat the
    // current error as authoritative so stale contact/location data is not shown.
    const detail = detailQuery?.isError ? undefined : detailQuery?.data?.job;
    return {
      ...job,
      customer: detail?.customer ?? null,
      property: detail?.property ?? null,
      detailState: detailQuery?.isError ? "unavailable" : detail ? "ready" : "loading"
    };
  });
  const jobCountLabel = `${jobs.length} ${jobs.length === 1 ? "job" : "jobs"} today`;
  const technicianName = authUser ? `${authUser.firstName} ${authUser.lastName}`.trim() : "Technician";
  const dateLabel = todayQuery.data?.date ? format(parseISO(todayQuery.data.date), "EEE, MMM d") : format(new Date(), "EEE, MMM d");

  if (todayQuery.isLoading) {
    return (
      <div className="space-y-4 px-4 py-4">
        <SkeletonCard className="h-[140px]" />
        <SkeletonCard className="h-[180px]" />
        <SkeletonCard className="h-[180px]" />
      </div>
    );
  }

  if (todayQuery.isError) {
    const accountUnavailable = todayQuery.error instanceof ApiError && (todayQuery.error.status === 400 || todayQuery.error.status === 403);
    return (
      <div className="px-4 py-6" role="alert">
        <EmptyState
          icon={SunMedium}
          title={accountUnavailable ? "Technician schedule unavailable" : "Today's jobs are unavailable"}
          subtitle={accountUnavailable ? "This account cannot open a technician schedule. Ask your office to check your access." : "We could not load your schedule. Check your connection and try again."}
          action={<button type="button" disabled={todayQuery.isFetching} onClick={() => void todayQuery.refetch()} className="min-h-11 rounded-xl bg-brand-accent px-4 text-sm font-semibold text-white disabled:opacity-60">Retry jobs</button>}
          compact
        />
      </div>
    );
  }

  if (isTablet) {
    return <TabletJobsList jobs={jobs} technicianName={technicianName} jobCountLabel={jobCountLabel} dateLabel={dateLabel} />;
  }

  return (
    <div className="min-h-[100svh] overflow-x-hidden bg-[#F5F7FB] px-4 py-4">
      <div className="mx-auto w-full max-w-[390px] space-y-5">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-[2rem] font-semibold tracking-tight text-neutral-950">Today&apos;s Jobs</h1>
            <p className="text-sm text-neutral-500">{dateLabel} · {jobCountLabel}</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent text-sm font-semibold text-white shadow-[0_16px_40px_rgba(37,122,250,0.24)]">
            {authUser ? getInitials(authUser.firstName, authUser.lastName) : "SR"}
          </div>
        </header>

        <section className="rounded-[28px] border border-neutral-200 bg-white px-4 py-4 shadow-[0_24px_80px_rgba(16,33,99,0.08)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-accent-light text-brand-accent">
              <SunMedium className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">Good morning, {authUser?.firstName ?? "Tech"}</p>
              <p className="text-xs text-neutral-500">{jobCountLabel}</p>
            </div>
          </div>
        </section>

        {jobs.length === 0 ? (
          <EmptyState
            icon={SunMedium}
            title="No jobs scheduled today"
            subtitle="Once dispatch assigns work, it will show up here in timeline order with quick field actions."
            compact
          />
        ) : (
          <div className="relative space-y-4 pl-5">
            <div className="absolute bottom-0 left-[11px] top-1 w-px bg-neutral-200" />
            {jobs.map((job) => (
              <div key={job.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[18px] top-7 h-3.5 w-3.5 rounded-full border-2 border-white shadow",
                    job.status === "in_progress" ? "bg-brand-accent" : "bg-neutral-300"
                  )}
                />
                <article
                  className={cn(
                    "rounded-[28px] border px-4 py-4 shadow-[0_18px_48px_rgba(16,33,99,0.06)]",
                    job.status === "in_progress" ? "border-brand-accent/20 bg-white" : "border-neutral-200 bg-white"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-brand-accent">{formatTimeWindow(job)}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", getStatusClasses(job.status))}>
                          {jobStatusLabel(job.status)}
                        </span>
                        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-500">
                          Priority: {job.priority?.replaceAll("_", " ") ?? "Not set"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">
                      {job.customer ? `${job.customer.firstName} ${job.customer.lastName}` : job.detailState === "loading" ? "Loading customer details…" : "Customer details unavailable"}
                    </h2>
                    <p className="mt-1 text-sm text-neutral-700">{job.title ?? "Job details pending"}</p>
                    <p className="mt-1 text-sm text-neutral-500">
                      {job.property ? `${job.property.addressLine1}, ${job.property.city}` : job.detailState === "loading" ? "Loading address…" : "Address unavailable"}
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link
                      href={`/mobile/jobs/${job.id}`}
                      className={cn(
                        "inline-flex min-h-11 items-center justify-center rounded-2xl px-4 text-sm font-semibold",
                        job.status === "in_progress" ? "bg-brand-accent text-white" : "bg-brand-primary text-white"
                      )}
                    >
                      {job.status === "in_progress" ? "Continue Job" : "View Details"}
                    </Link>
                    {job.property ? (
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(`${job.property.addressLine1}, ${job.property.city}, ${job.property.state}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white text-sm font-semibold text-neutral-700 ring-1 ring-neutral-200"
                      >
                        <MapPinned className="h-4 w-4" />
                        Nav
                      </a>
                    ) : <span className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-neutral-100 text-sm text-neutral-500">{job.detailState === "loading" ? "Loading navigation…" : "Nav unavailable"}</span>}
                    <Link
                      href={`/mobile/otw/${job.id}`}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white text-sm font-semibold text-neutral-700 ring-1 ring-neutral-200"
                    >
                      <CarFront className="h-4 w-4" />
                      OTW
                    </Link>
                    {job.customer?.phone ? (
                      <a href={`tel:${job.customer.phone}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white text-sm font-semibold text-neutral-700 ring-1 ring-neutral-200">
                        <Phone className="h-4 w-4" />Call
                      </a>
                    ) : <span className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-neutral-100 text-sm text-neutral-500">{job.detailState === "loading" ? "Loading phone…" : "Call unavailable"}</span>}
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-neutral-400">
                    <span>{job.jobNumber}</span>
                    <Link href={`/mobile/jobs/${job.id}`} className="inline-flex items-center gap-1 font-semibold text-brand-accent">
                      Open
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </article>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
