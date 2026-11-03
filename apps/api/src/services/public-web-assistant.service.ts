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

function unverified(answer = "I can't verify that from this business's published information. Staff can review your request."): WebAssistantResponse {
  return { kind: "answer", verified: false, answer, source: "unverified" };
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
  if (settings.trade !== "hvac" && settings.trade !== "plumbing") return unverified();
  switch (input.topic) {
    case "services": {
      const labels = serviceLabels(settings);
      if (labels.length === 0) return unverified("This business hasn't published a verified service list yet. Staff can confirm your request.");
      if (input.service) {
        const matched = labels.find((label) => label.toLowerCase() === input.service?.toLowerCase());
        return matched
          ? { kind: "answer", verified: true, answer: `${settings.companyName} lists ${matched} as an offered service. Staff will confirm the next step.`, source: "public_booking_settings" }
          : unverified("I can't verify that service in the published service list. Staff can review your request.");
      }
      return { kind: "answer", verified: true, answer: `${settings.companyName} lists these services: ${labels.join(", ")}. Staff will confirm your request.`, source: "public_booking_settings" };
    }
    case "service_area":
      if (!input.zip || !serviceability || serviceability === "unknown") return unverified("Service coverage for that ZIP isn't verified. Staff can review your request.");
      return {
        kind: "answer", verified: true,
        answer: serviceability === "in_area"
          ? `${settings.companyName} currently lists ${input.zip} in its service area. Staff will confirm availability.`
          : `${settings.companyName} does not currently list ${input.zip} in its service area. Staff can review your request.`,
        source: "zip_serviceability"
      };
    case "booking_hours":
      if (settings.availableDays.length === 0 || settings.availableHoursEnd <= settings.availableHoursStart) return unverified();
      return {
        kind: "answer", verified: true,
        answer: `Published booking request windows: ${settings.availableDays.join(", ")}, ${formatHour(settings.availableHoursStart)} to ${formatHour(settings.availableHoursEnd)} (${settings.timezone}). These are request windows, not a confirmed appointment.`,
        source: "public_booking_settings"
      };
    case "emergency": {
      const resolution = resolveEmergencyRequest(true, settings.emergencyService ?? { enabled: false, hoursText: null }, settings.trade);
      return resolution.accepted
        ? { kind: "answer", verified: true, answer: `${settings.companyName} has emergency service enabled. Staff must confirm coverage and response time for your request.`, source: "public_booking_settings" }
        : unverified("Emergency coverage is not verified for this business. Staff can review an urgent request.");
    }
    case "contact":
      return settings.phone
        ? { kind: "answer", verified: true, answer: `The published contact number for ${settings.companyName} is ${settings.phone}.`, source: "public_booking_settings" }
        : unverified("This business has not published a verified contact number. Staff can review your request.");
    case "availability":
      return unverified("I can't confirm a live appointment from published settings. Staff can review available slots and your request.");
    case "pricing":
      return unverified("I can't approve or verify a price here. Staff can provide a quote for your request.");
    case "human":
      return unverified("Staff can review your request when you submit the handoff form. No appointment has been confirmed.");
    case "other":
      return unverified();
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
