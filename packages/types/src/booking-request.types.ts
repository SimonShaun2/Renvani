import type { PaginatedResult } from "./customer.types.js";

export type BookingRequestStatus = "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
export type BookingSource = "google" | "facebook" | "instagram" | "yelp" | "direct" | "website" | "qr_code";
export type BookingUrgency = "emergency" | "this_week" | "flexible";
export type PreferredBookingWindow = "morning" | "afternoon" | "first_available";

export interface BookingRequest {
  id: string;
  companyId: string;
  customerId: string | null;
  jobId: string | null;
  assignedTechnicianId: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  zip: string;
  propertyType: string | null;
  serviceCategory: string | null;
  serviceType: string | null;
  serviceDetail: string | null;
  urgency: BookingUrgency | null;
  customerNotes: string | null;
  preferredDate: string | null;
  preferredWindow: PreferredBookingWindow | null;
  status: BookingRequestStatus;
  source: BookingSource;
  referenceNumber: string | null;
  isPropertyOwner: boolean | null;
  smsConsentAppointments: boolean | null;
  smsConsentMarketing: boolean | null;
  confirmedAt: Date | null;
  confirmedById: string | null;
  confirmationSentAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface BookingRequestListItem {
  id: string;
  referenceNumber: string | null;
  status: BookingRequestStatus;
  source: BookingSource;
  firstName: string;
  lastName: string;
  phone: string;
  zip: string;
  serviceCategory: string | null;
  serviceType: string | null;
  preferredDate: string | null;
  preferredWindow: PreferredBookingWindow | null;
  assignedTechnicianId: string | null;
  createdAt: Date;
}

export interface SubmitBookingRequestInput {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zip: string;
  propertyType?: string;
  serviceCategory?: string;
  serviceType?: string;
  serviceDetail?: string;
  urgency?: BookingUrgency;
  /** 24/7 emergency request from the public site; downgraded when the shop has emergency service off. */
  emergency?: boolean;
  customerNotes?: string;
  preferredDate?: string;
  preferredWindow?: PreferredBookingWindow;
  isPropertyOwner?: boolean;
  smsConsentAppointments?: boolean;
  smsConsentMarketing?: boolean;
  source?: BookingSource;
}

export interface ConfirmBookingRequestInput {
  technicianId: string;
  scheduledStart: string;
  scheduledEnd: string;
}

/** In-platform branded-site slot selection before final confirm (FS-21). */
export type HoldBookingSlotInput = ConfirmBookingRequestInput;

export interface BookingSlotHoldView {
  technicianId: string;
  scheduledStart: string;
  scheduledEnd: string;
}

/** Public slot hold requires signed token from submit (FS-21 security). */
export interface PublicHoldBookingSlotInput extends HoldBookingSlotInput {
  holdToken: string;
}

export interface DeclineBookingRequestInput {
  reason?: string;
}

export interface ListBookingRequestsQuery {
  status?: BookingRequestStatus;
  source?: BookingSource;
  page?: number;
  limit?: number;
}

export interface CheckZipCoverageResult {
  covered: boolean;
  techCount: number;
}

export interface BookingAvailabilityWindow {
  date: string;
  window: PreferredBookingWindow;
  start: string;
  end: string;
  technicianIds: string[];
}

export interface BookingConfirmationView {
  referenceNumber: string;
  status: BookingRequestStatus;
  companyName: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
}

export type BookingRequestListResult = PaginatedResult<BookingRequestListItem>;
