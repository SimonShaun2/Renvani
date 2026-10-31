/**
 * FS-200 Growth: call tracking + recording (backend only, disabled adapter by default).
 *
 * - Settings, tracking numbers and call records are tenant-scoped by company_id (RLS forced on all three tables).
 * - Inbound calls are accepted only when the provider's adapter is enabled AND the shop has enabled call
 *   tracking with that provider. With the built-in `disabled` adapter nothing is ever accepted.
 * - Caller numbers are stored as a tenant-scoped SHA-256 hash plus last 4 digits; recordings by reference only,
 *   and only when the shop turned recording on.
 * - Attribution reuses the lead attribution whitelist (#271): utm_source/utm_campaign from the number mapping,
 *   utm_medium "phone".
 */
import { createHash } from "node:crypto";

import { and, desc, eq, isNull } from "drizzle-orm";

import { callRecords, callTrackingNumbers, callTrackingSettings, db } from "@fsm/db";
import {
  AppError,
  CALL_TRACKING_DISABLED_PROVIDER_ID,
  ErrorCode,
  inboundCallEventSchema,
  sanitizeLeadAttribution,
  type CallRecord,
  type CallRecordListQuery,
  type CallTrackingNumber,
  type CallTrackingNumberCreate,
  type CallTrackingNumberUpdate,
  type CallTrackingSettings,
  type CallTrackingSettingsUpdate,
  type InboundCallWebhookResponse
} from "@fsm/types";

import {
  findCallTrackingAdapter,
  listCallTrackingAdapterIds,
  type CallTrackingWebhookInput
} from "./call-tracking-adapter.registry.js";

type SettingsRow = typeof callTrackingSettings.$inferSelect;
type NumberRow = typeof callTrackingNumbers.$inferSelect;
type CallRow = typeof callRecords.$inferSelect;

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: unknown; cause?: { code?: unknown } };
  return err.code === "23505" || err.cause?.code === "23505";
}

function toSettings(row: SettingsRow | undefined): CallTrackingSettings {
  const provider = row?.provider ?? CALL_TRACKING_DISABLED_PROVIDER_ID;
  return {
    provider,
    enabled: row?.enabled ?? false,
    providerReady: findCallTrackingAdapter(provider)?.enabled === true,
    recordingEnabled: row?.recordingEnabled ?? false,
    recordingDisclosureEnabled: row?.recordingDisclosureEnabled ?? true,
    consentMode: row?.consentMode ?? "all_party",
    recordingNoticeState: row?.recordingNoticeState ?? null,
    availableProviders: listCallTrackingAdapterIds(),
    version: row?.version ?? 0,
    updatedAt: row ? row.updatedAt.toISOString() : null
  };
}

function toNumber(row: NumberRow): CallTrackingNumber {
  return {
    id: row.id,
    provider: row.provider,
    trackingNumber: row.trackingNumber,
    label: row.label,
    marketingSource: row.marketingSource,
    marketingCampaign: row.marketingCampaign,
    forwardingNumber: row.forwardingNumber,
    active: row.active,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function toCall(row: CallRow): CallRecord {
  return {
    id: row.id,
    trackingNumberId: row.trackingNumberId,
    provider: row.provider,
    callerMasked: `***${row.callerLast4}`,
    startedAt: row.startedAt.toISOString(),
    durationSeconds: row.durationSeconds,
    outcome: row.outcome,
    leadAttribution: (row.attribution as Record<string, string> | null) ?? null,
    recordingRef: row.recordingRef,
    recordingDisclosurePlayed: row.recordingDisclosurePlayed,
    callerConsent: row.callerConsent,
    recordingNoticeState: row.recordingNoticeState,
    createdAt: row.createdAt.toISOString()
  };
}

async function loadSettingsRow(companyId: string): Promise<SettingsRow | undefined> {
  const [row] = await db.select().from(callTrackingSettings).where(eq(callTrackingSettings.companyId, companyId)).limit(1);
  return row;
}

export async function getCallTrackingSettings(companyId: string): Promise<CallTrackingSettings> {
  return toSettings(await loadSettingsRow(companyId));
}

export async function updateCallTrackingSettings(
  companyId: string,
  actorUserId: string,
  input: CallTrackingSettingsUpdate
): Promise<CallTrackingSettings> {
  const current = await loadSettingsRow(companyId);
  const currentVersion = current?.version ?? 0;
  if (input.expectedVersion !== currentVersion) {
    throw new AppError(ErrorCode.CONFLICT, "Call tracking settings changed; reload and retry", {
      reason: "stale_version",
      currentVersion: String(currentVersion)
    });
  }
  const merged = {
    provider: input.provider ?? current?.provider ?? CALL_TRACKING_DISABLED_PROVIDER_ID,
    enabled: input.enabled ?? current?.enabled ?? false,
    recordingEnabled: input.recordingEnabled ?? current?.recordingEnabled ?? false,
    recordingDisclosureEnabled: input.recordingDisclosureEnabled ?? current?.recordingDisclosureEnabled ?? true,
    consentMode: input.consentMode ?? current?.consentMode ?? "all_party",
    recordingNoticeState:
      input.recordingNoticeState !== undefined ? input.recordingNoticeState : (current?.recordingNoticeState ?? null)
  };
  const adapter = findCallTrackingAdapter(merged.provider);
  if (!adapter) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Unknown call tracking provider", { provider: "unknown_provider" });
  }
  if (merged.enabled && !adapter.enabled) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Call tracking cannot be enabled until a provider adapter is configured", {
      enabled: "provider_not_ready"
    });
  }
  if (merged.recordingEnabled && !merged.recordingDisclosureEnabled) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Call recording requires the recording disclosure to be on", {
      recordingDisclosureEnabled: "required_when_recording"
    });
  }
  if (merged.recordingEnabled && !merged.recordingNoticeState) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Call recording requires the state whose notice applies", {
      recordingNoticeState: "required_when_recording"
    });
  }

  const now = new Date();
  try {
    if (!current) {
      await db.insert(callTrackingSettings).values({ companyId, ...merged, version: 1, updatedByUserId: actorUserId, createdAt: now, updatedAt: now });
    } else {
      const updated = await db
        .update(callTrackingSettings)
        .set({ ...merged, version: currentVersion + 1, updatedByUserId: actorUserId, updatedAt: now })
        .where(
          and(
            eq(callTrackingSettings.companyId, companyId),
            eq(callTrackingSettings.id, current.id),
            eq(callTrackingSettings.version, currentVersion)
          )
        )
        .returning();
      if (updated.length === 0) throw new AppError(ErrorCode.CONFLICT, "Call tracking settings changed; reload and retry");
    }
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError(ErrorCode.CONFLICT, "Call tracking settings changed; reload and retry");
    throw error;
  }
  return getCallTrackingSettings(companyId);
}

export async function listCallTrackingNumbers(companyId: string): Promise<CallTrackingNumber[]> {
  const rows = await db
    .select()
    .from(callTrackingNumbers)
    .where(and(eq(callTrackingNumbers.companyId, companyId), isNull(callTrackingNumbers.deletedAt)))
    .orderBy(desc(callTrackingNumbers.createdAt));
  return rows.map(toNumber);
}

export async function createCallTrackingNumber(companyId: string, input: CallTrackingNumberCreate): Promise<CallTrackingNumber> {
  if (input.trackingNumber === input.forwardingNumber) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Forwarding number must differ from the tracking number", {
      forwardingNumber: "same_as_tracking_number"
    });
  }
  const settings = await getCallTrackingSettings(companyId);
  const [existing] = await db
    .select({ id: callTrackingNumbers.id })
    .from(callTrackingNumbers)
    .where(and(eq(callTrackingNumbers.trackingNumber, input.trackingNumber), isNull(callTrackingNumbers.deletedAt)))
    .limit(1);
  if (existing) throw new AppError(ErrorCode.CONFLICT, "Tracking number is already in use");
  const now = new Date();
  try {
    const [row] = await db
      .insert(callTrackingNumbers)
      .values({
        companyId,
        provider: settings.provider,
        providerNumberId: input.providerNumberId ?? null,
        trackingNumber: input.trackingNumber,
        label: input.label,
        marketingSource: input.marketingSource,
        marketingCampaign: input.marketingCampaign ?? null,
        forwardingNumber: input.forwardingNumber,
        active: true,
        version: 1,
        createdAt: now,
        updatedAt: now
      })
      .returning();
    return toNumber(row!);
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError(ErrorCode.CONFLICT, "Tracking number is already in use");
    throw error;
  }
}

export async function updateCallTrackingNumber(
  companyId: string,
  numberId: string,
  input: CallTrackingNumberUpdate
): Promise<CallTrackingNumber> {
  const [row] = await db
    .select()
    .from(callTrackingNumbers)
    .where(and(eq(callTrackingNumbers.companyId, companyId), eq(callTrackingNumbers.id, numberId), isNull(callTrackingNumbers.deletedAt)))
    .limit(1);
  if (!row) throw new AppError(ErrorCode.NOT_FOUND, "Tracking number not found");
  if (row.version !== input.expectedVersion) {
    throw new AppError(ErrorCode.CONFLICT, "Tracking number changed; reload and retry", {
      reason: "stale_version",
      currentVersion: String(row.version)
    });
  }
  const forwardingNumber = input.forwardingNumber ?? row.forwardingNumber;
  if (forwardingNumber === row.trackingNumber) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Forwarding number must differ from the tracking number", {
      forwardingNumber: "same_as_tracking_number"
    });
  }
  const [updated] = await db
    .update(callTrackingNumbers)
    .set({
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.marketingSource !== undefined ? { marketingSource: input.marketingSource } : {}),
      ...(input.marketingCampaign !== undefined ? { marketingCampaign: input.marketingCampaign } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      forwardingNumber,
      version: row.version + 1,
      updatedAt: new Date()
    })
    .where(and(eq(callTrackingNumbers.companyId, companyId), eq(callTrackingNumbers.id, row.id), eq(callTrackingNumbers.version, row.version)))
    .returning();
  if (!updated) throw new AppError(ErrorCode.CONFLICT, "Tracking number changed; reload and retry");
  return toNumber(updated);
}

export async function listCallRecords(companyId: string, query: CallRecordListQuery): Promise<CallRecord[]> {
  const rows = await db
    .select()
    .from(callRecords)
    .where(
      and(
        eq(callRecords.companyId, companyId),
        query.trackingNumberId ? eq(callRecords.trackingNumberId, query.trackingNumberId) : undefined
      )
    )
    .orderBy(desc(callRecords.startedAt))
    .limit(query.limit ?? 50);
  return rows.map(toCall);
}

/** Tenant-scoped pseudonymous caller key (groups repeat callers within one shop; not reversible by the API). */
export function hashCallerNumber(companyId: string, callerNumber: string): string {
  return createHash("sha256").update(`call-tracking:v1:${companyId}:${callerNumber}`).digest("hex");
}

export type InboundCallOutcome =
  | { httpStatus: 404; error: "UNKNOWN_PROVIDER" }
  | { httpStatus: 503; error: "CALL_TRACKING_DISABLED" }
  | { httpStatus: 401; error: "INVALID_SIGNATURE" }
  | { httpStatus: 400; error: "INVALID_PAYLOAD" }
  | { httpStatus: 200 | 202; body: InboundCallWebhookResponse };

/**
 * Webhook ingestion. Order matters: unknown/disabled adapters are rejected before the body is read, the
 * signature is checked before parsing, and unknown or non-enabled tenants get a generic "ignored" (no leak).
 */
export async function ingestInboundCall(providerId: string, input: CallTrackingWebhookInput): Promise<InboundCallOutcome> {
  const adapter = findCallTrackingAdapter(providerId);
  if (!adapter) return { httpStatus: 404, error: "UNKNOWN_PROVIDER" };
  if (!adapter.enabled) return { httpStatus: 503, error: "CALL_TRACKING_DISABLED" };

  let verified = false;
  try {
    verified = adapter.verifyWebhookSignature(input);
  } catch {
    verified = false;
  }
  if (!verified) return { httpStatus: 401, error: "INVALID_SIGNATURE" };

  let parsed;
  try {
    parsed = inboundCallEventSchema.safeParse(adapter.parseInboundCall(input.rawBody));
  } catch {
    return { httpStatus: 400, error: "INVALID_PAYLOAD" };
  }
  if (!parsed.success) return { httpStatus: 400, error: "INVALID_PAYLOAD" };
  const event = parsed.data;

  const [number] = await db
    .select()
    .from(callTrackingNumbers)
    .where(
      and(
        eq(callTrackingNumbers.trackingNumber, event.trackingNumber),
        eq(callTrackingNumbers.provider, adapter.id),
        eq(callTrackingNumbers.active, true),
        isNull(callTrackingNumbers.deletedAt)
      )
    )
    .limit(1);
  if (!number) return { httpStatus: 202, body: { status: "ignored" } };

  const settings = await loadSettingsRow(number.companyId);
  if (!settings || !settings.enabled || settings.provider !== adapter.id) {
    return { httpStatus: 202, body: { status: "ignored" } };
  }

  const [duplicate] = await db
    .select({ id: callRecords.id })
    .from(callRecords)
    .where(and(eq(callRecords.provider, adapter.id), eq(callRecords.providerCallId, event.providerCallId)))
    .limit(1);
  if (duplicate) return { httpStatus: 200, body: { status: "duplicate" } };

  const recordingAllowed = settings.recordingEnabled;
  const attribution = sanitizeLeadAttribution({
    utm_source: number.marketingSource,
    utm_medium: "phone",
    ...(number.marketingCampaign ? { utm_campaign: number.marketingCampaign } : {})
  });

  try {
    await db.insert(callRecords).values({
      companyId: number.companyId,
      trackingNumberId: number.id,
      provider: adapter.id,
      providerCallId: event.providerCallId,
      callerHash: hashCallerNumber(number.companyId, event.callerNumber),
      callerLast4: event.callerNumber.slice(-4),
      startedAt: new Date(event.startedAt),
      durationSeconds: event.durationSeconds,
      outcome: event.outcome,
      attribution,
      recordingRef: recordingAllowed ? (event.recordingRef ?? null) : null,
      recordingDisclosurePlayed: event.recordingDisclosurePlayed ?? false,
      callerConsent: recordingAllowed ? (event.callerConsent ?? "unknown") : "not_required",
      recordingNoticeState: settings.recordingNoticeState
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { httpStatus: 200, body: { status: "duplicate" } };
    throw error;
  }
  return { httpStatus: 202, body: { status: "accepted" } };
}
