"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { JobDetail } from "@fsm/types";

import { StatBadge } from "@/src/components/ui/StatBadge";

import { JobStatusTransitions } from "./JobStatusTransitions";
import { formatStatusLabel, getStatusTone } from "./jobs.utils";

interface JobHeaderProps {
  job: JobDetail;
  pendingRequiredTasks: number;
  onOpenOTW: () => void;
  invoiceAction?: ReactNode;
}

export function JobHeader({ job, pendingRequiredTasks, onOpenOTW, invoiceAction }: JobHeaderProps) {
  return (
    <section className="surface-card px-6 py-6">
      <Link href="/jobs" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-accent">
        <ArrowLeft className="h-4 w-4" />
        Back to Jobs
      </Link>

      <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">{job.title}</h1>
            <StatBadge label={formatStatusLabel(job.status)} tone={getStatusTone(job.status)} className="px-3 py-1.5 text-sm" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-neutral-500">
            <span className="font-semibold text-brand-accent">{job.jobNumber}</span>
            <span>•</span>
            <span>
              {job.customer.firstName} {job.customer.lastName}
            </span>
            {job.technician ? (
              <>
                <span>•</span>
                <span>
                  {job.technician.firstName} {job.technician.lastName}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 xl:max-w-[56%] xl:items-end">
          {invoiceAction ? <div className="flex flex-wrap gap-3">{invoiceAction}</div> : null}
          <JobStatusTransitions job={job} pendingRequiredTasks={pendingRequiredTasks} onOpenOTW={onOpenOTW} />
        </div>
      </div>
    </section>
  );
}
