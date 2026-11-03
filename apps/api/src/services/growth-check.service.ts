import { randomUUID } from "node:crypto";

import { featureFlags } from "@fsm/config/feature-flags";
import {
  db,
  emitEvent,
  growthCheckFindings,
  growthCheckScans
} from "@fsm/db";
import { growthQueue } from "@fsm/jobs";
import {
  AppError,
  ErrorCode,
  GROWTH_QUEUE_JOB_NAMES,
  type EnqueueGrowthCheckPublicScanInput,
  type GrowthCheckFindingRecord,
  type GrowthCheckScanProgress,
  buildGrowthCheckScanProgress,
  getGrowthCheckRubricById,
  resolveGrowthCheckRubricIdForTrade,
  growthCheckPublicScanJobId,
  normalizeGrowthCheckTargetUrl
} from "@fsm/types";
import { and, eq } from "drizzle-orm";

import { checkGrowthCheckEnqueueRateLimits } from "../lib/growth-check/enqueue-rate-limit.js";
import { getCompanyTrade } from "./company-trade.service.js";

export interface GrowthCheckScanResponse {
  id: string;
  companyId: string;
  targetUrl: string;
  rubricId: string;
  rubricVersion: string;
  status: string;
  progress: GrowthCheckScanProgress;
  idempotencyKey: string;
  failureReason: string | null;
  findings: GrowthCheckFindingRecord[];
  createdAt: string;
  updatedAt: string;
}

function toFindingRecord(row: typeof growthCheckFindings.$inferSelect): GrowthCheckFindingRecord {
  return {
    checkId: row.checkId,
    areaId: row.areaId,
    sourceUrl: row.sourceUrl,
    observedAt: row.observedAt.toISOString(),
    status: row.status,
    confidence: row.confidence,
    summary: row.summary
  };
}

function toScanResponse(
  scan: typeof growthCheckScans.$inferSelect,
  findings: GrowthCheckFindingRecord[]
): GrowthCheckScanResponse {
  return {
    id: scan.id,
    companyId: scan.companyId,
    targetUrl: scan.targetUrl,
    rubricId: scan.rubricId,
    rubricVersion: scan.rubricVersion,
    status: scan.status,
    progress: scan.progress as GrowthCheckScanProgress,
    idempotencyKey: scan.idempotencyKey,
    failureReason: scan.failureReason,
    findings,
    createdAt: scan.createdAt.toISOString(),
    updatedAt: scan.updatedAt.toISOString()
  };
}

/**
 * Default rubric for a new scan: picked from the shop trade (companies.settings.trade) through the
 * trade->rubric registry, falling back to the home-services rubric when the trade is unset or unreadable.
 */
async function resolveDefaultRubricIdForCompany(companyId: string): Promise<string> {
  try {
    const { trade } = await getCompanyTrade(companyId);
    return resolveGrowthCheckRubricIdForTrade(trade);
  } catch {
    return resolveGrowthCheckRubricIdForTrade(null);
  }
}

export async function enqueueGrowthCheckPublicScan(
  companyId: string,
  actorUserId: string,
  input: EnqueueGrowthCheckPublicScanInput
): Promise<GrowthCheckScanResponse> {
  // FEATURE FLAG: growth-check-public-scan
  if (!featureFlags.growthCheckPublicScan) {
    throw new AppError(ErrorCode.FORBIDDEN, "Growth check public scan is not enabled");
  }

  const rateLimit = await checkGrowthCheckEnqueueRateLimits(companyId);
  if (!rateLimit.allowed) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      rateLimit.scope === "global"
        ? "Growth check enqueue rate limit exceeded (global)"
        : "Growth check enqueue rate limit exceeded for this company"
    );
  }

  const targetUrl = normalizeGrowthCheckTargetUrl(input.targetUrl).toString();
  const rubricId = input.rubricId ?? (await resolveDefaultRubricIdForCompany(companyId));
  const rubric = getGrowthCheckRubricById(rubricId);

  if (!rubric) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Unknown rubricId", { rubricId });
  }

  const idempotencyKey = input.idempotencyKey?.trim() || randomUUID();

  const existing = await db.query.growthCheckScans.findFirst({
    where: and(eq(growthCheckScans.companyId, companyId), eq(growthCheckScans.idempotencyKey, idempotencyKey))
  });

  if (existing) {
    const findings = await db
      .select()
      .from(growthCheckFindings)
      .where(and(eq(growthCheckFindings.companyId, companyId), eq(growthCheckFindings.scanId, existing.id)));

    return toScanResponse(existing, findings.map(toFindingRecord));
  }

  const progress = buildGrowthCheckScanProgress(rubric);

  const inserted = await db
    .insert(growthCheckScans)
    .values({
      companyId,
      requestedByUserId: actorUserId,
      targetUrl,
      rubricId: rubric.id,
      rubricVersion: rubric.version,
      status: "queued",
      progress,
      idempotencyKey
    })
    .returning();

  const scan = inserted[0];
  if (!scan) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create growth check scan");
  }

  await emitEvent({
    companyId,
    eventType: "growth.check_scan_enqueued",
    actorId: actorUserId,
    actorType: "user",
    entityType: "growth_check_scan",
    entityId: scan.id,
    payload: {
      targetUrl,
      rubricId: rubric.id,
      rubricVersion: rubric.version,
      idempotencyKey
    },
    summary: "Growth check public scan enqueued"
  });

  const jobPayload = {
    companyId,
    scanId: scan.id,
    targetUrl,
    rubricId: rubric.id,
    rubricVersion: rubric.version,
    idempotencyKey,
    requestedByUserId: actorUserId
  };

  try {
    await growthQueue.add(GROWTH_QUEUE_JOB_NAMES.publicScan, jobPayload, {
      jobId: growthCheckPublicScanJobId(companyId, idempotencyKey),
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to enqueue growth check scan";
    await db
      .update(growthCheckScans)
      .set({ status: "failed", failureReason: message })
      .where(and(eq(growthCheckScans.id, scan.id), eq(growthCheckScans.companyId, companyId)));

    throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to enqueue growth check scan");
  }

  return toScanResponse(scan, []);
}

export async function getGrowthCheckScan(
  companyId: string,
  scanId: string
): Promise<GrowthCheckScanResponse> {
  const scan = await db.query.growthCheckScans.findFirst({
    where: and(eq(growthCheckScans.companyId, companyId), eq(growthCheckScans.id, scanId))
  });

  if (!scan) {
    throw new AppError(ErrorCode.NOT_FOUND, "Growth check scan not found");
  }

  const findings = await db
    .select()
    .from(growthCheckFindings)
    .where(and(eq(growthCheckFindings.companyId, companyId), eq(growthCheckFindings.scanId, scan.id)));

  return toScanResponse(scan, findings.map(toFindingRecord));
}
