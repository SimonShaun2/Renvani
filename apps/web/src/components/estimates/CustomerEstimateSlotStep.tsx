"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useQueries } from "@tanstack/react-query";

import { CurrencyDisplay } from "@/src/components/ui/CurrencyDisplay";
import { cn } from "@/src/lib/utils";
import { publicApi } from "@/src/lib/public-api";
import type { PublicEstimateRecord, PublicEstimateSchedulingRecord } from "@/src/hooks/estimates.hooks";
import type { BookingAvailabilityRecord } from "@/src/hooks/booking.hooks";
import { useSubmitBookingRequest } from "@/src/hooks/booking.hooks";
import {
  buildUpcomingIsoDates,
  flattenAvailabilitySlots,
  type EstimateSlotOption
} from "@/src/components/estimates/estimate-slot.utils";

interface CustomerEstimateSlotStepProps {
  estimate: PublicEstimateRecord;
  scheduling: PublicEstimateSchedulingRecord;
  onRequested: (input: { referenceNumber: string }) => void;
}

function EstimateSummaryCard({ estimate }: { estimate: PublicEstimateRecord }) {
  const headline = estimate.title ?? "Your estimate";

  return (
    <section className="rounded-[14px] border border-[#e6dccb] bg-white p-[18px]">
      <div className="flex flex-wrap items-baseline gap-2">
        <CurrencyDisplay value={estimate.total} className="text-[40px] font-semibold tracking-tight text-neutral-900" showCents />
        {estimate.tierLabel ? (
          <span className="text-sm text-neutral-500">{estimate.tierLabel}</span>
        ) : null}
      </div>
      <p className="mt-2 text-sm font-medium text-neutral-900">{headline}</p>
      <div className="mt-4 space-y-2 text-[13px]">
        {estimate.items.slice(0, 4).map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-3 text-neutral-500">
            <span>{item.name}</span>
            <CurrencyDisplay value={item.total} className="font-medium text-neutral-900" showCents />
          </div>
        ))}
        {estimate.discountAmount && Number(estimate.discountAmount) > 0 ? (
          <div className="flex items-center justify-between gap-3 text-neutral-500">
            <span>Discount</span>
            <CurrencyDisplay value={estimate.discountAmount} className="font-medium text-neutral-900" showCents />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SlotButton({
  slot,
  selected,
  onSelect
}: {
  slot: EstimateSlotOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center justify-between rounded-[10px] px-4 py-3.5 text-left text-[15px] transition",
        selected
          ? "bg-neutral-900 text-white"
          : "border border-[#e6dccb] bg-white text-neutral-900 hover:border-neutral-300"
      )}
    >
      <span className="font-semibold">{slot.labelDate}</span>
      <span className={cn("font-medium", selected ? "text-[#f6b400]" : "text-[#2a3360]")}>{slot.labelTime}</span>
    </button>
  );
}

export function CustomerEstimateSlotStep({ estimate, scheduling, onRequested }: CustomerEstimateSlotStepProps) {
  const submitMutation = useSubmitBookingRequest(scheduling.bookingSlug);
  const [inquiryOnlyReference, setInquiryOnlyReference] = useState<string | null>(null);
  const upcomingDates = useMemo(() => buildUpcomingIsoDates(7), []);
  const availabilityQueries = useQueries({
    queries: upcomingDates.map((date) => ({
      queryKey: ["public-booking", "availability", scheduling.bookingSlug, scheduling.zip, date],
      queryFn: async () => {
        const query = new URLSearchParams({ zip: scheduling.zip, date });
        return publicApi.get<{ availability: BookingAvailabilityRecord[] }>(
          `/api/v1/public/booking/${scheduling.bookingSlug}/availability?${query.toString()}`
        );
      },
      staleTime: 60_000
    }))
  });

  const slots = useMemo(
    () =>
      flattenAvailabilitySlots(
        upcomingDates.map((date, index) => ({
          date,
          slots: availabilityQueries[index]?.data?.availability ?? []
        }))
      ),
    [availabilityQueries, upcomingDates]
  );

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selectedSlot = slots.find((slot) => slot.key === selectedKey) ?? slots[0] ?? null;
  const isLoadingSlots = availabilityQueries.some((query) => query.isLoading);
  const property = scheduling.property;

  async function handleRequestTime() {
    if (!selectedSlot || !property) {
      return;
    }

    const response = await submitMutation.mutateAsync({
      source: "website",
      body: {
        firstName: scheduling.customer.firstName,
        lastName: scheduling.customer.lastName,
        phone: scheduling.customer.phone,
        email: scheduling.customer.email ?? undefined,
        addressLine1: property.addressLine1,
        addressLine2: property.addressLine2 ?? undefined,
        city: property.city,
        state: property.state,
        zip: property.zip,
        preferredDate: selectedSlot.date,
        preferredWindow: selectedSlot.window,
        customerNotes: `Approved estimate ${estimate.estimateNumber}. Requested slot ${selectedSlot.labelDate} ${selectedSlot.labelTime}.`,
        smsConsentAppointments: true
      }
    });

    if (!("confirmation" in response)) {
      setInquiryOnlyReference(response.bookingRequest.referenceNumber ?? "received");
      return;
    }
    onRequested({ referenceNumber: response.confirmation.referenceNumber });
  }

  if (inquiryOnlyReference) {
    return (
      <div className="min-h-screen bg-[#fbf6ef] px-5 py-10 text-neutral-900">
        <div className="mx-auto max-w-md rounded-[14px] border border-[#e6dccb] bg-white p-6">
          <h1 className="text-2xl font-semibold">We received your inquiry</h1>
          <p className="mt-3 text-sm leading-6">Service availability has not been confirmed. The team will follow up. No appointment has been booked.</p>
          <p className="mt-3 text-sm">Reference {inquiryOnlyReference}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fbf6ef] text-neutral-900">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-6 pt-4">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-[#2f7d4f]" aria-hidden />
          <p className="text-base font-semibold text-neutral-900">{scheduling.companyName}</p>
        </div>

        <p className="mt-6 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-[#5e6684]">Your estimate</p>
        <div className="mt-3">
          <EstimateSummaryCard estimate={estimate} />
        </div>

        <p className="mt-6 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-[#5e6684]">Pick a first visit</p>

        <div className="mt-3 flex flex-col gap-2">
          {isLoadingSlots ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-brand-accent" />
            </div>
          ) : slots.length === 0 ? (
            <p className="rounded-[10px] border border-[#e6dccb] bg-white px-4 py-4 text-sm text-neutral-600">
              No open slots in the next week. {scheduling.companyName} will reach out to schedule your visit.
            </p>
          ) : (
            slots.map((slot) => (
              <SlotButton
                key={slot.key}
                slot={slot}
                selected={(selectedSlot?.key ?? slot.key) === slot.key}
                onSelect={() => setSelectedKey(slot.key)}
              />
            ))
          )}
        </div>

        <p className="mt-4 text-xs leading-5 text-[#5e6684]">
          Slots come from the crew calendar. Your booking is confirmed by {scheduling.companyName} — usually within minutes.
          This request is not final until the team confirms your time.
        </p>

        <div className="mt-auto pt-6">
          <button
            type="button"
            disabled={!selectedSlot || submitMutation.isPending || slots.length === 0}
            onClick={() => {
              void handleRequestTime();
            }}
            className="flex h-[52px] w-full items-center justify-center rounded-[10px] bg-[#f6b400] text-sm font-semibold text-neutral-900 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitMutation.isPending ? "Sending request..." : "Request this time"}
          </button>
          <p className="mt-3 text-center font-mono text-[10px] tracking-wide text-[#5e6684]">Powered by Renvani</p>
        </div>
      </div>
    </div>
  );
}
