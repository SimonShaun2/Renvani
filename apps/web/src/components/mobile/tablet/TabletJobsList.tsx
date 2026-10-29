"use client";

import Link from "next/link";
import { format, isToday, parseISO } from "date-fns";
import { ArrowRight, CarFront, MapPinned, SunMedium } from "lucide-react";

import type { JobListRecord } from "@/src/hooks/jobs.hooks";
import { cn } from "@/src/lib/utils";

interface TabletJobsListProps {
  jobs: JobListRecord[];
  technicianName: string;
  jobCountLabel: string;
}

function formatTimeWindow(job: JobListRecord) {
  if (!job.scheduledStart) {
    return "Unscheduled";
  }

  const start = parseISO(job.scheduledStart);
  const startLabel = format(start, "h:mm a");

  if (!job.scheduledEnd) {
    return startLabel;
  }

  return `${startLabel} - ${format(parseISO(job.scheduledEnd), "h:mm a")}`;
}

function getStatusLabel(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getStatusClasses(status: string) {
  switch (status) {
    case "in_progress":
      return "bg-brand-accent-light text-brand-accent";
    case "completed":
    case "paid":
      return "bg-success-light text-success";
    default:
      return "bg-neutral-100 text-neutral-500";
  }
}

export function TabletJobsList({ jobs, technicianName, jobCountLabel }: TabletJobsListProps) {
  return (
    <div className="min-h-[100svh] bg-[#F5F7FB] px-8 py-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex items-start justify-between gap-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-accent">Technician Workspace</p>
            <h1 className="text-4xl font-semibold tracking-tight text-neutral-950">Today&apos;s Jobs</h1>
            <p className="text-sm text-neutral-500">
              {format(new Date(), "EEE, MMM d")} · {jobCountLabel} for {technicianName}
            </p>
          </div>
          <div className="rounded-[28px] border border-neutral-200 bg-white px-5 py-4 shadow-[0_20px_60px_rgba(16,33,99,0.08)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-accent-light text-brand-accent">
                <SunMedium className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-900">Your schedule</p>
                <p className="text-xs text-neutral-500">{jobCountLabel}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="rounded-[32px] border border-neutral-200 bg-white px-6 py-6 shadow-[0_24px_80px_rgba(16,33,99,0.08)]">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {["Clock In", "On The Way", "Job Started", "Complete", "Invoice"].map((step, index) => {
                const active = index < 3;
                const current = index === 2;

                return (
                  <div key={step} className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                        active ? "bg-success text-white" : "bg-neutral-100 text-neutral-400",
                        current && "bg-brand-accent text-white"
                      )}
                    >
                      {index + 1}
                    </div>
                    <span className={cn("text-xs font-medium", active ? "text-neutral-900" : "text-neutral-400")}>
                      {step}
                    </span>
                    {index < 4 ? <span className="h-px w-8 bg-neutral-200" /> : null}
                  </div>
                );
              })}
            </div>
            <p className="text-sm font-semibold text-success">{jobCountLabel}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {jobs.map((job) => (
              <article
                key={job.id}
                className={cn(
                  "rounded-[28px] border px-5 py-5 shadow-sm transition",
                  job.status === "in_progress"
                    ? "border-brand-accent/30 bg-white shadow-[0_22px_46px_rgba(37,122,250,0.14)]"
                    : "border-neutral-200 bg-neutral-50/50"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", getStatusClasses(job.status))}>
                        {getStatusLabel(job.status)}
                      </span>
                      <span className="rounded-full bg-brand-accent-light px-2.5 py-1 text-xs font-semibold text-brand-accent">
                        {job.assetId ? "Carrier HVAC Unit · Aging" : job.priority.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-400">
                      {formatTimeWindow(job)}
                    </p>
                    <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">
                      {job.customer.firstName} {job.customer.lastName}
                    </h2>
                    <p className="text-sm text-neutral-600">{job.title}</p>
                    <p className="text-sm text-neutral-500">
                      {job.property?.addressLine1 ?? "Address pending"}
                      {job.property ? `, ${job.property.city}` : ""}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href={`/mobile/jobs/${job.id}`}
                    className={cn(
                      "inline-flex min-h-11 items-center justify-center rounded-2xl px-4 text-sm font-semibold",
                      job.status === "in_progress"
                        ? "bg-brand-accent text-white"
                        : "bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200"
                    )}
                  >
                    {job.status === "in_progress" ? "Continue Job" : "View Details"}
                  </Link>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(
                      `${job.property?.addressLine1 ?? ""} ${job.property?.city ?? ""} ${job.property?.state ?? ""}`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-neutral-700 shadow-sm ring-1 ring-neutral-200"
                  >
                    <MapPinned className="h-4 w-4" />
                    Nav
                  </a>
                  <Link
                    href={`/mobile/otw/${job.id}`}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-neutral-700 shadow-sm ring-1 ring-neutral-200"
                  >
                    <CarFront className="h-4 w-4" />
                    OTW
                  </Link>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-neutral-400">
                  <span>{isToday(parseISO(job.scheduledStart ?? job.createdAt)) ? "Today" : format(parseISO(job.createdAt), "MMM d")}</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-brand-accent">
                    Open Job
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
