import {
  AppError,
  ErrorCode,
  resolveEmergencyRequest,
  type PublicBookingSettings,
  type WebAssistantHandoffReason,
  type WebAssistantRequest,
  type WebAssistantResponse
} from "@fsm/types";

import {
  getPublicBookingContext,
  getPublicBookingSettingsBySlug,
  resolvePublicZipServiceability
} from "./booking.service.js";
import { normalizeUsPhone } from "./public-service-inquiry.logic.js";
import { intakeWebAssistantHandoff } from "./revenue-inquiry-intake.service.js";

type Serviceability = "in_area" | "out_of_area" | "unknown";

function serviceLabels(settings: PublicBookingSettings): string[] {
  return Array.from(new Set(settings.offeredServices.flatMap((service) => {
    const label = [service.label, service.name, service.category]
      .find((value): value is string => typeof value === "string" && value.trim().length > 0);
    return label ? [label.trim()] : [];
  })));
}

function handoffRequired(
  reason: WebAssistantHandoffReason,
  message = "I can't verify that from this business's published information. Submit your request for staff review; no appointment is confirmed."
): WebAssistantResponse {
  return { kind: "handoff_required", reason, message };
}

function formatHour(hour: number): string {
  const whole = Math.trunc(hour);
  if (whole === 24) return "12:00 AM (next day)";
  const suffix = whole < 12 ? "AM" : "PM";
  return `${whole % 12 || 12}:00 ${suffix}`;
}

/** Only public, owner-configured facts can produce a verified answer. No generated text or availability promise. */
export function answerVerifiedWebQuestion(
  input: Extract<WebAssistantRequest, { action: "answer" }>,
  settings: PublicBookingSettings,
  serviceability?: Serviceability
): WebAssistantResponse {
  if (settings.trade !== "hvac" && settings.trade !== "plumbing") return handoffRequired("unsupported_service");
  switch (input.topic) {
    case "services": {
      const labels = serviceLabels(settings);
      if (labels.length === 0) return handoffRequired("unverified_answer", "This business hasn't published a verified service list yet. Submit your request for staff review; no appointment is confirmed.");
      if (input.service) {
        const matched = labels.find((label) => label.toLowerCase() === input.service?.toLowerCase());
        return matched
          ? { kind: "answer", verified: true, answer: `${settings.companyName} lists ${matched} as an offered service. Staff will confirm the next step.`, source: "public_booking_settings" }
          : handoffRequired("unsupported_service", "I can't verify that service in the published service list. Submit your request for staff review; no appointment is confirmed.");
      }
      return { kind: "answer", verified: true, answer: `${settings.companyName} lists these services: ${labels.join(", ")}. Staff will confirm your request.`, source: "public_booking_settings" };
    }
    case "service_area":
      if (!input.zip || !serviceability || serviceability === "unknown") return handoffRequired("unknown_serviceability", "Service coverage for that ZIP isn't verified. Submit your request for staff review; no appointment is confirmed.");
      if (serviceability === "out_of_area") return handoffRequired("out_of_area", `${settings.companyName} does not currently list ${input.zip} in its service area. Staff can review your request; no appointment is confirmed.`);
      return {
        kind: "answer", verified: true,
        answer: `${settings.companyName} currently lists ${input.zip} in its service area. Staff will confirm availability.`,
        source: "zip_serviceability"
      };
    case "booking_hours":
      if (settings.availableDays.length === 0 || settings.availableHoursEnd <= settings.availableHoursStart) return handoffRequired("unverified_answer");
      return {
        kind: "answer", verified: true,
        answer: `Published booking request windows: ${settings.availableDays.join(", ")}, ${formatHour(settings.availableHoursStart)} to ${formatHour(settings.availableHoursEnd)} (${settings.timezone}). These are request windows, not a confirmed appointment.`,
        source: "public_booking_settings"
      };
    case "emergency": {
      const resolution = resolveEmergencyRequest(true, settings.emergencyService ?? { enabled: false, hoursText: null }, settings.trade);
      return resolution.accepted
        ? { kind: "answer", verified: true, answer: `${settings.companyName} has emergency service enabled. Staff must confirm coverage and response time for your request.`, source: "public_booking_settings" }
        : handoffRequired("emergency_review", "Emergency coverage is not verified for this business. Submit an urgent request for staff review; no response time or appointment is confirmed.");
    }
    case "contact":
      return settings.phone
        ? { kind: "answer", verified: true, answer: `The published contact number for ${settings.companyName} is ${settings.phone}.`, source: "public_booking_settings" }
        : handoffRequired("unverified_answer", "This business has not published a verified contact number. Submit your request for staff review; no appointment is confirmed.");
    case "availability":
      return handoffRequired("availability_review", "I can't confirm a live appointment from published settings. Submit your request for staff review; no appointment is confirmed.");
    case "pricing":
      return handoffRequired("pricing_review", "I can't approve or verify a price here. Submit your request for a staff quote; no price is confirmed.");
    case "human":
      return handoffRequired("human_requested", "Submit the handoff form to reach staff. No appointment has been confirmed.");
    case "other":
      return handoffRequired("unverified_answer");
  }
}

function handoffReason(
  input: Extract<WebAssistantRequest, { action: "handoff" }>,
  settings: PublicBookingSettings,
  serviceability: Serviceability
): WebAssistantHandoffReason {
  if (input.topic === "human") return "human_requested";
  if (serviceability === "out_of_area") return "out_of_area";
  if (serviceability === "unknown") return "unknown_serviceability";
  if (settings.trade !== "hvac" && settings.trade !== "plumbing") return "unsupported_service";
  if (input.service && !serviceLabels(settings).some((label) => label.toLowerCase() === input.service?.toLowerCase())) return "unsupported_service";
  if (input.topic === "emergency") return "emergency_review";
  if (input.topic === "pricing") return "pricing_review";
  if (input.topic === "availability") return "availability_review";
  return "unverified_answer";
}

export async function decidePublicWebAssistant(
  slug: string,
  input: WebAssistantRequest,
  idempotencyKey?: string
): Promise<{ created: boolean; response: WebAssistantResponse }> {
  const { company, settings: bookingSettings } = await getPublicBookingContext(slug);
  const publicSettings = await getPublicBookingSettingsBySlug(slug);
  if (publicSettings.companySlug !== company.slug) throw new AppError(ErrorCode.CONFLICT, "Public shop changed during request");

  if (input.action === "answer") {
    const coverage = input.topic === "service_area" && input.zip
      ? await resolvePublicZipServiceability(slug, input.zip)
      : null;
    if (coverage && coverage.companyId !== bookingSettings.companyId) throw new AppError(ErrorCode.CONFLICT, "Public shop changed during request");
    return { created: false, response: answerVerifiedWebQuestion(input, publicSettings, coverage?.serviceability) };
  }

  if (!idempotencyKey) throw new AppError(ErrorCode.VALIDATION_ERROR, "Idempotency-Key is required for staff handoff");
  const phone = normalizeUsPhone(input.contact.phone);
  if (!phone) throw new AppError(ErrorCode.VALIDATION_ERROR, "Enter a valid 10-digit US phone number");
  const coverage = await resolvePublicZipServiceability(slug, input.contact.zip);
  if (coverage.companyId !== bookingSettings.companyId) throw new AppError(ErrorCode.CONFLICT, "Public shop changed during request");
  const reason = handoffReason(input, publicSettings, coverage.serviceability);
  const { created, result } = await intakeWebAssistantHandoff(bookingSettings.companyId, {
    firstName: input.contact.firstName,
    lastName: input.contact.lastName,
    phone,
    email: input.contact.email ?? null,
    addressLine1: input.contact.addressLine1,
    city: input.contact.city,
    state: input.contact.state.toUpperCase(),
    zip: input.contact.zip,
    service: input.service ?? null,
    message: input.message,
    source: input.source ?? "website",
    serviceability: coverage.serviceability,
    reason,
    smsConsentAppointments: input.smsConsentAppointments ?? false,
    smsConsentMarketing: input.smsConsentMarketing ?? false,
    idempotencyKey
  });
  return {
    created,
    response: {
      kind: "handoff",
      status: "pending",
      referenceNumber: result.referenceNumber,
      reason: result.reason,
      message: "Your request is pending staff review. No appointment has been confirmed."
    }
  };
}
