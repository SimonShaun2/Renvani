"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ExternalLink,
  Loader2,
  MapPin,
  Phone,
  ShieldCheck
} from "lucide-react";

import {
  useBookingConfirmation,
  useCaptureBookingInterest,
  usePublicAvailability,
  usePublicBookingSettings,
  useSubmitBookingRequest,
  type PublicBookingSettingsRecord
} from "@/src/hooks/booking.hooks";
import { useServesZip } from "@/src/hooks/public-growth.hooks";
import { ZipCheckCard } from "@/src/components/booking/growth/ZipCheckCard";
import { EmergencyBadge, EmergencyToggle } from "@/src/components/booking/growth/EmergencyToggle";
import {
  EMERGENCY_COPY,
  emergencyAvailable,
  emergencySubmitFields,
  emergencyWasDowngraded
} from "@/src/components/booking/growth/booking-growth.utils";
import {
  buildRecurringScheduleMessage,
  clearConfirmedBookingSnapshot,
  readConfirmedBookingSnapshot
} from "@/src/lib/booking-commit.utils";
import {
  clearBookingIdempotencyKey,
  getOrCreateBookingIdempotencyKey
} from "@/src/lib/booking-idempotency";
import { ApiError } from "@/src/lib/api";
import { showToast } from "@/src/stores/toast.store";
import { useBookingFlowStore } from "@/src/stores/booking-flow.store";
import { cn } from "@/src/lib/utils";

type BookingStepKey = "location" | "service" | "schedule" | "contact" | "confirm";

const stepOrder: BookingStepKey[] = ["location", "service", "schedule", "contact", "confirm"];
const serviceTypeFallbacks = ["Repair", "Maintenance / Tune-Up", "New Installation", "Free Estimate"];
const repairDetailFallbacks = ["AC System", "Heating / Furnace", "Thermostat", "Air Quality", "Not sure"];
const sourceLabels: Record<string, string> = {
  google: "Google",
  facebook: "Facebook",
  instagram: "Instagram",
  yelp: "Yelp",
  website: "Website",
  qr_code: "QR Code",
  direct: "Direct"
};

function getBaseBookingPath(slug: string, step: BookingStepKey) {
  switch (step) {
    case "location":
      return `/book/${slug}`;
    case "service":
      return `/book/${slug}/service`;
    case "schedule":
      return `/book/${slug}/schedule`;
    case "contact":
      return `/book/${slug}/contact`;
    case "confirm":
      return `/book/${slug}/confirm`;
  }
}

function getStepIndex(step: BookingStepKey) {
  return stepOrder.indexOf(step) + 1;
}

function buildStepHref(slug: string, step: BookingStepKey, source: string) {
  const query = new URLSearchParams();
  if (source) {
    query.set("src", source);
  }

  const suffix = query.toString();
  return `${getBaseBookingPath(slug, step)}${suffix ? `?${suffix}` : ""}`;
}

function formatWindowLabel(window: string) {
  switch (window) {
    case "morning":
      return "Morning - 8am-12pm";
    case "afternoon":
      return "Afternoon - 12pm-4pm";
    default:
      return "First available";
  }
}

function getSourceLabel(source: string) {
  return sourceLabels[source] ?? "Direct";
}

function buildCommitHref(slug: string, source: string, referenceNumber: string) {
  const params = new URLSearchParams();
  if (source) {
    params.set("src", source);
  }
  params.set("ref", referenceNumber);
  return `/book/${slug}/commit?${params.toString()}`;
}

function buildConfirmedHref(slug: string, source: string, referenceNumber: string) {
  const params = new URLSearchParams();

  if (source) {
    params.set("src", source);
  }

  params.set("ref", referenceNumber);

  return `/book/${slug}/confirmed?${params.toString()}`;
}

function buildCalendarHref(
  companyName: string | undefined,
  referenceNumber: string,
  scheduledStart: string | null,
  scheduledEnd: string | null
) {
  if (!scheduledStart || !scheduledEnd) {
    return null;
  }

  const start = new Date(scheduledStart).toISOString().replace(/[-:]/gu, "").replace(".000Z", "Z");
  const end = new Date(scheduledEnd).toISOString().replace(/[-:]/gu, "").replace(".000Z", "Z");
  const url = new URL("https://calendar.google.com/calendar/render");

  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", `${companyName ?? "Service appointment"} booking`);
  url.searchParams.set("dates", `${start}/${end}`);
  url.searchParams.set("details", `Booking reference ${referenceNumber}`);

  return url.toString();
}

function formatDateChip(value: string) {
  try {
    return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric"
    });
  } catch {
    return value;
  }
}

function normalizeOfferedServices(settings: PublicBookingSettingsRecord | undefined) {
  const defaultCategories = [
    {
      id: "heating_cooling",
      label: "Heating & Cooling",
      types: serviceTypeFallbacks
    },
    {
      id: "plumbing",
      label: "Plumbing",
      types: ["Repair", "Maintenance", "Emergency", "Inspection"]
    },
    {
      id: "electrical",
      label: "Electrical",
      types: ["Repair", "Inspection", "Install", "Troubleshooting"]
    }
  ];

  if (!settings?.offeredServices?.length) {
    return defaultCategories;
  }

  const normalized = settings.offeredServices
    .map((item, index) => {
      const rawLabel =
        typeof item.label === "string"
          ? item.label
          : typeof item.name === "string"
            ? item.name
            : typeof item.category === "string"
              ? item.category
              : `Service ${index + 1}`;
      const rawTypes = Array.isArray(item.types)
        ? item.types
        : Array.isArray(item.services)
          ? item.services
          : serviceTypeFallbacks;

      return {
        id: rawLabel.toLowerCase().replace(/[^a-z0-9]+/gu, "_"),
        label: rawLabel,
        types: rawTypes
          .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
          .map((value) => value.trim())
      };
    })
    .filter((item) => item.label.trim().length > 0);

  return normalized.length > 0 ? normalized : defaultCategories;
}

function BookingHeader({
  slug,
  source,
  step,
  settings
}: {
  slug: string;
  source: string;
  step: BookingStepKey;
  settings: PublicBookingSettingsRecord | undefined;
}) {
  const currentStep = getStepIndex(step);
  const initials =
    settings?.companyName
      ?.split(" ")
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") ?? "SR";

  return (
    <header className="overflow-hidden rounded-[32px] bg-brand-primary text-white shadow-[0_24px_70px_rgba(16,33,99,0.22)]">
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12 text-sm font-semibold text-white">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{settings?.companyName ?? "ServiceRev"}</p>
            <p className="truncate text-xs text-white/70">
              {settings?.tagline?.trim() || `${settings?.phone ?? "(918) 555-0100"} - Book a service appointment`}
            </p>
          </div>
        </div>
      </div>
      <div className="px-5 py-4">
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
          {stepOrder.map((item) => (
            <span key={item} className={cn(item === step && "text-white")}>
              {item}
            </span>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {stepOrder.map((item, index) => (
            <a
              key={item}
              href={buildStepHref(slug, item, source)}
              className={cn(
                "h-2 rounded-full transition",
                index < currentStep ? "bg-success" : index === currentStep - 1 ? "bg-brand-accent" : "bg-white/15"
              )}
            />
          ))}
        </div>
      </div>
    </header>
  );
}

function BookingCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-[30px] border border-neutral-200 bg-white px-5 py-5 shadow-[0_18px_60px_rgba(16,33,99,0.08)]">
      {children}
    </section>
  );
}

export function BookingFlowClient({
  slug,
  step
}: {
  slug: string;
  step: BookingStepKey;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const source = searchParams.get("src") ?? "direct";
  const settingsQuery = usePublicBookingSettings(slug);
  const servesZipMutation = useServesZip(slug);
  const emailCaptureMutation = useCaptureBookingInterest(slug);
  const submitMutation = useSubmitBookingRequest(slug);
  const {
    zip,
    zipVerified,
    addressLine1,
    city,
    state,
    propertyType,
    serviceCategory,
    serviceType,
    serviceDetail,
    urgency,
    preferredDate,
    preferredWindow,
    firstName,
    lastName,
    phone,
    email,
    notes,
    smsConsent,
    smsConsentMarketing,
    hydrateFromRoute,
    setReferenceNumber,
    setHoldToken,
    selectedTechnicianId,
    selectedScheduledStart,
    selectedScheduledEnd,
    setStep,
    setZipCoverage,
    updateFields
  } = useBookingFlowStore();
  const emergencyOn = emergencyAvailable(settingsQuery.data?.booking);
  const isEmergency = emergencyOn && urgency === "emergency";
  const [showAllTimes, setShowAllTimes] = useState(preferredWindow !== "first_available");
  const availabilityDate = preferredDate || new Date().toISOString().slice(0, 10);
  const availabilityQuery = usePublicAvailability(slug, zipVerified ? zip : null, availabilityDate);

  useEffect(() => {
    hydrateFromRoute(slug, source);
  }, [hydrateFromRoute, slug, source]);

  useEffect(() => {
    setStep(getStepIndex(step));
  }, [setStep, step]);

  const normalizedServices = useMemo(
    () => normalizeOfferedServices(settingsQuery.data?.booking),
    [settingsQuery.data?.booking]
  );
  const selectedCategory =
    normalizedServices.find((item) => item.label === serviceCategory) ?? normalizedServices[0] ?? null;
  const availableSlots = useMemo(() => {
    const slots = availabilityQuery.data?.availability ?? [];
    if (showAllTimes) {
      return slots;
    }

    return slots.slice(0, 1);
  }, [availabilityQuery.data?.availability, showAllTimes]);

  function navigateTo(nextStep: BookingStepKey) {
    router.push(buildStepHref(slug, nextStep, source));
  }

  async function handleSubmitBooking() {
    if (submitMutation.isPending) {
      return;
    }

    const idempotencyKey = getOrCreateBookingIdempotencyKey(slug);

    try {
      const response = await submitMutation.mutateAsync({
        source,
        idempotencyKey,
        body: {
          firstName,
          lastName,
          phone,
          email,
          addressLine1,
          city,
          state,
          zip,
          propertyType,
          serviceCategory,
          serviceType,
          serviceDetail,
          ...emergencySubmitFields(isEmergency, urgency),
          preferredDate,
          preferredWindow,
          customerNotes: notes,
          smsConsentAppointments: smsConsent,
          smsConsentMarketing
        }
      });

      clearBookingIdempotencyKey(slug);
      if (emergencyWasDowngraded(response)) {
        showToast({ tone: "info", title: EMERGENCY_COPY.downgraded });
      }
      const reference = response.confirmation.referenceNumber;
      setReferenceNumber(reference);
      setHoldToken(response.holdToken ?? null);

      const canSecureSlot =
        Boolean(response.holdToken) &&
        Boolean(selectedTechnicianId) &&
        Boolean(selectedScheduledStart) &&
        Boolean(selectedScheduledEnd) &&
        Boolean(reference);

      if (canSecureSlot && reference) {
        router.push(buildCommitHref(slug, source, reference));
        return;
      }

      router.push(buildConfirmedHref(slug, source, reference));
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        const reason =
          typeof error.payload.fields?.reason === "string" ? error.payload.fields.reason : null;

        if (
          reason === "idempotency_payload_mismatch" ||
          error.payload.message.toLowerCase().includes("different payload")
        ) {
          clearBookingIdempotencyKey(slug);
          showToast({
            tone: "error",
            title: "This form changed",
            description: "Please review your details and submit again."
          });
          return;
        }

        showToast({
          tone: "error",
          title: "Request already submitted",
          description: "Start again from the contact step if you need to change your details."
        });
        return;
      }

      const message = error instanceof Error ? error.message : "Please try again.";
      showToast({
        tone: "error",
        title: "Could not submit your request",
        description: message
      });
    }
  }

  if (settingsQuery.isLoading) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] items-center justify-center px-4 py-10">
        <Loader2 className="h-8 w-8 animate-spin text-brand-accent" />
      </div>
    );
  }

  if (settingsQuery.isError || !settingsQuery.data?.booking) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] items-center justify-center px-4 py-10">
        <BookingCard>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">Booking page unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-neutral-500">
            This booking page could not be loaded. Please call the office directly instead.
          </p>
        </BookingCard>
      </div>
    );
  }

  const settings = settingsQuery.data.booking;

  return (
    <div className="mx-auto w-full max-w-[480px] px-4 py-6 md:max-w-[688px] md:px-6">
      <div className="space-y-4">
        <BookingHeader slug={slug} source={source} step={step} settings={settings} />

        {step === "location" ? (
          <div className="space-y-4">
            <ZipCheckCard
              companyName={settings.companyName}
              zip={zip}
              onZipChange={(value) => {
                updateFields({ zip: value });
                if (zipVerified) setZipCoverage(false, 0);
              }}
              checkZip={(value) => servesZipMutation.mutateAsync(value)}
              onContinue={(value) => {
                updateFields({ zip: value });
                setZipCoverage(true, 0);
              }}
              captureEmail={(input) => emailCaptureMutation.mutateAsync(input)}
            />

            {zipVerified ? (
              <BookingCard>
                <h3 className="text-xl font-semibold tracking-tight text-neutral-950">Full service address</h3>
                <div className="mt-4 space-y-3">
                  <input
                    value={addressLine1}
                    onChange={(event) => updateFields({ addressLine1: event.target.value })}
                    placeholder="Street address"
                    className="min-h-12 w-full rounded-[20px] border border-neutral-200 px-4 text-sm outline-none transition focus:border-brand-accent"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      value={city}
                      onChange={(event) => updateFields({ city: event.target.value })}
                      placeholder="City"
                      className="min-h-12 w-full rounded-[20px] border border-neutral-200 px-4 text-sm outline-none transition focus:border-brand-accent"
                    />
                    <input
                      value={state}
                      onChange={(event) => updateFields({ state: event.target.value })}
                      placeholder="State"
                      className="min-h-12 w-full rounded-[20px] border border-neutral-200 px-4 text-sm outline-none transition focus:border-brand-accent"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {(["residential", "commercial"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => updateFields({ propertyType: value })}
                        className={cn(
                          "min-h-12 rounded-[20px] border px-4 text-sm font-semibold transition",
                          propertyType === value
                            ? "border-brand-accent bg-brand-accent text-white"
                            : "border-neutral-200 bg-white text-neutral-700"
                        )}
                      >
                        {value === "residential" ? "Residential" : "Commercial"}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigateTo("service")}
                  disabled={!addressLine1.trim() || !city.trim() || !state.trim()}
                  className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-[20px] bg-brand-accent px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Next: Choose Service
                </button>
              </BookingCard>
            ) : null}

          </div>
        ) : null}

        {step === "service" ? (
          <BookingCard>
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-accent">
              <a href={buildStepHref(slug, "location", source)} className="inline-flex items-center gap-2">
                <ChevronLeft className="h-4 w-4" />
                Back
              </a>
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-950">What do you need help with?</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {normalizedServices.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => updateFields({ serviceCategory: item.label, serviceType: item.types[0] ?? "" })}
                  className={cn(
                    "min-h-11 rounded-full px-4 text-sm font-semibold transition",
                    serviceCategory === item.label
                      ? "bg-brand-accent text-white"
                      : "bg-neutral-100 text-neutral-600"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {(selectedCategory?.types.length ? selectedCategory.types : serviceTypeFallbacks).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => updateFields({ serviceType: value })}
                  className={cn(
                    "min-h-11 rounded-[18px] border px-4 text-sm font-semibold transition",
                    serviceType === value
                      ? "border-brand-accent bg-brand-accent-light text-brand-accent"
                      : "border-neutral-200 bg-white text-neutral-600"
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
            {serviceType === "Repair" || serviceType === "AC Repair" ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {repairDetailFallbacks.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateFields({ serviceDetail: value })}
                    className={cn(
                      "min-h-11 rounded-[18px] border px-4 text-sm font-semibold transition",
                      serviceDetail === value
                        ? "border-brand-accent bg-brand-accent-light text-brand-accent"
                        : "border-neutral-200 bg-white text-neutral-600"
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
            ) : null}
            {emergencyOn ? (
              <div className="mt-5">
                <EmergencyToggle
                  on={isEmergency}
                  onChange={(on) => updateFields({ urgency: on ? "emergency" : "this_week" })}
                />
              </div>
            ) : null}
            <div className={cn("mt-5 space-y-2", isEmergency && "hidden")}>
              {[
                { value: "this_week", label: "This week", note: "Soon, but flexible" },
                { value: "flexible", label: "Flexible", note: "Best rate availability" }
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateFields({ urgency: option.value as typeof urgency })}
                  className={cn(
                    "flex min-h-12 w-full items-center justify-between rounded-[20px] border px-4 text-left transition",
                    urgency === option.value
                      ? "border-brand-accent bg-brand-accent-light"
                      : "border-neutral-200 bg-white"
                  )}
                >
                  <span>
                    <span className="block text-sm font-semibold text-neutral-900">{option.label}</span>
                    <span className="block text-xs text-neutral-500">{option.note}</span>
                  </span>
                  <span className={cn("h-4 w-4 rounded-full border", urgency === option.value ? "border-brand-accent bg-brand-accent" : "border-neutral-300")} />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => navigateTo("schedule")}
              disabled={!serviceCategory || !serviceType}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-[20px] bg-brand-accent px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Next: Choose Time
            </button>
          </BookingCard>
        ) : null}

        {step === "schedule" ? (
          <BookingCard>
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-accent">
              <a href={buildStepHref(slug, "service", source)} className="inline-flex items-center gap-2">
                <ChevronLeft className="h-4 w-4" />
                Back
              </a>
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-950">Choose a time that works for you</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowAllTimes(false)}
                className={cn(
                  "min-h-11 rounded-full px-4 text-sm font-semibold transition",
                  !showAllTimes ? "bg-brand-accent text-white" : "bg-neutral-100 text-neutral-500"
                )}
              >
                First Available
              </button>
              <button
                type="button"
                onClick={() => setShowAllTimes(true)}
                className={cn(
                  "min-h-11 rounded-full px-4 text-sm font-semibold transition",
                  showAllTimes ? "bg-brand-accent text-white" : "bg-neutral-100 text-neutral-500"
                )}
              >
                All Times
              </button>
            </div>
            <label className="mt-4 block">
              <span className="text-sm font-semibold text-neutral-700">Preferred date</span>
              <input
                type="date"
                value={availabilityDate}
                onChange={(event) => updateFields({ preferredDate: event.target.value })}
                className="mt-2 min-h-12 w-full rounded-[20px] border border-neutral-200 px-4 text-sm outline-none transition focus:border-brand-accent"
              />
            </label>
            <div className="mt-5 space-y-3">
              {availabilityQuery.isLoading ? (
                <div className="flex min-h-32 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-brand-accent" />
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-5 text-sm text-neutral-500">
                  No slots are currently available for that day. Try another date.
                </div>
              ) : (
                availableSlots.map((slot) => {
                  const isSelected = preferredDate === slot.date && preferredWindow === slot.window;
                  return (
                    <button
                      key={`${slot.date}-${slot.window}-${slot.start}`}
                      type="button"
                      onClick={() =>
                        updateFields({
                          preferredDate: slot.date,
                          preferredWindow: slot.window,
                          selectedTechnicianId: slot.technicianIds[0] ?? null,
                          selectedScheduledStart: slot.start,
                          selectedScheduledEnd: slot.end
                        })
                      }
                      className={cn(
                        "w-full rounded-[24px] border px-4 py-4 text-left transition",
                        isSelected ? "border-brand-accent bg-brand-accent-light" : "border-neutral-200 bg-white"
                      )}
                    >
                      <p className="text-sm font-semibold text-neutral-900">
                        {formatDateChip(slot.date)} - {formatWindowLabel(slot.window)}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">~2hr window - {slot.technicianIds.length} techs available</p>
                    </button>
                  );
                })
              )}
            </div>
            <button
              type="button"
              onClick={() => navigateTo("contact")}
              disabled={!preferredDate}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-[20px] bg-brand-accent px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Next: Your Contact Info
            </button>
          </BookingCard>
        ) : null}

        {step === "contact" ? (
          <BookingCard>
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-accent">
              <a href={buildStepHref(slug, "schedule", source)} className="inline-flex items-center gap-2">
                <ChevronLeft className="h-4 w-4" />
                Back
              </a>
            </div>
            <div className="mt-4 rounded-[24px] border border-brand-accent/10 bg-brand-accent-light/50 px-4 py-4">
              <p className="text-sm font-semibold text-neutral-900">
                {serviceType || "Service"} · {preferredDate ? formatDateChip(preferredDate) : "Date TBD"}
              </p>
              <a href={buildStepHref(slug, "schedule", source)} className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-brand-accent">
                <CalendarDays className="h-3.5 w-3.5" />
                Change appointment time
              </a>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <input
                value={firstName}
                onChange={(event) => updateFields({ firstName: event.target.value })}
                placeholder="First name"
                className="min-h-12 rounded-[20px] border border-neutral-200 px-4 text-sm outline-none transition focus:border-brand-accent"
              />
              <input
                value={lastName}
                onChange={(event) => updateFields({ lastName: event.target.value })}
                placeholder="Last name"
                className="min-h-12 rounded-[20px] border border-neutral-200 px-4 text-sm outline-none transition focus:border-brand-accent"
              />
            </div>
            <div className="mt-3 space-y-3">
              <input
                value={phone}
                onChange={(event) => updateFields({ phone: event.target.value })}
                placeholder="Phone number"
                className="min-h-12 w-full rounded-[20px] border border-neutral-200 px-4 text-sm outline-none transition focus:border-brand-accent"
              />
              <input
                value={email}
                onChange={(event) => updateFields({ email: event.target.value })}
                placeholder="Email address"
                className="min-h-12 w-full rounded-[20px] border border-neutral-200 px-4 text-sm outline-none transition focus:border-brand-accent"
              />
              <textarea
                value={notes}
                onChange={(event) => updateFields({ notes: event.target.value })}
                placeholder="Anything we should know?"
                rows={4}
                className="w-full rounded-[20px] border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-brand-accent"
              />
            </div>
            <label className="mt-4 flex items-start gap-3 rounded-[22px] border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-600">
              <input
                type="checkbox"
                checked={smsConsent}
                onChange={(event) => updateFields({ smsConsent: event.target.checked })}
                className="mt-1 h-4 w-4 rounded border-neutral-300"
              />
              <span>
                Receive SMS about my appointment (optional).
                <span className="mt-1 block text-xs text-neutral-400">
                  Standard message rates apply. Reply STOP to opt out.
                </span>
              </span>
            </label>
            <label className="mt-3 flex items-start gap-3 rounded-[22px] border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-600">
              <input
                type="checkbox"
                checked={smsConsentMarketing}
                onChange={(event) => updateFields({ smsConsentMarketing: event.target.checked })}
                className="mt-1 h-4 w-4 rounded border-neutral-300"
              />
              <span>
                Receive occasional promotional texts (optional).
                <span className="mt-1 block text-xs text-neutral-400">Separate from appointment updates.</span>
              </span>
            </label>
            <button
              type="button"
              onClick={() => navigateTo("confirm")}
              disabled={!firstName.trim() || !lastName.trim() || !phone.trim()}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-[20px] bg-brand-accent px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Next: Review & Confirm
            </button>
          </BookingCard>
        ) : null}

        {step === "confirm" ? (
          <BookingCard>
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-accent">
              <a href={buildStepHref(slug, "contact", source)} className="inline-flex items-center gap-2">
                <ChevronLeft className="h-4 w-4" />
                Back
              </a>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">Review your booking</h2>
              {isEmergency ? <EmergencyBadge /> : null}
            </div>
            <div className="mt-4 rounded-[24px] border-l-4 border-brand-accent bg-brand-accent-light/30 px-4 py-4">
              <dl className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-neutral-500">Service</dt>
                  <dd className="text-right font-semibold text-neutral-900">{serviceCategory} · {serviceType}</dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-neutral-500">Date</dt>
                  <dd className="text-right font-semibold text-neutral-900">
                    {preferredDate ? formatDateChip(preferredDate) : "First available"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-neutral-500">Time</dt>
                  <dd className="text-right font-semibold text-neutral-900">{formatWindowLabel(preferredWindow)}</dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-neutral-500">Address</dt>
                  <dd className="text-right font-semibold text-neutral-900">
                    {addressLine1}
                    <br />
                    {city}, {state} {zip}
                  </dd>
                </div>
                {isEmergency ? (
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-neutral-500">{EMERGENCY_COPY.priorityLabel}</dt>
                    <dd className="text-right font-semibold text-neutral-900">{EMERGENCY_COPY.priorityValue}</dd>
                  </div>
                ) : null}
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-neutral-500">Contact</dt>
                  <dd className="text-right font-semibold text-neutral-900">
                    {firstName} {lastName}
                    <br />
                    {phone}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="mt-5 rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4" aria-live="polite">
              <p className="text-sm font-semibold text-neutral-900">What happens next</p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>
                  {selectedScheduledStart
                    ? "Next you will secure your calendar slot, then confirm the appointment in-app."
                    : "We review your request — this is not a confirmed appointment yet."}
                </li>
                {smsConsent ? <li>Confirmation SMS within 2 hours if you opted in</li> : null}
                {smsConsent ? <li>24-hour appointment reminder when scheduled</li> : null}
                {smsConsent ? <li>On-the-way notification before arrival when scheduled</li> : null}
                <li>Our team will call if anything needs to shift</li>
              </ul>
              <p className="mt-3 text-xs text-neutral-400">No payment is required to submit your request.</p>
            </div>

            <button
              type="button"
              onClick={() => {
                void handleSubmitBooking();
              }}
              disabled={submitMutation.isPending}
              aria-busy={submitMutation.isPending}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-[20px] bg-brand-accent px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitMutation.isPending
                ? "Submitting..."
                : selectedScheduledStart
                  ? "Continue to secure slot"
                  : "Submit request"}
            </button>
          </BookingCard>
        ) : null}
      </div>
    </div>
  );
}

export function BookingConfirmed({
  slug,
  referenceNumber
}: {
  slug: string;
  referenceNumber: string | null;
}) {
  const { reset, source } = useBookingFlowStore();
  const settingsQuery = usePublicBookingSettings(slug);
  const confirmationQuery = useBookingConfirmation(slug, referenceNumber);
  const [confirmedSnapshot] = useState(() =>
    referenceNumber ? readConfirmedBookingSnapshot(slug, referenceNumber) : null
  );

  useEffect(() => {
    if (referenceNumber) {
      reset(slug, source);
      clearConfirmedBookingSnapshot(slug, referenceNumber);
    }
  }, [referenceNumber, reset, slug, source]);

  const confirmation = confirmationQuery.data?.confirmation;
  const booking = settingsQuery.data?.booking;
  const sourceLabel = getSourceLabel(source);
  const isInPlatformConfirmed =
    confirmedSnapshot?.status === "confirmed" || confirmation?.status === "confirmed";
  const scheduledStart = confirmedSnapshot?.scheduledStart ?? confirmation?.scheduledStart ?? null;
  const scheduledEnd = confirmedSnapshot?.scheduledEnd ?? confirmation?.scheduledEnd ?? null;
  const recurringMessage = buildRecurringScheduleMessage(confirmedSnapshot?.recurringSchedule);
  const calendarHref = buildCalendarHref(
    confirmation?.companyName ?? booking?.companyName,
    confirmation?.referenceNumber ?? referenceNumber ?? "pending",
    scheduledStart,
    scheduledEnd
  );

  return (
    <div className="mx-auto w-full max-w-[480px] px-4 py-6">
      <div className="space-y-4">
        <BookingHeader slug={slug} source={source} step="confirm" settings={booking} />
        <BookingCard>
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success-light text-success">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h1 className="mt-5 text-center text-3xl font-semibold tracking-tight text-neutral-950">
            {isInPlatformConfirmed ? "Appointment confirmed" : "Booking requested"}
          </h1>
          <p className="mt-2 text-center text-sm leading-6 text-neutral-500">
            Confirmation #{confirmation?.referenceNumber ?? referenceNumber ?? "pending"}
          </p>
          {source !== "direct" ? (
            <div className="mt-4 flex justify-center">
              <span className="rounded-full bg-brand-accent-light px-3 py-1 text-xs font-semibold text-brand-accent">
                Source: {sourceLabel}
              </span>
            </div>
          ) : null}

          {confirmation ? (
            <div className="mt-5 rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
              <p className="text-sm font-semibold text-neutral-900">{confirmation.companyName}</p>
              <p className="mt-2 text-sm text-neutral-500">
                {scheduledStart
                  ? isInPlatformConfirmed
                    ? "Your visit is on the schedule"
                    : "Appointment scheduled"
                  : "Pending dispatcher confirmation"}
              </p>
              {scheduledStart ? (
                <p className="mt-2 text-sm font-semibold text-neutral-900">
                  {new Date(scheduledStart).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    weekday: "short",
                    hour: "numeric",
                    minute: "2-digit"
                  })}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="mt-6 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-brand-accent" />
            </div>
          )}

          {recurringMessage ? (
            <div className="mt-5 rounded-[24px] border border-brand-accent/20 bg-brand-accent-light/30 px-4 py-4 text-sm text-neutral-700">
              <p className="font-semibold text-neutral-900">Recurring &amp; VIP schedule</p>
              <p className="mt-2 leading-6">{recurringMessage}</p>
            </div>
          ) : null}

          {confirmedSnapshot?.manageToken ? (
            <Link
              href={`/book/${slug}/manage?token=${encodeURIComponent(confirmedSnapshot.manageToken)}`}
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-[20px] border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-900"
            >
              Reschedule or cancel online
            </Link>
          ) : null}

          <div className="mt-5 rounded-[24px] border border-neutral-200 bg-white px-4 py-4">
            <p className="text-sm font-semibold text-neutral-900">What happens next</p>
            <ul className="mt-3 space-y-2 text-sm text-neutral-600">
              {isInPlatformConfirmed ? (
                <>
                  <li className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-success" />
                    Your appointment is confirmed on our calendar.
                  </li>
                  <li className="flex items-start gap-2">
                    <Phone className="mt-0.5 h-4 w-4 text-brand-accent" />
                    We will reach out if anything needs to change before the visit.
                  </li>
                </>
              ) : (
                <>
                  <li className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-success" />
                    We review your request — scheduling is not confirmed until our team reaches out.
                  </li>
                  <li className="flex items-start gap-2">
                    <Phone className="mt-0.5 h-4 w-4 text-brand-accent" />
                    We may call or email if we need more details
                  </li>
                  {scheduledStart ? (
                    <li className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 text-brand-accent" />
                      Your proposed time is noted; we will confirm the final appointment window.
                    </li>
                  ) : null}
                </>
              )}
            </ul>
          </div>

          <div className="mt-5 space-y-3">
            {calendarHref ? (
              <a
                href={calendarHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[20px] border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700"
              >
                <CalendarDays className="h-4 w-4" />
                Add to Calendar
              </a>
            ) : null}

            {booking?.googleReviewUrl ? (
              <a
                href={booking.googleReviewUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[20px] border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700"
              >
                <ExternalLink className="h-4 w-4" />
                Leave a Google review
              </a>
            ) : null}

            {source !== "direct" ? (
              <button
                type="button"
                onClick={() => window.history.back()}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-[20px] bg-brand-accent px-4 text-sm font-semibold text-white"
              >
                Back to {sourceLabel}
              </button>
            ) : null}
          </div>
        </BookingCard>
      </div>
    </div>
  );
}
