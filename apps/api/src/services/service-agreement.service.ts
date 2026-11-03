import { randomUUID } from "node:crypto";

import { addMonths } from "date-fns";
import { and, eq, isNull } from "drizzle-orm";
import pino from "pino";

import {
  assets,
  automationRules,
  companies,
  customers,
  db,
  emitEventWithExecutor,
  jobs,
  maintenancePlans,
  maintenanceVisits,
  properties,
  serviceAgreementTemplates,
  users
} from "@fsm/db";
import { aiQueue } from "@fsm/jobs";
import {
  AppError,
  ErrorCode,
  type AgreementDetail,
  type AgreementListItem,
  type CancelAgreementInput,
  type CreateAgreementInput,
  type MaintenancePlan,
  type MaintenancePlanFrequency,
  type MaintenanceVisit,
  type ListAgreementsQuery,
  type PaginatedResult,
  type RecordVisitInput,
  type RetryAgreementPaymentResult,
  type ServiceAgreementStripeStatus,
  type ServiceAgreementBillingCycle,
  type UpdateAgreementInput
} from "@fsm/types";

import { computeRecurringServiceFee } from "../lib/recurring-service-fee.js";
import {
  cancelServiceAgreementSubscription,
  createServiceAgreementPrice,
  createServiceAgreementSubscription,
  createStripeCustomer,
  pauseServiceAgreementSubscription,
  retrieveServiceAgreementSubscriptionSnapshot,
  updateServiceAgreementSubscriptionCancelAtPeriodEnd
} from "../lib/stripe.js";

type AssetRow = typeof assets.$inferSelect;
type CompanyRow = typeof companies.$inferSelect;
type CustomerRow = typeof customers.$inferSelect;
type JobRow = typeof jobs.$inferSelect;
type MaintenancePlanRow = typeof maintenancePlans.$inferSelect;
type MaintenanceVisitRow = typeof maintenanceVisits.$inferSelect;
type PropertyRow = typeof properties.$inferSelect;
type ServiceAgreementTemplateRow = typeof serviceAgreementTemplates.$inferSelect;
type UserRow = typeof users.$inferSelect;
type SelectExecutor = Pick<typeof db, "select">;
type TransactionExecutor = Pick<typeof db, "select" | "insert" | "update">;

const logger = pino({
  name: "service-agreement-service"
});

const DEFAULT_LIST_PAGE = 1;
const DEFAULT_LIST_LIMIT = 25;
const MAX_LIST_LIMIT = 100;
const MAX_RESULT_WINDOW = 10_000;
const DEFAULT_CALENDAR_TIME_ZONE = "America/Chicago";

const STATUS_ORDER: MaintenancePlan["status"][] = ["active", "paused", "expired", "cancelled"];
const STRIPE_STATUS_VALUES: ServiceAgreementStripeStatus[] = [
  "active",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "past_due",
  "paused",
  "trialing",
  "unpaid"
];

interface AgreementStripeSnapshot {
  stripeStatus: ServiceAgreementStripeStatus | null;
  stripeCurrentPeriodEnd: Date | null;
  stripeCancelAtPeriodEnd: boolean;
  paymentMethodLabel: string | null;
  retryPaymentUrl: string | null;
  latestInvoiceAmountDue: string | null;
  latestInvoiceDueDate: string | null;
}

function buildActorName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

function normalizeOptionalString(value: string | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeSearchValue(value: string | undefined): string | null {
  const trimmedValue = value?.trim().toLowerCase() ?? "";
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeStringArray(values: string[] | undefined): string[] | undefined {
  if (values === undefined) {
    return undefined;
  }

  const normalizedValues: string[] = [];

  for (const value of values) {
    const trimmedValue = value.trim();

    if (trimmedValue.length === 0 || normalizedValues.includes(trimmedValue)) {
      continue;
    }

    normalizedValues.push(trimmedValue);
  }

  return normalizedValues;
}

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function formatCurrentLocalDateOnly(value: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_CALENDAR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  return formatter.format(value);
}

function compareNullableDateStrings(
  left: string | null,
  right: string | null,
  sortOrder: "asc" | "desc"
): number {
  if (!left && !right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  return sortOrder === "asc"
    ? parseDateOnly(left).getTime() - parseDateOnly(right).getTime()
    : parseDateOnly(right).getTime() - parseDateOnly(left).getTime();
}

function toStripeStatus(value: string | null | undefined): ServiceAgreementStripeStatus | null {
  if (!value) {
    return null;
  }

  return STRIPE_STATUS_VALUES.includes(value as ServiceAgreementStripeStatus)
    ? (value as ServiceAgreementStripeStatus)
    : null;
}

function buildFallbackStripeSnapshot(plan: MaintenancePlanRow): AgreementStripeSnapshot {
  return {
    stripeStatus: null,
    stripeCurrentPeriodEnd: plan.stripeCurrentPeriodEnd,
    stripeCancelAtPeriodEnd: plan.stripeCancelAtPeriodEnd ?? false,
    paymentMethodLabel: null,
    retryPaymentUrl: null,
    latestInvoiceAmountDue: null,
    latestInvoiceDueDate: null
  };
}

async function loadAgreementStripeSnapshot(plan: MaintenancePlanRow): Promise<AgreementStripeSnapshot> {
  if (!plan.stripeSubscriptionId) {
    return buildFallbackStripeSnapshot(plan);
  }

  try {
    const snapshot = await retrieveServiceAgreementSubscriptionSnapshot(plan.stripeSubscriptionId, {
      companyId: plan.companyId,
      agreementId: plan.id
    });

    return {
      stripeStatus: toStripeStatus(snapshot.status),
      stripeCurrentPeriodEnd: snapshot.currentPeriodEnd,
      stripeCancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
      paymentMethodLabel: snapshot.paymentMethodLabel,
      retryPaymentUrl: snapshot.retryPaymentUrl,
      latestInvoiceAmountDue: snapshot.latestInvoiceAmountDue,
      latestInvoiceDueDate: snapshot.latestInvoiceDueDate
    };
  } catch (error: unknown) {
    logger.error(
      {
        err: error,
        companyId: plan.companyId,
        agreementId: plan.id,
        stripeSubscriptionId: plan.stripeSubscriptionId
      },
      "Failed to load Stripe billing snapshot for service agreement"
    );

    return buildFallbackStripeSnapshot(plan);
  }
}

export function computeNextServiceDate(
  lastDate: Date,
  frequency: MaintenancePlanFrequency
): Date {
  const normalizedLastDate = new Date(
    Date.UTC(lastDate.getUTCFullYear(), lastDate.getUTCMonth(), lastDate.getUTCDate(), 12)
  );

  switch (frequency) {
    case "monthly":
      return addMonths(normalizedLastDate, 1);
    case "bi_monthly":
      return addMonths(normalizedLastDate, 2);
    case "quarterly":
      return addMonths(normalizedLastDate, 3);
    case "bi_annual":
      return addMonths(normalizedLastDate, 6);
    case "annual":
      return addMonths(normalizedLastDate, 12);
  }
}

function toMaintenancePlan(row: MaintenancePlanRow): MaintenancePlan {
  return {
    ...row,
    frequency: row.frequency as MaintenancePlan["frequency"],
    status: row.status as MaintenancePlan["status"],
    billingCycle: (row.billingCycle ?? null) as MaintenancePlan["billingCycle"]
  };
}

function toMaintenanceVisit(row: MaintenanceVisitRow): MaintenanceVisit {
  return {
    ...row
  };
}

async function getActor(companyId: string, actorId: string, executor: SelectExecutor): Promise<UserRow> {
  const [actor] = await executor
    .select()
    .from(users)
    .where(and(eq(users.companyId, companyId), eq(users.id, actorId), isNull(users.deletedAt)))
    .limit(1);

  if (!actor) {
    throw new AppError(ErrorCode.NOT_FOUND, "User not found");
  }

  return actor;
}

async function getCompanyRecord(companyId: string, executor: SelectExecutor): Promise<CompanyRow> {
  const [company] = await executor
    .select()
    .from(companies)
    .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
    .limit(1);

  if (!company) {
    throw new AppError(ErrorCode.NOT_FOUND, "Company not found");
  }

  return company;
}

async function getCustomerRecord(companyId: string, customerId: string, executor: SelectExecutor): Promise<CustomerRow> {
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

async function getPropertyRecord(companyId: string, propertyId: string, executor: SelectExecutor): Promise<PropertyRow> {
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

async function getAssetRecord(companyId: string, assetId: string, executor: SelectExecutor): Promise<AssetRow> {
  const [asset] = await executor
    .select()
    .from(assets)
    .where(and(eq(assets.companyId, companyId), eq(assets.id, assetId), isNull(assets.deletedAt)))
    .limit(1);

  if (!asset) {
    throw new AppError(ErrorCode.NOT_FOUND, "Asset not found");
  }

  return asset;
}

async function getJobRecord(companyId: string, jobId: string, executor: SelectExecutor): Promise<JobRow> {
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

async function getTemplateRecord(
  companyId: string,
  templateId: string,
  executor: SelectExecutor
): Promise<ServiceAgreementTemplateRow> {
  const [template] = await executor
    .select()
    .from(serviceAgreementTemplates)
    .where(
      and(
        eq(serviceAgreementTemplates.companyId, companyId),
        eq(serviceAgreementTemplates.id, templateId),
        isNull(serviceAgreementTemplates.deletedAt)
      )
    )
    .limit(1);

  if (!template) {
    throw new AppError(ErrorCode.NOT_FOUND, "Service agreement template not found");
  }

  return template;
}

async function getAgreementRecord(
  companyId: string,
  agreementId: string,
  executor: SelectExecutor
): Promise<MaintenancePlanRow> {
  const [agreement] = await executor
    .select()
    .from(maintenancePlans)
    .where(
      and(
        eq(maintenancePlans.companyId, companyId),
        eq(maintenancePlans.id, agreementId),
        isNull(maintenancePlans.deletedAt)
      )
    )
    .limit(1);

  if (!agreement) {
    throw new AppError(ErrorCode.NOT_FOUND, "Service agreement not found");
  }

  return agreement;
}

async function listPlanVisits(
  companyId: string,
  agreementId: string,
  executor: SelectExecutor
): Promise<MaintenanceVisitRow[]> {
  const rows = await executor
    .select()
    .from(maintenanceVisits)
    .where(
      and(
        eq(maintenanceVisits.companyId, companyId),
        eq(maintenanceVisits.maintenancePlanId, agreementId),
        isNull(maintenanceVisits.deletedAt)
      )
    );

  return rows.sort((left, right) => {
    if (left.completedDate && right.completedDate) {
      return right.completedDate.localeCompare(left.completedDate);
    }

    if (left.completedDate) {
      return -1;
    }

    if (right.completedDate) {
      return 1;
    }

    return right.createdAt.getTime() - left.createdAt.getTime();
  });
}

async function findAutomationRule(companyId: string) {
  return (
    await db.query.automationRules.findFirst({
      where: (table, operators) =>
        operators.and(
          operators.eq(table.companyId, companyId),
          operators.eq(table.ruleType, "service_agreement_renewal"),
          operators.eq(table.isEnabled, true),
          operators.isNull(table.deletedAt)
        )
    })
  ) ?? null;
}

function buildAgreementSummary(agreementName: string, eventLabel: string): string {
  return `Maintenance plan ${agreementName} ${eventLabel}`;
}

async function emitAgreementEvent(
  executor: TransactionExecutor,
  input: {
    agreement: MaintenancePlanRow;
    actorId?: string;
    actorName?: string | null;
    actorType?: "user" | "system";
    eventType: "maintenance_plan.created" | "maintenance_plan.updated" | "maintenance_plan.cancelled";
    summary: string;
    payload?: Record<string, unknown>;
  }
): Promise<void> {
  await emitEventWithExecutor(executor, {
    companyId: input.agreement.companyId,
    eventType: input.eventType,
    ...(input.actorId ? { actorId: input.actorId } : {}),
    ...(input.actorName ? { actorName: input.actorName } : {}),
    ...(input.actorType ? { actorType: input.actorType } : {}),
    entityType: "maintenance_plan",
    entityId: input.agreement.id,
    customerId: input.agreement.customerId,
    payload: input.payload ?? {},
    summary: input.summary
  });
}

function normalizeCreateAgreementInput(input: CreateAgreementInput) {
  return {
    customerId: input.customerId,
    serviceAgreementTemplateId: input.serviceAgreementTemplateId,
    propertyId: input.propertyId,
    name: input.name.trim(),
    description: normalizeOptionalString(input.description) ?? null,
    frequency: input.frequency,
    startDate: input.startDate,
    billingEnabled: input.billingEnabled ?? false,
    billingCycle: input.billingCycle,
    assetIds: normalizeStringArray(input.assetIds) ?? [],
    notes: normalizeOptionalString(input.notes) ?? null
  };
}

function normalizeUpdateAgreementInput(input: UpdateAgreementInput) {
  return {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.description !== undefined ? { description: normalizeOptionalString(input.description) ?? null } : {}),
    ...(input.notes !== undefined ? { notes: normalizeOptionalString(input.notes) ?? null } : {}),
    ...(input.nextServiceDate !== undefined ? { nextServiceDate: input.nextServiceDate } : {}),
    ...(input.assetIds !== undefined ? { assetIds: normalizeStringArray(input.assetIds) ?? [] } : {}),
    ...(input.frequency !== undefined ? { frequency: input.frequency } : {})
  };
}

function normalizeCancelAgreementInput(input: CancelAgreementInput) {
  return {
    cancelImmediately: input.cancelImmediately ?? false,
    reason: normalizeOptionalString(input.reason) ?? null
  };
}

function normalizeRecordVisitInput(input: RecordVisitInput) {
  return {
    completedDate: input.completedDate,
    jobId: input.jobId,
    notes: normalizeOptionalString(input.notes) ?? null
  };
}

function resolveTemplatePrice(
  template: ServiceAgreementTemplateRow,
  billingCycle: ServiceAgreementBillingCycle
): { price: string | null; stripePriceId: string | null } {
  if (billingCycle === "monthly") {
    return {
      price: template.monthlyPrice ?? null,
      stripePriceId: template.stripeMthlyPriceId ?? null
    };
  }

  return {
    price: template.annualPrice ?? null,
    stripePriceId: template.stripeAnnualPriceId ?? null
  };
}

function assertPropertyBelongsToCustomer(property: PropertyRow, customerId: string): void {
  if (property.customerId !== customerId) {
    throw new AppError(ErrorCode.CONFLICT, "Property does not belong to customer");
  }
}

function assertAssetBelongsToCustomer(asset: AssetRow, customerId: string): void {
  if (asset.customerId !== customerId) {
    throw new AppError(ErrorCode.CONFLICT, "Asset does not belong to customer");
  }
}

function assertAssetBelongsToProperty(asset: AssetRow, propertyId: string): void {
  if (asset.propertyId !== propertyId) {
    throw new AppError(ErrorCode.CONFLICT, "Asset does not belong to property");
  }
}

async function loadAssetsForPlan(
  companyId: string,
  customerId: string,
  propertyId: string | null,
  assetIds: string[],
  executor: SelectExecutor
): Promise<AssetRow[]> {
  const assetRecords: AssetRow[] = [];

  for (const assetId of assetIds) {
    const asset = await getAssetRecord(companyId, assetId, executor);
    assertAssetBelongsToCustomer(asset, customerId);

    if (propertyId) {
      assertAssetBelongsToProperty(asset, propertyId);
    }

    assetRecords.push(asset);
  }

  return assetRecords;
}

function matchesAgreementSearch(
  plan: MaintenancePlanRow,
  customer: CustomerRow | undefined,
  template: ServiceAgreementTemplateRow | undefined,
  search: string
): boolean {
  const customerName = customer
    ? `${customer.firstName} ${customer.lastName} ${customer.displayName ?? ""}`.toLowerCase()
    : "";
  const templateName = template?.name.toLowerCase() ?? "";

  return (
    plan.name.toLowerCase().includes(search) ||
    customerName.includes(search) ||
    templateName.includes(search)
  );
}

function toAgreementListItem(
  plan: MaintenancePlanRow,
  customer: CustomerRow,
  stripeSnapshot: AgreementStripeSnapshot
): AgreementListItem {
  return {
    id: plan.id,
    name: plan.name,
    status: plan.status as AgreementListItem["status"],
    frequency: plan.frequency as AgreementListItem["frequency"],
    nextServiceDate: plan.nextServiceDate,
    lastServiceDate: plan.lastServiceDate,
    price: plan.price,
    billingCycle: plan.price ? (plan.billingCycle as AgreementListItem["billingCycle"]) : null,
    stripeStatus: stripeSnapshot.stripeStatus,
    stripeCurrentPeriodEnd: stripeSnapshot.stripeCurrentPeriodEnd,
    stripeCancelAtPeriodEnd: stripeSnapshot.stripeCancelAtPeriodEnd,
    customer: {
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName
    },
    createdAt: plan.createdAt
  };
}

function toAgreementDetail(
  plan: MaintenancePlanRow,
  customer: CustomerRow,
  property: PropertyRow | null,
  template: ServiceAgreementTemplateRow | null,
  assetRecords: AssetRow[],
  visits: MaintenanceVisitRow[],
  stripeSnapshot: AgreementStripeSnapshot
): AgreementDetail {
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    status: plan.status as AgreementDetail["status"],
    frequency: plan.frequency as AgreementDetail["frequency"],
    startDate: plan.startDate,
    endDate: plan.endDate,
    nextServiceDate: plan.nextServiceDate,
    lastServiceDate: plan.lastServiceDate,
    price: plan.price,
    billingCycle: plan.price ? (plan.billingCycle as AgreementDetail["billingCycle"]) : null,
    stripeStatus: stripeSnapshot.stripeStatus,
    stripeCancelAtPeriodEnd: stripeSnapshot.stripeCancelAtPeriodEnd,
    stripeCurrentPeriodEnd: stripeSnapshot.stripeCurrentPeriodEnd,
    paymentMethodLabel: stripeSnapshot.paymentMethodLabel,
    retryPaymentUrl: stripeSnapshot.retryPaymentUrl,
    latestInvoiceAmountDue: stripeSnapshot.latestInvoiceAmountDue,
    latestInvoiceDueDate: stripeSnapshot.latestInvoiceDueDate,
    includedServices: plan.includedServices ?? [],
    notes: plan.notes,
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
    template: template
      ? {
          id: template.id,
          name: template.name,
          visitsPerYear: template.visitsPerYear,
          frequency: template.frequency as AgreementDetail["frequency"]
        }
      : null,
    assets: assetRecords.map((asset) => ({
      id: asset.id,
      name: asset.name,
      assetType: asset.assetType
    })),
    recentVisits: visits.slice(0, 5).flatMap((visit) => {
      if (!visit.completedDate) {
        return [];
      }

      return [
        {
          id: visit.id,
          completedDate: visit.completedDate,
          notes: visit.notes,
          jobId: visit.jobId
        }
      ];
    })
  };
}

export async function listAgreements(
  companyId: string,
  query: ListAgreementsQuery
): Promise<PaginatedResult<AgreementListItem>> {
  const page = query.page ?? DEFAULT_LIST_PAGE;
  const limit = Math.min(query.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
  const sortBy = query.sortBy ?? "nextServiceDate";
  const sortOrder = query.sortOrder ?? "asc";
  const search = normalizeSearchValue(query.search);
  const expiresAfter = query.expiresAfter ? parseDateOnly(query.expiresAfter) : null;
  const expiresBefore = query.expiresBefore ? parseDateOnly(query.expiresBefore) : null;
  const [rows, companyCustomers, companyTemplates] = await Promise.all([
    db
      .select()
      .from(maintenancePlans)
      .where(and(eq(maintenancePlans.companyId, companyId), isNull(maintenancePlans.deletedAt)))
      .limit(MAX_RESULT_WINDOW),
    db
      .select()
      .from(customers)
      .where(and(eq(customers.companyId, companyId), isNull(customers.deletedAt)))
      .limit(MAX_RESULT_WINDOW),
    search
      ? db
          .select()
          .from(serviceAgreementTemplates)
          .where(and(eq(serviceAgreementTemplates.companyId, companyId), isNull(serviceAgreementTemplates.deletedAt)))
          .limit(MAX_RESULT_WINDOW)
      : Promise.resolve([])
  ]);
  const customerMap = new Map(companyCustomers.map((customer) => [customer.id, customer]));
  const templateMap = new Map(companyTemplates.map((template) => [template.id, template]));

  const filteredRows = rows.filter((row) => {
    if (query.status && row.status !== query.status) {
      return false;
    }

    if (query.customerId && row.customerId !== query.customerId) {
      return false;
    }

    if (query.templateId && row.serviceAgreementTemplateId !== query.templateId) {
      return false;
    }

    if (expiresAfter) {
      if (!row.endDate || parseDateOnly(row.endDate).getTime() < expiresAfter.getTime()) {
        return false;
      }
    }

    if (expiresBefore) {
      if (!row.endDate || parseDateOnly(row.endDate).getTime() > expiresBefore.getTime()) {
        return false;
      }
    }

    if (search && !matchesAgreementSearch(
      row,
      customerMap.get(row.customerId),
      row.serviceAgreementTemplateId ? templateMap.get(row.serviceAgreementTemplateId) : undefined,
      search
    )) {
      return false;
    }

    return true;
  });

  const sortedRows = [...filteredRows].sort((left, right) => {
    if (sortBy === "status") {
      const leftIndex = STATUS_ORDER.indexOf(left.status as MaintenancePlan["status"]);
      const rightIndex = STATUS_ORDER.indexOf(right.status as MaintenancePlan["status"]);
      return sortOrder === "asc" ? leftIndex - rightIndex : rightIndex - leftIndex;
    }

    if (sortBy === "createdAt") {
      return sortOrder === "asc"
        ? left.createdAt.getTime() - right.createdAt.getTime()
        : right.createdAt.getTime() - left.createdAt.getTime();
    }

    return compareNullableDateStrings(left.nextServiceDate, right.nextServiceDate, sortOrder);
  });

  const total = sortedRows.length;
  const offset = (page - 1) * limit;
  const pagedRows = sortedRows.slice(offset, offset + limit);
  const data = (
    await Promise.all(
      pagedRows.map(async (row) => {
        const customer = customerMap.get(row.customerId);

        if (!customer) {
          return null;
        }

        const stripeSnapshot = await loadAgreementStripeSnapshot(row);
        return toAgreementListItem(row, customer, stripeSnapshot);
      })
    )
  ).flatMap((agreement) => (agreement ? [agreement] : []));

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

export async function getAgreement(companyId: string, agreementId: string): Promise<AgreementDetail> {
  const plan = await getAgreementRecord(companyId, agreementId, db);
  const [customer, property, template, visits, stripeSnapshot] = await Promise.all([
    getCustomerRecord(companyId, plan.customerId, db),
    plan.propertyId ? getPropertyRecord(companyId, plan.propertyId, db) : Promise.resolve(null),
    plan.serviceAgreementTemplateId
      ? getTemplateRecord(companyId, plan.serviceAgreementTemplateId, db).catch(() => null)
      : Promise.resolve(null),
    listPlanVisits(companyId, plan.id, db),
    loadAgreementStripeSnapshot(plan)
  ]);
  const assetRecords = await loadAssetsForPlan(companyId, plan.customerId, plan.propertyId, plan.assetIds ?? [], db);

  return toAgreementDetail(plan, customer, property, template, assetRecords, visits, stripeSnapshot);
}

export async function createAgreement(
  companyId: string,
  actorId: string,
  input: CreateAgreementInput
): Promise<MaintenancePlan> {
  const normalizedInput = normalizeCreateAgreementInput(input);
  const planId = randomUUID();
  const [company, customer, template, property] = await Promise.all([
    getCompanyRecord(companyId, db),
    getCustomerRecord(companyId, normalizedInput.customerId, db),
    normalizedInput.serviceAgreementTemplateId
      ? getTemplateRecord(companyId, normalizedInput.serviceAgreementTemplateId, db)
      : Promise.resolve(null),
    normalizedInput.propertyId ? getPropertyRecord(companyId, normalizedInput.propertyId, db) : Promise.resolve(null)
  ]);

  if (property) {
    assertPropertyBelongsToCustomer(property, customer.id);
  }

  await loadAssetsForPlan(companyId, customer.id, property?.id ?? null, normalizedInput.assetIds, db);

  let stripeCustomerId = customer.stripeCustomerId;
  let stripeSubscriptionId: string | null = null;
  let stripePriceId: string | null = null;
  let stripeCurrentPeriodStart: Date | null = null;
  let stripeCurrentPeriodEnd: Date | null = null;
  let stripeCancelAtPeriodEnd = false;
  const billingCycle = normalizedInput.billingEnabled ? normalizedInput.billingCycle ?? null : null;
  let resolvedPrice: string | null = null;

  if (billingCycle && template) {
    const resolvedTemplatePrice = resolveTemplatePrice(template, billingCycle);
    resolvedPrice = resolvedTemplatePrice.price;
    stripePriceId = resolvedTemplatePrice.stripePriceId;
  }

  if (normalizedInput.billingEnabled) {
    if (!billingCycle) {
      throw new AppError(ErrorCode.CONFLICT, "Billing cycle is required when billing is enabled");
    }

    if (!template) {
      throw new AppError(ErrorCode.CONFLICT, "Billing requires a template with Stripe pricing");
    }

    if (!company.stripeAccountId) {
      throw new AppError(ErrorCode.CONFLICT, "Stripe Connect not configured");
    }

    if (!stripePriceId) {
      throw new AppError(ErrorCode.CONFLICT, "Stripe price not configured for selected billing cycle");
    }

    if (!stripeCustomerId) {
      stripeCustomerId = (await createStripeCustomer({
        companyId,
        customerId: customer.id,
        email: customer.email,
        name: `${customer.firstName} ${customer.lastName}`.trim()
      })).id;
    }

    const serviceFee = resolvedPrice ? computeRecurringServiceFee(company, resolvedPrice) : null;
    let stripePlatformFeePriceId: string | null = null;

    if (serviceFee && serviceFee.serviceFeeCents > 0) {
      const interval = billingCycle === "monthly" ? "month" : "year";
      stripePlatformFeePriceId = (
        await createServiceAgreementPrice({
          companyId,
          templateId: template.id,
          name: template.name,
          productName: serviceFee.lineItemName,
          amount: serviceFee.serviceFeeAmount,
          interval
        })
      ).id;
    }

    const subscription = await createServiceAgreementSubscription({
      companyId,
      planId,
      customerId: customer.id,
      stripeCustomerId,
      stripePriceId,
      stripePlatformFeePriceId,
      companyStripeAccountId: company.stripeAccountId,
      applicationFeePercent: stripePlatformFeePriceId ? serviceFee?.applicationFeePercent ?? null : null
    });
    stripeSubscriptionId = subscription.id;
    stripeCurrentPeriodStart = subscription.currentPeriodStart;
    stripeCurrentPeriodEnd = subscription.currentPeriodEnd;
    stripeCancelAtPeriodEnd = subscription.cancelAtPeriodEnd;
  }

  const nextServiceDate = formatDateOnly(
    computeNextServiceDate(parseDateOnly(normalizedInput.startDate), normalizedInput.frequency)
  );

  try {
    const createdPlan = await db.transaction(async (tx) => {
      const actor = await getActor(companyId, actorId, tx);

      if (stripeCustomerId && customer.stripeCustomerId !== stripeCustomerId) {
        await tx
          .update(customers)
          .set({
            stripeCustomerId,
            updatedAt: new Date()
          })
          .where(and(eq(customers.companyId, companyId), eq(customers.id, customer.id), isNull(customers.deletedAt)))
          .returning();
      }

      const insertedPlans = await tx
        .insert(maintenancePlans)
        .values({
          id: planId,
          companyId,
          customerId: customer.id,
          propertyId: property?.id ?? null,
          serviceAgreementTemplateId: template?.id ?? null,
          name: normalizedInput.name,
          description: normalizedInput.description ?? template?.description ?? null,
          includedServices: template?.includedServices ?? [],
          frequency: normalizedInput.frequency,
          status: "active",
          price: resolvedPrice,
          billingCycle,
          stripeSubscriptionId,
          stripePriceId,
          stripeCurrentPeriodStart,
          stripeCurrentPeriodEnd,
          stripeCancelAtPeriodEnd,
          startDate: normalizedInput.startDate,
          nextServiceDate,
          assetIds: normalizedInput.assetIds,
          notes: normalizedInput.notes
        })
        .returning();
      const agreement = insertedPlans[0];

      if (!agreement) {
        throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create service agreement");
      }

      await emitAgreementEvent(tx, {
        agreement,
        actorId: actor.id,
        actorName: buildActorName(actor.firstName, actor.lastName),
        eventType: "maintenance_plan.created",
        summary: buildAgreementSummary(agreement.name, "created")
      });

      return agreement;
    });

    return toMaintenancePlan(createdPlan);
  } catch (error) {
    if (stripeSubscriptionId) {
      try {
        await cancelServiceAgreementSubscription(stripeSubscriptionId);
      } catch (cleanupError: unknown) {
        logger.error({ err: cleanupError, companyId, planId, stripeSubscriptionId }, "Failed to cancel Stripe subscription after create agreement error");
      }
    }

    throw error;
  }
}

export async function updateAgreement(
  companyId: string,
  actorId: string,
  agreementId: string,
  input: UpdateAgreementInput
): Promise<MaintenancePlan> {
  const existingAgreement = await getAgreementRecord(companyId, agreementId, db);
  const normalizedInput = normalizeUpdateAgreementInput(input);

  if (normalizedInput.assetIds !== undefined) {
    await loadAssetsForPlan(
      companyId,
      existingAgreement.customerId,
      existingAgreement.propertyId,
      normalizedInput.assetIds,
      db
    );
  }

  const recomputedNextServiceDate =
    normalizedInput.frequency !== undefined && normalizedInput.nextServiceDate === undefined
      ? formatDateOnly(
          computeNextServiceDate(
            parseDateOnly(existingAgreement.lastServiceDate ?? existingAgreement.startDate),
            normalizedInput.frequency
          )
        )
      : undefined;

  const updatedAgreement = await db.transaction(async (tx) => {
    const actor = await getActor(companyId, actorId, tx);
    const updatedPlans = await tx
      .update(maintenancePlans)
      .set({
        ...(normalizedInput.name !== undefined ? { name: normalizedInput.name } : {}),
        ...(normalizedInput.description !== undefined ? { description: normalizedInput.description } : {}),
        ...(normalizedInput.notes !== undefined ? { notes: normalizedInput.notes } : {}),
        ...(normalizedInput.nextServiceDate !== undefined ? { nextServiceDate: normalizedInput.nextServiceDate } : {}),
        ...(normalizedInput.assetIds !== undefined ? { assetIds: normalizedInput.assetIds } : {}),
        ...(normalizedInput.frequency !== undefined ? { frequency: normalizedInput.frequency } : {}),
        ...(recomputedNextServiceDate !== undefined ? { nextServiceDate: recomputedNextServiceDate } : {}),
        updatedAt: new Date()
      })
      .where(
        and(
          eq(maintenancePlans.companyId, companyId),
          eq(maintenancePlans.id, agreementId),
          isNull(maintenancePlans.deletedAt)
        )
      )
      .returning();
    const agreement = updatedPlans[0];

    if (!agreement) {
      throw new AppError(ErrorCode.NOT_FOUND, "Service agreement not found");
    }

    await emitAgreementEvent(tx, {
      agreement,
      actorId: actor.id,
      actorName: buildActorName(actor.firstName, actor.lastName),
      eventType: "maintenance_plan.updated",
      summary: buildAgreementSummary(agreement.name, "updated")
    });

    return agreement;
  });

  return toMaintenancePlan(updatedAgreement);
}

export async function cancelAgreement(
  companyId: string,
  actorId: string,
  agreementId: string,
  input: CancelAgreementInput
): Promise<MaintenancePlan> {
  const existingAgreement = await getAgreementRecord(companyId, agreementId, db);
  const normalizedInput = normalizeCancelAgreementInput(input);

  if (!["active", "paused"].includes(existingAgreement.status)) {
    throw new AppError(ErrorCode.CONFLICT, "Service agreement cannot be cancelled");
  }

  const shouldCancelImmediately = normalizedInput.cancelImmediately || !existingAgreement.stripeSubscriptionId;
  let stripeCurrentPeriodEnd = existingAgreement.stripeCurrentPeriodEnd;
  let stripeCancelAtPeriodEnd = existingAgreement.stripeCancelAtPeriodEnd ?? false;

  if (existingAgreement.stripeSubscriptionId) {
    if (shouldCancelImmediately) {
      const subscription = await cancelServiceAgreementSubscription(existingAgreement.stripeSubscriptionId);
      stripeCurrentPeriodEnd = subscription.currentPeriodEnd;
      stripeCancelAtPeriodEnd = subscription.cancelAtPeriodEnd;
    } else {
      const subscription = await updateServiceAgreementSubscriptionCancelAtPeriodEnd(
        existingAgreement.stripeSubscriptionId,
        true
      );
      stripeCurrentPeriodEnd = subscription.currentPeriodEnd;
      stripeCancelAtPeriodEnd = subscription.cancelAtPeriodEnd;
    }
  }

  const cancelledAgreement = await db.transaction(async (tx) => {
    const actor = await getActor(companyId, actorId, tx);
      const updatedPlans = await tx
        .update(maintenancePlans)
        .set({
          ...(shouldCancelImmediately
            ? {
                status: "cancelled",
                endDate: formatDateOnly(stripeCurrentPeriodEnd ?? new Date())
              }
            : {}),
          ...(existingAgreement.stripeSubscriptionId ? { stripeCancelAtPeriodEnd } : { stripeCancelAtPeriodEnd: false }),
          ...(stripeCurrentPeriodEnd ? { stripeCurrentPeriodEnd } : {}),
          updatedAt: new Date()
        })
      .where(
        and(
          eq(maintenancePlans.companyId, companyId),
          eq(maintenancePlans.id, agreementId),
          isNull(maintenancePlans.deletedAt)
        )
      )
      .returning();
    const agreement = updatedPlans[0];

    if (!agreement) {
      throw new AppError(ErrorCode.NOT_FOUND, "Service agreement not found");
    }

    await emitAgreementEvent(tx, {
      agreement,
      actorId: actor.id,
      actorName: buildActorName(actor.firstName, actor.lastName),
      eventType: "maintenance_plan.cancelled",
      summary: shouldCancelImmediately
        ? buildAgreementSummary(agreement.name, "cancelled")
        : `Maintenance plan ${agreement.name} cancellation requested`,
      payload: {
        cancelImmediately: shouldCancelImmediately,
        reason: normalizedInput.reason,
        stripeSubscriptionId: agreement.stripeSubscriptionId
      }
    });

    return agreement;
  });

  const rule = await findAutomationRule(companyId);

  if (rule) {
    try {
      await aiQueue.add(
        "evaluate-revenue-opportunities",
        {
          companyId,
          planId: cancelledAgreement.id,
          customerId: cancelledAgreement.customerId,
          trigger: "plan.cancelled"
        },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000
          }
        }
      );
    } catch (error: unknown) {
      logger.error({ err: error, companyId, agreementId }, "Failed to enqueue service agreement AI evaluation");
    }
  }

  return toMaintenancePlan(cancelledAgreement);
}

export async function pauseAgreement(
  companyId: string,
  actorId: string,
  agreementId: string
): Promise<MaintenancePlan> {
  const existingAgreement = await getAgreementRecord(companyId, agreementId, db);

  if (existingAgreement.status !== "active") {
    throw new AppError(ErrorCode.CONFLICT, "Only active service agreements can be paused");
  }

  let stripeCurrentPeriodEnd = existingAgreement.stripeCurrentPeriodEnd;
  let stripeCancelAtPeriodEnd = existingAgreement.stripeCancelAtPeriodEnd ?? false;

  if (existingAgreement.stripeSubscriptionId) {
    const subscription = await pauseServiceAgreementSubscription(existingAgreement.stripeSubscriptionId);
    stripeCurrentPeriodEnd = subscription.currentPeriodEnd;
    stripeCancelAtPeriodEnd = subscription.cancelAtPeriodEnd;
  }

  const pausedAgreement = await db.transaction(async (tx) => {
    const actor = await getActor(companyId, actorId, tx);
    const updatedPlans = await tx
      .update(maintenancePlans)
      .set({
        status: "paused",
        ...(stripeCurrentPeriodEnd ? { stripeCurrentPeriodEnd } : {}),
        stripeCancelAtPeriodEnd,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(maintenancePlans.companyId, companyId),
          eq(maintenancePlans.id, agreementId),
          isNull(maintenancePlans.deletedAt)
        )
      )
      .returning();
    const agreement = updatedPlans[0];

    if (!agreement) {
      throw new AppError(ErrorCode.NOT_FOUND, "Service agreement not found");
    }

    await emitAgreementEvent(tx, {
      agreement,
      actorId: actor.id,
      actorName: buildActorName(actor.firstName, actor.lastName),
      eventType: "maintenance_plan.updated",
      summary: `Maintenance plan ${agreement.name} paused`,
      payload: {
        status: "paused",
        stripeSubscriptionId: agreement.stripeSubscriptionId
      }
    });

    return agreement;
  });

  return toMaintenancePlan(pausedAgreement);
}

export async function retryAgreementPayment(
  companyId: string,
  agreementId: string
): Promise<RetryAgreementPaymentResult> {
  const agreement = await getAgreementRecord(companyId, agreementId, db);

  if (!agreement.stripeSubscriptionId) {
    throw new AppError(ErrorCode.CONFLICT, "Retry payment is unavailable for this agreement");
  }

  const stripeSnapshot = await retrieveServiceAgreementSubscriptionSnapshot(agreement.stripeSubscriptionId, {
    companyId: agreement.companyId,
    agreementId: agreement.id
  });

  if (!stripeSnapshot.retryPaymentUrl) {
    throw new AppError(ErrorCode.CONFLICT, "No retry payment link is currently available");
  }

  return {
    retryPaymentUrl: stripeSnapshot.retryPaymentUrl
  };
}

export async function recordVisit(
  companyId: string,
  actorId: string,
  agreementId: string,
  input: RecordVisitInput
): Promise<MaintenanceVisit> {
  const agreement = await getAgreementRecord(companyId, agreementId, db);

  if (agreement.status !== "active") {
    throw new AppError(ErrorCode.CONFLICT, "Only active plans can record visits");
  }

  const normalizedInput = normalizeRecordVisitInput(input);
  const nextServiceDate = formatDateOnly(
    computeNextServiceDate(parseDateOnly(normalizedInput.completedDate), agreement.frequency as MaintenancePlanFrequency)
  );
  const job = normalizedInput.jobId ? await getJobRecord(companyId, normalizedInput.jobId, db) : null;

  if (job && job.customerId !== agreement.customerId) {
    throw new AppError(ErrorCode.CONFLICT, "Job does not belong to plan customer");
  }

  const visit = await db.transaction(async (tx) => {
    const actor = await getActor(companyId, actorId, tx);
    const insertedVisits = await tx
      .insert(maintenanceVisits)
      .values({
        companyId,
        maintenancePlanId: agreement.id,
        jobId: job?.id ?? null,
        completedDate: normalizedInput.completedDate,
        notes: normalizedInput.notes
      })
      .returning();
    const createdVisit = insertedVisits[0];

    if (!createdVisit) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to record maintenance visit");
    }

    await tx
      .update(maintenancePlans)
      .set({
        lastServiceDate: normalizedInput.completedDate,
        nextServiceDate,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(maintenancePlans.companyId, companyId),
          eq(maintenancePlans.id, agreement.id),
          isNull(maintenancePlans.deletedAt)
        )
      )
      .returning();

    if (job?.assetId) {
      await tx
        .update(assets)
        .set({
          lastServiceDate: normalizedInput.completedDate,
          nextServiceDate,
          updatedAt: new Date()
        })
        .where(and(eq(assets.companyId, companyId), eq(assets.id, job.assetId), isNull(assets.deletedAt)))
        .returning();
    }

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "maintenance_visit.completed",
      actorId: actor.id,
      actorName: buildActorName(actor.firstName, actor.lastName),
      entityType: "maintenance_visit",
      entityId: createdVisit.id,
      customerId: agreement.customerId,
      ...(job ? { jobId: job.id } : {}),
      payload: {
        maintenancePlanId: agreement.id,
        completedDate: normalizedInput.completedDate,
        nextServiceDate
      },
      summary: `Completed maintenance visit for ${agreement.name}`
    });

    return createdVisit;
  });

  return toMaintenanceVisit(visit);
}

export async function listVisits(companyId: string, agreementId: string): Promise<MaintenanceVisit[]> {
  await getAgreementRecord(companyId, agreementId, db);
  const visits = await listPlanVisits(companyId, agreementId, db);
  return visits.map((visit) => toMaintenanceVisit(visit));
}
