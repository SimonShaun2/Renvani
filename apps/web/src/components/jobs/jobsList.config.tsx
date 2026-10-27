import type { ReactNode } from "react";
import Link from "next/link";

import type { JobListRecord } from "@/src/hooks/jobs.hooks";

import { formatStatusLabel } from "./jobs.utils";

/* Figma 144:567 Jobs list. Columns, filter chips and state chips are config objects so new ones are one entry. */

export type JobChipTone = "neutral" | "blue" | "amber" | "red" | "green";

export const CHIP_TONE_CLASS: Record<JobChipTone, string> = {
  neutral: "bg-[#eef0f5] text-[#2a3360]",
  blue: "bg-[#e5eafb] text-[#2d4bd8]",
  amber: "bg-[#fff4d6] text-[#7a5600]",
  red: "bg-[#fbe3dc] text-[#a3261a]",
  green: "bg-[#e4f1e8] text-[#1f6b3a]"
};

/** Frame state chips: dispatched → "On the way", invoiced → "Unpaid"; everything else uses the API status label. */
const STATE_CHIPS: Record<string, { label: string; tone: JobChipTone }> = {
  dispatched: { label: "On the way", tone: "blue" },
  in_progress: { label: "In progress", tone: "blue" },
  scheduled: { label: "Scheduled", tone: "neutral" },
  completed: { label: "Completed", tone: "green" },
  paid: { label: "Paid", tone: "green" },
  invoiced: { label: "Unpaid", tone: "amber" },
  on_hold: { label: "On hold", tone: "amber" },
  cancelled: { label: "Cancelled", tone: "red" }
};

export function jobStateChip(status: string): { label: string; tone: JobChipTone } {
  return STATE_CHIPS[status] ?? { label: formatStatusLabel(status), tone: "neutral" };
}

export function Chip({ label, tone }: { label: string; tone: JobChipTone }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${CHIP_TONE_CLASS[tone]}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Frame "When": "Today 10:30a", "Yesterday", "Oct 25". */
export function formatWhen(iso: string | null, now = new Date()): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" })
    .format(date)
    .replace(" AM", "a")
    .replace(" PM", "p");
  if (sameDay(date, now)) return `Today ${time}`;
  if (sameDay(date, yesterday)) return "Yesterday";
  if (sameDay(date, tomorrow)) return `Tomorrow ${time}`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

/** Frame "Marco R." */
export function formatTechShort(tech: JobListRecord["technician"]): string {
  if (!tech) return "Unassigned";
  return `${tech.firstName} ${tech.lastName ? `${tech.lastName.charAt(0)}.` : ""}`.trim();
}

export interface JobColumn {
  key: string;
  header: string;
  className?: string;
  cell: (job: JobListRecord, now: Date) => ReactNode;
}

export const JOB_COLUMNS: JobColumn[] = [
  {
    key: "job",
    header: "Job",
    cell: (job) => (
      <Link href={`/jobs/${job.id}`} className="font-semibold text-[#0f1530] hover:underline">
        {job.jobNumber}
      </Link>
    )
  },
  { key: "customer", header: "Customer", cell: (job) => `${job.customer.firstName} ${job.customer.lastName}`.trim() },
  {
    key: "service",
    header: "Service",
    cell: (job) => (
      <Link href={`/jobs/${job.id}`} className="hover:underline">
        {job.title}
      </Link>
    )
  },
  { key: "when", header: "When", cell: (job, now) => formatWhen(job.scheduledStart, now) },
  { key: "tech", header: "Tech", cell: (job) => formatTechShort(job.technician) },
  {
    key: "state",
    header: "State",
    cell: (job) => {
      const chip = jobStateChip(job.status);
      return <Chip label={chip.label} tone={chip.tone} />;
    }
  }
];

export interface JobFilterChip {
  key: "all" | "today" | "unpaid";
  label: string;
  tone: JobChipTone;
}

/** Frame chips 144:655 / 144:658 / 144:661. "Needs review" (144:664) has no API and is omitted. */
export const JOB_FILTER_CHIPS: JobFilterChip[] = [
  { key: "all", label: "All", tone: "neutral" },
  { key: "today", label: "Today", tone: "blue" },
  { key: "unpaid", label: "Unpaid", tone: "amber" }
];

export function toDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Filters for each chip, in buildJobListQuery terms. */
export function chipFilters(key: JobFilterChip["key"], now = new Date()): { status: string; from: string; to: string } {
  if (key === "today") {
    const today = toDateInput(now);
    return { status: "all", from: today, to: today };
  }
  // Unpaid = status `invoiced` only for now. Revisit when paid/unpaid invoice state lands on GET /jobs.
  if (key === "unpaid") return { status: "invoiced", from: "", to: "" };
  return { status: "all", from: "", to: "" };
}

/** Monday–Sunday of the current week, as date inputs. */
export function currentWeek(now = new Date()): { from: string; to: string } {
  const start = new Date(now);
  start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { from: toDateInput(start), to: toDateInput(end) };
}

/** Max page size GET /jobs allows; the single counts request uses it. */
export const COUNTS_PAGE_LIMIT = 100;

/**
 * Derives KPI counts from ONE GET /jobs request for the current week (no counts endpoint on dev).
 * week = exact `total`; today = counted from the rows, only when the page holds every job of the week.
 */
export function deriveWeekCounts(
  res: { data: { scheduledStart: string | null }[]; total: number } | undefined,
  now = new Date()
): { week: number | undefined; today: number | undefined } {
  if (!res) return { week: undefined, today: undefined };
  if (res.data.length < res.total) return { week: res.total, today: undefined };
  const today = toDateInput(now);
  const n = res.data.filter((j) => j.scheduledStart && toDateInput(new Date(j.scheduledStart)) === today).length;
  return { week: res.total, today: n };
}
