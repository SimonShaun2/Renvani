/**
 * FS-212 estimate good-better-best option sets.
 * - A set is the estimate rows sharing tier_group_id; each option is one estimate row (existing tier model).
 * - Set mutations require expectedVersion (estimates.option_set_version, kept equal on every row of the set)
 *   and an idempotency key. Replays are recognised from the set's audit events in activity_events
 *   (entity_type "estimate_option_set"); same key + different payload is 409 idempotency_conflict.
 * - At most one recommended option per set (service check + partial unique index, migration 0059).
 * - Financing stays disabled; no fee math here (Service Fee is applied at checkout).
 */
import { createHash, randomBytes } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";
import { Decimal } from "decimal.js";
import pino from "pino";

import { env } from "@fsm/config";
import { activityEvents, customers, db, emitEventWithExecutor, estimateItems, estimates, jobs, properties, users } from "@fsm/db";
import {
  AppError,
  ErrorCode,
  ESTIMATE_OPTION_SET_MAX_OPTIONS,
  ESTIMATE_OPTION_SET_MIN_OPTIONS,
  estimateOptionTierRank,
  type EstimateFinancingQuotesResponse,
  type EstimateItem,
  type EstimateOption,
  type EstimateOptionInput,
  type EstimateOptionSet,
  type EstimateOptionSetAddOptionBody,
  type EstimateOptionSetCreateBody,
  type EstimateOptionSetResponse,
  type EstimateOptionSetStatus,
  type EstimateOptionSetUpdateBody,
  type EstimateOptionSetVersionedBody,
  type EstimateStatus
} from "@fsm/types";

import { generateEstimateNumber } from "../lib/estimate-number.js";
import { recalculateTotals } from "./estimate-items.service.js";
import { financingSummary, quoteFinancing, startFinancingApplication } from "./financing/financing-adapter.registry.js";
import { assertPriceBookItemsInCompany } from "./price-book-item-scope.js";

const logger = pino({ name: "estimate-option-set" });

type EstimateRow = typeof estimates.$inferSelect;
type EstimateItemRow = typeof estimateItems.$inferSelect;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = Pick<typeof db, "select" | "insert" | "update">;

export const ESTIMATE_OPTION_SET_ENTITY_TYPE = "estimate_option_set";
export const ESTIMATE_OPTION_SET_EVENT_KIND = "estimate_option_set";
type SetOp = "create" | "update" | "add_option" | "remove_option" | "send";

export interface EstimateOptionSetActor {
  companyId: string;
  userId: string;
}

const MAX_SET_EVENTS = 500;

// ── helpers ──

function money(value: Decimal.Value): string {
  return new Decimal(value).toFixed(2);
}

function payloadHash(op: SetOp, body: object): string {
  const rest = { ...(body as Record<string, unknown>) };
  delete rest.idempotencyKey;
  return createHash("sha256").update(`${op}:${JSON.stringify(rest)}`).digest("hex");
}

/** Deterministic set id per (company, create key), so a create replay resolves to the same set. */
export function optionSetIdFor(companyId: string, idempotencyKey: string): string {
  const hex = createHash("sha256").update(`estimate-option-set:${companyId}:${idempotencyKey}`).digest("hex");
  const variant = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function conflict(reason: string, message: string, extra: Record<string, string> = {}): AppError {
  return new AppError(ErrorCode.CONFLICT, message, { reason, ...extra });
}

function notFound(): AppError {
  return new AppError(ErrorCode.NOT_FOUND, "Estimate option set not found");
}

function sortRows(rows: EstimateRow[]): EstimateRow[] {
  return [...rows].sort((a, b) => {
    const rank = estimateOptionTierRank(a.tierLabel) - estimateOptionTierRank(b.tierLabel);
    return rank !== 0 ? rank : a.createdAt.getTime() - b.createdAt.getTime();
  });
}

async function loadRows(executor: Pick<typeof db, "select">, companyId: string, tierGroupId: string): Promise<EstimateRow[]> {
  const rows = await executor
    .select()
    .from(estimates)
    .where(and(eq(estimates.companyId, companyId), eq(estimates.tierGroupId, tierGroupId), isNull(estimates.deletedAt)))
    .limit(ESTIMATE_OPTION_SET_MAX_OPTIONS * 4);
  return sortRows(rows);
}

async function loadItems(executor: Pick<typeof db, "select">, companyId: string, estimateId: string): Promise<EstimateItem[]> {
  const rows: EstimateItemRow[] = await executor
    .select()
    .from(estimateItems)
    .where(and(eq(estimateItems.companyId, companyId), eq(estimateItems.estimateId, estimateId), isNull(estimateItems.deletedAt)))
    .limit(500);
  return rows
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((row) => ({ ...row, priceBookItemId: row.productCatalogId, itemType: row.itemType as EstimateItem["itemType"] }));
}

function primaryRow(rows: EstimateRow[]): EstimateRow {
  return rows.find((row) => row.isRecommended) ?? rows[0]!;
}

function setStatus(rows: EstimateRow[]): EstimateOptionSetStatus {
  const statuses = new Set(rows.map((row) => row.status));
  if (rows.some((row) => row.status === "approved")) return "approved";
  return statuses.size === 1 ? (rows[0]!.status as EstimateStatus) : "mixed";
}

async function buildSet(executor: Pick<typeof db, "select">, companyId: string, rows: EstimateRow[]): Promise<EstimateOptionSet> {
  if (rows.length === 0) throw notFound();
  const primary = primaryRow(rows);
  const options: EstimateOption[] = [];
  for (const row of rows) {
    options.push({
      estimateId: row.id,
      estimateNumber: row.estimateNumber,
      tierLabel: row.tierLabel,
      rank: estimateOptionTierRank(row.tierLabel),
      recommended: row.isRecommended === true,
      title: row.title,
      status: row.status as EstimateStatus,
      isSelectedTier: row.isSelectedTier === true,
      subtotal: row.subtotal,
      taxRate: row.taxRate,
      taxAmount: row.taxAmount,
      discountAmount: row.discountAmount,
      total: row.total,
      items: await loadItems(executor, companyId, row.id)
    });
  }
  const financingOffered = rows.some((row) => row.financingOffered === true);
  return {
    tierGroupId: primary.tierGroupId!,
    customerId: primary.customerId,
    jobId: primary.jobId,
    propertyId: primary.propertyId,
    title: primary.title,
    messageToCustomer: primary.messageToCustomer,
    status: setStatus(rows),
    selectedEstimateId: rows.find((row) => row.isSelectedTier === true)?.id ?? null,
    recommendedEstimateId: rows.find((row) => row.isRecommended === true)?.id ?? null,
    financingOffered,
    financing: financingSummary(financingOffered),
    options,
    version: Math.max(...rows.map((row) => row.optionSetVersion ?? 1)),
    createdAt: rows.reduce((min, row) => (row.createdAt < min ? row.createdAt : min), rows[0]!.createdAt),
    updatedAt: rows.reduce((max, row) => (row.updatedAt > max ? row.updatedAt : max), rows[0]!.updatedAt)
  };
}

/** Returns the earlier event for this key, or null. Throws 409 when the key was used with a different payload. */
async function findReplay(executor: Pick<typeof db, "select">, companyId: string, tierGroupId: string, key: string, hash: string) {
  const events = await executor
    .select()
    .from(activityEvents)
    .where(
      and(
        eq(activityEvents.companyId, companyId),
        eq(activityEvents.entityType, ESTIMATE_OPTION_SET_ENTITY_TYPE),
        eq(activityEvents.entityId, tierGroupId)
      )
    )
    .limit(MAX_SET_EVENTS);
  const match = events.find((event) => {
    const payload = (event.payload ?? {}) as { kind?: string; idempotencyKey?: string };
    return payload.kind === ESTIMATE_OPTION_SET_EVENT_KIND && payload.idempotencyKey === key;
  });
  if (!match) return null;
  if ((match.payload as { payloadHash?: string }).payloadHash !== hash) {
    throw conflict("idempotency_conflict", "Idempotency key was already used with a different request");
  }
  return match;
}

async function emitSetEvent(
  tx: Executor,
  input: { actor: EstimateOptionSetActor; tierGroupId: string; customerId: string; op: SetOp; key: string; hash: string; version: number; summary: string }
): Promise<void> {
  await emitEventWithExecutor(tx, {
    companyId: input.actor.companyId,
    eventType: input.op === "create" ? "estimate.created" : input.op === "send" ? "estimate.sent" : "estimate.updated",
    entityType: ESTIMATE_OPTION_SET_ENTITY_TYPE,
    entityId: input.tierGroupId,
    customerId: input.customerId,
    actorId: input.actor.userId,
    actorType: "user",
    payload: {
      kind: ESTIMATE_OPTION_SET_EVENT_KIND,
      op: input.op,
      idempotencyKey: input.key,
      payloadHash: input.hash,
      version: input.version
    },
    summary: input.summary
  });
}

function assertEditable(rows: EstimateRow[], expectedVersion: number): number {
  if (rows.length === 0) throw notFound();
  const version = Math.max(...rows.map((row) => row.optionSetVersion ?? 1));
  if (rows.some((row) => row.status !== "draft")) {
    throw conflict("not_draft", "Only draft option sets can be changed", { currentVersion: String(version) });
  }
  if (version !== expectedVersion) {
    throw conflict("stale_version", "Option set changed since it was loaded; reload and retry", { currentVersion: String(version) });
  }
  return version;
}

function assertUniqueLabels(labels: Array<string | null>): void {
  const normalized = labels.map((label) => (label ?? "").trim().toLowerCase());
  if (new Set(normalized).size !== normalized.length) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Option tier labels must be unique", { reason: "duplicate_tier_label" });
  }
}

function staleVersion(): AppError {
  return conflict("stale_version", "Option set changed since it was loaded; reload and retry");
}

/**
 * Compare-and-set bump: only rows still at expectedVersion move to expectedVersion + 1.
 * If fewer rows than expected match, a concurrent writer won the race: throw 409 stale_version,
 * which rolls back every earlier write in the same transaction (so the version is never double-bumped).
 */
async function bumpVersion(
  tx: Executor,
  companyId: string,
  tierGroupId: string,
  expectedVersion: number,
  expectedRows: number,
  now: Date
): Promise<void> {
  const updated = await tx
    .update(estimates)
    .set({ optionSetVersion: expectedVersion + 1, updatedAt: now })
    .where(
      and(
        eq(estimates.companyId, companyId),
        eq(estimates.tierGroupId, tierGroupId),
        isNull(estimates.deletedAt),
        eq(estimates.optionSetVersion, expectedVersion)
      )
    )
    .returning();
  if (updated.length !== expectedRows) throw staleVersion();
}

async function clearRecommended(tx: Executor, companyId: string, tierGroupId: string, expectedVersion: number): Promise<void> {
  await tx
    .update(estimates)
    .set({ isRecommended: false })
    .where(
      and(
        eq(estimates.companyId, companyId),
        eq(estimates.tierGroupId, tierGroupId),
        eq(estimates.isRecommended, true),
        eq(estimates.optionSetVersion, expectedVersion)
      )
    )
    .returning();
}

/** Guarded single-row write inside a set mutation; 0 rows means a concurrent writer moved the version. */
async function updateOptionRow(
  tx: Executor,
  companyId: string,
  estimateId: string,
  expectedVersion: number,
  values: Partial<typeof estimates.$inferInsert>
): Promise<void> {
  const [updated] = await tx
    .update(estimates)
    .set(values)
    .where(
      and(
        eq(estimates.companyId, companyId),
        eq(estimates.id, estimateId),
        isNull(estimates.deletedAt),
        eq(estimates.optionSetVersion, expectedVersion)
      )
    )
    .returning();
  if (!updated) throw staleVersion();
}

async function insertOption(
  tx: Tx,
  actor: EstimateOptionSetActor,
  base: {
    tierGroupId: string;
    customerId: string;
    jobId: string | null;
    propertyId: string | null;
    title: string | null;
    messageToCustomer: string | null;
    financingOffered: boolean;
    version: number;
  },
  option: EstimateOptionInput
): Promise<EstimateRow> {
  const estimateNumber = await generateEstimateNumber(actor.companyId, tx);
  const [row] = await tx
    .insert(estimates)
    .values({
      companyId: actor.companyId,
      estimateNumber,
      customerId: base.customerId,
      jobId: base.jobId,
      propertyId: base.propertyId,
      createdById: actor.userId,
      status: "draft",
      title: option.title ?? base.title,
      messageToCustomer: base.messageToCustomer,
      taxRate: new Decimal(option.taxRate ?? 0).toFixed(4),
      discountAmount: money(option.discountAmount ?? 0),
      financingOffered: base.financingOffered,
      tierLabel: option.tierLabel.trim(),
      tierGroupId: base.tierGroupId,
      isRecommended: option.recommended === true,
      optionSetVersion: base.version
    })
    .returning();
  if (!row) throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create estimate option");
  await tx
    .insert(estimateItems)
    .values(
      option.items.map((item, index) => ({
        companyId: actor.companyId,
        estimateId: row.id,
        name: item.name.trim(),
        description: item.description?.trim() || null,
        itemType: item.itemType ?? "service",
        quantity: new Decimal(item.quantity).toFixed(3),
        unitPrice: money(item.unitPrice),
        total: money(new Decimal(item.quantity).mul(item.unitPrice)),
        isTaxable: item.isTaxable ?? true,
        sortOrder: item.sortOrder ?? index,
        ...(item.priceBookItemId ? { productCatalogId: item.priceBookItemId } : {})
      }))
    )
    .returning();
  await recalculateTotals(row.id, tx);
  await emitEventWithExecutor(tx, {
    companyId: actor.companyId,
    eventType: "estimate.created",
    entityType: "estimate",
    entityId: row.id,
    customerId: row.customerId,
    estimateId: row.id,
    actorId: actor.userId,
    actorType: "user",
    payload: { tierGroupId: base.tierGroupId, tierLabel: row.tierLabel },
    summary: `Estimate ${row.estimateNumber} created`,
    ...(row.jobId ? { jobId: row.jobId } : {})
  });
  return row;
}

async function assertCustomerContext(
  tx: Tx,
  companyId: string,
  input: { customerId: string; jobId?: string | undefined; propertyId?: string | undefined }
): Promise<void> {
  const [customer] = await tx
    .select()
    .from(customers)
    .where(and(eq(customers.companyId, companyId), eq(customers.id, input.customerId), isNull(customers.deletedAt)))
    .limit(1);
  if (!customer) throw new AppError(ErrorCode.NOT_FOUND, "Customer not found");
  if (input.propertyId) {
    const [property] = await tx
      .select()
      .from(properties)
      .where(and(eq(properties.companyId, companyId), eq(properties.id, input.propertyId), isNull(properties.deletedAt)))
      .limit(1);
    if (!property) throw new AppError(ErrorCode.NOT_FOUND, "Property not found");
    if (property.customerId !== customer.id) throw new AppError(ErrorCode.CONFLICT, "Property does not belong to customer");
  }
  if (input.jobId) {
    const [job] = await tx
      .select()
      .from(jobs)
      .where(and(eq(jobs.companyId, companyId), eq(jobs.id, input.jobId), isNull(jobs.deletedAt)))
      .limit(1);
    if (!job) throw new AppError(ErrorCode.NOT_FOUND, "Job not found");
    if (job.customerId !== customer.id) throw new AppError(ErrorCode.CONFLICT, "Job does not belong to customer");
  }
}

async function replayResponse(tx: Pick<typeof db, "select">, companyId: string, tierGroupId: string): Promise<EstimateOptionSetResponse> {
  return { optionSet: await buildSet(tx, companyId, await loadRows(tx, companyId, tierGroupId)), replayed: true };
}

// ── public API ──

export async function createEstimateOptionSet(
  actor: EstimateOptionSetActor,
  body: EstimateOptionSetCreateBody
): Promise<EstimateOptionSetResponse> {
  const tierGroupId = optionSetIdFor(actor.companyId, body.idempotencyKey);
  const hash = payloadHash("create", body);
  return db.transaction(async (tx) => {
    if (await findReplay(tx, actor.companyId, tierGroupId, body.idempotencyKey, hash)) {
      return replayResponse(tx, actor.companyId, tierGroupId);
    }
    if ((await loadRows(tx, actor.companyId, tierGroupId)).length > 0) {
      throw conflict("idempotency_conflict", "Idempotency key was already used with a different request");
    }
    const [user] = await tx
      .select()
      .from(users)
      .where(and(eq(users.companyId, actor.companyId), eq(users.id, actor.userId)))
      .limit(1);
    if (!user) throw new AppError(ErrorCode.NOT_FOUND, "User not found");
    await assertCustomerContext(tx, actor.companyId, body);
    await assertPriceBookItemsInCompany(
      tx,
      actor.companyId,
      body.options.flatMap((option) => option.items.map((item) => item.priceBookItemId))
    );
    const base = {
      tierGroupId,
      customerId: body.customerId,
      jobId: body.jobId ?? null,
      propertyId: body.propertyId ?? null,
      title: body.title ?? null,
      messageToCustomer: body.messageToCustomer ?? null,
      financingOffered: body.financingOffered ?? false,
      version: 1
    };
    for (const option of body.options) await insertOption(tx, actor, base, option);
    await emitSetEvent(tx, {
      actor, tierGroupId, customerId: body.customerId, op: "create", key: body.idempotencyKey, hash, version: 1,
      summary: `Estimate option set created with ${body.options.length} options`
    });
    return { optionSet: await buildSet(tx, actor.companyId, await loadRows(tx, actor.companyId, tierGroupId)), replayed: false };
  });
}

export async function getEstimateOptionSet(companyId: string, tierGroupId: string): Promise<EstimateOptionSet> {
  return buildSet(db, companyId, await loadRows(db, companyId, tierGroupId));
}

export async function updateEstimateOptionSet(
  actor: EstimateOptionSetActor,
  tierGroupId: string,
  body: EstimateOptionSetUpdateBody
): Promise<EstimateOptionSetResponse> {
  const hash = payloadHash("update", body);
  return db.transaction(async (tx) => {
    const rows = await loadRows(tx, actor.companyId, tierGroupId);
    if (rows.length === 0) throw notFound();
    if (await findReplay(tx, actor.companyId, tierGroupId, body.idempotencyKey, hash)) return replayResponse(tx, actor.companyId, tierGroupId);
    const version = assertEditable(rows, body.expectedVersion);
    const byId = new Map(rows.map((row) => [row.id, row]));
    const labels = new Map(rows.map((row) => [row.id, row.tierLabel]));
    for (const option of body.options ?? []) {
      if (!byId.has(option.estimateId)) throw new AppError(ErrorCode.NOT_FOUND, "Estimate option not found");
      labels.set(option.estimateId, option.tierLabel.trim());
    }
    assertUniqueLabels([...labels.values()]);
    if (body.recommendedEstimateId && !byId.has(body.recommendedEstimateId)) {
      throw new AppError(ErrorCode.NOT_FOUND, "Estimate option not found");
    }
    const now = new Date();
    const scope = and(
      eq(estimates.companyId, actor.companyId),
      eq(estimates.tierGroupId, tierGroupId),
      isNull(estimates.deletedAt),
      eq(estimates.optionSetVersion, version)
    );
    const shared = {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.messageToCustomer !== undefined ? { messageToCustomer: body.messageToCustomer } : {}),
      ...(body.financingOffered !== undefined ? { financingOffered: body.financingOffered } : {})
    };
    if (Object.keys(shared).length > 0) {
      const updated = await tx.update(estimates).set({ ...shared, updatedAt: now }).where(scope).returning();
      if (updated.length !== rows.length) throw staleVersion();
    }
    for (const option of body.options ?? []) {
      await updateOptionRow(tx, actor.companyId, option.estimateId, version, { tierLabel: option.tierLabel.trim(), updatedAt: now });
    }
    if (body.recommendedEstimateId !== undefined) {
      await clearRecommended(tx, actor.companyId, tierGroupId, version);
      if (body.recommendedEstimateId) {
        await updateOptionRow(tx, actor.companyId, body.recommendedEstimateId, version, { isRecommended: true, updatedAt: now });
      }
    }
    await bumpVersion(tx, actor.companyId, tierGroupId, version, rows.length, now);
    await emitSetEvent(tx, {
      actor, tierGroupId, customerId: rows[0]!.customerId, op: "update", key: body.idempotencyKey, hash, version: version + 1,
      summary: "Estimate option set updated"
    });
    return { optionSet: await buildSet(tx, actor.companyId, await loadRows(tx, actor.companyId, tierGroupId)), replayed: false };
  });
}

export async function addEstimateOption(
  actor: EstimateOptionSetActor,
  tierGroupId: string,
  body: EstimateOptionSetAddOptionBody
): Promise<EstimateOptionSetResponse> {
  const hash = payloadHash("add_option", body);
  return db.transaction(async (tx) => {
    const rows = await loadRows(tx, actor.companyId, tierGroupId);
    if (rows.length === 0) throw notFound();
    if (await findReplay(tx, actor.companyId, tierGroupId, body.idempotencyKey, hash)) return replayResponse(tx, actor.companyId, tierGroupId);
    const version = assertEditable(rows, body.expectedVersion);
    if (rows.length >= ESTIMATE_OPTION_SET_MAX_OPTIONS) {
      throw conflict("option_limit", `An option set can have at most ${ESTIMATE_OPTION_SET_MAX_OPTIONS} options`);
    }
    assertUniqueLabels([...rows.map((row) => row.tierLabel), body.option.tierLabel]);
    await assertPriceBookItemsInCompany(tx, actor.companyId, body.option.items.map((item) => item.priceBookItemId));
    if (body.option.recommended) await clearRecommended(tx, actor.companyId, tierGroupId, version);
    const primary = primaryRow(rows);
    await insertOption(
      tx,
      actor,
      {
        tierGroupId,
        customerId: primary.customerId,
        jobId: primary.jobId,
        propertyId: primary.propertyId,
        title: primary.title,
        messageToCustomer: primary.messageToCustomer,
        financingOffered: rows.some((row) => row.financingOffered === true),
        version
      },
      body.option
    );
    // The inserted option starts at `version`, so the bump must move rows.length + 1 rows.
    await bumpVersion(tx, actor.companyId, tierGroupId, version, rows.length + 1, new Date());
    await emitSetEvent(tx, {
      actor, tierGroupId, customerId: primary.customerId, op: "add_option", key: body.idempotencyKey, hash, version: version + 1,
      summary: "Estimate option added"
    });
    return { optionSet: await buildSet(tx, actor.companyId, await loadRows(tx, actor.companyId, tierGroupId)), replayed: false };
  });
}

export async function removeEstimateOption(
  actor: EstimateOptionSetActor,
  tierGroupId: string,
  estimateId: string,
  body: EstimateOptionSetVersionedBody
): Promise<EstimateOptionSetResponse> {
  const hash = payloadHash("remove_option", { ...body, estimateId });
  return db.transaction(async (tx) => {
    const rows = await loadRows(tx, actor.companyId, tierGroupId);
    if (rows.length === 0) throw notFound();
    if (await findReplay(tx, actor.companyId, tierGroupId, body.idempotencyKey, hash)) return replayResponse(tx, actor.companyId, tierGroupId);
    const version = assertEditable(rows, body.expectedVersion);
    if (!rows.some((row) => row.id === estimateId)) throw new AppError(ErrorCode.NOT_FOUND, "Estimate option not found");
    if (rows.length <= ESTIMATE_OPTION_SET_MIN_OPTIONS) {
      throw conflict("option_minimum", `An option set needs at least ${ESTIMATE_OPTION_SET_MIN_OPTIONS} options`);
    }
    const now = new Date();
    await updateOptionRow(tx, actor.companyId, estimateId, version, { deletedAt: now, isRecommended: false, updatedAt: now });
    await bumpVersion(tx, actor.companyId, tierGroupId, version, rows.length - 1, now);
    await emitSetEvent(tx, {
      actor, tierGroupId, customerId: rows[0]!.customerId, op: "remove_option", key: body.idempotencyKey, hash, version: version + 1,
      summary: "Estimate option removed"
    });
    return { optionSet: await buildSet(tx, actor.companyId, await loadRows(tx, actor.companyId, tierGroupId)), replayed: false };
  });
}

export async function sendEstimateOptionSet(
  actor: EstimateOptionSetActor,
  tierGroupId: string,
  body: EstimateOptionSetVersionedBody
): Promise<EstimateOptionSetResponse> {
  const hash = payloadHash("send", body);
  const result = await db.transaction(async (tx) => {
    const rows = await loadRows(tx, actor.companyId, tierGroupId);
    if (rows.length === 0) throw notFound();
    if (await findReplay(tx, actor.companyId, tierGroupId, body.idempotencyKey, hash)) {
      return { response: await replayResponse(tx, actor.companyId, tierGroupId), primaryId: null as string | null };
    }
    const version = assertEditable(rows, body.expectedVersion);
    const [customer] = await tx
      .select()
      .from(customers)
      .where(and(eq(customers.companyId, actor.companyId), eq(customers.id, rows[0]!.customerId)))
      .limit(1);
    if (!customer?.email) throw new AppError(ErrorCode.CONFLICT, "Customer must have an email before sending an estimate");
    const sentAt = new Date();
    const expiresAt = new Date(sentAt.getTime() + env.ESTIMATE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    for (const row of rows) {
      const [updated] = await tx
        .update(estimates)
        .set({
          approvalToken: randomBytes(24).toString("base64url"),
          sentAt,
          expiresAt,
          status: "sent",
          optionSetVersion: version + 1,
          updatedAt: sentAt
        })
        .where(
          and(
            eq(estimates.companyId, actor.companyId),
            eq(estimates.id, row.id),
            eq(estimates.status, "draft"),
            isNull(estimates.deletedAt),
            eq(estimates.optionSetVersion, version)
          )
        )
        .returning();
      if (!updated) throw staleVersion();
      await emitEventWithExecutor(tx, {
        companyId: actor.companyId,
        eventType: "estimate.sent",
        entityType: "estimate",
        entityId: updated.id,
        customerId: updated.customerId,
        estimateId: updated.id,
        actorId: actor.userId,
        actorType: "user",
        payload: { tierGroupId },
        summary: `Estimate ${updated.estimateNumber} sent`,
        ...(updated.jobId ? { jobId: updated.jobId } : {})
      });
    }
    await emitSetEvent(tx, {
      actor, tierGroupId, customerId: rows[0]!.customerId, op: "send", key: body.idempotencyKey, hash, version: version + 1,
      summary: `Estimate option set sent with ${rows.length} options`
    });
    const after = await loadRows(tx, actor.companyId, tierGroupId);
    return { response: { optionSet: await buildSet(tx, actor.companyId, after), replayed: false }, primaryId: primaryRow(after).id };
  });

  if (result.primaryId) {
    try {
      const { notificationsQueue } = await import("@fsm/jobs");
      await notificationsQueue.add(
        "send-estimate-email",
        { companyId: actor.companyId, estimateId: result.primaryId, customerId: result.response.optionSet.customerId },
        { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
      );
    } catch (error) {
      logger.error({ err: error, companyId: actor.companyId, estimateId: result.primaryId }, "Failed to enqueue estimate option set email");
    }
  }
  return result.response;
}

async function assertSetExists(companyId: string, tierGroupId: string): Promise<EstimateRow[]> {
  const rows = await loadRows(db, companyId, tierGroupId);
  if (rows.length === 0) throw notFound();
  return rows;
}

export async function getEstimateOptionSetFinancingQuotes(
  companyId: string,
  tierGroupId: string,
  estimateId?: string
): Promise<EstimateFinancingQuotesResponse> {
  const rows = await assertSetExists(companyId, tierGroupId);
  const target = estimateId ? rows.find((row) => row.id === estimateId) : primaryRow(rows);
  if (!target) throw new AppError(ErrorCode.NOT_FOUND, "Estimate option not found");
  return quoteFinancing({ companyId, estimateId: target.id, amount: target.total });
}

export async function startEstimateOptionSetFinancingApplication(companyId: string, tierGroupId: string): Promise<never> {
  const rows = await assertSetExists(companyId, tierGroupId);
  return startFinancingApplication({ companyId, estimateId: primaryRow(rows).id });
}
