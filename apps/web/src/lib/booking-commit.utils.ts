import type { PublicRecurringScheduleRecord } from "@/src/hooks/booking.hooks";

export function suggestsRecurringServiceIntent(input: {
  serviceCategory?: string;
  serviceType?: string;
  serviceDetail?: string;
}): boolean {
  const haystack = [input.serviceCategory, input.serviceType, input.serviceDetail]
    .filter((value): value is string => Boolean(value && value.trim().length > 0))
    .join(" ")
    .toLowerCase();

  return (
    haystack.includes("vip") ||
    haystack.includes("recurring") ||
    haystack.includes("maintenance") ||
    haystack.includes("weekly") ||
    haystack.includes("biweekly") ||
    haystack.includes("monthly")
  );
}

export function buildRecurringScheduleMessage(
  schedule: PublicRecurringScheduleRecord | null | undefined
): string | null {
  if (!schedule || schedule.scheduleKind === "none") {
    return null;
  }

  if (schedule.linked) {
    if (schedule.scheduleKind === "vip") {
      return "This visit is linked to your VIP service plan. Our team will keep your priority schedule up to date.";
    }

    return "This visit is linked to your maintenance plan. We will keep your recurring service dates aligned.";
  }

  if (schedule.scheduleKind === "vip") {
    return "We noted VIP priority for this booking. Ask our team about a VIP plan if you are not enrolled yet.";
  }

  return "We noted recurring maintenance interest. Our team can help you enroll in a maintenance plan.";
}

export const BOOKING_CONFIRMED_SESSION_PREFIX = "renvani-booking-confirmed:";

export function saveConfirmedBookingSnapshot(
  slug: string,
  referenceNumber: string,
  snapshot: {
    status: string;
    jobId: string;
    recurringSchedule: PublicRecurringScheduleRecord;
    scheduledStart: string;
    scheduledEnd: string;
    manageToken?: string | null;
  }
): void {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.setItem(
    `${BOOKING_CONFIRMED_SESSION_PREFIX}${slug}:${referenceNumber}`,
    JSON.stringify(snapshot)
  );
}

export function readConfirmedBookingSnapshot(
  slug: string,
  referenceNumber: string
): {
  status: string;
  jobId: string;
  recurringSchedule: PublicRecurringScheduleRecord;
  scheduledStart: string;
  scheduledEnd: string;
  manageToken?: string | null;
} | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = sessionStorage.getItem(`${BOOKING_CONFIRMED_SESSION_PREFIX}${slug}:${referenceNumber}`);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as {
      status: string;
      jobId: string;
      recurringSchedule: PublicRecurringScheduleRecord;
      scheduledStart: string;
      scheduledEnd: string;
      manageToken?: string | null;
    };
  } catch {
    return null;
  }
}

export function clearConfirmedBookingSnapshot(slug: string, referenceNumber: string): void {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.removeItem(`${BOOKING_CONFIRMED_SESSION_PREFIX}${slug}:${referenceNumber}`);
}
