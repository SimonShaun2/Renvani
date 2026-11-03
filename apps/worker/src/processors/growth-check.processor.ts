import type { Job, Processor } from "bullmq";
import { and, eq } from "drizzle-orm";
import pino from "pino";

import { featureFlags } from "@fsm/config/feature-flags";
import { fetchPublicUrl } from "@fsm/config/outbound-url-guard";
import { db, emitEvent, growthCheckFindings, growthCheckScans } from "@fsm/db";
import {
  GROWTH_QUEUE_JOB_NAMES,
  type GrowthCheckPublicScanJobData,
  type GrowthCheckScanProgress,
  assertFetchUrlAllowedForScan,
  evaluatePrivateOpsCheck,
  evaluatePublicHttpSignal,
  getGrowthCheckRubricById,
  normalizeGrowthCheckTargetUrl
} from "@fsm/types";

const logger = pino({
  name: "growth-check-processor"
});

const FETCH_TIMEOUT_MS = 10_000;

export interface GrowthCheckFetchResult {
  statusCode: number;
  body: string;
}

export type GrowthCheckPageFetcher = (url: URL) => Promise<GrowthCheckFetchResult>;

export interface GrowthCheckProcessorDependencies {
  fetchPage: GrowthCheckPageFetcher;
}

const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

/** Audit H2: DNS-pinned, private-address-blocking fetch (shared guard in @fsm/config/outbound-url-guard). */
async function defaultFetchPage(url: URL): Promise<GrowthCheckFetchResult> {
  const { statusCode, body } = await fetchPublicUrl(url, {
    timeoutMs: FETCH_TIMEOUT_MS,
    maxRedirects: MAX_REDIRECTS,
    maxBytes: MAX_RESPONSE_BYTES,
    headers: {
      "User-Agent": "FSM-GrowthCheck/1.0",
      Accept: "text/html,application/xhtml+xml"
    }
  });
  return { statusCode, body };
}

const defaultDependencies: GrowthCheckProcessorDependencies = {
  fetchPage: defaultFetchPage
};

function computeProgressPercent(progress: GrowthCheckScanProgress): number {
  const totalChecks = progress.areas.reduce((sum, area) => sum + area.totalChecks, 0);
  const completedChecks = progress.areas.reduce((sum, area) => sum + area.completedChecks, 0);

  if (totalChecks === 0) {
    return 100;
  }

  return Math.round((completedChecks / totalChecks) * 100);
}

async function persistProgress(
  companyId: string,
  scanId: string,
  progress: GrowthCheckScanProgress
): Promise<void> {
  await db
    .update(growthCheckScans)
    .set({ progress })
    .where(and(eq(growthCheckScans.id, scanId), eq(growthCheckScans.companyId, companyId)));
}

async function persistFinding(
  companyId: string,
  scanId: string,
  finding: {
    areaId: string;
    checkId: string;
    sourceUrl: string;
    observedAt: Date;
    status: "pass" | "fail" | "warning" | "unknown";
    confidence: "high" | "medium" | "low";
    summary: string;
  }
): Promise<void> {
  const existing = await db
    .select({ id: growthCheckFindings.id })
    .from(growthCheckFindings)
    .where(
      and(
        eq(growthCheckFindings.companyId, companyId),
        eq(growthCheckFindings.scanId, scanId),
        eq(growthCheckFindings.checkId, finding.checkId)
      )
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(growthCheckFindings)
      .set({
        areaId: finding.areaId,
        sourceUrl: finding.sourceUrl,
        observedAt: finding.observedAt,
        status: finding.status,
        confidence: finding.confidence,
        summary: finding.summary
      })
      .where(eq(growthCheckFindings.id, existing[0].id));
    return;
  }

  await db.insert(growthCheckFindings).values({
    companyId,
    scanId,
    areaId: finding.areaId,
    checkId: finding.checkId,
    sourceUrl: finding.sourceUrl,
    observedAt: finding.observedAt,
    status: finding.status,
    confidence: finding.confidence,
    summary: finding.summary
  });
}

export async function processGrowthCheckPublicScan(
  job: Job<GrowthCheckPublicScanJobData>,
  dependencies: GrowthCheckProcessorDependencies = defaultDependencies
): Promise<void> {
  // FEATURE FLAG: growth-check-public-scan
  if (!featureFlags.growthCheckPublicScan) {
    logger.info({ scanId: job.data.scanId }, "Growth check public scan disabled — skipping");
    return;
  }

  const scan = await db.query.growthCheckScans.findFirst({
    where: and(
      eq(growthCheckScans.companyId, job.data.companyId),
      eq(growthCheckScans.id, job.data.scanId)
    )
  });

  if (!scan) {
    logger.warn({ scanId: job.data.scanId }, "Growth check scan row missing");
    return;
  }

  if (scan.status === "completed") {
    logger.info({ scanId: scan.id }, "Growth check scan already completed — idempotent skip");
    return;
  }

  const rubric = getGrowthCheckRubricById(job.data.rubricId);
  if (!rubric || rubric.version !== job.data.rubricVersion) {
    await db
      .update(growthCheckScans)
      .set({
        status: "failed",
        failureReason: "Rubric version mismatch or unknown rubric"
      })
      .where(and(eq(growthCheckScans.id, scan.id), eq(growthCheckScans.companyId, scan.companyId)));

    await emitEvent({
      companyId: scan.companyId,
      eventType: "growth.check_scan_failed",
      actorType: "system",
      entityType: "growth_check_scan",
      entityId: scan.id,
      payload: { rubricId: job.data.rubricId, rubricVersion: job.data.rubricVersion },
      summary: "Growth check scan failed (rubric mismatch)"
    });
    return;
  }

  const targetOrigin = normalizeGrowthCheckTargetUrl(job.data.targetUrl);
  const progress = scan.progress as GrowthCheckScanProgress;

  await db
    .update(growthCheckScans)
    .set({ status: "running" })
    .where(and(eq(growthCheckScans.id, scan.id), eq(growthCheckScans.companyId, scan.companyId)));

  const pageCache = new Map<string, GrowthCheckFetchResult>();

  try {
    for (const area of rubric.areas) {
      progress.currentAreaId = area.id;

      for (const check of area.checks) {
        const observedAt = new Date();
        let sourceUrl = targetOrigin.toString();
        let evaluation;

        if (check.visibility === "private_ops" || check.method === "static") {
          evaluation = evaluatePrivateOpsCheck(check.label);
        } else if (check.method === "http_fetch") {
          const fetchUrl = assertFetchUrlAllowedForScan(targetOrigin, check.path ?? "/");
          sourceUrl = fetchUrl.toString();
          const cacheKey = fetchUrl.toString();

          let page = pageCache.get(cacheKey);
          if (!page) {
            page = await dependencies.fetchPage(fetchUrl);
            pageCache.set(cacheKey, page);
          }

          evaluation = evaluatePublicHttpSignal(check.signalId ?? "", page.body, page.statusCode);
        } else {
          evaluation = {
            status: "unknown" as const,
            confidence: "low" as const,
            summary: "Unsupported check method"
          };
        }

        await persistFinding(scan.companyId, scan.id, {
          areaId: area.id,
          checkId: check.id,
          sourceUrl,
          observedAt,
          status: evaluation.status,
          confidence: evaluation.confidence,
          summary: evaluation.summary
        });

        const areaProgress = progress.areas.find((row) => row.areaId === area.id);
        if (areaProgress) {
          areaProgress.completedChecks += 1;
        }

        progress.areasCompleted = progress.areas.filter(
          (row) => row.completedChecks >= row.totalChecks
        ).length;

        await persistProgress(scan.companyId, scan.id, progress);
        await job.updateProgress(computeProgressPercent(progress));
      }
    }

    await db
      .update(growthCheckScans)
      .set({ status: "completed", failureReason: null })
      .where(and(eq(growthCheckScans.id, scan.id), eq(growthCheckScans.companyId, scan.companyId)));

    await emitEvent({
      companyId: scan.companyId,
      eventType: "growth.check_scan_completed",
      actorType: "system",
      entityType: "growth_check_scan",
      entityId: scan.id,
      payload: {
        targetUrl: job.data.targetUrl,
        rubricId: rubric.id,
        rubricVersion: rubric.version,
        findingCount: rubric.areas.reduce((sum, area) => sum + area.checks.length, 0)
      },
      summary: "Growth check public scan completed"
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Growth check scan failed";

    await db
      .update(growthCheckScans)
      .set({ status: "failed", failureReason: message })
      .where(and(eq(growthCheckScans.id, scan.id), eq(growthCheckScans.companyId, scan.companyId)));

    await emitEvent({
      companyId: scan.companyId,
      eventType: "growth.check_scan_failed",
      actorType: "system",
      entityType: "growth_check_scan",
      entityId: scan.id,
      payload: { reason: message },
      summary: "Growth check public scan failed"
    });

    throw error;
  }
}

export function createGrowthCheckProcessor(
  dependencies?: GrowthCheckProcessorDependencies
): Processor<Record<string, unknown>, void, string> {
  return async (job) => {
    if (job.name !== GROWTH_QUEUE_JOB_NAMES.publicScan) {
      return;
    }

    await processGrowthCheckPublicScan(
      job as unknown as Job<GrowthCheckPublicScanJobData>,
      dependencies ?? defaultDependencies
    );
  };
}

export const processGrowthCheck = createGrowthCheckProcessor();
