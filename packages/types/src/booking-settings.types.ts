export interface BookingSettings {
  id: string;
  companyId: string;
  isEnabled: boolean;
  bookingSlug: string | null;
  offeredServices: Array<Record<string, unknown>>;
  availableHoursStart: number | null;
  availableHoursEnd: number | null;
  availableDays: string[] | null;
  slotDuration: number | null;
  maxAdvanceDays: number | null;
  autoConfirm: boolean | null;
  googleReviewUrl: string | null;
  yelpReviewUrl: string | null;
  facebookReviewUrl: string | null;
  customReviewUrl: string | null;
  tagline: string | null;
  allowZipOverflow: boolean | null;
  balanceWorkload: boolean | null;
  notifyOnNewBooking: boolean | null;
  notificationEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface UpdateBookingSettingsInput {
  isEnabled?: boolean;
  bookingSlug?: string;
  offeredServices?: Array<Record<string, unknown>>;
  availableHoursStart?: number;
  availableHoursEnd?: number;
  availableDays?: string[];
  slotDuration?: number;
  maxAdvanceDays?: number;
  autoConfirm?: boolean;
  googleReviewUrl?: string | null;
  yelpReviewUrl?: string | null;
  facebookReviewUrl?: string | null;
  customReviewUrl?: string | null;
  tagline?: string | null;
  allowZipOverflow?: boolean;
  balanceWorkload?: boolean;
  notifyOnNewBooking?: boolean;
  notificationEmail?: string | null;
}

export interface PublicBookingSettings {
  companyName: string;
  companySlug: string;
  bookingSlug: string;
  offeredServices: Array<Record<string, unknown>>;
  availableHoursStart: number;
  availableHoursEnd: number;
  availableDays: string[];
  slotDuration: number;
  maxAdvanceDays: number;
  googleReviewUrl: string | null;
  yelpReviewUrl: string | null;
  facebookReviewUrl: string | null;
  customReviewUrl: string | null;
  tagline: string | null;
  /** Read-only 24/7 emergency availability (company settings). */
  emergencyService?: { enabled: boolean; hoursText: string | null };
  phone: string | null;
  logoUrl: string | null;
  serviceAreaZipCodes: string[];
  /** Active service_areas.name values (shop-entered labels, typically city names). */
  serviceAreaNames: string[];
  /** IANA timezone for availableHoursStart/End + availableDays. */
  timezone: string;
}
