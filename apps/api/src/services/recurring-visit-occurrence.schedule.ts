import { Temporal } from "@js-temporal/polyfill";

import type { maintenancePlans } from "@fsm/db";

type MaintenancePlanFrequency = typeof maintenancePlans.$inferSelect.frequency;

const FREQUENCY_MONTH_STEP: Record<MaintenancePlanFrequency, number> = {
  monthly: 1,
  bi_monthly: 2,
  quarterly: 3,
  bi_annual: 6,
  annual: 12
};

function normalizeLocalTime(localTime: string): string {
  const trimmed = localTime.trim();
  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00`;
  }

  return trimmed;
}

export function monthsBetweenOccurrences(frequency: MaintenancePlanFrequency): number {
  return FREQUENCY_MONTH_STEP[frequency];
}

/** Calendar-month occurrence local dates from anchor (index 0 = anchor), no month-end drift. */
export function planOccurrenceLocalDates(
  anchorLocalDate: string,
  frequency: MaintenancePlanFrequency,
  count: number
): string[] {
  if (count < 1) {
    return [];
  }

  const step = monthsBetweenOccurrences(frequency);
  const dates: string[] = [];
  const anchor = Temporal.PlainDate.from(anchorLocalDate);

  // Each occurrence is computed from the anchor (anchor + n*step months), never chained from the
  // previous one, so a Jan 31 anchor yields Feb 28/29, Mar 31, Apr 30 ... (clamped per target month).
  for (let index = 0; index < count; index++) {
    dates.push(anchor.add({ months: index * step }, { overflow: "constrain" }).toString());
  }

  return dates;
}

export function localDateTimeToUtc(
  localDate: string,
  localTime: string,
  timeZone: string
): Date {
  const plainTime = Temporal.PlainTime.from(normalizeLocalTime(localTime));
  const zoned = Temporal.PlainDate.from(localDate).toZonedDateTime({
    timeZone,
    plainTime
  });

  return new Date(zoned.epochMilliseconds);
}

/** Today's calendar date in the given IANA time zone (YYYY-MM-DD). */
export function todayLocalDate(timeZone: string, now: Date = new Date()): string {
  return Temporal.Instant.fromEpochMilliseconds(now.getTime()).toZonedDateTimeISO(timeZone).toPlainDate().toString();
}
