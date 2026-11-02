import type { CommandCenterSource, CommandCenterSourceKind } from "@fsm/types";

/**
 * FS-29 source citations. Labels are record numbers or short ids only (never customer names, phone numbers or
 * emails), routes point at the web record. Pure functions, unit tested.
 */

export const COMMAND_CENTER_SOURCES_LIMIT = 20;

const LABEL_PREFIX: Record<CommandCenterSourceKind, string> = {
  booking_request: "INQ",
  call_record: "CALL",
  job: "J",
  invoice: "INV",
  customer: "CUST",
  agent_action: "ACT",
  maintenance_plan: "PLAN",
  crew: "CREW",
  campaign: "CAMPAIGN"
};

export function shortId(id: string): string {
  return id.replace(/-/gu, "").slice(0, 8);
}

/** Record-number-like values only: letters, digits, dash, underscore, dot, #. Anything else falls back to the id label. */
const SAFE_RECORD_NUMBER = /^[A-Za-z0-9#._-]{1,40}$/u;

export function commandCenterSourceLabel(kind: CommandCenterSourceKind, id: string, recordNumber?: string | null): string {
  const trimmed = recordNumber?.trim();
  if (trimmed && SAFE_RECORD_NUMBER.test(trimmed)) return trimmed;
  return `${LABEL_PREFIX[kind]}-${shortId(id)}`;
}

export function commandCenterSourceRoute(kind: CommandCenterSourceKind, id: string): string {
  const encoded = encodeURIComponent(id);
  switch (kind) {
    case "booking_request":
      return `/booking-requests?id=${encoded}`;
    case "call_record":
      return `/growth/call-tracking?call=${encoded}`;
    case "job":
      return `/jobs/${encoded}`;
    case "invoice":
      return `/invoices/${encoded}`;
    case "customer":
      return `/customers/${encoded}`;
    case "agent_action":
      return `/command-center/approvals?id=${encoded}`;
    case "maintenance_plan":
      return `/service-agreements/${encoded}`;
    case "crew":
      return `/dispatch?crew=${encoded}`;
    case "campaign":
      return `/growth?campaign=${encoded}`;
  }
}

export function commandCenterSource(
  kind: CommandCenterSourceKind,
  id: string,
  occurredAt: Date | null,
  recordNumber?: string | null
): CommandCenterSource {
  return {
    kind,
    id,
    label: commandCenterSourceLabel(kind, id, recordNumber),
    route: commandCenterSourceRoute(kind, id),
    occurredAt: occurredAt ? occurredAt.toISOString() : null
  };
}

/** Newest first, capped; `truncated` when more were available. */
export function capSources(sources: CommandCenterSource[], limit = COMMAND_CENTER_SOURCES_LIMIT): { sources: CommandCenterSource[]; truncated: boolean } {
  const sorted = [...sources].sort((a, b) => (b.occurredAt ?? "").localeCompare(a.occurredAt ?? "") || a.id.localeCompare(b.id));
  return { sources: sorted.slice(0, limit), truncated: sorted.length > limit };
}

/** E.164 for a stored booking phone (US default), matching how inbound caller numbers are hashed. */
export function normalizeBookingPhoneE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/gu, "");
  if (trimmed.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}
