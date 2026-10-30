"use client";

import "./jobs-motion.css";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Briefcase, ChevronLeft, ChevronRight, Search } from "lucide-react";

import { useJobsList } from "@/src/hooks/jobs.hooks";

import { EmptyState } from "../ui/EmptyState";
import { SkeletonCard } from "../ui/SkeletonCard";
import { CHIP_TONE_CLASS, JOB_COLUMNS, JOB_FILTER_CHIPS, COUNTS_PAGE_LIMIT, chipFilters, currentWeek, deriveWeekCounts, type JobFilterChip } from "./jobsList.config";
import { buildJobListQuery } from "./jobsList.utils";
import { NewJobPanel } from "./NewJobPanel";

function Kpi({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-[14px] border border-[#e6dccb] bg-white p-5">
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.8px] text-[#5e6684]">{label}</p>
      <p className="text-[30px] font-semibold leading-none text-[#0f1530]">{value}</p>
      <p className="text-xs text-[#5e6684]">{caption}</p>
    </div>
  );
}

const count = (n: number | undefined) => (n === undefined ? "—" : String(n));

export interface JobsListClientProps {
  /** From `/jobs?new=1&customerId=<id>` (parsed in the server page). */
  newJob?: { open: boolean; customerId: string };
}

export function JobsListClient({ newJob }: JobsListClientProps = {}) {
  const now = useMemo(() => new Date(), []);
  const [chip, setChip] = useState<JobFilterChip["key"]>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [chip, debouncedSearch]);

  // One counts request (current week); chip totals come from the list query itself and are remembered per chip.
  const weekQuery = useJobsList(
    buildJobListQuery({ status: "all", ...currentWeek(now), search: "", page: 1 }, COUNTS_PAGE_LIMIT)
  );
  const { week, today } = deriveWeekCounts(weekQuery.data, now);
  const query = useJobsList(buildJobListQuery({ ...chipFilters(chip, now), search: debouncedSearch, page }));
  const [seen, setSeen] = useState<Partial<Record<JobFilterChip["key"], number>>>({});
  const listTotal = query.data?.total;
  useEffect(() => {
    if (listTotal !== undefined && !debouncedSearch) setSeen((s) => (s[chip] === listTotal ? s : { ...s, [chip]: listTotal }));
  }, [chip, debouncedSearch, listTotal]);
  const counts: Record<JobFilterChip["key"], number | undefined> = { all: seen.all, unpaid: seen.unpaid, today: today ?? seen.today };
  const jobs = query.data?.data ?? [];
  const totalPages = Math.max(1, query.data?.totalPages ?? 1);
  const hasFilters = chip !== "all" || Boolean(debouncedSearch);

  return (
    <div className="space-y-6" data-jobs-reveal>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight text-[#0f1530]">Jobs</h1>
          <p className="mt-1 text-sm text-[#5e6684]">All jobs across your company</p>
        </div>
        <Link href="/jobs?new=1" className="rounded-[10px] bg-[#0f1530] px-[18px] py-3 text-sm font-semibold text-white hover:bg-[#2a3360]">
          New job
        </Link>
      </header>

      {newJob?.open ? <NewJobPanel key={newJob.customerId || "new"} initialCustomerId={newJob.customerId} /> : null}

      <section aria-label="Job stats" className="flex flex-wrap gap-4">
        <Kpi label="Jobs this week" value={count(week)} caption="Scheduled Mon–Sun" />
        <Kpi label="Scheduled today" value={count(today)} caption="On today's schedule" />
        <Kpi label="Unpaid" value="—" caption={counts.unpaid === undefined ? "Not available yet" : `${counts.unpaid} jobs · amount not available yet`} />
        <Kpi label="Avg ticket" value="—" caption="Not available yet" />
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {JOB_FILTER_CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={chip === c.key}
            onClick={() => setChip(c.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${CHIP_TONE_CLASS[c.tone]} ${
              chip === c.key ? "ring-2 ring-[#0f1530]" : "opacity-80 hover:opacity-100"
            }`}
          >
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
            {c.label} · {count(counts[c.key])}
          </button>
        ))}
        <span className="flex-1" />
        <label className="relative w-full sm:w-[260px]">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5e6684]" />
          <input
            aria-label="Search jobs"
            className="h-10 w-full rounded-[10px] border border-[#e6dccb] bg-white pl-9 pr-3 text-[13px] text-[#0f1530] outline-none focus:border-[#f6b400] focus:ring-2 focus:ring-[#fff4d6]"
            placeholder="Search jobs, customers…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
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
          subtitle={hasFilters ? "Try another filter or search." : "New work orders will show up here."}
        />
      ) : (
        <div className="overflow-x-auto rounded-[14px] border border-[#e6dccb] bg-white">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-[#fbf6ef] font-mono text-[10px] uppercase tracking-[0.8px] text-[#5e6684]">
              <tr>
                {JOB_COLUMNS.map((col) => (
                  <th key={col.key} className="px-5 py-2.5 font-medium">
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-t border-[#e6dccb] text-[#2a3360] hover:bg-[#fff4d6]/50">
                  {JOB_COLUMNS.map((col) => (
                    <td key={col.key} className="px-5 py-3.5">
                      {col.cell(job, now)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-[#e6dccb] px-5 py-3 text-sm text-[#5e6684]">
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
