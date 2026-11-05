import type { DispatchWeekJob } from "@fsm/types";

/** Date-only headings are calendar labels, not browser-local instants. */
export function formatWeekDate(
  date: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const instant = new Date(`${date}T12:00:00Z`);
  if (!options) {
    const weekday = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone: "UTC",
    }).format(instant);
    return `${weekday} ${instant.getUTCDate()}`;
  }
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: "UTC",
  }).format(instant);
}

export function formatWeeklyJobTime(
  job: DispatchWeekJob,
  timezone: string,
): string {
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  const start = format.format(new Date(job.scheduledStart));
  if (job.timingWarning || !job.scheduledEnd)
    return `${start} · end time unavailable`;
  return `${start} – ${format.format(new Date(job.scheduledEnd))}`;
}

export function weeklyJobContinuation(
  job: DispatchWeekJob,
  day: { start: string; endExclusive: string },
): string {
  if (job.timingWarning || !job.scheduledEnd)
    return "Check the job's scheduled end time.";
  const before = Date.parse(job.scheduledStart) < Date.parse(day.start);
  const after = Date.parse(job.scheduledEnd) > Date.parse(day.endExclusive);
  if (before && after)
    return "Continues from an earlier day and into the next day.";
  if (before) return "Continued from an earlier day.";
  if (after) return "Continues into the next day.";
  return "View job";
}
