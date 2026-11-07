import { Temporal } from "@js-temporal/polyfill";
import { AppError, ErrorCode, type DispatchWeekJob } from "@fsm/types";

export function buildDispatchWeekCalendar(
  timezone: string,
  date?: string,
  now = new Date(),
) {
  try {
    if (!timezone || /^[+-]/.test(timezone))
      throw new RangeError("Named timezone required");
    const today = Temporal.Instant.from(now.toISOString())
      .toZonedDateTimeISO(timezone)
      .toPlainDate();
    if (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(date))
      throw new RangeError("Invalid date");
    const anchor =
      date === undefined
        ? today
        : Temporal.PlainDate.from(date, { overflow: "reject" });
    if (anchor.year < 1900 || anchor.year > 9998)
      throw new RangeError("Date outside the supported calendar range");
    const monday = anchor.subtract({ days: anchor.dayOfWeek - 1 });
    const instant = (day: Temporal.PlainDate) =>
      day
        .toZonedDateTime(timezone)
        .toInstant()
        .toString({ smallestUnit: "millisecond" });
    const days = Array.from({ length: 7 }, (_, i) => {
      const day = monday.add({ days: i });
      const start = instant(day),
        endExclusive = instant(day.add({ days: 1 }));
      if (Date.parse(endExclusive) <= Date.parse(start))
        throw new RangeError("Nonexistent local day");
      return {
        date: day.toString(),
        start,
        endExclusive,
        jobIds: [] as string[],
      };
    });
    return {
      timezone,
      today: today.toString(),
      weekStart: monday.toString(),
      weekEnd: monday.add({ days: 6 }).toString(),
      previousWeek: monday.subtract({ days: 7 }).toString(),
      nextWeek: monday.add({ days: 7 }).toString(),
      rangeStart: days[0]!.start,
      rangeEndExclusive: days[6]!.endExclusive,
      days,
    };
  } catch {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "The date or company timezone is invalid. Check the company timezone and choose a valid calendar date.",
    );
  }
}

/** Half-open overlap: an end exactly at midnight never occupies the following day. */
export function weekJobOverlaps(
  job: Pick<
    DispatchWeekJob,
    "scheduledStart" | "scheduledEnd" | "timingWarning"
  >,
  start: string,
  endExclusive: string,
): boolean {
  const a = Date.parse(job.scheduledStart),
    lo = Date.parse(start),
    hi = Date.parse(endExclusive);
  if (!Number.isFinite(a) || a >= hi) return false;
  if (job.timingWarning || !job.scheduledEnd) return a >= lo;
  return Date.parse(job.scheduledEnd) > lo;
}
