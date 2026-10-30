import type { HomeServiceTrade } from "./home-services/trade.js";
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
  phone: string | null;
  logoUrl: string | null;
  serviceAreaZipCodes: string[];
  /** Active service_areas.name values (shop-entered labels, typically city names). */
  serviceAreaNames: string[];
  /** IANA timezone for availableHoursStart/End + availableDays. */
  timezone: string;
  /** Shop-selected trade (company settings), or null when unset. */
  trade?: HomeServiceTrade | null;
  /** schema.org @type for the site JSON-LD derived from `trade`, or null when unset. */
  tradeSchemaType?: string | null;
  /** "Describe your trade" when trade is "other", else null. */
  tradeDescription?: string | null;
}
