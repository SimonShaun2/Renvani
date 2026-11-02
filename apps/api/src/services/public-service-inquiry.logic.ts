/**
 * Growth — server-side gate for the public service-by-ZIP inquiry form (no address field).
 * Everything the web form checks is re-checked here; nothing from the client is trusted.
 */

export const SERVICE_INQUIRY_HONEYPOT_FIELD = "website";
export const SERVICE_INQUIRY_LEAD_SOURCE = "service_page";

export const SERVICE_INQUIRY_LIMITS = {
  name: 200,
  phone: 30,
  email: 255,
  message: 2000,
  service: 100
} as const;

export interface ServiceInquiryFieldError {
  field: string;
  message: string;
}

export interface NormalizedServiceInquiry {
  firstName: string;
  lastName: string;
  /** 10 digits, US. */
  phone: string;
  email: string | null;
  message: string | null;
  service: string | null;
  /** 5-digit ZIP (ZIP+4 is reduced to 5). */
  zip: string;
}

export type ServiceInquiryValidation =
  | { ok: true; honeypot: boolean; value: NormalizedServiceInquiry }
  | { ok: false; honeypot: boolean; errors: ServiceInquiryFieldError[] };

const ALLOWED_FIELDS = new Set(["name", "phone", "email", "message", "service", "zip", SERVICE_INQUIRY_HONEYPOT_FIELD]);
const EMAIL_PATTERN = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/u;
const ZIP_PATTERN = /^(\d{5})(?:-\d{4})?$/u;
// Strip control characters except tab/newline (messages keep line breaks).
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu;

function readString(
  body: Record<string, unknown>,
  field: string,
  errors: ServiceInquiryFieldError[]
): string | undefined {
  const raw = body[field];
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string") {
    errors.push({ field, message: `${field} must be a string` });
    return undefined;
  }
  const cleaned = raw.replace(CONTROL_CHARS, "").trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

function collapseSpaces(value: string): string {
  return value.replace(/\s+/gu, " ");
}

export function normalizeUsPhone(value: string): string | null {
  const digits = value.replace(/\D/gu, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (ten.length !== 10) return null;
  // NANP: area code and exchange cannot start with 0 or 1.
  if (!/^[2-9]\d{2}[2-9]\d{6}$/u.test(ten)) return null;
  return ten;
}

export function validateServiceInquiry(input: unknown): ServiceInquiryValidation {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, honeypot: false, errors: [{ field: "body", message: "Request body must be a JSON object" }] };
  }
  const body = input as Record<string, unknown>;
  const honeypotRaw = body[SERVICE_INQUIRY_HONEYPOT_FIELD];
  const honeypot = typeof honeypotRaw === "string" ? honeypotRaw.trim().length > 0 : honeypotRaw != null && honeypotRaw !== false;

  const errors: ServiceInquiryFieldError[] = [];
  for (const key of Object.keys(body)) {
    if (!ALLOWED_FIELDS.has(key)) errors.push({ field: key, message: "Unknown field" });
  }

  const name = readString(body, "name", errors);
  const phoneRaw = readString(body, "phone", errors);
  const emailRaw = readString(body, "email", errors);
  const message = readString(body, "message", errors);
  const service = readString(body, "service", errors);
  const zipRaw = readString(body, "zip", errors);

  if (!name) errors.push({ field: "name", message: "Name is required" });
  else if (name.length > SERVICE_INQUIRY_LIMITS.name)
    errors.push({ field: "name", message: `Name must be at most ${SERVICE_INQUIRY_LIMITS.name} characters` });

  let phone: string | null = null;
  if (!phoneRaw) errors.push({ field: "phone", message: "Phone is required" });
  else if (phoneRaw.length > SERVICE_INQUIRY_LIMITS.phone || !(phone = normalizeUsPhone(phoneRaw)))
    errors.push({ field: "phone", message: "Enter a valid 10-digit US phone number" });

  let email: string | null = null;
  if (emailRaw) {
    if (emailRaw.length > SERVICE_INQUIRY_LIMITS.email || !EMAIL_PATTERN.test(emailRaw))
      errors.push({ field: "email", message: "Enter a valid email address" });
    else email = emailRaw.toLowerCase();
  }

  if (message && message.length > SERVICE_INQUIRY_LIMITS.message)
    errors.push({ field: "message", message: `Message must be at most ${SERVICE_INQUIRY_LIMITS.message} characters` });
  if (service && service.length > SERVICE_INQUIRY_LIMITS.service)
    errors.push({ field: "service", message: `Service must be at most ${SERVICE_INQUIRY_LIMITS.service} characters` });

  let zip: string | null = null;
  if (!zipRaw) errors.push({ field: "zip", message: "ZIP code is required" });
  else {
    const match = ZIP_PATTERN.exec(zipRaw);
    if (!match) errors.push({ field: "zip", message: "Enter a 5-digit ZIP code" });
    else zip = match[1] ?? null;
  }

  if (errors.length > 0 || !name || !phone || !zip) {
    return { ok: false, honeypot, errors };
  }

  const fullName = collapseSpaces(name);
  const spaceAt = fullName.indexOf(" ");
  const firstName = (spaceAt === -1 ? fullName : fullName.slice(0, spaceAt)).slice(0, 100);
  const lastName = (spaceAt === -1 ? "" : fullName.slice(spaceAt + 1)).slice(0, 100);

  return {
    ok: true,
    honeypot,
    value: {
      firstName,
      lastName,
      phone,
      email,
      message: message ?? null,
      service: service ? collapseSpaces(service) : null,
      zip
    }
  };
}

export function buildServiceInquiryNotes(value: Pick<NormalizedServiceInquiry, "service" | "message">): string | null {
  const parts = [value.service ? `Service: ${value.service}` : null, value.message].filter(
    (part): part is string => Boolean(part)
  );
  return parts.length > 0 ? parts.join("\n\n") : null;
}
