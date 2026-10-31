/**
 * FS-56 Growth Check findings review.
 *
 * The machine observation in growth_check_findings is immutable. Every staff/owner change is an append-only
 * row in growth_check_finding_revisions (who, when, old -> new). The effective state of a finding is the
 * latest revision's next_state, or the machine values when there are no revisions.
 *
 * Concurrency: callers pass expectedRevision; the finding row is locked FOR UPDATE inside a transaction and a
 * mismatch is a 409. Replay: the same idempotencyKey with the same payload returns the stored revision
 * (replayed: true); the same key with a different payload is a 409.
 */
import { createHash } from "node:crypto";

import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import { db, growthCheckFindingRevisions, growthCheckFindings, growthCheckScans } from "@fsm/db";
import {
  AppError,
  ErrorCode,
  GROWTH_CHECK_REVIEW_ACTION_REGISTRY,
  getGrowthCheckRubricCheckLabel,
  type GrowthCheckFindingDetailResponse,
  type GrowthCheckFindingReviewBody,
  type GrowthCheckFindingReviewResponse,
  type GrowthCheckFindingReviewState,
  type GrowthCheckFindingRevision,
  type GrowthCheckFindingView,
  type GrowthCheckScanFindingsResponse,
  type GrowthCheckScanHistoryResponse,
  type UserRole
} from "@fsm/types";

import { canonicalJson } from "../lib/canonical-json.js";

type FindingRow = typeof growthCheckFindings.$inferSelect;
type RevisionRow = typeof growthCheckFindingRevisions.$inferSelect;

export interface GrowthCheckReviewActor {
  companyId: string;
  userId: string;
  role: UserRole;
}

const REVIEW_FIELDS: Array<keyof GrowthCheckFindingReviewState> = [
  "status",
  "summary",
  "reviewState",
  "ownerValidation",
  "ownerConfirmedFact",
  "lastNote"
];

function machineState(row: FindingRow): GrowthCheckFindingReviewState {
  return {
    status: row.status,
    summary: row.summary,
    reviewState: "machine",
    ownerValidation: "not_requested",
    ownerConfirmedFact: false,
    lastNote: null
  };
}

function asState(value: unknown): GrowthCheckFindingReviewState {
  return value as GrowthCheckFindingReviewState;
}

function effectiveState(row: FindingRow, latest: RevisionRow | undefined): GrowthCheckFindingReviewState {
  return latest ? asState(latest.nextState) : machineState(row);
}

function changedFields(previous: GrowthCheckFindingReviewState, next: GrowthCheckFindingReviewState): string[] {
  return REVIEW_FIELDS.filter((field) => previous[field] !== next[field]);
}

function toRevision(row: RevisionRow): GrowthCheckFindingRevision {
  const previous = asState(row.previousState);
  const next = asState(row.nextState);
  return {
    id: row.id,
    findingId: row.findingId,
    revision: row.revision,
    action: row.action,
    actorUserId: row.actorUserId,
    reason: row.reason,
    note: row.note,
    previous,
    next,
    changedFields: changedFields(previous, next),
    createdAt: row.createdAt.toISOString()
  };
}

function toView(row: FindingRow, rubricId: string, latest: RevisionRow | undefined): GrowthCheckFindingView {
  return {
    id: row.id,
    scanId: row.scanId,
    areaId: row.areaId,
    checkId: row.checkId,
    checkLabel: getGrowthCheckRubricCheckLabel(rubricId, row.checkId),
    sourceUrl: row.sourceUrl,
    observedAt: row.observedAt.toISOString(),
    machine: { status: row.status, confidence: row.confidence, summary: row.summary },
    current: effectiveState(row, latest),
    revision: latest?.revision ?? 0,
    updatedAt: (latest?.createdAt ?? row.updatedAt).toISOString()
  };
}

/** Pure transition: never promotes a machine hypothesis to a fact without an explicit owner confirmation. */
export function applyGrowthCheckReviewAction(
  previous: GrowthCheckFindingReviewState,
  body: GrowthCheckFindingReviewBody
): GrowthCheckFindingReviewState {
  const next: GrowthCheckFindingReviewState = { ...previous };
  switch (body.action) {
    case "edit":
      if (body.status !== undefined) next.status = body.status;
      if (body.summary !== undefined) next.summary = body.summary;
      next.reviewState = "edited";
      // A corrected finding needs fresh owner confirmation before it counts as a fact.
      if (next.status !== previous.status || next.summary !== previous.summary) next.ownerConfirmedFact = false;
      if (next.ownerValidation === "confirmed" && !next.ownerConfirmedFact) next.ownerValidation = "not_requested";
      break;
    case "mark_not_applicable":
      next.reviewState = "not_applicable";
      break;
    case "dismiss":
      next.reviewState = "dismissed";
      break;
    case "add_note":
      next.lastNote = body.note;
      if (next.reviewState === "machine") next.reviewState = "noted";
      break;
    case "request_owner_validation":
      next.ownerValidation = "requested";
      next.ownerConfirmedFact = false;
      break;
    case "owner_confirm":
      next.ownerValidation = "confirmed";
      next.ownerConfirmedFact = true;
      break;
    case "owner_reject":
      next.ownerValidation = "rejected";
      next.ownerConfirmedFact = false;
      break;
    case "owner_cannot_answer":
      next.ownerValidation = "cannot_answer";
      next.ownerConfirmedFact = false;
      break;
  }
  if (body.action !== "add_note" && "note" in body && body.note !== undefined) next.lastNote = body.note;
  return next;
}

function payloadHash(body: GrowthCheckFindingReviewBody): string {
  const { idempotencyKey: _ignored, ...rest } = body;
  return createHash("sha256").update(canonicalJson(rest)).digest("hex");
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: unknown; cause?: { code?: unknown } };
  return err.code === "23505" || err.cause?.code === "23505";
}

async function loadScan(companyId: string, scanId: string) {
  const [scan] = await db
    .select()
    .from(growthCheckScans)
    .where(and(eq(growthCheckScans.companyId, companyId), eq(growthCheckScans.id, scanId), isNull(growthCheckScans.deletedAt)))
    .limit(1);
  if (!scan) throw new AppError(ErrorCode.NOT_FOUND, "Growth check scan not found");
  return scan;
}

async function loadRevisions(companyId: string, findingIds: string[]): Promise<RevisionRow[]> {
  if (findingIds.length === 0) return [];
  return db
    .select()
    .from(growthCheckFindingRevisions)
    .where(and(eq(growthCheckFindingRevisions.companyId, companyId), inArray(growthCheckFindingRevisions.findingId, findingIds)))
    .orderBy(asc(growthCheckFindingRevisions.revision));
}

function latestByFinding(revisions: RevisionRow[]): Map<string, RevisionRow> {
  const latest = new Map<string, RevisionRow>();
  for (const row of revisions) {
    const current = latest.get(row.findingId);
    if (!current || row.revision > current.revision) latest.set(row.findingId, row);
  }
  return latest;
}

export async function listGrowthCheckScanHistory(
  companyId: string,
  limit = 20
): Promise<GrowthCheckScanHistoryResponse> {
  const scans = await db
    .select()
    .from(growthCheckScans)
    .where(and(eq(growthCheckScans.companyId, companyId), isNull(growthCheckScans.deletedAt)))
    .orderBy(desc(growthCheckScans.createdAt))
    .limit(limit);
  const scanIds = scans.map((s) => s.id);
  const findings = scanIds.length
    ? await db
        .select()
        .from(growthCheckFindings)
        .where(and(eq(growthCheckFindings.companyId, companyId), inArray(growthCheckFindings.scanId, scanIds), isNull(growthCheckFindings.deletedAt)))
    : [];
  const revisions = scanIds.length
    ? await db
        .select()
        .from(growthCheckFindingRevisions)
        .where(and(eq(growthCheckFindingRevisions.companyId, companyId), inArray(growthCheckFindingRevisions.scanId, scanIds)))
    : [];
  const latest = latestByFinding(revisions);

  return {
    scans: scans.map((scan) => {
      const scanFindings = findings.filter((f) => f.scanId === scan.id);
      const scanRevisions = revisions.filter((r) => r.scanId === scan.id);
      const states = scanFindings.map((f) => latest.get(f.id)).filter((r): r is RevisionRow => r !== undefined).map((r) => asState(r.nextState));
      const lastChanged = scanRevisions.reduce<Date | null>((acc, r) => (!acc || r.createdAt > acc ? r.createdAt : acc), null);
      return {
        id: scan.id,
        targetUrl: scan.targetUrl,
        rubricId: scan.rubricId,
        rubricVersion: scan.rubricVersion,
        status: scan.status,
        createdAt: scan.createdAt.toISOString(),
        findingCount: scanFindings.length,
        reviewedFindingCount: states.length,
        revisionCount: scanRevisions.length,
        ownerValidationRequested: states.filter((s) => s.ownerValidation === "requested").length,
        ownerConfirmed: states.filter((s) => s.ownerConfirmedFact).length,
        lastChangedAt: lastChanged ? lastChanged.toISOString() : null
      };
    })
  };
}

export async function listGrowthCheckScanFindings(companyId: string, scanId: string): Promise<GrowthCheckScanFindingsResponse> {
  const scan = await loadScan(companyId, scanId);
  const findings = await db
    .select()
    .from(growthCheckFindings)
    .where(and(eq(growthCheckFindings.companyId, companyId), eq(growthCheckFindings.scanId, scan.id), isNull(growthCheckFindings.deletedAt)))
    .orderBy(asc(growthCheckFindings.areaId), asc(growthCheckFindings.checkId));
  const latest = latestByFinding(await loadRevisions(companyId, findings.map((f) => f.id)));
  return {
    scanId: scan.id,
    rubricId: scan.rubricId,
    rubricVersion: scan.rubricVersion,
    findings: findings.map((f) => toView(f, scan.rubricId, latest.get(f.id)))
  };
}

async function loadFinding(companyId: string, findingId: string): Promise<FindingRow> {
  const [row] = await db
    .select()
    .from(growthCheckFindings)
    .where(and(eq(growthCheckFindings.companyId, companyId), eq(growthCheckFindings.id, findingId), isNull(growthCheckFindings.deletedAt)))
    .limit(1);
  if (!row) throw new AppError(ErrorCode.NOT_FOUND, "Growth check finding not found");
  return row;
}

export async function getGrowthCheckFindingDetail(companyId: string, findingId: string): Promise<GrowthCheckFindingDetailResponse> {
  const row = await loadFinding(companyId, findingId);
  const scan = await loadScan(companyId, row.scanId);
  const revisions = await loadRevisions(companyId, [row.id]);
  return {
    finding: toView(row, scan.rubricId, revisions.at(-1)),
    history: revisions.map(toRevision).reverse()
  };
}

export async function reviewGrowthCheckFinding(
  actor: GrowthCheckReviewActor,
  findingId: string,
  body: GrowthCheckFindingReviewBody
): Promise<GrowthCheckFindingReviewResponse> {
  const definition = GROWTH_CHECK_REVIEW_ACTION_REGISTRY.find((a) => a.key === body.action);
  if (!definition) throw new AppError(ErrorCode.VALIDATION_ERROR, "Unknown review action");
  if (definition.ownerOnly && actor.role !== "owner") {
    throw new AppError(ErrorCode.FORBIDDEN, "Only the account owner can record owner validation");
  }
  const hash = payloadHash(body);

  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(growthCheckFindings)
        .where(and(eq(growthCheckFindings.companyId, actor.companyId), eq(growthCheckFindings.id, findingId), isNull(growthCheckFindings.deletedAt)))
        .for("update")
        .limit(1);
      if (!row) throw new AppError(ErrorCode.NOT_FOUND, "Growth check finding not found");
      const [scan] = await tx
        .select()
        .from(growthCheckScans)
        .where(and(eq(growthCheckScans.companyId, actor.companyId), eq(growthCheckScans.id, row.scanId)))
        .limit(1);
      if (!scan) throw new AppError(ErrorCode.NOT_FOUND, "Growth check finding not found");

      const [existing] = await tx
        .select()
        .from(growthCheckFindingRevisions)
        .where(and(eq(growthCheckFindingRevisions.companyId, actor.companyId), eq(growthCheckFindingRevisions.idempotencyKey, body.idempotencyKey)))
        .limit(1);
      if (existing) {
        if (existing.findingId !== row.id || existing.payloadHash !== hash) {
          throw new AppError(ErrorCode.CONFLICT, "Idempotency key was already used with a different request");
        }
        const [latest] = await tx
          .select()
          .from(growthCheckFindingRevisions)
          .where(and(eq(growthCheckFindingRevisions.companyId, actor.companyId), eq(growthCheckFindingRevisions.findingId, row.id)))
          .orderBy(desc(growthCheckFindingRevisions.revision))
          .limit(1);
        return { finding: toView(row, scan.rubricId, latest), revision: toRevision(existing), replayed: true };
      }

      const [latest] = await tx
        .select()
        .from(growthCheckFindingRevisions)
        .where(and(eq(growthCheckFindingRevisions.companyId, actor.companyId), eq(growthCheckFindingRevisions.findingId, row.id)))
        .orderBy(desc(growthCheckFindingRevisions.revision))
        .limit(1);
      const currentRevision = latest?.revision ?? 0;
      if (body.expectedRevision !== currentRevision) {
        throw new AppError(ErrorCode.CONFLICT, "Finding was changed by someone else; reload and retry", {
          reason: "stale_revision",
          currentRevision: String(currentRevision)
        });
      }

      const previous = effectiveState(row, latest);
      const next = applyGrowthCheckReviewAction(previous, body);
      const [inserted] = await tx
        .insert(growthCheckFindingRevisions)
        .values({
          companyId: actor.companyId,
          findingId: row.id,
          scanId: row.scanId,
          revision: currentRevision + 1,
          action: body.action,
          actorUserId: actor.userId,
          reason: "reason" in body ? body.reason : null,
          note: "note" in body ? body.note ?? null : null,
          previousState: previous,
          nextState: next,
          idempotencyKey: body.idempotencyKey,
          payloadHash: hash
        })
        .returning();
      return { finding: toView(row, scan.rubricId, inserted!), revision: toRevision(inserted!), replayed: false };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(ErrorCode.CONFLICT, "Finding was changed concurrently; reload and retry");
    }
    throw error;
  }
}
