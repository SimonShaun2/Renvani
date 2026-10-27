import { RECORD_VERSION_V1_PREFIX } from "./constants.js";

export const CANONICAL_ENTITY_TYPES_V1 = [
  "customer",
  "property",
  "asset",
  "job",
  "job_task",
  "estimate",
  "invoice",
  "booking_request",
  "time_entry",
  "timesheet",
  "technician_pay_rate"
] as const;

export type CanonicalEntityTypeV1 = (typeof CANONICAL_ENTITY_TYPES_V1)[number];

export interface CanonicalEntityRefV1 {
  contractVersion: "1.0.0";
  entityType: CanonicalEntityTypeV1;
  entityId: string;
  companyId: string;
  observedAt: string;
  recordVersion: string;
  source?: {
    channel: string;
    externalId?: string;
    importSessionId?: string;
  };
}

/**
 * ADR-FS-3 U4: deterministic optimistic-lock token from row `updatedAt`.
 */
export function buildRecordVersionV1(
  entityType: CanonicalEntityTypeV1,
  entityId: string,
  updatedAt: Date
): string {
  return `${RECORD_VERSION_V1_PREFIX}:${entityType}:${entityId}:${updatedAt.toISOString()}`;
}

export interface ParsedRecordVersionV1 {
  entityType: CanonicalEntityTypeV1;
  entityId: string;
  updatedAtIso: string;
}

export function parseRecordVersionV1(token: string): ParsedRecordVersionV1 | null {
  if (!token.startsWith(`${RECORD_VERSION_V1_PREFIX}:`)) {
    return null;
  }

  const parts = token.split(":");
  if (parts.length < 4) {
    return null;
  }

  const entityType = parts[1];
  const entityId = parts[2];
  const updatedAtIso = parts.slice(3).join(":");

  if (!entityType || !entityId || !updatedAtIso) {
    return null;
  }

  if (!CANONICAL_ENTITY_TYPES_V1.includes(entityType as CanonicalEntityTypeV1)) {
    return null;
  }

  if (Number.isNaN(Date.parse(updatedAtIso))) {
    return null;
  }

  return {
    entityType: entityType as CanonicalEntityTypeV1,
    entityId,
    updatedAtIso
  };
}

/** FS37-NT-06 — execute-time compare; mismatch implies stale target. */
export function isStaleRecordVersion(expected: string, live: string): boolean {
  return expected !== live;
}
