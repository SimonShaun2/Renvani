"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  buildBookPath,
  type BrandedStorefrontViewModel
} from "@/src/components/growth/branded-storefront.utils";
import { useCheckZipCoverage, useSubmitBookingRequest } from "@/src/hooks/booking.hooks";
import { ApiError } from "@/src/lib/api";
import { SITE_TRADES } from "@/src/components/growth/site-trade.registry";
import { HONEYPOT_FIELD } from "@/src/lib/inquiry-rate-limit";

interface BrandedInquiryClientProps {
  model: BrandedStorefrontViewModel;
  acquisitionSource: string;
  initialService?: string;
  initialZip?: string;
  /** Label for the configured trade, sent as `serviceCategory`. */
  serviceCategory?: string;
}

type InquiryField = "firstName" | "lastName" | "phone" | "email" | "addressLine1" | "city" | "state" | "zip";
type InquiryFieldErrors = Partial<Record<InquiryField, string>>;

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

export function BrandedInquiryClient({ model, acquisitionSource, initialService, initialZip, serviceCategory }: BrandedInquiryClientProps) {
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<InquiryFieldErrors>({});
  const [isSending, setIsSending] = useState(false);
  const formId = useId();

  const idempotencyKey = useMemo(() => createIdempotencyKey(), []);

  const bookHref = buildBookPath(model.bookingSlug, acquisitionSource);
  const isPending = isSending || submitMutation.isPending || zipCheckMutation.isPending;
  const fieldErrorId = (field: InquiryField) => `${formId}-${field}-error`;
  const clearFieldError = (field: InquiryField) => {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setErrorMessage(null);
  };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isPending) return;
    setErrorMessage(null);
    const requiredFields = [
      { key: "firstName", label: "First name", value: firstName },
      { key: "lastName", label: "Last name", value: lastName },
      { key: "phone", label: "Mobile phone", value: phone },
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

      const coverage = await zipCheckMutation.mutateAsync(zip.trim());
      if (!coverage.covered) {
        setErrorMessage("That ZIP is outside our current service area. You can still leave your email on the booking page.");
        return;
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

      setReferenceNumber(response.confirmation.referenceNumber);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "We could not send your request. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  if (referenceNumber) {
    return (
      <div className="mx-auto max-w-lg rounded-[14px] border border-[#e6dccb] bg-white p-8 text-center">
        <h1 className="text-2xl font-semibold text-[#0f1530]">Inquiry received</h1>
        <p className="mt-3 text-sm leading-6 text-[#5e6684]">
          Reference <span className="font-mono font-medium text-[#0f1530]">{referenceNumber}</span>.{" "}
          {model.companyName} will follow up — this is not a confirmed appointment until they reach out.
        </p>
        {model.serviceCards.length > 0 ? (
          <Link href={bookHref} className="mt-6 inline-flex text-sm font-semibold text-[#2f7d4f] hover:underline">
            Review booking options
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <form className="mx-auto max-w-lg space-y-4" onSubmit={(event) => void handleSubmit(event)} noValidate>
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

      {model.serviceCards.length > 0 ? (
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
      ) : null}

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
          onChange={(event) => { setZip(event.target.value); clearFieldError("zip"); }}
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
          "Send inquiry"
        )}
      </button>
    </form>
  );
}
