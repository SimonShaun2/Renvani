/**
 * FS-57 Growth Check owner report: drafts, approval, preview, export and share snapshots.
 *
 * - Company-scoped on every query (plus tenant RLS on the tables).
 * - Drafts are versioned; every change (create/edit/approve) is an append-only revision row (audit history).
 * - Mutations take idempotencyKey (+ expectedVersion). Same key + same payload replays; different payload is 409.
 * - Export and share require approval of the current version. Share tokens are random and stored as sha256 only.
 */
import { createHash, randomBytes } from "node:crypto";

import { and, desc, eq, isNull } from "drizzle-orm";

import { db, growthCheckReportDraftRevisions, growthCheckReportDrafts, growthCheckReportShares, growthCheckScans } from "@fsm/db";
import {
  AppError,
  ErrorCode,
  GROWTH_CHECK_REPORT_EDITABLE_FIELDS,
  type GrowthCheckReportDeliveryBody,
  type GrowthCheckReportDocument,
  type GrowthCheckReportDraft,
  type GrowthCheckReportDraftApproveBody,
  type GrowthCheckReportDraftContent,
  type GrowthCheckReportDraftCreateBody,
  type GrowthCheckReportDraftDetailResponse,
  type GrowthCheckReportDraftEditBody,
  type GrowthCheckReportDraftMutationResponse,
  type GrowthCheckReportDraftRevision,
  type GrowthCheckReportExportFormat,
  type GrowthCheckReportPreviewResponse,
  type GrowthCheckReportShare,
  type GrowthCheckReportShareCreateBody,
  type GrowthCheckReportShareCreateResponse,
  type GrowthCheckReportShareListResponse,
  type GrowthCheckReportShareRevokeResponse,
  type UserRole
} from "@fsm/types";

import { listGrowthCheckScanFindings } from "./growth-check-findings-review.service.js";
import {
  buildGrowthCheckReportDocument,
  canonicalJson,
  renderGrowthCheckReportHtml,
  renderGrowthCheckReportHtmlDocument,
  renderGrowthCheckReportMarkdown,
  renderGrowthCheckReportText,
  reportContentHash
} from "./growth-check-report-render.js";
import { assertGrowthCheckReportDeliveryAvailable } from "./growth/report-delivery.registry.js";

type DraftRow = typeof growthCheckReportDrafts.$inferSelect;
type RevisionRow = typeof growthCheckReportDraftRevisions.$inferSelect;
type ShareRow = typeof growthCheckReportShares.$inferSelect;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface GrowthCheckReportActor {
  companyId: string;
  userId: string;
  role: UserRole;
}

const asContent = (value: unknown) => value as GrowthCheckReportDraftContent;

function payloadHash(target: string, body: object): string {
  const { idempotencyKey: _ignored, ...rest } = body as Record<string, unknown>;
  return createHash("sha256").update(`${target}|${canonicalJson(rest)}`).digest("hex");
}

export function hashGrowthCheckShareToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: unknown; cause?: { code?: unknown } };
  return err.code === "23505" || err.cause?.code === "23505";
}

const notFound = () => new AppError(ErrorCode.NOT_FOUND, "Growth check report draft not found");
const idempotencyConflict = () => new AppError(ErrorCode.CONFLICT, "Idempotency key was already used with a different request");

function toDraft(row: DraftRow): GrowthCheckReportDraft {
  return {
    id: row.id,
    scanId: row.scanId,
    version: row.version,
    content: asContent(row.content),
    approved: row.approvedVersion !== null && row.approvedVersion === row.version,
    approvedVersion: row.approvedVersion,
    approvedByUserId: row.approvedByUserId,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function changedFields(previous: GrowthCheckReportDraftContent | null, next: GrowthCheckReportDraftContent): string[] {
  if (!previous) return [];
  return GROWTH_CHECK_REPORT_EDITABLE_FIELDS.filter((f) => canonicalJson(previous[f]) !== canonicalJson(next[f]));
}

function toRevision(row: RevisionRow): GrowthCheckReportDraftRevision {
  const previous = row.previousContent ? asContent(row.previousContent) : null;
  const next = asContent(row.nextContent);
  return {
    id: row.id,
    draftId: row.draftId,
    version: row.version,
    action: row.action,
    actorUserId: row.actorUserId,
    changedFields: changedFields(previous, next),
    previous,
    next,
    createdAt: row.createdAt.toISOString()
  };
}

export function growthCheckShareStatus(row: Pick<ShareRow, "revokedAt" | "expiresAt">, now = new Date()): GrowthCheckReportShare["status"] {
  if (row.revokedAt) return "revoked";
  if (row.expiresAt && row.expiresAt.getTime() <= now.getTime()) return "expired";
  return "active";
}

function toShare(row: ShareRow): GrowthCheckReportShare {
  return {
    id: row.id,
    draftId: row.draftId,
    draftVersion: row.draftVersion,
    contentHash: row.contentHash,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    revokedByUserId: row.revokedByUserId,
    status: growthCheckShareStatus(row)
  };
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

async function loadDraft(companyId: string, draftId: string): Promise<DraftRow> {
  const [row] = await db
    .select()
    .from(growthCheckReportDrafts)
    .where(and(eq(growthCheckReportDrafts.companyId, companyId), eq(growthCheckReportDrafts.id, draftId)))
    .limit(1);
  if (!row) throw notFound();
  return row;
}

async function lockDraft(tx: Tx, companyId: string, draftId: string): Promise<DraftRow> {
  const [row] = await tx
    .select()
    .from(growthCheckReportDrafts)
    .where(and(eq(growthCheckReportDrafts.companyId, companyId), eq(growthCheckReportDrafts.id, draftId)))
    .for("update")
    .limit(1);
  if (!row) throw notFound();
  return row;
}

async function findRevisionByKey(tx: Tx, companyId: string, key: string): Promise<RevisionRow | undefined> {
  const [row] = await tx
    .select()
    .from(growthCheckReportDraftRevisions)
    .where(and(eq(growthCheckReportDraftRevisions.companyId, companyId), eq(growthCheckReportDraftRevisions.idempotencyKey, key)))
    .limit(1);
  return row;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

async function withConflictMapping<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError(ErrorCode.CONFLICT, "Report was changed concurrently; reload and retry");
    throw error;
  }
}

export async function createGrowthCheckReportDraft(
  actor: GrowthCheckReportActor,
  scanId: string,
  body: GrowthCheckReportDraftCreateBody
): Promise<GrowthCheckReportDraftMutationResponse> {
  const hash = payloadHash(`create:${scanId}`, body);
  const scan = await loadScan(actor.companyId, scanId);
  return withConflictMapping(() =>
    db.transaction(async (tx) => {
      const existingRevision = await findRevisionByKey(tx, actor.companyId, body.idempotencyKey);
      if (existingRevision) {
        if (existingRevision.payloadHash !== hash) throw idempotencyConflict();
        const draft = await lockDraft(tx, actor.companyId, existingRevision.draftId);
        return { draft: toDraft(draft), revision: toRevision(existingRevision), replayed: true };
      }
      const [existingDraft] = await tx
        .select()
        .from(growthCheckReportDrafts)
        .where(and(eq(growthCheckReportDrafts.companyId, actor.companyId), eq(growthCheckReportDrafts.scanId, scan.id)))
        .limit(1);
      if (existingDraft) {
        throw new AppError(ErrorCode.CONFLICT, "A report draft already exists for this scan", {
          reason: "draft_exists",
          draftId: existingDraft.id
        });
      }
      const content: GrowthCheckReportDraftContent = {
        title: body.title ?? `Growth Check: ${body.businessName ?? hostnameOf(scan.targetUrl)}`,
        businessName: body.businessName ?? null,
        serviceArea: body.serviceArea ?? null,
        intro: null,
        internalNotes: null,
        opportunities: [],
        excludedFindingIds: []
      };
      const [draft] = await tx
        .insert(growthCheckReportDrafts)
        .values({ companyId: actor.companyId, scanId: scan.id, version: 1, content, createdByUserId: actor.userId })
        .returning();
      const [revision] = await tx
        .insert(growthCheckReportDraftRevisions)
        .values({
          companyId: actor.companyId,
          draftId: draft!.id,
          version: 1,
          action: "create",
          actorUserId: actor.userId,
          previousContent: null,
          nextContent: content,
          idempotencyKey: body.idempotencyKey,
          payloadHash: hash
        })
        .returning();
      return { draft: toDraft(draft!), revision: toRevision(revision!), replayed: false };
    })
  );
}

export async function getGrowthCheckReportDraftForScan(companyId: string, scanId: string): Promise<{ draft: GrowthCheckReportDraft }> {
  const scan = await loadScan(companyId, scanId);
  const [row] = await db
    .select()
    .from(growthCheckReportDrafts)
    .where(and(eq(growthCheckReportDrafts.companyId, companyId), eq(growthCheckReportDrafts.scanId, scan.id)))
    .limit(1);
  if (!row) throw notFound();
  return { draft: toDraft(row) };
}

export async function getGrowthCheckReportDraftDetail(companyId: string, draftId: string): Promise<GrowthCheckReportDraftDetailResponse> {
  const row = await loadDraft(companyId, draftId);
  const revisions = await db
    .select()
    .from(growthCheckReportDraftRevisions)
    .where(and(eq(growthCheckReportDraftRevisions.companyId, companyId), eq(growthCheckReportDraftRevisions.draftId, row.id)))
    .orderBy(desc(growthCheckReportDraftRevisions.version));
  return { draft: toDraft(row), history: revisions.map(toRevision) };
}

/** Shared versioned mutation: lock, replay check, expectedVersion check, append revision, bump version. */
async function mutateDraft(
  actor: GrowthCheckReportActor,
  draftId: string,
  action: "edit" | "approve",
  body: { idempotencyKey: string; expectedVersion: number },
  apply: (draft: DraftRow, content: GrowthCheckReportDraftContent) => Promise<GrowthCheckReportDraftContent>
): Promise<GrowthCheckReportDraftMutationResponse> {
  const hash = payloadHash(`${action}:${draftId}`, body);
  return withConflictMapping(() =>
    db.transaction(async (tx) => {
      const draft = await lockDraft(tx, actor.companyId, draftId);
      const existing = await findRevisionByKey(tx, actor.companyId, body.idempotencyKey);
      if (existing) {
        if (existing.draftId !== draft.id || existing.payloadHash !== hash) throw idempotencyConflict();
        return { draft: toDraft(draft), revision: toRevision(existing), replayed: true };
      }
      if (body.expectedVersion !== draft.version) {
        throw new AppError(ErrorCode.CONFLICT, "Report draft was changed by someone else; reload and retry", {
          reason: "stale_version",
          currentVersion: String(draft.version)
        });
      }
      const previous = asContent(draft.content);
      const next = await apply(draft, previous);
      const version = draft.version + 1;
      const now = new Date();
      const [updated] = await tx
        .update(growthCheckReportDrafts)
        .set({
          version,
          content: next,
          updatedAt: now,
          ...(action === "approve" ? { approvedVersion: version, approvedByUserId: actor.userId, approvedAt: now } : {})
        })
        .where(and(eq(growthCheckReportDrafts.companyId, actor.companyId), eq(growthCheckReportDrafts.id, draft.id)))
        .returning();
      const [revision] = await tx
        .insert(growthCheckReportDraftRevisions)
        .values({
          companyId: actor.companyId,
          draftId: draft.id,
          version,
          action,
          actorUserId: actor.userId,
          previousContent: previous,
          nextContent: next,
          idempotencyKey: body.idempotencyKey,
          payloadHash: hash
        })
        .returning();
      return { draft: toDraft(updated!), revision: toRevision(revision!), replayed: false };
    })
  );
}

export async function editGrowthCheckReportDraft(
  actor: GrowthCheckReportActor,
  draftId: string,
  body: GrowthCheckReportDraftEditBody
): Promise<GrowthCheckReportDraftMutationResponse> {
  return mutateDraft(actor, draftId, "edit", body, async (draft, previous) => {
    const next: GrowthCheckReportDraftContent = { ...previous };
    if (body.title !== undefined) next.title = body.title;
    if (body.businessName !== undefined) next.businessName = body.businessName;
    if (body.serviceArea !== undefined) next.serviceArea = body.serviceArea;
    if (body.intro !== undefined) next.intro = body.intro;
    if (body.internalNotes !== undefined) next.internalNotes = body.internalNotes;
    if (body.opportunities !== undefined) next.opportunities = body.opportunities;
    if (body.excludedFindingIds !== undefined) next.excludedFindingIds = [...new Set(body.excludedFindingIds)];
    if (body.opportunities !== undefined || body.excludedFindingIds !== undefined) {
      // Findings must belong to this draft's scan (company-scoped lookup).
      const { findings } = await listGrowthCheckScanFindings(actor.companyId, draft.scanId);
      const ids = new Set(findings.map((f) => f.id));
      const unknown = [...next.opportunities.map((o) => o.findingId), ...next.excludedFindingIds].filter((id) => !ids.has(id));
      if (unknown.length > 0) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, "Findings must belong to this report's scan", { findingId: unknown[0]! });
      }
      const excluded = new Set(next.excludedFindingIds);
      const both = next.opportunities.find((o) => excluded.has(o.findingId));
      if (both) throw new AppError(ErrorCode.VALIDATION_ERROR, "An excluded finding cannot be an opportunity", { findingId: both.findingId });
    }
    return next;
  });
}

export async function approveGrowthCheckReportDraft(
  actor: GrowthCheckReportActor,
  draftId: string,
  body: GrowthCheckReportDraftApproveBody
): Promise<GrowthCheckReportDraftMutationResponse> {
  return mutateDraft(actor, draftId, "approve", body, async (_draft, previous) => previous);
}

async function buildDocument(companyId: string, draft: DraftRow): Promise<GrowthCheckReportDocument> {
  const scan = await loadScan(companyId, draft.scanId);
  const { findings } = await listGrowthCheckScanFindings(companyId, draft.scanId);
  return buildGrowthCheckReportDocument(asContent(draft.content), scan, findings, draft.version);
}

export async function previewGrowthCheckReportDraft(companyId: string, draftId: string): Promise<GrowthCheckReportPreviewResponse> {
  const draft = await loadDraft(companyId, draftId);
  const report = await buildDocument(companyId, draft);
  return {
    draftId: draft.id,
    version: draft.version,
    approved: toDraft(draft).approved,
    contentHash: reportContentHash(report),
    report,
    html: renderGrowthCheckReportHtml(report),
    text: renderGrowthCheckReportText(report)
  };
}

function assertApproved(draft: DraftRow): void {
  if (draft.approvedVersion === null || draft.approvedVersion !== draft.version) {
    throw new AppError(ErrorCode.CONFLICT, "Approve the current version of the report before exporting or sharing", {
      reason: "not_approved",
      currentVersion: String(draft.version)
    });
  }
}

export interface GrowthCheckReportExportFile {
  body: string;
  contentType: string;
  filename: string;
  version: number;
  contentHash: string;
}

const EXPORT_FORMATS: Record<GrowthCheckReportExportFormat, { contentType: string; ext: string }> = {
  markdown: { contentType: "text/markdown; charset=utf-8", ext: "md" },
  html: { contentType: "text/html; charset=utf-8", ext: "html" },
  text: { contentType: "text/plain; charset=utf-8", ext: "txt" },
  json: { contentType: "application/json; charset=utf-8", ext: "json" }
};

export async function exportGrowthCheckReportDraft(
  companyId: string,
  draftId: string,
  format: GrowthCheckReportExportFormat
): Promise<GrowthCheckReportExportFile> {
  const draft = await loadDraft(companyId, draftId);
  assertApproved(draft);
  const report = await buildDocument(companyId, draft);
  const contentHash = reportContentHash(report);
  const body =
    format === "markdown"
      ? renderGrowthCheckReportMarkdown(report)
      : format === "html"
        ? renderGrowthCheckReportHtmlDocument(report)
        : format === "text"
          ? renderGrowthCheckReportText(report)
          : `${JSON.stringify({ report, contentHash, version: draft.version }, null, 2)}\n`;
  const meta = EXPORT_FORMATS[format];
  return {
    body,
    contentType: meta.contentType,
    filename: `growth-check-report-${draft.scanId.slice(0, 8)}-v${draft.version}.${meta.ext}`,
    version: draft.version,
    contentHash
  };
}

export async function createGrowthCheckReportShare(
  actor: GrowthCheckReportActor,
  draftId: string,
  body: GrowthCheckReportShareCreateBody,
  now = new Date()
): Promise<GrowthCheckReportShareCreateResponse> {
  const hash = payloadHash(`share:${draftId}`, body);
  return withConflictMapping(() =>
    db.transaction(async (tx) => {
      const draft = await lockDraft(tx, actor.companyId, draftId);
      const [existing] = await tx
        .select()
        .from(growthCheckReportShares)
        .where(and(eq(growthCheckReportShares.companyId, actor.companyId), eq(growthCheckReportShares.idempotencyKey, body.idempotencyKey)))
        .limit(1);
      if (existing) {
        if (existing.draftId !== draft.id || existing.payloadHash !== hash) throw idempotencyConflict();
        return { share: toShare(existing), token: null, replayed: true };
      }
      if (body.expectedVersion !== draft.version) {
        throw new AppError(ErrorCode.CONFLICT, "Report draft was changed by someone else; reload and retry", {
          reason: "stale_version",
          currentVersion: String(draft.version)
        });
      }
      assertApproved(draft);
      const report = await buildDocument(actor.companyId, draft);
      const token = randomBytes(32).toString("base64url");
      const [row] = await tx
        .insert(growthCheckReportShares)
        .values({
          companyId: actor.companyId,
          draftId: draft.id,
          draftVersion: draft.version,
          contentHash: reportContentHash(report),
          snapshot: report,
          tokenHash: hashGrowthCheckShareToken(token),
          createdByUserId: actor.userId,
          createdAt: now,
          expiresAt: body.expiresInDays ? new Date(now.getTime() + body.expiresInDays * 86_400_000) : null,
          idempotencyKey: body.idempotencyKey,
          payloadHash: hash
        })
        .returning();
      return { share: toShare(row!), token, replayed: false };
    })
  );
}

export async function listGrowthCheckReportShares(companyId: string, draftId: string): Promise<GrowthCheckReportShareListResponse> {
  const draft = await loadDraft(companyId, draftId);
  const rows = await db
    .select()
    .from(growthCheckReportShares)
    .where(and(eq(growthCheckReportShares.companyId, companyId), eq(growthCheckReportShares.draftId, draft.id)))
    .orderBy(desc(growthCheckReportShares.createdAt));
  return { shares: rows.map(toShare) };
}

async function loadShare(companyId: string, shareId: string): Promise<ShareRow> {
  const [row] = await db
    .select()
    .from(growthCheckReportShares)
    .where(and(eq(growthCheckReportShares.companyId, companyId), eq(growthCheckReportShares.id, shareId)))
    .limit(1);
  if (!row) throw new AppError(ErrorCode.NOT_FOUND, "Growth check report share not found");
  return row;
}

/** Idempotent: revoking an already revoked share returns it unchanged with alreadyRevoked: true. */
export async function revokeGrowthCheckReportShare(actor: GrowthCheckReportActor, shareId: string): Promise<GrowthCheckReportShareRevokeResponse> {
  const row = await loadShare(actor.companyId, shareId);
  if (row.revokedAt) return { share: toShare(row), alreadyRevoked: true };
  const [updated] = await db
    .update(growthCheckReportShares)
    .set({ revokedAt: new Date(), revokedByUserId: actor.userId })
    .where(and(eq(growthCheckReportShares.companyId, actor.companyId), eq(growthCheckReportShares.id, row.id), isNull(growthCheckReportShares.revokedAt)))
    .returning();
  if (!updated) return { share: toShare(await loadShare(actor.companyId, shareId)), alreadyRevoked: true };
  return { share: toShare(updated), alreadyRevoked: false };
}

/** Outside delivery is disabled; checks tenancy (404) first, then always refuses before any adapter call. */
export async function requestGrowthCheckReportDelivery(
  actor: GrowthCheckReportActor,
  shareId: string,
  body: GrowthCheckReportDeliveryBody
): Promise<never> {
  await loadShare(actor.companyId, shareId);
  assertGrowthCheckReportDeliveryAvailable(body.channel);
  throw new AppError(ErrorCode.POLICY_DENIED, "Report delivery is not enabled", { reason: "delivery_disabled" });
}
