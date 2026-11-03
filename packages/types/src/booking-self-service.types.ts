import type { BookingConfirmationView } from "./booking-request.types.js";

export interface BookingSelfServiceView {
  bookingSlug: string;
  referenceNumber: string;
  companyName: string;
  confirmation: BookingConfirmationView;
  canReschedule: boolean;
  canCancel: boolean;
  cutoffHours: number;
  expiresAt: string;
}

export interface PublicBookingManageHoldInput {
  technicianId: string;
  scheduledStart: string;
  scheduledEnd: string;
}

export interface PublicBookingManageRescheduleInput extends PublicBookingManageHoldInput {}

export interface BookingSelfServiceActionResult {
  referenceNumber: string;
  status: "confirmed" | "cancelled";
  scheduledStart: string | null;
  scheduledEnd: string | null;
}

export type BookingManageTokenIssueContext = {
  recurringSchedule: {
    linked: boolean;
    scheduleKind: "vip" | "maintenance" | "none";
  };
};
