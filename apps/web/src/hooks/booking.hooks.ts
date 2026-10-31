"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/src/lib/api";
import { publicApi } from "@/src/lib/public-api";

interface PaginatedResponse<TItem> {
  data: TItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PublicBookingSettingsRecord {
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
  customReviewUrl?: string | null;
  tagline?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  serviceAreaZipCodes?: string[];
  /** Active service-area names (inquiry contract, Dev C #268). Absent until that API ships. */
  serviceAreaNames?: string[];
  /** Shop IANA timezone for the hours above (inquiry contract, Dev C #268). */
  timezone?: string | null;
}

export interface ZipCoverageRecord {
  covered: boolean;
  techCount: number;
}

export interface BookingAvailabilityRecord {
  date: string;
  window: "morning" | "afternoon" | "first_available";
  start: string;
  end: string;
  technicianIds: string[];
}

export interface BookingConfirmationRecord {
  referenceNumber: string;
  status: string;
  companyName: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
}

export interface PublicRecurringScheduleRecord {
  linked: boolean;
  scheduleKind: "vip" | "maintenance" | "none";
  maintenancePlanId: string | null;
  maintenanceVisitId: string | null;
}

export interface PublicSlotHoldInput {
  holdToken: string;
  technicianId: string;
  scheduledStart: string;
  scheduledEnd: string;
}

export interface PublicConfirmBookingInput {
  technicianId: string;
  scheduledStart: string;
  scheduledEnd: string;
}

export interface BookingSettingsRecord {
  id: string;
  companyId: string;
  isEnabled: boolean;
  bookingSlug: string | null;
  offeredServices: Array<Record<string, unknown>>;
  availableHoursStart: number | null;
  availableHoursEnd: number | null;
  availableDays: string[];
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
  autoAssignTech?: boolean | null;
  updatedAt: string;
}

interface BookingSlugAvailabilityResponse {
  slug: string;
  available: boolean;
}

export interface BookingStatsRecord {
  totalRequests: number;
  confirmationRate: number;
  confirmedBookings: number;
  estimatedRevenue: string;
  bySource: Array<{
    source: string;
    count: number;
  }>;
}

export interface BookingDemandByZipRecord {
  zip: string;
  count: number;
}

interface PublicBookingResponse {
  booking: PublicBookingSettingsRecord;
}

interface PublicAvailabilityResponse {
  availability: BookingAvailabilityRecord[];
}

interface SubmitBookingResponse {
  bookingRequest: {
    id: string;
    referenceNumber: string | null;
    status: string;
  };
  confirmation: BookingConfirmationRecord;
  holdToken?: string | null;
}

interface PublicSlotHoldResponse {
  bookingRequest: {
    id: string;
    referenceNumber: string | null;
    status: string;
    assignedTechnicianId: string | null;
  };
  hold: {
    technicianId: string;
    scheduledStart: string;
    scheduledEnd: string;
  };
}

export interface PublicConfirmBookingResponse {
  bookingRequest: {
    id: string;
    referenceNumber: string | null;
    status: string;
    jobId: string;
  };
  jobId: string;
  recurringSchedule: PublicRecurringScheduleRecord;
  manageToken: string | null;
}

export interface BookingSelfServiceViewRecord {
  bookingSlug: string;
  referenceNumber: string;
  companyName: string;
  confirmation: BookingConfirmationRecord;
  canReschedule: boolean;
  canCancel: boolean;
  cutoffHours: number;
  expiresAt: string;
}

interface ConfirmationResponse {
  confirmation: BookingConfirmationRecord;
}

interface BookingSettingsResponse {
  settings: BookingSettingsRecord;
}

interface BookingStatsResponse {
  stats: BookingStatsRecord;
}

interface BookingDemandByZipResponse extends PaginatedResponse<BookingDemandByZipRecord> {}

function buildQueryString(values: Record<string, string | number | boolean | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      continue;
    }

    params.set(key, String(value));
  }

  return params.toString();
}

const bookingKeys = {
  publicSettings: (slug: string) => ["booking", "public", slug] as const,
  publicAvailability: (slug: string, zip: string, date: string | null) =>
    ["booking", "availability", slug, zip, date] as const,
  confirmation: (slug: string, referenceNumber: string) => ["booking", "confirmation", slug, referenceNumber] as const,
  settings: ["booking", "settings"] as const,
  stats: (days: number) => ["booking", "stats", days] as const,
  demand: (days: number) => ["booking", "demand", days] as const
};

export function usePublicBookingSettings(slug: string | null) {
  return useQuery({
    queryKey: slug ? bookingKeys.publicSettings(slug) : bookingKeys.publicSettings("pending"),
    queryFn: () => publicApi.get<PublicBookingResponse>(`/api/v1/public/booking/${slug}`),
    enabled: Boolean(slug)
  });
}

export function useCheckZipCoverage(slug: string) {
  return useMutation({
    mutationFn: (zip: string) =>
      publicApi.post<ZipCoverageRecord>(`/api/v1/public/booking/${slug}/check-zip`, { zip })
  });
}

export function useCaptureBookingInterest(slug: string) {
  return useMutation({
    mutationFn: (input: { zip: string; email: string }) =>
      publicApi.post<{ success: boolean }>(`/api/v1/public/booking/${slug}/email-capture`, input)
  });
}

export function usePublicAvailability(slug: string | null, zip: string | null, date: string | null) {
  const queryString = buildQueryString({
    zip: zip ?? undefined,
    date: date ?? undefined
  });

  return useQuery({
    queryKey: slug && zip ? bookingKeys.publicAvailability(slug, zip, date) : bookingKeys.publicAvailability("pending", "pending", null),
    queryFn: () =>
      publicApi.get<PublicAvailabilityResponse>(`/api/v1/public/booking/${slug}/availability?${queryString}`),
    enabled: Boolean(slug && zip)
  });
}

export function useSubmitBookingRequest(slug: string) {
  return useMutation({
    mutationFn: ({
      source,
      body,
      idempotencyKey
    }: {
      source?: string;
      body: Record<string, unknown>;
      idempotencyKey?: string;
    }) =>
      publicApi.post<SubmitBookingResponse>(
        `/api/v1/public/booking/${slug}/submit${source ? `?src=${encodeURIComponent(source)}` : ""}`,
        body,
        idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : undefined
      )
  });
}

export function usePublicSlotHold(slug: string, referenceNumber: string) {
  return useMutation({
    mutationFn: (input: PublicSlotHoldInput) =>
      publicApi.post<PublicSlotHoldResponse>(
        `/api/v1/public/booking/${slug}/requests/${encodeURIComponent(referenceNumber)}/slot-hold`,
        input
      )
  });
}

export function usePublicConfirmBooking(slug: string, referenceNumber: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: PublicConfirmBookingInput) =>
      publicApi.post<PublicConfirmBookingResponse>(
        `/api/v1/public/booking/${slug}/requests/${encodeURIComponent(referenceNumber)}/confirm`,
        input
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: bookingKeys.confirmation(slug, referenceNumber)
      });
    }
  });
}

export function useBookingConfirmation(slug: string | null, referenceNumber: string | null) {
  return useQuery({
    queryKey:
      slug && referenceNumber
        ? bookingKeys.confirmation(slug, referenceNumber)
        : bookingKeys.confirmation("pending", "pending"),
    queryFn: () =>
      publicApi.get<ConfirmationResponse>(`/api/v1/public/booking/${slug}/confirmation/${referenceNumber}`),
    enabled: Boolean(slug && referenceNumber)
  });
}

export function useBookingSettings() {
  return useQuery({
    queryKey: bookingKeys.settings,
    queryFn: () => api.get<BookingSettingsResponse>("/api/v1/booking-settings"),
    staleTime: 60 * 1000
  });
}

export function useUpdateBookingSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Partial<BookingSettingsRecord>) =>
      api.patch<BookingSettingsResponse>("/api/v1/booking-settings", input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: bookingKeys.settings }),
        queryClient.invalidateQueries({ queryKey: ["dispatch"] })
      ]);
    }
  });
}

export function useCheckBookingSlugAvailability() {
  return useMutation({
    mutationFn: (slug: string) =>
      api.get<BookingSlugAvailabilityResponse>(
        `/api/v1/booking-settings/check-slug?slug=${encodeURIComponent(slug)}`
      )
  });
}

export function useBookingStats(days = 30) {
  return useQuery({
    queryKey: bookingKeys.stats(days),
    queryFn: () => api.get<BookingStatsResponse>(`/api/v1/booking-requests/stats?days=${days}`),
    staleTime: 60 * 1000
  });
}

export function useBookingDemandByZip(days = 30) {
  return useQuery({
    queryKey: bookingKeys.demand(days),
    queryFn: () => api.get<BookingDemandByZipResponse>(`/api/v1/booking-requests/demand-by-zip?days=${days}`),
    staleTime: 60 * 1000
  });
}

export function useBookingSelfService(manageToken: string | null) {
  return useQuery({
    queryKey: ["booking", "self-service", manageToken],
    queryFn: () =>
      publicApi.get<{ selfService: BookingSelfServiceViewRecord }>(
        `/api/v1/public/booking/manage/${encodeURIComponent(manageToken ?? "")}`
      ),
    enabled: Boolean(manageToken)
  });
}

export function useBookingSelfServiceCancel(manageToken: string) {
  return useMutation({
    mutationFn: () =>
      publicApi.post<{ result: { status: string } }>(
        `/api/v1/public/booking/manage/${encodeURIComponent(manageToken)}/cancel`,
        {}
      )
  });
}
