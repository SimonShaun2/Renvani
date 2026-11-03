"use client";

import { format } from "date-fns";
import { create } from "zustand";

export type DispatchTab = "schedule" | "bookings" | "unscheduled";
export type DispatchViewMode = "day" | "week";

interface DispatchStore {
  selectedDate: string;
  selectedJobId: string | null;
  selectedBookingRequestId: string | null;
  activeTab: DispatchTab;
  viewMode: DispatchViewMode;
  setSelectedDate: (date: string) => void;
  setSelectedJob: (jobId: string | null) => void;
  setSelectedBookingRequest: (bookingRequestId: string | null) => void;
  setActiveTab: (tab: DispatchTab) => void;
  setViewMode: (viewMode: DispatchViewMode) => void;
  closeDetail: () => void;
  /** True while the /dispatch/stream EventSource is open; false means the board polls every 30s. */
  streamLive: boolean;
  setStreamLive: (live: boolean) => void;
}

export const useDispatchStore = create<DispatchStore>((set) => ({
  selectedDate: format(new Date(), "yyyy-MM-dd"),
  selectedJobId: null,
  selectedBookingRequestId: null,
  activeTab: "schedule",
  viewMode: "day",
  setSelectedDate: (date) => set({ selectedDate: date }),
  setSelectedJob: (jobId) => set({ selectedJobId: jobId, selectedBookingRequestId: null }),
  setSelectedBookingRequest: (bookingRequestId) =>
    set({ selectedBookingRequestId: bookingRequestId, selectedJobId: null }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setViewMode: (viewMode) => set({ viewMode }),
  closeDetail: () => set({ selectedJobId: null, selectedBookingRequestId: null }),
  streamLive: false,
  setStreamLive: (live) => set({ streamLive: live })
}));
