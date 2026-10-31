"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  BRANDED_ACQUISITION_SOURCE,
  buildBookPath,
  type BrandedStorefrontViewModel
} from "@/src/components/growth/branded-storefront.utils";
import { useCheckZipCoverage, useSubmitBookingRequest } from "@/src/hooks/booking.hooks";
import { ApiError } from "@/src/lib/api";
import { HONEYPOT_FIELD } from "@/src/lib/inquiry-rate-limit";

interface BrandedInquiryClientProps {
  model: BrandedStorefrontViewModel;
  acquisitionSource: string;
  initialService?: string;
  initialZip?: string;
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

export function BrandedInquiryClient({ model, acquisitionSource, initialService, initialZip }: BrandedInquiryClientProps) {
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
  const [serviceInterest, setServiceInterest] = useState(initialService ?? model.serviceCards[0]?.title ?? "Standard clean");
  const [notes, setNotes] = useState("");
  const [smsConsentAppointments, setSmsConsentAppointments] = useState(false);
  const [smsConsentMarketing, setSmsConsentMarketing] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const idempotencyKey = useMemo(() => createIdempotencyKey(), []);

  const bookHref = buildBookPath(model.bookingSlug, acquisitionSource);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(null);

    if (!smsConsentAppointments) {
      setErrorMessage("Please agree to appointment updates by text so we can confirm your request.");
      return;
    }

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
          serviceCategory: "Cleaning",
          serviceType: serviceInterest,
          customerNotes: `[Branded site inquiry] ${notes.trim()}`.trim(),
          urgency: "flexible",
          preferredWindow: "first_available",
          smsConsentAppointments: true,
          smsConsentMarketing
        }
      });

      setReferenceNumber(response.confirmation.referenceNumber);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "We could not send your request. Please try again.");
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
        <Link href={bookHref} className="mt-6 inline-flex text-sm font-semibold text-[#2f7d4f] hover:underline">
          Prefer to pick a time now? Continue to booking
        </Link>
      </div>
    );
  }

  return (
    <form className="mx-auto max-w-lg space-y-4" onSubmit={(event) => void handleSubmit(event)} noValidate>
      <p className="text-sm text-[#5e6684]">
        Request a quote without leaving {model.companyName}&apos;s Renvani-powered site. This coexists with your existing
        website — no migration required.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-[#2a3360]">
          First name
          <input
            required
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-[#e6dccb] px-3.5 py-3 text-[15px]"
            autoComplete="given-name"
          />
        </label>
        <label className="block text-sm font-medium text-[#2a3360]">
          Last name
          <input
            required
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-[#e6dccb] px-3.5 py-3 text-[15px]"
            autoComplete="family-name"
          />
        </label>
      </div>

      <label className="block text-sm font-medium text-[#2a3360]">
        Mobile phone
        <input
          required
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="mt-1.5 w-full rounded-lg border border-[#e6dccb] px-3.5 py-3 text-[15px]"
          autoComplete="tel"
        />
      </label>

      <label className="block text-sm font-medium text-[#2a3360]">
        Email (optional)
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1.5 w-full rounded-lg border border-[#e6dccb] px-3.5 py-3 text-[15px]"
          autoComplete="email"
        />
      </label>

      <label className="block text-sm font-medium text-[#2a3360]">
        Service interest
        <select
          value={serviceInterest}
          onChange={(event) => setServiceInterest(event.target.value)}
          className="mt-1.5 w-full rounded-lg border border-[#e6dccb] px-3.5 py-3 text-[15px]"
        >
          {model.serviceCards.map((card) => (
            <option key={card.id} value={card.title}>
              {card.title}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium text-[#2a3360]">
        Service address
        <input
          required
          value={addressLine1}
          onChange={(event) => setAddressLine1(event.target.value)}
          className="mt-1.5 w-full rounded-lg border border-[#e6dccb] px-3.5 py-3 text-[15px]"
          autoComplete="street-address"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm font-medium text-[#2a3360] sm:col-span-2">
          City
          <input
            required
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-[#e6dccb] px-3.5 py-3 text-[15px]"
            autoComplete="address-level2"
          />
        </label>
        <label className="block text-sm font-medium text-[#2a3360]">
          State
          <input
            required
            maxLength={2}
            value={state}
            onChange={(event) => setState(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-[#e6dccb] px-3.5 py-3 text-[15px] uppercase"
            autoComplete="address-level1"
          />
        </label>
      </div>

      <label className="block text-sm font-medium text-[#2a3360]">
        ZIP code
        <input
          required
          inputMode="numeric"
          value={zip}
          onChange={(event) => setZip(event.target.value)}
          className="mt-1.5 w-full rounded-lg border border-[#e6dccb] px-3.5 py-3 text-[15px]"
          autoComplete="postal-code"
        />
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
            I agree to receive appointment-related texts from {model.companyName}. Message frequency varies. Reply STOP to
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
          <span>Optional: send me occasional offers and cleaning tips by text.</span>
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
        disabled={submitMutation.isPending || zipCheckMutation.isPending}
        className="flex h-[52px] w-full items-center justify-center rounded-[10px] bg-[#2f7d4f] text-sm font-semibold text-white hover:bg-[#286b44] disabled:opacity-60"
      >
        {submitMutation.isPending || zipCheckMutation.isPending ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        ) : (
          "Send inquiry"
        )}
      </button>

      <p className="text-center text-xs text-[#5e6684]">
        Attribution: <span className="font-mono">{acquisitionSource || BRANDED_ACQUISITION_SOURCE}</span> · Handoff to
        Revenue (FS-17) via booking request
      </p>
    </form>
  );
}
