"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface BookingFlowStore {
  slug: string;
  source: string;
  currentStep: number;
  zip: string;
  zipVerified: boolean;
  addressLine1: string;
  city: string;
  state: string;
  propertyType: "residential" | "commercial";
  serviceCategory: string;
  serviceType: string;
  serviceDetail: string;
  urgency: "emergency" | "this_week" | "flexible";
  preferredDate: string;
  preferredWindow: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  notes: string;
  smsConsent: boolean;
  smsConsentMarketing: boolean;
  referenceNumber: string | null;
  holdToken: string | null;
  selectedTechnicianId: string | null;
  selectedScheduledStart: string | null;
  selectedScheduledEnd: string | null;
  servedTechCount: number;
  setStep: (step: number) => void;
  hydrateFromRoute: (slug: string, source?: string) => void;
  updateFields: (patch: Partial<BookingFlowSnapshot>) => void;
  setZipCoverage: (covered: boolean, techCount: number) => void;
  setReferenceNumber: (referenceNumber: string | null) => void;
  setHoldToken: (holdToken: string | null) => void;
  reset: (slug?: string, source?: string) => void;
}

type BookingFlowSnapshot = Omit<
  BookingFlowStore,
  | "setStep"
  | "hydrateFromRoute"
  | "updateFields"
  | "setZipCoverage"
  | "setReferenceNumber"
  | "setHoldToken"
  | "reset"
>;

const initialBookingState: BookingFlowSnapshot = {
  slug: "",
  source: "direct",
  currentStep: 1,
  zip: "",
  zipVerified: false,
  addressLine1: "",
  city: "",
  state: "",
  propertyType: "residential",
  serviceCategory: "",
  serviceType: "",
  serviceDetail: "",
  urgency: "this_week",
  preferredDate: "",
  preferredWindow: "first_available",
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  notes: "",
  smsConsent: false,
  smsConsentMarketing: false,
  referenceNumber: null,
  holdToken: null,
  selectedTechnicianId: null,
  selectedScheduledStart: null,
  selectedScheduledEnd: null,
  servedTechCount: 0
};

export const useBookingFlowStore = create<BookingFlowStore>()(
  persist(
    (set, get) => ({
      ...initialBookingState,
      setStep: (currentStep) => set({ currentStep }),
      hydrateFromRoute: (slug, source) => {
        const state = get();
        if (state.slug === slug && state.source === (source ?? state.source)) {
          return;
        }

        set({
          ...initialBookingState,
          slug,
          source: source ?? state.source ?? "direct"
        });
      },
      updateFields: (patch) =>
        set((state) => ({
          ...state,
          ...patch
        })),
      setZipCoverage: (zipVerified, servedTechCount) =>
        set({
          zipVerified,
          servedTechCount
        }),
      setReferenceNumber: (referenceNumber) => set({ referenceNumber }),
      setHoldToken: (holdToken) => set({ holdToken }),
      reset: (slug, source) =>
        set({
          ...initialBookingState,
          slug: slug ?? "",
          source: source ?? "direct"
        })
    }),
    {
      name: "servicerev-booking-flow",
      partialize: (state) => ({
        slug: state.slug,
        source: state.source,
        currentStep: state.currentStep,
        zip: state.zip,
        zipVerified: state.zipVerified,
        addressLine1: state.addressLine1,
        city: state.city,
        state: state.state,
        propertyType: state.propertyType,
        serviceCategory: state.serviceCategory,
        serviceType: state.serviceType,
        serviceDetail: state.serviceDetail,
        urgency: state.urgency,
        preferredDate: state.preferredDate,
        preferredWindow: state.preferredWindow,
        firstName: state.firstName,
        lastName: state.lastName,
        phone: state.phone,
        email: state.email,
        notes: state.notes,
        smsConsent: state.smsConsent,
        smsConsentMarketing: state.smsConsentMarketing,
        referenceNumber: state.referenceNumber,
        holdToken: state.holdToken,
        selectedTechnicianId: state.selectedTechnicianId,
        selectedScheduledStart: state.selectedScheduledStart,
        selectedScheduledEnd: state.selectedScheduledEnd,
        servedTechCount: state.servedTechCount
      })
    }
  )
);
