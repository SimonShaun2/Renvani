import { randomBytes } from "node:crypto";

import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { Decimal } from "decimal.js";
import pino from "pino";

import { env } from "@fsm/config";
import {
  activityEvents,
  automationRules,
  bookingSettings,
  companies,
  customers,
  db,
  emitEventWithExecutor,
  estimates,
  estimateItems,
  jobs,
  properties,
  users
} from "@fsm/db";
import {
  AppError,
  ErrorCode,
  type Estimate,
  type EstimateDetail,
  type EstimateItem,
  type EstimateItemType,
  type EstimateListItem,
  type EstimateStatus,
  type Job,
  type ListEstimatesQuery,
  type PaginatedResult,
  type PublicEstimateSchedulingContext,
  type PublicEstimateView,
  type UpdateEstimateInput,
  type CreateEstimateInput
} from "@fsm/types";

import { generateEstimateNumber } from "../lib/estimate-number.js";
import { generateJobNumber } from "../lib/job-number.js";
import { listItems, recalculateTotals } from "./estimate-items.service.js";
import { assertPriceBookItemsInCompany } from "./price-book-item-scope.js";

type EstimateRow = typeof estimates.$inferSelect;
type EstimateItemRow = typeof estimateItems.$inferSelect;
type CustomerRow = typeof customers.$inferSelect;
type PropertyRow = typeof properties.$inferSelect;
type JobRow = typeof jobs.$inferSelect;
type UserRow = typeof users.$inferSelect;
type TransactionExecutor = Pick<typeof db, "select" | "insert" | "update">;
type SelectExecutor = Pick<typeof db, "select">;
type AutomationRuleType = (typeof automationRules.$inferSelect)["ruleType"];

const logger = pino({
  name: "estimate-service"
});

const DEFAULT_LIST_PAGE = 1;
const DEFAULT_LIST_LIMIT = 25;
const MAX_LIST_LIMIT = 100;
const MAX_RESULT_WINDOW = 10_000;

function formatMoney(value: Decimal): string {
  return value.toFixed(2);
}

function formatTaxRate(value: Decimal): string {
  return value.toFixed(4);
}

function parseIsoDateTime(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  return new Date(value);
}

function normalizeOptionalString(value: string | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeEstimateStatus(status: EstimateRow["status"]): EstimateStatus {
  return status as EstimateStatus;
}

function normalizeEstimateItemType(itemType: EstimateItemRow["itemType"]): EstimateItemType {
  return itemType as EstimateItemType;
}

function toEstimate(row: EstimateRow): Estimate {
  return {
    ...row,
    status: normalizeEstimateStatus(row.status)
  };
}

function toEstimateItem(row: EstimateItemRow): EstimateItem {
  return {
    ...row,
    priceBookItemId: row.productCatalogId,
    itemType: normalizeEstimateItemType(row.itemType)
  };
}

function toEstimateListItem(row: EstimateRow, customer: CustomerRow): EstimateListItem {
  return {
    id: row.id,
    estimateNumber: row.estimateNumber,
    title: row.title,
    status: normalizeEstimateStatus(row.status),
    total: row.total,
    subtotal: row.subtotal,
    tierLabel: row.tierLabel,
    tierGroupId: row.tierGroupId,
    customer: {
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName
    },
    sentAt: row.sentAt,
    expiresAt: row.expiresAt,
    approvedAt: row.approvedAt,
    declinedAt: row.declinedAt,
    createdAt: row.createdAt
  };
}

function toEstimateDetail(
  row: EstimateRow,
  customer: CustomerRow,
  property: PropertyRow | null,
  job: JobRow | null,
  items: EstimateItem[]
): EstimateDetail {
  return {
    ...toEstimate(row),
    customer: {
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      email: customer.email
    },
    property: property
      ? {
          id: property.id,
          addressLine1: property.addressLine1,
          city: property.city,
          state: property.state
        }
      : null,
    job: job
      ? {
          id: job.id,
          jobNumber: job.jobNumber,
          title: job.title
        }
      : null,
    items
  };
}

function toPublicEstimateView(
  row: EstimateRow,
  items: EstimateItem[]
): PublicEstimateView {
  return {
    estimateNumber: row.estimateNumber,
    title: row.title,
    status: normalizeEstimateStatus(row.status),
    messageToCustomer: row.messageToCustomer,
    subtotal: row.subtotal,
    taxRate: row.taxRate,
    taxAmount: row.taxAmount,
    discountAmount: row.discountAmount,
    total: row.total,
    financingOffered: row.financingOffered,
    tierLabel: row.tierLabel,
    expiresAt: row.expiresAt,
    items: items.map((item) => ({
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total
    }))
  };
}

function getTierSortRank(tierLabel: string | null): number {
  switch ((tierLabel ?? "").trim().toLowerCase()) {
    case "good":
      return 0;
    case "better":
      return 1;
    case "best":
      return 2;
    default:
      return 99;
  }
}

function buildActorName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

function buildEstimateSummary(estimateNumber: string, eventLabel: string): string {
  return `Estimate ${estimateNumber} ${eventLabel}`;
}

function generateApprovalToken(): string {
  return randomBytes(24).toString("base64url");
}

async function getUserRecord(
  companyId: string,
  userId: string,
  executor: SelectExecutor
): Promise<UserRow> {
  const [user] = await executor
    .select()
    .from(users)
    .where(and(eq(users.companyId, companyId), eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  if (!user) {
    throw new AppError(ErrorCode.NOT_FOUND, "User not found");
  }

  return user;
}

async function getCustomerRecord(
  companyId: string,
  customerId: string,
  executor: SelectExecutor
): Promise<CustomerRow> {
  const [customer] = await executor
    .select()
    .from(customers)
    .where(and(eq(customers.companyId, companyId), eq(customers.id, customerId), isNull(customers.deletedAt)))
    .limit(1);

  if (!customer) {
    throw new AppError(ErrorCode.NOT_FOUND, "Customer not found");
  }

  return customer;
}

async function getPropertyRecord(
  companyId: string,
  propertyId: string,
  executor: SelectExecutor
): Promise<PropertyRow> {
  const [property] = await executor
    .select()
    .from(properties)
    .where(and(eq(properties.companyId, companyId), eq(properties.id, propertyId), isNull(properties.deletedAt)))
    .limit(1);

  if (!property) {
    throw new AppError(ErrorCode.NOT_FOUND, "Property not found");
  }

  return property;
}

async function getJobRecord(
  companyId: string,
  jobId: string,
  executor: SelectExecutor
): Promise<JobRow> {
  const [job] = await executor
    .select()
    .from(jobs)
    .where(and(eq(jobs.companyId, companyId), eq(jobs.id, jobId), isNull(jobs.deletedAt)))
    .limit(1);

  if (!job) {
    throw new AppError(ErrorCode.NOT_FOUND, "Job not found");
  }

  return job;
}

async function getEstimateRecord(
  companyId: string,
  estimateId: string,
  executor: SelectExecutor
): Promise<EstimateRow> {
  const [estimate] = await executor
    .select()
    .from(estimates)
    .where(and(eq(estimates.companyId, companyId), eq(estimates.id, estimateId), isNull(estimates.deletedAt)))
    .limit(1);

  if (!estimate) {
    throw new AppError(ErrorCode.NOT_FOUND, "Estimate not found");
  }

  return estimate;
}

async function getEstimateByToken(
  token: string,
  executor: SelectExecutor
): Promise<EstimateRow> {
  const [estimate] = await executor
    .select()
    .from(estimates)
    .where(and(eq(estimates.approvalToken, token), isNull(estimates.deletedAt)))
    .limit(1);

  if (!estimate) {
    throw new AppError(ErrorCode.NOT_FOUND, "Estimate not found");
  }

  return estimate;
}

async function getEstimateByNumberAndTierGroup(
  companyId: string,
  tierGroupId: string,
  estimateNumber: string,
  executor: SelectExecutor
): Promise<EstimateRow> {
  const [estimate] = await executor
    .select()
    .from(estimates)
    .where(
      and(
        eq(estimates.companyId, companyId),
        eq(estimates.tierGroupId, tierGroupId),
        eq(estimates.estimateNumber, estimateNumber),
        isNull(estimates.deletedAt)
      )
    )
    .limit(1);

  if (!estimate) {
    throw new AppError(ErrorCode.NOT_FOUND, "Estimate not found");
  }

  return estimate;
}

async function getEstimateItems(
  companyId: string,
  estimateId: string,
  executor: SelectExecutor
): Promise<EstimateItem[]> {
  const rows = await executor
    .select()
    .from(estimateItems)
    .where(and(eq(estimateItems.companyId, companyId), eq(estimateItems.estimateId, estimateId), isNull(estimateItems.deletedAt)))
    .orderBy(asc(estimateItems.sortOrder));

  return rows.map((row) => toEstimateItem(row));
}

async function getTierGroupEstimateRows(
  companyId: string,
  tierGroupId: string,
  executor: SelectExecutor
): Promise<EstimateRow[]> {
  const rows = await executor
    .select()
    .from(estimates)
    .where(and(eq(estimates.companyId, companyId), eq(estimates.tierGroupId, tierGroupId), isNull(estimates.deletedAt)))
    .limit(MAX_RESULT_WINDOW);

  return rows.sort((left, right) => {
    const tierComparison = getTierSortRank(left.tierLabel) - getTierSortRank(right.tierLabel);
    if (tierComparison !== 0) {
      return tierComparison;
    }

    return left.createdAt.getTime() - right.createdAt.getTime();
  });
}

async function findAutomationRule(
  companyId: string,
  ruleType: AutomationRuleType
): Promise<(typeof automationRules.$inferSelect) | null> {
  return (
    await db.query.automationRules.findFirst({
      where: (table, operators) =>
        operators.and(
          operators.eq(table.companyId, companyId),
          operators.eq(table.ruleType, ruleType),
          operators.eq(table.isEnabled, true),
          operators.isNull(table.deletedAt)
        )
    })
  ) ?? null;
}

function assertPropertyBelongsToCustomer(property: PropertyRow, customerId: string): void {
  if (property.customerId !== customerId) {
    throw new AppError(ErrorCode.CONFLICT, "Property does not belong to customer");
  }
}

function assertEstimateIsDraft(estimate: EstimateRow): void {
  if (estimate.status !== "draft") {
    throw new AppError(ErrorCode.CONFLICT, "Only draft estimates can be modified");
  }
}

function assertEstimateIsAwaitingDecision(estimate: EstimateRow): void {
  if (estimate.status !== "sent" && estimate.status !== "viewed") {
    throw new AppError(ErrorCode.CONFLICT, "Estimate is not awaiting a decision");
  }
}

function assertEstimateNotExpired(estimate: EstimateRow): void {
  if (estimate.expiresAt && estimate.expiresAt.getTime() < Date.now()) {
    throw new AppError(ErrorCode.CONFLICT, "Estimate has expired");
  }
}

function normalizeCreateEstimateInput(input: CreateEstimateInput) {
  return {
    customerId: input.customerId,
    jobId: input.jobId,
    propertyId: input.propertyId,
    title: normalizeOptionalString(input.title) ?? null,
    messageToCustomer: normalizeOptionalString(input.messageToCustomer) ?? null,
    internalNotes: normalizeOptionalString(input.internalNotes) ?? null,
    taxRate: formatTaxRate(new Decimal(input.taxRate ?? 0)),
    discountAmount: formatMoney(new Decimal(input.discountAmount ?? 0)),
    financingOffered: input.financingOffered ?? false,
    tierLabel: normalizeOptionalString(input.tierLabel) ?? null,
    tierGroupId: input.tierGroupId ?? null,
    items: input.items ?? []
  };
}

function normalizeUpdateEstimateInput(input: UpdateEstimateInput) {
  return {
    ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
    ...(input.jobId !== undefined ? { jobId: input.jobId } : {}),
    ...(input.propertyId !== undefined ? { propertyId: input.propertyId } : {}),
    ...(input.title !== undefined ? { title: normalizeOptionalString(input.title) ?? null } : {}),
    ...(
      input.messageToCustomer !== undefined
        ? { messageToCustomer: normalizeOptionalString(input.messageToCustomer) ?? null }
        : {}
    ),
    ...(input.internalNotes !== undefined ? { internalNotes: normalizeOptionalString(input.internalNotes) ?? null } : {}),
    ...(input.taxRate !== undefined ? { taxRate: formatTaxRate(new Decimal(input.taxRate)) } : {}),
    ...(input.discountAmount !== undefined ? { discountAmount: formatMoney(new Decimal(input.discountAmount)) } : {}),
    ...(input.financingOffered !== undefined ? { financingOffered: input.financingOffered } : {}),
    ...(input.tierLabel !== undefined ? { tierLabel: normalizeOptionalString(input.tierLabel) ?? null } : {}),
    ...(input.tierGroupId !== undefined ? { tierGroupId: input.tierGroupId ?? null } : {})
  };
}

async function buildEstimateDetail(
  companyId: string,
  estimate: EstimateRow,
  executor: SelectExecutor
): Promise<EstimateDetail> {
  const [customer, property, job, items] = await Promise.all([
    getCustomerRecord(companyId, estimate.customerId, executor),
    estimate.propertyId ? getPropertyRecord(companyId, estimate.propertyId, executor) : Promise.resolve(null),
    estimate.jobId ? getJobRecord(companyId, estimate.jobId, executor) : Promise.resolve(null),
    getEstimateItems(companyId, estimate.id, executor)
  ]);

  return toEstimateDetail(estimate, customer, property, job, items);
}

async function buildPublicEstimateView(
  estimate: EstimateRow,
  executor: SelectExecutor
): Promise<PublicEstimateView> {
  const items = await getEstimateItems(estimate.companyId, estimate.id, executor);
  const publicEstimate = toPublicEstimateView(estimate, items);

  if (!estimate.tierGroupId) {
    return publicEstimate;
  }

  const tierRows = await getTierGroupEstimateRows(estimate.companyId, estimate.tierGroupId, executor);
  const tierItems = await Promise.all(
    tierRows.map(async (tierRow) => ({
      tierRow,
      items: await getEstimateItems(estimate.companyId, tierRow.id, executor)
    }))
  );

  return {
    ...publicEstimate,
    tiers: tierItems.map(({ tierRow, items: tierEstimateItems }) => ({
      estimateNumber: tierRow.estimateNumber,
      title: tierRow.title,
      tierLabel: tierRow.tierLabel,
      subtotal: tierRow.subtotal,
      taxRate: tierRow.taxRate,
      taxAmount: tierRow.taxAmount,
      discountAmount: tierRow.discountAmount,
      total: tierRow.total,
      items: tierEstimateItems.map((item) => ({
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total
      }))
    }))
  };
}

async function emitEstimateEvent(
  executor: TransactionExecutor,
  input: {
    estimate: EstimateRow;
    eventType: typeof activityEvents.$inferInsert.eventType;
    actorId?: string | null;
    actorType?: string | null;
    actorName?: string | null;
    summary: string;
    payload?: Record<string, unknown>;
  }
): Promise<void> {
  await emitEventWithExecutor(executor, {
    companyId: input.estimate.companyId,
    eventType: input.eventType,
    entityType: "estimate",
    entityId: input.estimate.id,
    customerId: input.estimate.customerId,
    estimateId: input.estimate.id,
    payload: input.payload ?? {},
    summary: input.summary,
    ...(input.actorId ? { actorId: input.actorId } : {}),
    ...(input.actorType ? { actorType: input.actorType } : {}),
    ...(input.actorName ? { actorName: input.actorName } : {}),
    ...(input.estimate.jobId ? { jobId: input.estimate.jobId } : {})
  });
}

export async function listEstimates(
  companyId: string,
  query: ListEstimatesQuery
): Promise<PaginatedResult<EstimateListItem>> {
  const createdAfter = parseIsoDateTime(query.createdAfter);
  const createdBefore = parseIsoDateTime(query.createdBefore);
  const page = query.page ?? DEFAULT_LIST_PAGE;
  const limit = Math.min(query.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
  const sortBy = query.sortBy ?? "createdAt";
  const sortOrder = query.sortOrder ?? "desc";
  const search = normalizeOptionalString(query.search)?.toLowerCase();
  const rows = await db
    .select()
    .from(estimates)
    .where(and(eq(estimates.companyId, companyId), isNull(estimates.deletedAt)))
    .limit(MAX_RESULT_WINDOW);

  const filteredRows = rows.filter((row) => {
    if (query.status && row.status !== query.status) {
      return false;
    }

    if (query.customerId && row.customerId !== query.customerId) {
      return false;
    }

    if (query.jobId && row.jobId !== query.jobId) {
      return false;
    }

    if (query.tierGroupId && row.tierGroupId !== query.tierGroupId) {
      return false;
    }

    if (
      search &&
      !(row.title ?? "").toLowerCase().includes(search) &&
      !row.estimateNumber.toLowerCase().includes(search)
    ) {
      return false;
    }

    if (createdAfter && row.createdAt.getTime() < createdAfter.getTime()) {
      return false;
    }

    if (createdBefore && row.createdAt.getTime() > createdBefore.getTime()) {
      return false;
    }

    return true;
  });

  const sortedRows = [...filteredRows].sort((left, right) => {
    if (sortBy === "total") {
      const comparison = new Decimal(left.total).cmp(right.total);
      return sortOrder === "asc" ? comparison : comparison * -1;
    }

    if (sortBy === "status") {
      const comparison = left.status.localeCompare(right.status);
      return sortOrder === "asc" ? comparison : comparison * -1;
    }

    const comparison = left.createdAt.getTime() - right.createdAt.getTime();
    return sortOrder === "asc" ? comparison : comparison * -1;
  });

  const customerIds = [...new Set(sortedRows.map((row) => row.customerId))];
  const companyCustomers = customerIds.length === 0
    ? []
    : await db
        .select()
        .from(customers)
        .where(and(eq(customers.companyId, companyId), isNull(customers.deletedAt)))
        .limit(MAX_RESULT_WINDOW);
  const customerMap = new Map(companyCustomers.map((row) => [row.id, row]));
  const total = sortedRows.length;
  const offset = (page - 1) * limit;
  const data = sortedRows.slice(offset, offset + limit).flatMap((row) => {
    const customer = customerMap.get(row.customerId);

    if (!customer) {
      return [];
    }

    return [toEstimateListItem(row, customer)];
  });

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

export async function getEstimate(companyId: string, estimateId: string): Promise<EstimateDetail> {
  const estimate = await getEstimateRecord(companyId, estimateId, db);
  return buildEstimateDetail(companyId, estimate, db);
}

export async function createEstimate(
  companyId: string,
  actorId: string,
  input: CreateEstimateInput
): Promise<Estimate> {
  const normalizedInput = normalizeCreateEstimateInput(input);

  return db.transaction(async (tx) => {
    const actor = await getUserRecord(companyId, actorId, tx);
    const customer = await getCustomerRecord(companyId, normalizedInput.customerId, tx);
    const property = normalizedInput.propertyId
      ? await getPropertyRecord(companyId, normalizedInput.propertyId, tx)
      : null;
    const job = normalizedInput.jobId ? await getJobRecord(companyId, normalizedInput.jobId, tx) : null;

    if (property) {
      assertPropertyBelongsToCustomer(property, customer.id);
    }

    if (job && job.customerId !== customer.id) {
      throw new AppError(ErrorCode.CONFLICT, "Job does not belong to customer");
    }

    const estimateNumber = await generateEstimateNumber(companyId, tx);
    const insertedEstimates = await tx
      .insert(estimates)
      .values({
        companyId,
        estimateNumber,
        customerId: customer.id,
        jobId: job?.id ?? null,
        propertyId: property?.id ?? null,
        createdById: actor.id,
        status: "draft",
        title: normalizedInput.title,
        messageToCustomer: normalizedInput.messageToCustomer,
        internalNotes: normalizedInput.internalNotes,
        taxRate: normalizedInput.taxRate,
        discountAmount: normalizedInput.discountAmount,
        financingOffered: normalizedInput.financingOffered,
        tierLabel: normalizedInput.tierLabel,
        tierGroupId: normalizedInput.tierGroupId
      })
      .returning();
    const createdEstimate = insertedEstimates[0];

    if (!createdEstimate) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create estimate");
    }

    if (normalizedInput.items.length > 0) {
      await assertPriceBookItemsInCompany(
        tx,
        companyId,
        normalizedInput.items.map((item) => item.priceBookItemId)
      );
      await tx
        .insert(estimateItems)
        .values(
          normalizedInput.items.map((item, index) => ({
            companyId,
            estimateId: createdEstimate.id,
            name: item.name.trim(),
            description: normalizeOptionalString(item.description) ?? null,
            itemType: item.itemType ?? "service",
            quantity: new Decimal(item.quantity).toFixed(3),
            unitPrice: formatMoney(new Decimal(item.unitPrice)),
            total: formatMoney(new Decimal(item.quantity).mul(item.unitPrice)),
            isTaxable: item.isTaxable ?? true,
            sortOrder: item.sortOrder ?? index,
            ...(item.priceBookItemId ? { productCatalogId: item.priceBookItemId } : {})
          }))
        )
        .returning();
    }

    await recalculateTotals(createdEstimate.id, tx);

    const [persistedEstimate] = await tx
      .select()
      .from(estimates)
      .where(eq(estimates.id, createdEstimate.id))
      .limit(1);

    if (!persistedEstimate) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to load created estimate");
    }

    await emitEstimateEvent(tx, {
      estimate: persistedEstimate,
      eventType: "estimate.created",
      actorId: actor.id,
      actorName: buildActorName(actor.firstName, actor.lastName),
      summary: buildEstimateSummary(persistedEstimate.estimateNumber, "created")
    });

    return toEstimate(persistedEstimate);
  });
}

export async function updateEstimate(
  companyId: string,
  actorId: string,
  estimateId: string,
  input: UpdateEstimateInput
): Promise<Estimate> {
  const existingEstimate = await getEstimateRecord(companyId, estimateId, db);
  assertEstimateIsDraft(existingEstimate);
  const normalizedInput = normalizeUpdateEstimateInput(input);
  const nextCustomerId = normalizedInput.customerId ?? existingEstimate.customerId;
  const nextJobId = normalizedInput.jobId ?? existingEstimate.jobId;
  const nextPropertyId = normalizedInput.propertyId ?? existingEstimate.propertyId;

  return db.transaction(async (tx) => {
    const actor = await getUserRecord(companyId, actorId, tx);
    const customer = await getCustomerRecord(companyId, nextCustomerId, tx);
    const property = nextPropertyId ? await getPropertyRecord(companyId, nextPropertyId, tx) : null;
    const job = nextJobId ? await getJobRecord(companyId, nextJobId, tx) : null;

    if (property) {
      assertPropertyBelongsToCustomer(property, customer.id);
    }

    if (job && job.customerId !== customer.id) {
      throw new AppError(ErrorCode.CONFLICT, "Job does not belong to customer");
    }

    const updatedEstimates = await tx
      .update(estimates)
      .set({
        ...normalizedInput,
        updatedAt: new Date()
      })
      .where(and(eq(estimates.companyId, companyId), eq(estimates.id, estimateId), isNull(estimates.deletedAt)))
      .returning();
    const updatedEstimate = updatedEstimates[0];

    if (!updatedEstimate) {
      throw new AppError(ErrorCode.NOT_FOUND, "Estimate not found");
    }

    await recalculateTotals(updatedEstimate.id, tx);

    const [persistedEstimate] = await tx
      .select()
      .from(estimates)
      .where(eq(estimates.id, updatedEstimate.id))
      .limit(1);

    if (!persistedEstimate) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to load updated estimate");
    }

    await emitEstimateEvent(tx, {
      estimate: persistedEstimate,
      eventType: "estimate.updated",
      actorId: actor.id,
      actorName: buildActorName(actor.firstName, actor.lastName),
      summary: buildEstimateSummary(persistedEstimate.estimateNumber, "updated")
    });

    return toEstimate(persistedEstimate);
  });
}

export async function deleteEstimate(
  companyId: string,
  actorId: string,
  estimateId: string
): Promise<void> {
  const existingEstimate = await getEstimateRecord(companyId, estimateId, db);
  assertEstimateIsDraft(existingEstimate);

  await db.transaction(async (tx) => {
    const actor = await getUserRecord(companyId, actorId, tx);
    const [deletedEstimate] = await tx
      .update(estimates)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(eq(estimates.companyId, companyId), eq(estimates.id, estimateId), isNull(estimates.deletedAt)))
      .returning();

    if (!deletedEstimate) {
      throw new AppError(ErrorCode.NOT_FOUND, "Estimate not found");
    }

    await tx
      .update(estimateItems)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(eq(estimateItems.companyId, companyId), eq(estimateItems.estimateId, estimateId), isNull(estimateItems.deletedAt)))
      .returning();

    await emitEstimateEvent(tx, {
      estimate: deletedEstimate,
      eventType: "estimate.deleted",
      actorId: actor.id,
      actorName: buildActorName(actor.firstName, actor.lastName),
      summary: buildEstimateSummary(deletedEstimate.estimateNumber, "deleted")
    });
  });
}

export async function sendEstimate(
  companyId: string,
  actorId: string,
  estimateId: string
): Promise<Estimate> {
  const existingEstimate = await getEstimateRecord(companyId, estimateId, db);

  if (existingEstimate.status !== "draft") {
    throw new AppError(ErrorCode.CONFLICT, "Only draft estimates can be sent");
  }

  const sentEstimate = await db.transaction(async (tx) => {
    const actor = await getUserRecord(companyId, actorId, tx);
    const customer = await getCustomerRecord(companyId, existingEstimate.customerId, tx);

    if (!customer.email) {
      throw new AppError(ErrorCode.CONFLICT, "Customer must have an email before sending an estimate");
    }

    const approvalToken = generateApprovalToken();
    const sentAt = new Date();
    const expiresAt = new Date(sentAt.getTime() + env.ESTIMATE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const updatedEstimates = await tx
      .update(estimates)
      .set({
        approvalToken,
        sentAt,
        expiresAt,
        status: "sent",
        updatedAt: sentAt
      })
      .where(and(eq(estimates.companyId, companyId), eq(estimates.id, estimateId), isNull(estimates.deletedAt)))
      .returning();
    const updatedEstimate = updatedEstimates[0];

    if (!updatedEstimate) {
      throw new AppError(ErrorCode.NOT_FOUND, "Estimate not found");
    }

    await emitEstimateEvent(tx, {
      estimate: updatedEstimate,
      eventType: "estimate.sent",
      actorId: actor.id,
      actorName: buildActorName(actor.firstName, actor.lastName),
      summary: buildEstimateSummary(updatedEstimate.estimateNumber, "sent")
    });

    return updatedEstimate;
  });

  try {
    const { notificationsQueue } = await import("@fsm/jobs");
    await notificationsQueue.add(
      "send-estimate-email",
      {
        companyId,
        estimateId: sentEstimate.id,
        customerId: sentEstimate.customerId
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000
        }
      }
    );
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId,
        estimateId: sentEstimate.id
      },
      "Failed to enqueue estimate email notification"
    );
  }

  const rule = await findAutomationRule(companyId, "estimate_follow_up");

  if (rule) {
    const delayMs = (rule.delayHours ?? 24) * 60 * 60 * 1000;

    try {
      const { aiQueue } = await import("@fsm/jobs");
      await aiQueue.add(
        "estimate-follow-up-check",
        {
          companyId,
          estimateId: sentEstimate.id,
          customerId: sentEstimate.customerId
        },
        {
          attempts: 3,
          delay: delayMs,
          backoff: {
            type: "exponential",
            delay: 5000
          }
        }
      );
    } catch (error) {
      logger.error(
        {
          err: error,
          companyId,
          estimateId: sentEstimate.id
        },
        "Failed to enqueue estimate follow-up check"
      );
    }
  }

  return toEstimate(sentEstimate);
}

export async function approveEstimate(
  companyId: string,
  actorId: string,
  estimateId: string
): Promise<Estimate> {
  const existingEstimate = await getEstimateRecord(companyId, estimateId, db);
  assertEstimateIsAwaitingDecision(existingEstimate);

  return db.transaction(async (tx) => {
    const actor = await getUserRecord(companyId, actorId, tx);
    const now = new Date();
    const actorName = buildActorName(actor.firstName, actor.lastName);

    if (existingEstimate.tierGroupId) {
      await tx
        .update(estimates)
        .set({
          isSelectedTier: false,
          updatedAt: now
        })
        .where(
          and(
            eq(estimates.companyId, companyId),
            eq(estimates.tierGroupId, existingEstimate.tierGroupId),
            isNull(estimates.deletedAt)
          )
        )
        .returning();
    }

    const updatedEstimates = await tx
      .update(estimates)
      .set({
        status: "approved",
        ...(existingEstimate.tierGroupId ? { isSelectedTier: true } : {}),
        approvedAt: now,
        approvedByName: actorName,
        updatedAt: now
      })
      .where(and(eq(estimates.companyId, companyId), eq(estimates.id, estimateId), isNull(estimates.deletedAt)))
      .returning();
    const updatedEstimate = updatedEstimates[0];

    if (!updatedEstimate) {
      throw new AppError(ErrorCode.NOT_FOUND, "Estimate not found");
    }

    await emitEstimateEvent(tx, {
      estimate: updatedEstimate,
      eventType: "estimate.approved",
      actorId: actor.id,
      actorName,
      summary: buildEstimateSummary(updatedEstimate.estimateNumber, "approved"),
      ...(existingEstimate.tierGroupId
        ? {
            payload: {
              selectedEstimateNumber: updatedEstimate.estimateNumber,
              selectedTierLabel: updatedEstimate.tierLabel
            }
          }
        : {})
    });

    return toEstimate(updatedEstimate);
  });
}

export async function declineEstimate(
  companyId: string,
  actorId: string,
  estimateId: string,
  reason?: string
): Promise<Estimate> {
  const existingEstimate = await getEstimateRecord(companyId, estimateId, db);
  assertEstimateIsAwaitingDecision(existingEstimate);

  const declinedEstimate = await db.transaction(async (tx) => {
    const actor = await getUserRecord(companyId, actorId, tx);
    const now = new Date();
    const actorName = buildActorName(actor.firstName, actor.lastName);
    const updatedEstimates = await tx
      .update(estimates)
      .set({
        status: "declined",
        declinedAt: now,
        declineReason: normalizeOptionalString(reason) ?? null,
        updatedAt: now
      })
      .where(and(eq(estimates.companyId, companyId), eq(estimates.id, estimateId), isNull(estimates.deletedAt)))
      .returning();
    const updatedEstimate = updatedEstimates[0];

    if (!updatedEstimate) {
      throw new AppError(ErrorCode.NOT_FOUND, "Estimate not found");
    }

    await emitEstimateEvent(tx, {
      estimate: updatedEstimate,
      eventType: "estimate.declined",
      actorId: actor.id,
      actorName,
      summary: buildEstimateSummary(updatedEstimate.estimateNumber, "declined"),
      ...(reason ? { payload: { reason } } : {})
    });

    return updatedEstimate;
  });

  const rule = await findAutomationRule(companyId, "estimate_declined");

  if (rule) {
    try {
      const { aiQueue } = await import("@fsm/jobs");
      await aiQueue.add(
        "evaluate-revenue-opportunities",
        {
          companyId,
          estimateId: declinedEstimate.id,
          customerId: declinedEstimate.customerId,
          trigger: "estimate.declined"
        },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000
          }
        }
      );
    } catch (error) {
      logger.error(
        {
          err: error,
          companyId,
          estimateId: declinedEstimate.id
        },
        "Failed to enqueue estimate decline AI job"
      );
    }
  }

  return toEstimate(declinedEstimate);
}

export async function reviseEstimate(
  companyId: string,
  actorId: string,
  estimateId: string
): Promise<Estimate> {
  const existingEstimate = await getEstimateRecord(companyId, estimateId, db);

  if (existingEstimate.status === "converted" || existingEstimate.status === "revised") {
    throw new AppError(ErrorCode.CONFLICT, "Estimate cannot be revised");
  }

  return db.transaction(async (tx) => {
    const actor = await getUserRecord(companyId, actorId, tx);
    const currentItems = await getEstimateItems(companyId, estimateId, tx);
    const estimateNumber = await generateEstimateNumber(companyId, tx);
    const insertedEstimates = await tx
      .insert(estimates)
      .values({
        companyId,
        estimateNumber,
        jobId: existingEstimate.jobId,
        customerId: existingEstimate.customerId,
        propertyId: existingEstimate.propertyId,
        createdById: actor.id,
        status: "draft",
        tierLabel: existingEstimate.tierLabel,
        tierGroupId: existingEstimate.tierGroupId,
        isSelectedTier: existingEstimate.isSelectedTier,
        subtotal: existingEstimate.subtotal,
        taxRate: existingEstimate.taxRate,
        taxAmount: existingEstimate.taxAmount,
        discountAmount: existingEstimate.discountAmount,
        total: existingEstimate.total,
        title: existingEstimate.title,
        messageToCustomer: existingEstimate.messageToCustomer,
        internalNotes: existingEstimate.internalNotes,
        financingOffered: existingEstimate.financingOffered
      })
      .returning();
    const newEstimate = insertedEstimates[0];

    if (!newEstimate) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create estimate revision");
    }

    if (currentItems.length > 0) {
      await tx
        .insert(estimateItems)
        .values(
          currentItems.map((item) => ({
            companyId,
            estimateId: newEstimate.id,
            name: item.name,
            description: item.description,
            itemType: item.itemType,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            isTaxable: item.isTaxable,
            sortOrder: item.sortOrder ?? 0
          }))
        )
        .returning();
    }

    await recalculateTotals(newEstimate.id, tx);

    const updatedOriginals = await tx
      .update(estimates)
      .set({
        status: "revised",
        updatedAt: new Date()
      })
      .where(and(eq(estimates.companyId, companyId), eq(estimates.id, estimateId), isNull(estimates.deletedAt)))
      .returning();
    const updatedOriginal = updatedOriginals[0];

    if (!updatedOriginal) {
      throw new AppError(ErrorCode.NOT_FOUND, "Estimate not found");
    }

    await emitEstimateEvent(tx, {
      estimate: updatedOriginal,
      eventType: "estimate.revised",
      actorId: actor.id,
      actorName: buildActorName(actor.firstName, actor.lastName),
      summary: buildEstimateSummary(updatedOriginal.estimateNumber, "revised"),
      payload: {
        newEstimateId: newEstimate.id
      }
    });

    await emitEstimateEvent(tx, {
      estimate: newEstimate,
      eventType: "estimate.created",
      actorId: actor.id,
      actorName: buildActorName(actor.firstName, actor.lastName),
      summary: buildEstimateSummary(newEstimate.estimateNumber, "created")
    });

    return toEstimate(newEstimate);
  });
}

export async function convertToJob(
  companyId: string,
  actorId: string,
  estimateId: string
): Promise<Job> {
  const existingEstimate = await getEstimateRecord(companyId, estimateId, db);

  if (existingEstimate.status !== "approved") {
    throw new AppError(ErrorCode.CONFLICT, "Only approved estimates can be converted to jobs");
  }

  return db.transaction(async (tx) => {
    const actor = await getUserRecord(companyId, actorId, tx);
    const customer = await getCustomerRecord(companyId, existingEstimate.customerId, tx);
    const jobNumber = await generateJobNumber(companyId, tx);
    const insertedJobs = await tx
      .insert(jobs)
      .values({
        companyId,
        jobNumber,
        customerId: customer.id,
        propertyId: existingEstimate.propertyId,
        type: "service_call",
        priority: "normal",
        status: "lead",
        title: existingEstimate.title ?? `Estimate ${existingEstimate.estimateNumber}`,
        description: existingEstimate.messageToCustomer,
        estimateTotal: existingEstimate.total,
        parentJobId: existingEstimate.jobId
      })
      .returning();
    const createdJob = insertedJobs[0];

    if (!createdJob) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create job from estimate");
    }

    const updatedEstimates = await tx
      .update(estimates)
      .set({
        status: "converted",
        updatedAt: new Date()
      })
      .where(and(eq(estimates.companyId, companyId), eq(estimates.id, estimateId), isNull(estimates.deletedAt)))
      .returning();
    const updatedEstimate = updatedEstimates[0];

    if (!updatedEstimate) {
      throw new AppError(ErrorCode.NOT_FOUND, "Estimate not found");
    }

    const actorName = buildActorName(actor.firstName, actor.lastName);

    await emitEstimateEvent(tx, {
      estimate: updatedEstimate,
      eventType: "estimate.converted",
      actorId: actor.id,
      actorName,
      summary: buildEstimateSummary(updatedEstimate.estimateNumber, "converted"),
      payload: {
        jobId: createdJob.id
      }
    });

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "job.created",
      actorId: actor.id,
      actorName,
      entityType: "job",
      entityId: createdJob.id,
      customerId: createdJob.customerId,
      jobId: createdJob.id,
      payload: {
        estimateId: updatedEstimate.id
      },
      summary: `Job ${createdJob.jobNumber} created from estimate ${updatedEstimate.estimateNumber}`
    });

    return createdJob as Job;
  });
}

export async function getPublicEstimate(token: string): Promise<PublicEstimateView> {
  const existingEstimate = await getEstimateByToken(token, db);
  assertEstimateNotExpired(existingEstimate);

  let estimateForView = existingEstimate;

  if (!existingEstimate.viewedAt) {
    estimateForView = await db.transaction(async (tx) => {
      const viewedAt = new Date();
      const updatedEstimates = await tx
        .update(estimates)
        .set({
          viewedAt,
          status: existingEstimate.status === "sent" ? "viewed" : existingEstimate.status,
          updatedAt: viewedAt
        })
        .where(and(eq(estimates.id, existingEstimate.id), isNull(estimates.deletedAt)))
        .returning();
      const updatedEstimate = updatedEstimates[0];

      if (!updatedEstimate) {
        throw new AppError(ErrorCode.NOT_FOUND, "Estimate not found");
      }

      await emitEstimateEvent(tx, {
        estimate: updatedEstimate,
        eventType: "estimate.viewed",
        actorType: "customer",
        summary: buildEstimateSummary(updatedEstimate.estimateNumber, "viewed")
      });

      return updatedEstimate;
    });
  }

  return buildPublicEstimateView(estimateForView, db);
}

async function buildPublicEstimateSchedulingContext(
  estimate: EstimateRow,
  executor: SelectExecutor
): Promise<PublicEstimateSchedulingContext | null> {
  const [companyRows, settingsRows, customerRows, propertyRow] = await Promise.all([
    executor
      .select()
      .from(companies)
      .where(and(eq(companies.id, estimate.companyId), isNull(companies.deletedAt)))
      .limit(1),
    executor
      .select()
      .from(bookingSettings)
      .where(and(eq(bookingSettings.companyId, estimate.companyId), isNull(bookingSettings.deletedAt)))
      .limit(1),
    executor
      .select()
      .from(customers)
      .where(
        and(eq(customers.id, estimate.customerId), eq(customers.companyId, estimate.companyId), isNull(customers.deletedAt))
      )
      .limit(1),
    estimate.propertyId
      ? executor
          .select()
          .from(properties)
          .where(
            and(
              eq(properties.id, estimate.propertyId),
              eq(properties.companyId, estimate.companyId),
              isNull(properties.deletedAt)
            )
          )
          .limit(1)
      : Promise.resolve([])
  ]);

  const company = companyRows[0];
  const settings = settingsRows[0];
  const customer = customerRows[0];
  const property = propertyRow[0] ?? null;

  if (!company || !settings || !settings.isEnabled || !customer) {
    return null;
  }

  const bookingSlug = (settings.bookingSlug ?? company.slug).trim();
  if (bookingSlug.length === 0) {
    return null;
  }

  if (!property) {
    return null;
  }

  const zip = property.zip.trim();
  if (zip.length === 0) {
    return null;
  }

  const phone = customer.phone?.trim() ?? "";
  if (phone.length === 0) {
    return null;
  }

  return {
    companyName: company.name,
    bookingSlug,
    zip,
    customer: {
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone,
      email: customer.email
    },
    property: {
      addressLine1: property.addressLine1,
      addressLine2: property.addressLine2,
      city: property.city,
      state: property.state,
      zip: property.zip
    }
  };
}

export async function getPublicEstimateSchedulingContext(
  token: string,
  executor: SelectExecutor = db
): Promise<PublicEstimateSchedulingContext | null> {
  const estimate = await getEstimateByToken(token, executor);
  assertEstimateNotExpired(estimate);
  return buildPublicEstimateSchedulingContext(estimate, executor);
}

export async function customerApproveEstimate(
  token: string,
  approvedByName: string,
  signatureUrl?: string,
  selectedEstimateNumber?: string
): Promise<void> {
  const existingEstimate = await getEstimateByToken(token, db);
  assertEstimateNotExpired(existingEstimate);

  if (existingEstimate.status === "approved" || existingEstimate.status === "declined") {
    throw new AppError(ErrorCode.CONFLICT, "Estimate has already been actioned");
  }

  await db.transaction(async (tx) => {
    const selectedEstimate =
      selectedEstimateNumber && existingEstimate.tierGroupId
        ? await getEstimateByNumberAndTierGroup(
            existingEstimate.companyId,
            existingEstimate.tierGroupId,
            selectedEstimateNumber,
            tx
          )
        : existingEstimate;
    assertEstimateNotExpired(selectedEstimate);
    assertEstimateIsAwaitingDecision(selectedEstimate);
    const approvedAt = new Date();

    if (existingEstimate.tierGroupId) {
      await tx
        .update(estimates)
        .set({
          isSelectedTier: false,
          updatedAt: approvedAt
        })
        .where(
          and(
            eq(estimates.companyId, existingEstimate.companyId),
            eq(estimates.tierGroupId, existingEstimate.tierGroupId),
            isNull(estimates.deletedAt)
          )
        )
        .returning();
    }

    const updatedEstimates = await tx
      .update(estimates)
      .set({
        status: "approved",
        isSelectedTier: existingEstimate.tierGroupId ? true : selectedEstimate.isSelectedTier,
        approvedAt,
        approvedByName: approvedByName.trim(),
        approvedSignatureUrl: signatureUrl ?? null,
        viewedAt: selectedEstimate.viewedAt ?? existingEstimate.viewedAt ?? approvedAt,
        updatedAt: approvedAt
      })
      .where(and(eq(estimates.id, selectedEstimate.id), isNull(estimates.deletedAt)))
      .returning();
    const updatedEstimate = updatedEstimates[0];

    if (!updatedEstimate) {
      throw new AppError(ErrorCode.NOT_FOUND, "Estimate not found");
    }

    await emitEstimateEvent(tx, {
      estimate: updatedEstimate,
      eventType: "estimate.approved",
      actorType: "customer",
      actorName: approvedByName.trim(),
      summary: buildEstimateSummary(updatedEstimate.estimateNumber, "approved"),
      ...(existingEstimate.tierGroupId
        ? {
            payload: {
              selectedEstimateNumber: updatedEstimate.estimateNumber,
              selectedTierLabel: updatedEstimate.tierLabel
            }
          }
        : {})
    });
  });
}

export async function customerDeclineEstimate(
  token: string,
  reason?: string
): Promise<void> {
  const existingEstimate = await getEstimateByToken(token, db);
  assertEstimateNotExpired(existingEstimate);

  if (existingEstimate.status === "approved" || existingEstimate.status === "declined") {
    throw new AppError(ErrorCode.CONFLICT, "Estimate has already been actioned");
  }

  const declinedEstimate = await db.transaction(async (tx) => {
    const declinedAt = new Date();
    const updatedEstimates = await tx
      .update(estimates)
      .set({
        status: "declined",
        declinedAt,
        declineReason: normalizeOptionalString(reason) ?? null,
        viewedAt: existingEstimate.viewedAt ?? declinedAt,
        updatedAt: declinedAt
      })
      .where(and(eq(estimates.id, existingEstimate.id), isNull(estimates.deletedAt)))
      .returning();
    const updatedEstimate = updatedEstimates[0];

    if (!updatedEstimate) {
      throw new AppError(ErrorCode.NOT_FOUND, "Estimate not found");
    }

    await emitEstimateEvent(tx, {
      estimate: updatedEstimate,
      eventType: "estimate.declined",
      actorType: "customer",
      summary: buildEstimateSummary(updatedEstimate.estimateNumber, "declined"),
      ...(reason ? { payload: { reason } } : {})
    });

    return updatedEstimate;
  });

  const rule = await findAutomationRule(declinedEstimate.companyId, "estimate_declined");

  if (rule) {
    try {
      const { aiQueue } = await import("@fsm/jobs");
      await aiQueue.add(
        "evaluate-revenue-opportunities",
        {
          companyId: declinedEstimate.companyId,
          estimateId: declinedEstimate.id,
          customerId: declinedEstimate.customerId,
          trigger: "estimate.declined"
        },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000
          }
        }
      );
    } catch (error) {
      logger.error(
        {
          err: error,
          companyId: declinedEstimate.companyId,
          estimateId: declinedEstimate.id
        },
        "Failed to enqueue customer estimate decline AI job"
      );
    }
  }
}

export { listItems };
