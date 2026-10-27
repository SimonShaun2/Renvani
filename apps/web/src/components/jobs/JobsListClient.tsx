"use client";

import "./jobs-motion.css";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, ChevronLeft, ChevronRight, Search } from "lucide-react";

import type { JobStatus } from "@fsm/types";
import { useJobsList } from "@/src/hooks/jobs.hooks";

import { EmptyState } from "../ui/EmptyState";
import { SkeletonCard } from "../ui/SkeletonCard";
import { StatBadge } from "../ui/StatBadge";
import { formatDateTime, formatStatusLabel, getStatusTone } from "./jobs.utils";
import { JOB_STATUS_OPTIONS, buildJobListQuery } from "./jobsList.utils";

const inputClass =
  "h-10 rounded-xl border border-[#e6dccb] bg-white px-3 text-sm text-[#0f1530] outline-none focus:border-[#f6b400] focus:ring-2 focus:ring-[#fff4d6]";

export function JobsListClient() {
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [status, from, to, debouncedSearch]);

  const query = useJobsList(buildJobListQuery({ status, from, to, search: debouncedSearch, page }));
  const jobs = query.data?.data ?? [];
  const totalPages = Math.max(1, query.data?.totalPages ?? 1);
  const hasFilters = status !== "all" || Boolean(from || to || debouncedSearch);

  return (
    <div className="space-y-6" data-jobs-reveal>
      <header>
        <h1 className="text-[32px] font-semibold tracking-tight text-[#0f1530]">Jobs</h1>
        <p className="mt-1 text-sm text-[#5e6684]">
          {query.data ? `${query.data.total} work orders` : "Work orders across your crew"}
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#e6dccb] bg-white p-4">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-medium text-[#5e6684]">
          Search
          <span className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5e6684]" />
            <input
              aria-label="Search jobs"
              className={`${inputClass} w-full pl-9`}
              placeholder="Job #, title, customer"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </span>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[#5e6684]">
          Status
          <select aria-label="Status" className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All statuses</option>
            {JOB_STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {formatStatusLabel(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[#5e6684]">
          Scheduled from
          <input aria-label="Scheduled from" type="date" className={inputClass} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[#5e6684]">
          Scheduled to
          <input aria-label="Scheduled to" type="date" className={inputClass} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </label>
        {hasFilters ? (
          <button
            type="button"
            className="h-10 rounded-xl px-3 text-sm font-medium text-[#2a3360] hover:bg-[#fff4d6]"
            onClick={() => {
              setStatus("all");
              setFrom("");
              setTo("");
              setSearch("");
            }}
          >
            Clear
          </button>
        ) : null}
      </div>

      {query.isLoading ? (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : query.isError ? (
        <EmptyState
          icon={Briefcase}
          title="Couldn't load jobs"
          subtitle="The jobs service didn't respond. Try again in a moment."
          action={
            <button type="button" className="rounded-xl bg-[#0f1530] px-4 py-2 text-sm font-semibold text-white" onClick={() => void query.refetch()}>
              Retry
            </button>
          }
        />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={hasFilters ? "No jobs match these filters" : "No jobs yet"}
          subtitle={hasFilters ? "Try another status or date range." : "New work orders will show up here."}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#e6dccb] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#faf6ee] text-xs uppercase tracking-wide text-[#5e6684]">
              <tr>
                <th className="px-4 py-3 font-medium">Job</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Customer</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">Technician</th>
                <th className="px-4 py-3 font-medium">Scheduled</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-t border-[#e6dccb] hover:bg-[#fff4d6]/50">
                  <td className="px-4 py-3">
                    <Link href={`/jobs/${job.id}`} className="font-semibold text-[#0f1530] hover:underline">
                      {job.title}
                    </Link>
                    <div className="text-xs text-[#5e6684]">#{job.jobNumber} · {formatStatusLabel(job.type)}</div>
                  </td>
                  <td className="hidden px-4 py-3 text-[#2a3360] md:table-cell">
                    {job.customer.firstName} {job.customer.lastName}
                    {job.property ? <div className="text-xs text-[#5e6684]">{job.property.addressLine1}</div> : null}
                  </td>
                  <td className="hidden px-4 py-3 text-[#2a3360] lg:table-cell">
                    {job.technician ? `${job.technician.firstName} ${job.technician.lastName}` : "Unassigned"}
                  </td>
                  <td className="px-4 py-3 text-[#2a3360]">{job.scheduledStart ? formatDateTime(job.scheduledStart) : "Not scheduled"}</td>
                  <td className="px-4 py-3">
                    <StatBadge label={formatStatusLabel(job.status)} tone={getStatusTone(job.status as JobStatus)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-[#e6dccb] px-4 py-3 text-sm text-[#5e6684]">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-[#e6dccb] p-1.5 disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-[#e6dccb] p-1.5 disabled:opacity-40">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
