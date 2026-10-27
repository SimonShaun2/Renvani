"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { publicEnv } from "@fsm/config";
import type {
  AutoFitResponse,
  ConfirmBookingRequestInput,
  DispatchView,
  JobDetail,
  CreateJobInput
} from "@fsm/types";

import { api, resolveBearerToken } from "@/src/lib/api";
import { assignAndScheduleJob } from "@/src/lib/dispatch-actions";
import { useDispatchStore } from "@/src/stores/dispatch.store";
import type { UnscheduledJobListItem } from "@/src/hooks/dashboard.hooks";

interface PaginatedResponse<TItem> {
  data: TItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BookingRequestListItem {
  id: string;
  referenceNumber: string | null;
  status: string;
  source: string;
  firstName: string;
  lastName: string;
  phone: string;
  zip: string;
  serviceCategory: string | null;
  serviceType: string | null;
  preferredDate: string | null;
  preferredWindow: string | null;
  assignedTechnicianId: string | null;
  createdAt: string;
}

export interface BookingRequestDetail extends BookingRequestListItem {
  companyId: string;
  customerId: string | null;
  jobId: string | null;
  email: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  propertyType: string | null;
  serviceDetail: string | null;
  urgency: string | null;
  customerNotes: string | null;
  isPropertyOwner: boolean | null;
  smsConsentAppointments: boolean | null;
  smsConsentMarketing: boolean | null;
  confirmedAt: string | null;
  confirmationSentAt: string | null;
}

export interface ApprovedEstimateQueueItem {
  id: string;
  estimateNumber: string;
  title: string | null;
  total: string;
  approvedAt: string | null;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface CustomerSearchItem {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
}

export interface ScheduleBoardJobInput {
  jobId: string;
  technicianId: string;
  scheduledStart: string;
  scheduledEnd: string;
}

export interface CreateQuickJobInput extends CreateJobInput {
  technicianId: string;
  scheduledStart: string;
  scheduledEnd: string;
}

function toQueryString(values: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  return params.toString();
}

async function invalidateDispatchQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["dispatch"] }),
    queryClient.invalidateQueries({ queryKey: ["dispatch-unscheduled"] }),
    queryClient.invalidateQueries({ queryKey: ["approved-estimates"] }),
    queryClient.invalidateQueries({ queryKey: ["booking-requests"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard-jobs"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard-unscheduled-jobs"] })
  ]);
}

export function useDispatchView(date: string) {
  const queryClient = useQueryClient();
  const [streamLive, setStreamLiveState] = useState(true);
  const setStreamLive = useDispatchStore((state) => state.setStreamLive);

  useEffect(() => {
    let cancelled = false;
    let eventSource: EventSource | null = null;
    const update = (live: boolean) => {
      if (cancelled) return;
      setStreamLiveState(live);
      setStreamLive(live);
    };

    // Same precedence as apiFetch: Clerk session token first, legacy JWT as fallback.
    void resolveBearerToken().then(({ token }) => {
      if (cancelled) return;
      if (!token || typeof EventSource === "undefined") {
        update(false);
        return;
      }

      const params = new URLSearchParams({ date, access_token: token });
      eventSource = new EventSource(`${publicEnv.NEXT_PUBLIC_API_URL}/api/v1/dispatch/stream?${params.toString()}`);
      eventSource.onopen = () => update(true);
      eventSource.addEventListener("ping", () => {
        void invalidateDispatchQueries(queryClient);
      });
      eventSource.onerror = () => {
        update(false);
        eventSource?.close();
      };
    });

    return () => {
      update(false);
      cancelled = true;
      eventSource?.close();
    };
  }, [date, queryClient, setStreamLive]);

  return useQuery({
    queryKey: ["dispatch", date],
    queryFn: () => api.get<DispatchView>(`/api/v1/dispatch?date=${date}`),
    staleTime: 60 * 1000,
    refetchInterval: streamLive ? false : 30_000,
    refetchIntervalInBackground: true
  });
}

export function useScheduleJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ScheduleBoardJobInput) => assignAndScheduleJob(api, input),
    // Refresh on failure too: a half-applied assign must not leave the job looking unassigned.
    onSettled: async () => {
      await invalidateDispatchQueries(queryClient);
    }
  });
}

export function useAutoFit() {
  return useMutation({
    mutationFn: ({ jobId, date }: { jobId: string; date: string }) =>
      api.post<AutoFitResponse>("/api/v1/dispatch/auto-fit", {
        jobId,
        date
      })
  });
}

export function useDispatchJob(jobId: string | null) {
  return useQuery({
    queryKey: ["dispatch-job", jobId],
    queryFn: () => api.get<{ job: JobDetail }>(`/api/v1/jobs/${jobId}`),
    enabled: Boolean(jobId)
  });
}

export function useCompleteDispatchJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ jobId }: { jobId: string }) =>
      api.post<{ job: JobDetail }>(`/api/v1/jobs/${jobId}/complete`, {}),
    onSuccess: async () => {
      await invalidateDispatchQueries(queryClient);
    }
  });
}

export function useUnscheduledDispatchJobs() {
  return useQuery({
    queryKey: ["dispatch-unscheduled"],
    queryFn: () => api.get<{ jobs: UnscheduledJobListItem[] }>("/api/v1/jobs/unscheduled")
  });
}

export function useApprovedEstimatesQueue() {
  return useQuery({
    queryKey: ["approved-estimates"],
    queryFn: () => api.get<{ estimates: ApprovedEstimateQueueItem[] }>("/api/v1/estimates/approved-unconverted")
  });
}

export function useConvertEstimateToJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ estimateId }: { estimateId: string }) =>
      api.post<{ job: JobDetail }>(`/api/v1/estimates/${estimateId}/convert`, {}),
    onSuccess: async () => {
      await invalidateDispatchQueries(queryClient);
    }
  });
}

export function useBookingRequests() {
  const queryString = toQueryString({
    status: "pending",
    page: 1,
    limit: 50
  });

  return useQuery({
    queryKey: ["booking-requests"],
    queryFn: () => api.get<PaginatedResponse<BookingRequestListItem>>(`/api/v1/booking-requests?${queryString}`),
    refetchInterval: 30 * 1000
  });
}

export function useBookingRequest(id: string | null) {
  return useQuery({
    queryKey: ["booking-request", id],
    queryFn: () => api.get<{ bookingRequest: BookingRequestDetail }>(`/api/v1/booking-requests/${id}`),
    enabled: Boolean(id)
  });
}

export function useConfirmBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ConfirmBookingRequestInput }) =>
      api.post<{ bookingRequest: BookingRequestDetail }>(`/api/v1/booking-requests/${id}/confirm`, input),
    onSuccess: async () => {
      await invalidateDispatchQueries(queryClient);
    }
  });
}

export function useDeclineBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.post<{ bookingRequest: BookingRequestDetail }>(
        `/api/v1/booking-requests/${id}/decline`,
        reason ? { reason } : {}
      ),
    onSuccess: async () => {
      await invalidateDispatchQueries(queryClient);
    }
  });
}

export function useCustomerSearch(search: string) {
  return useQuery({
    queryKey: ["dispatch-customer-search", search],
    queryFn: () => api.get<{ customers: CustomerSearchItem[] }>(`/api/v1/customers/search?q=${encodeURIComponent(search)}`),
    enabled: search.trim().length >= 2,
    staleTime: 30 * 1000
  });
}

export function useCreateQuickJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateQuickJobInput) =>
      api.post<{ job: JobDetail }>("/api/v1/jobs", input),
    onSuccess: async () => {
      await invalidateDispatchQueries(queryClient);
    }
  });
}
