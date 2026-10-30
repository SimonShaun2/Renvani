import type { BookingUrgency } from "@fsm/types";

import type { BookingRequestListItem } from "@/src/hooks/dispatch.hooks";

/** #320 (4074fa1) list/detail items carry `urgency` and `downgraded` (emergency asked for, shop has it off). */
export type InboxItem = BookingRequestListItem & { urgency?: BookingUrgency | null; downgraded?: boolean };

export function wasDowngraded(item: object | null | undefined): boolean {
  return (item as { downgraded?: unknown } | null | undefined)?.downgraded === true;
}

export const DOWNGRADED_NOTE = "Asked for emergency · sent as a regular request";

export function isEmergency(item: { urgency?: BookingUrgency | string | null | undefined }): boolean {
  return item.urgency === "emergency";
}

/** Emergency first, then newest (mirrors #320's listBookingRequests sort; stable when urgency is absent). */
export function sortInbox<T extends InboxItem>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) =>
      Number(isEmergency(b)) - Number(isEmergency(a)) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export const STATUS_LABEL: Record<string, string> = {
  pending: "New",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed",
  no_show: "No-show"
};

export function sourceLabel(source: string): string {
  return source === "website" ? "Website" : "Booking";
}
