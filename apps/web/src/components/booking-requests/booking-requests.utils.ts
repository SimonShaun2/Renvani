import type { BookingUrgency } from "@fsm/types";

import type { BookingRequestListItem } from "@/src/hooks/dispatch.hooks";

/** #320 sorts emergencies first server-side but the list item has no `urgency` yet (missing field for Dev A). */
export type InboxItem = BookingRequestListItem & { urgency?: BookingUrgency | null };

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
