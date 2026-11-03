export type ImportedMessageChannel = "sms" | "email" | "in_app";
export type ImportedMessageDirection = "outbound" | "inbound";

export function normalizeImportedMessageChannel(
  raw: string | null | undefined,
): ImportedMessageChannel | null {
  if (!raw) {
    return null;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized.includes("sms") || normalized.includes("text") || normalized === "mms") {
    return "sms";
  }
  if (normalized.includes("email") || normalized.includes("mail")) {
    return "email";
  }
  if (normalized.includes("app") || normalized.includes("portal") || normalized.includes("chat")) {
    return "in_app";
  }

  return null;
}

export function normalizeImportedMessageDirection(
  raw: string | null | undefined,
): ImportedMessageDirection | null {
  if (!raw) {
    return null;
  }

  const normalized = raw.trim().toLowerCase();
  if (
    normalized.includes("inbound") ||
    normalized.includes("incoming") ||
    normalized.includes("received") ||
    normalized === "in"
  ) {
    return "inbound";
  }
  if (
    normalized.includes("outbound") ||
    normalized.includes("outgoing") ||
    normalized.includes("sent") ||
    normalized === "out"
  ) {
    return "outbound";
  }

  return null;
}

/** Prefer explicit to-address; fall back to email/phone columns from vendor exports. */
export function resolveImportedMessageToAddress(input: {
  toAddress?: string | null;
  email?: string | null;
  phone?: string | null;
  channel: ImportedMessageChannel;
}): string | null {
  const explicit = input.toAddress?.trim();
  if (explicit && explicit.length > 0) {
    return explicit.slice(0, 255);
  }

  if (input.channel === "email") {
    const email = input.email?.trim();
    return email && email.length > 0 ? email.slice(0, 255) : null;
  }

  if (input.channel === "sms") {
    const phone = input.phone?.trim();
    return phone && phone.length > 0 ? phone.slice(0, 255) : null;
  }

  const fallback = input.email?.trim() || input.phone?.trim();
  return fallback && fallback.length > 0 ? fallback.slice(0, 255) : null;
}
