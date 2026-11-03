"use client";

import Link from "next/link";
import { useId, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { webAssistantResponseSchema, type WebAssistantResponse, type WebAssistantRequest, type WebAssistantHandoffReason } from "@fsm/types";

import {
  buildBookPath,
  type BrandedStorefrontViewModel
} from "@/src/components/growth/branded-storefront.utils";
import { useCheckZipCoverage, useSubmitBookingRequest } from "@/src/hooks/booking.hooks";
import { ApiError } from "@/src/lib/api";
import { SITE_TRADES } from "@/src/components/growth/site-trade.registry";
import { HONEYPOT_FIELD } from "@/src/lib/inquiry-rate-limit";
import { publicApi } from "@/src/lib/public-api";

interface BrandedInquiryClientProps {
  model: BrandedStorefrontViewModel;
  acquisitionSource: string;
  initialService?: string;
  initialZip?: string;
  /** Label for the configured trade, sent as `serviceCategory`. */
  serviceCategory?: string;
  assistantEnabled?: boolean;
}

type InquiryField = "firstName" | "lastName" | "phone" | "email" | "serviceInterest" | "addressLine1" | "city" | "state" | "zip";
type InquiryFieldErrors = Partial<Record<InquiryField, string>>;
type AssistantHandoff = Extract<WebAssistantRequest, { action: "handoff" }>;
const answerSourceLabels: Record<Extract<WebAssistantResponse, { kind: "answer" }>["source"], string> = {
  public_booking_settings: "Published business settings",
  zip_serviceability: "Checked service-area coverage"
};
const handoffReasonLabels: Record<WebAssistantHandoffReason, string> = {
  human_requested: "Staff contact requested",
  out_of_area: "Outside the listed service area",
  unknown_serviceability: "Service-area coverage needs verification",
  unsupported_service: "Requested service is not listed",
  emergency_review: "Emergency request needs staff review",
  pricing_review: "Pricing needs staff review",
  availability_review: "Availability needs staff review",
  unverified_answer: "Published details do not verify this answer"
};

function handoffSource(source: string): NonNullable<AssistantHandoff["source"]> {
  const approved = ["google", "facebook", "instagram", "yelp", "direct", "website", "qr_code"] as const;
  return approved.find((value) => value === source) ?? "website";
}

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `inquiry-${Date.now()}`;
}

async function passInquiryGate(slug: string, honeypot: string): Promise<{ ok: boolean; accepted: boolean; message?: string }> {
  const response = await fetch(`/api/site/${encodeURIComponent(slug)}/inquiry-gate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [HONEYPOT_FIELD]: honeypot })
  });
  const payload = (await response.json().catch(() => ({}))) as { accepted?: boolean; message?: string };
  return { ok: response.ok, accepted: payload.accepted !== false, ...(payload.message ? { message: payload.message } : {}) };
}

export function BrandedInquiryClient({ model, acquisitionSource, initialService, initialZip, serviceCategory, assistantEnabled = false }: BrandedInquiryClientProps) {
  const submitMutation = useSubmitBookingRequest(model.bookingSlug);
  const zipCheckMutation = useCheckZipCoverage(model.bookingSlug);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [zip, setZip] = useState(initialZip ?? "");
  const [honeypot, setHoneypot] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [serviceInterest, setServiceInterest] = useState(
    model.serviceCards.find((card) => card.title === initialService)?.title ?? model.serviceCards[0]?.title ?? ""
  );
  const [notes, setNotes] = useState("");
  const [smsConsentAppointments, setSmsConsentAppointments] = useState(false);
  const [smsConsentMarketing, setSmsConsentMarketing] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState<string | null>(null);
  const [inquiryOnlyReceived, setInquiryOnlyReceived] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<InquiryFieldErrors>({});
  const [isSending, setIsSending] = useState(false);
  const [assistantTopic, setAssistantTopic] = useState<Extract<WebAssistantRequest, { action: "answer" }>["topic"]>("services");
  const [assistantService, setAssistantService] = useState("");
  const [assistantZip, setAssistantZip] = useState("");
  const [assistantResponse, setAssistantResponse] = useState<WebAssistantResponse | null>(null);
  const [assistantPending, setAssistantPending] = useState(false);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [contactConsent, setContactConsent] = useState(false);
  const [handoffIdempotencyKey, setHandoffIdempotencyKey] = useState(createIdempotencyKey);
  const assistantRequestVersion = useRef(0);
  const formId = useId();

  const idempotencyKey = useMemo(() => createIdempotencyKey(), []);

  const bookHref = buildBookPath(model.bookingSlug, acquisitionSource);
  const isPending = isSending || assistantPending || submitMutation.isPending || zipCheckMutation.isPending;
  const handoffRequired = assistantResponse?.kind === "handoff_required";
  const fieldErrorId = (field: InquiryField) => `${formId}-${field}-error`;
  const clearFieldError = (field: InquiryField) => {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setErrorMessage(null);
  };
  const invalidateAssistantQuestion = () => {
    assistantRequestVersion.current += 1;
    setAssistantResponse(null);
    setAssistantError(null);
    setAssistantPending(false);
    setContactConsent(false);
  };

  async function askAssistant() {
    if (assistantPending) return;
    const requestVersion = ++assistantRequestVersion.current;
    setAssistantError(null);
    setAssistantResponse(null);
    setAssistantPending(true);
    try {
      const request: Extract<WebAssistantRequest, { action: "answer" }> = {
        action: "answer",
        topic: assistantTopic,
        ...(assistantService.trim() ? { service: assistantService.trim() } : {}),
        ...(assistantTopic === "service_area" && assistantZip.trim() ? { zip: assistantZip.trim() } : {})
      };
      const response = await publicApi.post<WebAssistantResponse>(
        `/api/v1/public/site/${encodeURIComponent(model.bookingSlug)}/assistant`, request
      );
      const parsed = webAssistantResponseSchema.parse(response);
      if (requestVersion === assistantRequestVersion.current) {
        if (assistantTopic === "service_area" && assistantZip.trim()) setZip(assistantZip.trim());
        setAssistantResponse(parsed);
      }
    } catch (error) {
      if (requestVersion === assistantRequestVersion.current) {
        setAssistantError(error instanceof ApiError ? error.message : "We could not check that right now. Please try again.");
      }
    } finally {
      if (requestVersion === assistantRequestVersion.current) setAssistantPending(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isPending) return;
    setErrorMessage(null);
    const requiredFields = [
      { key: "firstName", label: "First name", value: firstName },
      { key: "lastName", label: "Last name", value: lastName },
      { key: "phone", label: "Mobile phone", value: phone },
      ...(model.serviceCards.length === 0 ? [{ key: "serviceInterest" as const, label: "Service interest", value: handoffRequired && assistantService.trim() ? assistantService : serviceInterest }] : []),
      { key: "addressLine1", label: "Service address", value: addressLine1 },
      { key: "city", label: "City", value: city },
      { key: "state", label: "State", value: state },
      { key: "zip", label: "ZIP code", value: zip }
    ] as const;
    const errors: InquiryFieldErrors = {};
    for (const field of requiredFields) {
      if (!field.value.trim()) errors[field.key] = `${field.label} is required.`;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email.trim())) {
      errors.email = "Enter a valid email address.";
    }
    setFieldErrors(errors);
    const firstInvalidField = [...requiredFields.map((field) => field.key), "email"].find((field) => errors[field as InquiryField]);
    if (firstInvalidField) {
      setErrorMessage("Please correct the highlighted fields.");
      event.currentTarget.querySelector<HTMLInputElement>(`[name="${firstInvalidField}"]`)?.focus();
      return;
    }
    if (handoffRequired && !contactConsent) {
      setErrorMessage("Agree to send your contact details for staff review.");
      event.currentTarget.querySelector<HTMLInputElement>("[name=contactConsent]")?.focus();
      return;
    }

    setIsSending(true);
    try {
      const gate = await passInquiryGate(model.bookingSlug, honeypot);
      if (!gate.ok) {
        setErrorMessage(gate.message ?? "Please try again in a few minutes.");
        return;
      }
      if (!gate.accepted) {
        setReferenceNumber("received");
        return;
      }

      if (handoffRequired) {
        const request: AssistantHandoff = {
          action: "handoff",
          topic: assistantTopic,
          ...((assistantService.trim() || serviceInterest.trim()) ? { service: assistantService.trim() || serviceInterest.trim() } : {}),
          message: notes.trim() || assistantResponse.message,
          contact: {
            firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim(),
            ...(email.trim() ? { email: email.trim() } : {}),
            addressLine1: addressLine1.trim(), city: city.trim(),
            state: state.trim(), zip: zip.trim()
          },
          contactConsent: true,
          smsConsentAppointments,
          smsConsentMarketing,
          source: handoffSource(acquisitionSource)
        };
        const response = await publicApi.post<WebAssistantResponse>(
          `/api/v1/public/site/${encodeURIComponent(model.bookingSlug)}/assistant`, request,
          { headers: { "Idempotency-Key": handoffIdempotencyKey } }
        );
        const parsed = webAssistantResponseSchema.parse(response);
        if (parsed.kind !== "handoff") throw new Error("Unexpected handoff response");
        setAssistantResponse(parsed);
        return;
      }

      // For an unconfigured shop, only the server can distinguish unknown coverage from a known out-of-area ZIP.
      if (model.intakeMode === "bookable") {
        const coverage = await zipCheckMutation.mutateAsync(zip.trim());
        if (!coverage.covered) {
          setErrorMessage("This shop has not confirmed service in that ZIP. Your inquiry was not sent.");
          return;
        }
      }

      const response = await submitMutation.mutateAsync({
        source: acquisitionSource,
        idempotencyKey,
        body: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          addressLine1: addressLine1.trim(),
          city: city.trim(),
          state: state.trim().toUpperCase().slice(0, 2),
          zip: zip.trim(),
          propertyType: "residential",
          serviceCategory: model.configuredTrade
            ? serviceCategory ?? SITE_TRADES[model.configuredTrade].label
            : serviceInterest || SITE_TRADES.other.label,
          serviceType: serviceInterest || "Service inquiry",
          customerNotes: `[Branded site inquiry] ${notes.trim()}`.trim(),
          urgency: "flexible",
          preferredWindow: "first_available",
          smsConsentAppointments,
          smsConsentMarketing
        }
      });

      if (!("confirmation" in response)) {
        setInquiryOnlyReceived(true);
        setReferenceNumber(response.bookingRequest.referenceNumber ?? "received");
      } else {
        setReferenceNumber(response.confirmation.referenceNumber);
      }
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "We could not send your request. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  if (assistantResponse?.kind === "handoff") {
    return <div className="mx-auto max-w-lg rounded-[14px] border border-[#e6dccb] bg-white p-8 text-center" role="status">
      <h1 className="text-2xl font-semibold text-[#0f1530]">Request pending staff review</h1>
      <p className="mt-3 text-sm leading-6 text-[#5e6684]">{assistantResponse.message}</p>
      <p className="mt-3 text-sm text-[#5e6684]">Reference <span className="font-mono font-medium text-[#0f1530]">{assistantResponse.referenceNumber}</span>.</p>
    </div>;
  }

  if (referenceNumber) {
    return (
      <div className="mx-auto max-w-lg rounded-[14px] border border-[#e6dccb] bg-white p-8 text-center">
        <h1 className="text-2xl font-semibold text-[#0f1530]">{inquiryOnlyReceived ? "We received your inquiry" : "Inquiry received"}</h1>
        <p className="mt-3 text-sm leading-6 text-[#5e6684]">
          {inquiryOnlyReceived ? (
            <>Service availability has not been confirmed. The team will follow up. No appointment has been booked.</>
          ) : (
            <>{model.companyName} will follow up — this is not a confirmed appointment until they reach out.</>
          )}
        </p>
        <p className="mt-3 text-sm text-[#5e6684]">Reference <span className="font-mono font-medium text-[#0f1530]">{referenceNumber}</span>.</p>
        {!inquiryOnlyReceived && model.intakeMode === "bookable" ? (
          <Link href={bookHref} className="mt-6 inline-flex text-sm font-semibold text-[#2f7d4f] hover:underline">
            Review booking options
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <form className="mx-auto max-w-lg space-y-4" onSubmit={(event) => void handleSubmit(event)} onChangeCapture={() => setHandoffIdempotencyKey(createIdempotencyKey())} noValidate>
      {assistantEnabled ? (
        <section aria-label="Ask about this business" className="rounded-[14px] border border-[#e6dccb] bg-white p-5" onKeyDown={(event) => {
          if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
            event.preventDefault();
            void askAssistant();
          }
        }}>
          <h2 className="text-lg font-semibold">Ask about this business</h2>
          <p className="mt-1 text-sm text-[#5e6684]">Answers use published business details. Staff must confirm appointments, prices, and availability.</p>
          <label className="mt-4 block text-sm font-medium text-[#2a3360]">Question topic
            <select value={assistantTopic} onChange={(event) => { invalidateAssistantQuestion(); setAssistantTopic(event.target.value as typeof assistantTopic); }} className="mt-1.5 w-full rounded-lg border border-[#e6dccb] px-3.5 py-3">
              <option value="services">Services</option><option value="service_area">Service area</option>
              <option value="booking_hours">Published request hours</option><option value="emergency">Emergency service</option>
              <option value="contact">Contact</option><option value="availability">Appointment availability</option>
              <option value="pricing">Pricing</option><option value="human">Speak with staff</option>
              <option value="other">Other question</option>
            </select>
          </label>
          <label className="mt-3 block text-sm font-medium text-[#2a3360]">Service (optional)
            <input value={assistantService} onChange={(event) => { invalidateAssistantQuestion(); setAssistantService(event.target.value); }} maxLength={100} className="mt-1.5 w-full rounded-lg border border-[#e6dccb] px-3.5 py-3" />
          </label>
          {assistantTopic === "service_area" ? <label className="mt-3 block text-sm font-medium text-[#2a3360]">ZIP to check
            <input value={assistantZip} onChange={(event) => { invalidateAssistantQuestion(); setAssistantZip(event.target.value); }} inputMode="numeric" autoComplete="postal-code" className="mt-1.5 w-full rounded-lg border border-[#e6dccb] px-3.5 py-3" />
          </label> : null}
          <button type="button" disabled={isPending} aria-busy={assistantPending} onClick={() => void askAssistant()} className="mt-4 rounded-lg bg-[#2f7d4f] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{assistantPending ? "Checking published details" : "Check published details"}</button>
          {assistantError ? <p role="alert" className="mt-3 text-sm text-red-700">{assistantError}</p> : null}
          {assistantResponse?.kind === "answer" ? <div role="status" aria-live="polite" className="mt-3 text-sm text-[#2a3360]">
            <p>{assistantResponse.answer}</p>
            <p className="mt-1 text-[#5e6684]">Verified source: {answerSourceLabels[assistantResponse.source]}.</p>
            {assistantTopic === "services" && assistantResponse.source === "public_booking_settings" &&
              model.intakeMode === "bookable" && (model.configuredTrade === "hvac" || model.configuredTrade === "plumbing") ? (
                <p className="mt-3"><Link href={bookHref} className="font-semibold text-[#2f7d4f] underline">Check real booking availability</Link></p>
              ) : null}
          </div> : null}
          {assistantResponse?.kind === "handoff_required" ? <div role="status" aria-live="polite" className="mt-3 text-sm text-[#2a3360]">
            <p>{assistantResponse.message} Use the form below to request staff review.</p>
            <p className="mt-1 text-[#5e6684]">Reason: {handoffReasonLabels[assistantResponse.reason]}.</p>
          </div> : null}
        </section>
      ) : null}
      <p className="text-sm text-[#5e6684]">Tell {model.companyName} what you need. An inquiry is not a confirmed appointment.</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-[#2a3360]">
          First name
          <input
            required
            name="firstName"
            value={firstName}
            onChange={(event) => { setFirstName(event.target.value); clearFieldError("firstName"); }}
            aria-invalid={Boolean(fieldErrors.firstName)}
            aria-describedby={fieldErrors.firstName ? fieldErrorId("firstName") : undefined}
            className="mt-1.5 w-full rounded-lg border border-[#e6dccb] px-3.5 py-3 text-[15px]"
            autoComplete="given-name"
          />
          {fieldErrors.firstName ? <span id={fieldErrorId("firstName")} className="mt-1 block text-red-700">{fieldErrors.firstName}</span> : null}
        </label>
        <label className="block text-sm font-medium text-[#2a3360]">
          Last name
          <input
            required
            name="lastName"
            value={lastName}
            onChange={(event) => { setLastName(event.target.value); clearFieldError("lastName"); }}
            aria-invalid={Boolean(fieldErrors.lastName)}
            aria-describedby={fieldErrors.lastName ? fieldErrorId("lastName") : undefined}
            className="mt-1.5 w-full rounded-lg border border-[#e6dccb] px-3.5 py-3 text-[15px]"
            autoComplete="family-name"
          />
          {fieldErrors.lastName ? <span id={fieldErrorId("lastName")} className="mt-1 block text-red-700">{fieldErrors.lastName}</span> : null}
        </label>
      </div>

      <label className="block text-sm font-medium text-[#2a3360]">
        Mobile phone
        <input
          required
          type="tel"
          name="phone"
          value={phone}
          onChange={(event) => { setPhone(event.target.value); clearFieldError("phone"); }}
          aria-invalid={Boolean(fieldErrors.phone)}
          aria-describedby={fieldErrors.phone ? fieldErrorId("phone") : undefined}
          className="mt-1.5 w-full rounded-lg border border-[#e6dccb] px-3.5 py-3 text-[15px]"
          autoComplete="tel"
        />
        {fieldErrors.phone ? <span id={fieldErrorId("phone")} className="mt-1 block text-red-700">{fieldErrors.phone}</span> : null}
      </label>

      <label className="block text-sm font-medium text-[#2a3360]">
        Email (recommended for a reply)
        <input
          type="email"
          name="email"
          value={email}
          onChange={(event) => { setEmail(event.target.value); clearFieldError("email"); }}
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? fieldErrorId("email") : undefined}
          className="mt-1.5 w-full rounded-lg border border-[#e6dccb] px-3.5 py-3 text-[15px]"
          autoComplete="email"
        />
        {fieldErrors.email ? <span id={fieldErrorId("email")} className="mt-1 block text-red-700">{fieldErrors.email}</span> : null}
      </label>

      {handoffRequired && assistantService.trim() ? (
        <p className="text-sm text-[#2a3360]">Requested service for staff review: <strong>{assistantService.trim()}</strong>. This service is not confirmed as offered or bookable.</p>
      ) : model.serviceCards.length > 0 ? (
        <label className="block text-sm font-medium text-[#2a3360]">
          Service interest
          <select
            value={serviceInterest}
            onChange={(event) => setServiceInterest(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-[#e6dccb] px-3.5 py-3 text-[15px]"
          >
            {model.serviceCards.map((card) => (
              <option key={card.id} value={card.title}>{card.title}</option>
            ))}
          </select>
        </label>
      ) : (
        <label className="block text-sm font-medium text-[#2a3360]">
          Service interest
          <input
            required
            name="serviceInterest"
            value={serviceInterest}
            onChange={(event) => { setServiceInterest(event.target.value); clearFieldError("serviceInterest"); }}
            aria-invalid={Boolean(fieldErrors.serviceInterest)}
            aria-describedby={fieldErrors.serviceInterest ? fieldErrorId("serviceInterest") : undefined}
            className="mt-1.5 w-full rounded-lg border border-[#e6dccb] px-3.5 py-3 text-[15px]"
            placeholder="Briefly describe the service you need"
          />
          {fieldErrors.serviceInterest ? <span id={fieldErrorId("serviceInterest")} className="mt-1 block text-red-700">{fieldErrors.serviceInterest}</span> : null}
        </label>
      )}

      <label className="block text-sm font-medium text-[#2a3360]">
        Service address
        <input
          required
          name="addressLine1"
          value={addressLine1}
          onChange={(event) => { setAddressLine1(event.target.value); clearFieldError("addressLine1"); }}
          aria-invalid={Boolean(fieldErrors.addressLine1)}
          aria-describedby={fieldErrors.addressLine1 ? fieldErrorId("addressLine1") : undefined}
          className="mt-1.5 w-full rounded-lg border border-[#e6dccb] px-3.5 py-3 text-[15px]"
          autoComplete="street-address"
        />
        {fieldErrors.addressLine1 ? <span id={fieldErrorId("addressLine1")} className="mt-1 block text-red-700">{fieldErrors.addressLine1}</span> : null}
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm font-medium text-[#2a3360] sm:col-span-2">
          City
          <input
            required
            name="city"
            value={city}
            onChange={(event) => { setCity(event.target.value); clearFieldError("city"); }}
            aria-invalid={Boolean(fieldErrors.city)}
            aria-describedby={fieldErrors.city ? fieldErrorId("city") : undefined}
            className="mt-1.5 w-full rounded-lg border border-[#e6dccb] px-3.5 py-3 text-[15px]"
            autoComplete="address-level2"
          />
          {fieldErrors.city ? <span id={fieldErrorId("city")} className="mt-1 block text-red-700">{fieldErrors.city}</span> : null}
        </label>
        <label className="block text-sm font-medium text-[#2a3360]">
          State
          <input
            required
            maxLength={2}
            name="state"
            value={state}
            onChange={(event) => { setState(event.target.value); clearFieldError("state"); }}
            aria-invalid={Boolean(fieldErrors.state)}
            aria-describedby={fieldErrors.state ? fieldErrorId("state") : undefined}
            className="mt-1.5 w-full rounded-lg border border-[#e6dccb] px-3.5 py-3 text-[15px] uppercase"
            autoComplete="address-level1"
          />
          {fieldErrors.state ? <span id={fieldErrorId("state")} className="mt-1 block text-red-700">{fieldErrors.state}</span> : null}
        </label>
      </div>

      <label className="block text-sm font-medium text-[#2a3360]">
        ZIP code
        <input
          required
          inputMode="numeric"
          name="zip"
          value={zip}
          onChange={(event) => { if (assistantPending || (handoffRequired && assistantTopic === "service_area")) invalidateAssistantQuestion(); setZip(event.target.value); clearFieldError("zip"); }}
          aria-invalid={Boolean(fieldErrors.zip)}
          aria-describedby={fieldErrors.zip ? fieldErrorId("zip") : undefined}
          className="mt-1.5 w-full rounded-lg border border-[#e6dccb] px-3.5 py-3 text-[15px]"
          autoComplete="postal-code"
        />
        {fieldErrors.zip ? <span id={fieldErrorId("zip")} className="mt-1 block text-red-700">{fieldErrors.zip}</span> : null}
      </label>

      <label className="block text-sm font-medium text-[#2a3360]">
        Notes (optional)
        <textarea
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="mt-1.5 w-full rounded-lg border border-[#e6dccb] px-3.5 py-3 text-[15px]"
        />
      </label>

      <fieldset className="space-y-3 rounded-lg border border-[#e6dccb] bg-[#f7faf8] p-4">
        <legend className="px-1 text-sm font-semibold text-[#0f1530]">Consent</legend>
        <label className="flex gap-2 text-sm text-[#2a3360]">
          <input
            type="checkbox"
            checked={smsConsentAppointments}
            onChange={(event) => setSmsConsentAppointments(event.target.checked)}
            className="mt-0.5"
          />
          <span>
            Optional: I agree to receive appointment-related texts from {model.companyName}. Message frequency varies. Reply STOP to
            opt out.
          </span>
        </label>
        <label className="flex gap-2 text-sm text-[#2a3360]">
          <input
            type="checkbox"
            checked={smsConsentMarketing}
            onChange={(event) => setSmsConsentMarketing(event.target.checked)}
            className="mt-0.5"
          />
          <span>Optional: I agree to receive occasional offers and maintenance reminders by text.</span>
        </label>
      </fieldset>

      {handoffRequired ? <label className="flex gap-2 text-sm text-[#2a3360]">
        <input type="checkbox" name="contactConsent" checked={contactConsent} onChange={(event) => { setContactConsent(event.target.checked); setErrorMessage(null); }} className="mt-0.5" />
        <span>I agree to send these contact details and my request to staff for review. No appointment has been confirmed.</span>
      </label> : null}

      {errorMessage ? (
        <p className="text-sm text-red-700" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div aria-hidden="true" className="absolute left-[-10000px] h-px w-px overflow-hidden">
        <label>
          Website
          <input
            type="text"
            name={HONEYPOT_FIELD}
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="flex h-[52px] w-full items-center justify-center rounded-[10px] bg-[#2f7d4f] text-sm font-semibold text-white hover:bg-[#286b44] disabled:opacity-60"
      >
        {isPending ? (
          <><Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />Sending inquiry</>
        ) : (
          handoffRequired ? "Request staff review" : "Send inquiry"
        )}
      </button>
    </form>
  );
}
