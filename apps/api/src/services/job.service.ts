import { and, desc, eq, isNull } from "drizzle-orm";
import pino from "pino";

import {
  activityEvents,
  assets,
  customers,
  db,
  type EmitEventContext,
  emitEventWithExecutor,
  jobNotes,
  jobPhotos,
  jobs,
  properties,
  scheduleSlots,
  technicians,
  users
} from "@fsm/db";
import { aiQueue } from "@fsm/jobs";

import { enqueuePostJobLoyaltyReminderEvaluation } from "./loyalty-reminder-post-job.service.js";
import {
  AppError,
  ErrorCode,
  type ActivityEvent,
  type AddNoteInput,
  type AddPhotoInput,
  type CompleteJobInput,
  type CreateJobInput,
  type Job,
  type JobDetail,
  type JobListItem,
  type JobNote,
  type JobPhoto,
  type JobPriority,
  type JobStatus,
  type JobTechnicianSummary,
  type ListJobsQuery,
  type PaginatedResult,
  type ScheduleJobInput,
  type UpdateJobInput
} from "@fsm/types";

import { generateJobNumber } from "../lib/job-number.js";
import { runTenantAwareTransaction } from "../lib/company-scoped-transaction.js";
import { enforceJobCreationPlanLimit } from "../lib/plan-usage-limits.js";
import {
  canTransition,
  getAvailableTransitions,
  transition as applyTransition
} from "../lib/job-state-machine.js";
import { trackConversion } from "./campaign.service.js";
import { invalidateDispatchCache } from "./dispatch.service.js";

const DEFAULT_LIST_PAGE = 1;
const DEFAULT_LIST_LIMIT = 25;
const MAX_LIST_LIMIT = 100;
const MAX_RESULT_WINDOW = 10_000;
const DEFAULT_LIST_SORT_BY = "scheduledStart";
const DEFAULT_LIST_SORT_ORDER = "asc";
const DEFAULT_JOB_TYPE = "service_call";
const DEFAULT_JOB_PRIORITY = "normal";
const DEFAULT_PHOTO_TYPE = "general";

const PRIORITY_ORDER: JobPriority[] = ["low", "normal", "high", "urgent"];
const STATUS_ORDER: JobStatus[] = [
  "lead",
  "estimate_requested",
  "estimate_sent",
  "estimate_approved",
  "scheduled",
  "dispatched",
  "in_progress",
  "on_hold",
  "completed",
  "invoiced",
  "paid",
  "cancelled",
  "closed"
];

type CustomerRow = typeof customers.$inferSelect;
type PropertyRow = typeof properties.$inferSelect;
type AssetRow = typeof assets.$inferSelect;
type JobRow = typeof jobs.$inferSelect;
type JobNoteRow = typeof jobNotes.$inferSelect;
type JobPhotoRow = typeof jobPhotos.$inferSelect;
type TechnicianRow = typeof technicians.$inferSelect;
type UserRow = typeof users.$inferSelect;
type ScheduleSlotRow = typeof scheduleSlots.$inferSelect;
type ActivityEventRow = typeof activityEvents.$inferSelect;
type SelectExecutor = Pick<typeof db, "select">;
type TransactionExecutor = Pick<typeof db, "select" | "insert" | "update">;

type NormalizedListJobsQuery = {
  status: JobStatus[];
  technicianId?: string;
  customerId?: string;
  propertyId?: string;
  assetId?: string;
  type?: CreateJobInput["type"];
  priority?: CreateJobInput["priority"];
  scheduledAfter?: Date;
  scheduledBefore?: Date;
  search?: string;
  sortBy: NonNullable<ListJobsQuery["sortBy"]>;
  sortOrder: NonNullable<ListJobsQuery["sortOrder"]>;
  page: number;
  limit: number;
};

type TransitionEventType =
  | "job.updated"
  | "job.scheduled"
  | "job.dispatched"
  | "job.started"
  | "job.paused"
  | "job.cancelled"
  | "job.closed"
  | "job.reopened";

const logger = pino({ name: "job-service" });

function buildActorName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

function normalizeOptionalString(value: string | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeStringArray(values: string[] | undefined): string[] | undefined {
  if (values === undefined) {
    return undefined;
  }

  const normalizedValues: string[] = [];

  for (const value of values) {
    const normalizedValue = value.trim();

    if (normalizedValue.length === 0 || normalizedValues.includes(normalizedValue)) {
      continue;
    }

    normalizedValues.push(normalizedValue);
  }

  return normalizedValues;
}

function parseIsoDateTime(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  return new Date(value);
}

function calculateDurationMinutes(start: Date | null, end: Date | null): number | null {
  if (!start || !end) {
    return null;
  }

  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
}

function compareNullableDates(
  left: Date | null,
  right: Date | null,
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
    ? left.getTime() - right.getTime()
    : right.getTime() - left.getTime();
}

function compareDates(left: Date, right: Date, sortOrder: "asc" | "desc"): number {
  return sortOrder === "asc"
    ? left.getTime() - right.getTime()
    : right.getTime() - left.getTime();
}

function compareRankedValues(
  left: string,
  right: string,
  order: readonly string[],
  sortOrder: "asc" | "desc"
): number {
  const leftIndex = order.indexOf(left);
  const rightIndex = order.indexOf(right);

  return sortOrder === "asc" ? leftIndex - rightIndex : rightIndex - leftIndex;
}

function formatDateOnly(dateValue: Date): string {
  return dateValue.toISOString().slice(0, 10);
}

async function invalidateDispatchDates(
  companyId: string,
  ...dates: Array<Date | null | undefined>
): Promise<void> {
  const uniqueDates = [...new Set(dates.flatMap((dateValue) => (dateValue ? [formatDateOnly(dateValue)] : [])))];

  for (const date of uniqueDates) {
    await invalidateDispatchCache(companyId, date);
  }
}

function addMoneyStrings(leftValue: string | null, rightValue: string | null): string {
  const leftCents = toCents(leftValue);
  const rightCents = toCents(rightValue);

  return fromCents(leftCents + rightCents);
}

function toCents(value: string | null): number {
  if (!value) {
    return 0;
  }

  const [rawWhole, rawFraction = ""] = value.split(".");
  const whole = Number.parseInt(rawWhole ?? "0", 10);
  const fraction = Number.parseInt(rawFraction.padEnd(2, "0").slice(0, 2), 10);

  if (!Number.isFinite(whole) || !Number.isFinite(fraction)) {
    return 0;
  }

  return whole * 100 + (whole >= 0 ? fraction : -fraction);
}

function fromCents(value: number): string {
  const sign = value < 0 ? "-" : "";
  const absoluteValue = Math.abs(value);
  const whole = Math.floor(absoluteValue / 100);
  const cents = absoluteValue % 100;

  return `${sign}${whole}.${String(cents).padStart(2, "0")}`;
}

function normalizeListJobsQuery(query: ListJobsQuery): NormalizedListJobsQuery {
  const normalizedStatus =
    query.status === undefined
      ? []
      : Array.isArray(query.status)
        ? query.status
        : [query.status];
  const scheduledAfter = parseIsoDateTime(query.scheduledAfter);
  const scheduledBefore = parseIsoDateTime(query.scheduledBefore);
  const normalizedSearch = normalizeOptionalString(query.search)?.toLowerCase();

  return {
    status: normalizedStatus,
    ...(query.technicianId ? { technicianId: query.technicianId } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.propertyId ? { propertyId: query.propertyId } : {}),
    ...(query.assetId ? { assetId: query.assetId } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(scheduledAfter ? { scheduledAfter } : {}),
    ...(scheduledBefore ? { scheduledBefore } : {}),
    ...(normalizedSearch ? { search: normalizedSearch } : {}),
    sortBy: query.sortBy ?? DEFAULT_LIST_SORT_BY,
    sortOrder: query.sortOrder ?? DEFAULT_LIST_SORT_ORDER,
    page: query.page ?? DEFAULT_LIST_PAGE,
    limit: Math.min(query.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT)
  };
}

function normalizeCreateJobInput(input: CreateJobInput) {
  const scheduledStart = parseIsoDateTime(input.scheduledStart);
  const scheduledEnd = parseIsoDateTime(input.scheduledEnd);

  return {
    customerId: input.customerId,
    propertyId: input.propertyId,
    assetId: input.assetId,
    technicianId: input.technicianId,
    type: input.type ?? DEFAULT_JOB_TYPE,
    priority: input.priority ?? DEFAULT_JOB_PRIORITY,
    title: input.title.trim(),
    description: normalizeOptionalString(input.description) ?? null,
    leadSource: normalizeOptionalString(input.leadSource) ?? null,
    tags: normalizeStringArray(input.tags) ?? [],
    scheduledStart,
    scheduledEnd,
    scheduledDurationMinutes: calculateDurationMinutes(scheduledStart, scheduledEnd)
  };
}

function normalizeUpdateJobInput(input: UpdateJobInput) {
  return {
    title: input.title !== undefined ? input.title.trim() : undefined,
    description: input.description !== undefined ? normalizeOptionalString(input.description) ?? null : undefined,
    type: input.type,
    priority: input.priority,
    tags: input.tags !== undefined ? normalizeStringArray(input.tags) ?? [] : undefined,
    techNotes: input.techNotes !== undefined ? normalizeOptionalString(input.techNotes) ?? null : undefined,
    technicianId: input.technicianId,
    scheduledStart: input.scheduledStart,
    scheduledEnd: input.scheduledEnd
  };
}

function normalizeScheduleJobInput(input: ScheduleJobInput) {
  const scheduledStart = new Date(input.scheduledStart);
  const scheduledEnd = new Date(input.scheduledEnd);

  return {
    scheduledStart,
    scheduledEnd,
    scheduledDurationMinutes: calculateDurationMinutes(scheduledStart, scheduledEnd)
  };
}

function normalizeCompleteJobInput(input: CompleteJobInput) {
  return {
    completionNotes: normalizeOptionalString(input.completionNotes) ?? null,
    signatureUrl: normalizeOptionalString(input.signatureUrl) ?? null,
    signedByName: normalizeOptionalString(input.signedByName) ?? null,
    signedAt: parseIsoDateTime(input.signedAt)
  };
}

function normalizeAddNoteInput(input: AddNoteInput) {
  return {
    content: input.content.trim(),
    isInternal: input.isInternal ?? true
  };
}

function normalizeAddPhotoInput(input: AddPhotoInput) {
  return {
    url: input.url.trim(),
    thumbnailUrl: normalizeOptionalString(input.thumbnailUrl) ?? null,
    caption: normalizeOptionalString(input.caption) ?? null,
    photoType: input.photoType ?? DEFAULT_PHOTO_TYPE,
    takenAt: parseIsoDateTime(input.takenAt)
  };
}

async function getActor(companyId: string, actorId: string, executor: SelectExecutor): Promise<UserRow | null> {
  const [actor] = await executor
    .select()
    .from(users)
    .where(and(eq(users.companyId, companyId), eq(users.id, actorId), isNull(users.deletedAt)))
    .limit(1);

  return actor ?? null;
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

async function getTechnicianRecord(
  companyId: string,
  technicianId: string,
  executor: SelectExecutor
): Promise<TechnicianRow> {
  const [technician] = await executor
    .select()
    .from(technicians)
    .where(and(eq(technicians.companyId, companyId), eq(technicians.id, technicianId), isNull(technicians.deletedAt)))
    .limit(1);

  if (!technician) {
    throw new AppError(ErrorCode.NOT_FOUND, "Technician not found");
  }

  return technician;
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

async function listCompanyJobs(companyId: string, executor: SelectExecutor): Promise<JobRow[]> {
  return executor
    .select()
    .from(jobs)
    .where(and(eq(jobs.companyId, companyId), isNull(jobs.deletedAt)))
    .limit(MAX_RESULT_WINDOW);
}

async function listCompanyJobNotes(companyId: string, jobId: string, executor: SelectExecutor): Promise<JobNoteRow[]> {
  return executor
    .select()
    .from(jobNotes)
    .where(and(eq(jobNotes.companyId, companyId), eq(jobNotes.jobId, jobId), isNull(jobNotes.deletedAt)))
    .orderBy(desc(jobNotes.createdAt));
}

async function listCompanyJobPhotos(
  companyId: string,
  jobId: string,
  executor: SelectExecutor
): Promise<JobPhotoRow[]> {
  return executor
    .select()
    .from(jobPhotos)
    .where(and(eq(jobPhotos.companyId, companyId), eq(jobPhotos.jobId, jobId), isNull(jobPhotos.deletedAt)))
    .orderBy(desc(jobPhotos.createdAt));
}

async function listCompanyJobActivity(
  companyId: string,
  jobId: string,
  executor: SelectExecutor
): Promise<ActivityEventRow[]> {
  return executor
    .select()
    .from(activityEvents)
    .where(and(eq(activityEvents.companyId, companyId), eq(activityEvents.jobId, jobId)))
    .orderBy(desc(activityEvents.occurredAt));
}

async function listJobScheduleSlots(
  companyId: string,
  jobId: string,
  executor: SelectExecutor
): Promise<ScheduleSlotRow[]> {
  return executor
    .select()
    .from(scheduleSlots)
    .where(and(eq(scheduleSlots.companyId, companyId), eq(scheduleSlots.jobId, jobId), isNull(scheduleSlots.deletedAt)))
    .limit(MAX_RESULT_WINDOW);
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

function toJobListItem(
  job: JobRow,
  customer: CustomerRow,
  property: PropertyRow | null,
  technician: TechnicianRow | null
): JobListItem {
  return {
    id: job.id,
    jobNumber: job.jobNumber,
    title: job.title,
    type: job.type,
    priority: job.priority,
    status: job.status,
    scheduledStart: job.scheduledStart,
    scheduledEnd: job.scheduledEnd,
    customer: {
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone
    },
    property: property
      ? {
          id: property.id,
          addressLine1: property.addressLine1,
          city: property.city,
          state: property.state
        }
      : null,
    technician: technician
      ? {
          id: technician.id,
          firstName: technician.firstName,
          lastName: technician.lastName,
          phone: technician.phone,
          calendarColor: technician.calendarColor
        }
      : null,
    createdAt: job.createdAt
  };
}

function toJobDetail(
  job: JobRow,
  customer: CustomerRow,
  property: PropertyRow | null,
  asset: AssetRow | null,
  technician: TechnicianRow | null
): JobDetail {
  return {
    ...job,
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
          state: property.state,
          zip: property.zip,
          accessNotes: property.accessNotes
        }
      : null,
    asset: asset
      ? {
          id: asset.id,
          name: asset.name,
          assetType: asset.assetType,
          brand: asset.brand,
          model: asset.model,
          installDate: asset.installDate,
          lastServiceDate: asset.lastServiceDate
        }
      : null,
    technician: technician
      ? {
          id: technician.id,
          firstName: technician.firstName,
          lastName: technician.lastName,
          phone: technician.phone,
          calendarColor: technician.calendarColor
        }
      : null,
    availableTransitions: getAvailableTransitions(job.status)
  };
}

function toActivityEventRecord(event: ActivityEventRow): ActivityEvent {
  return {
    id: event.id,
    companyId: event.companyId,
    eventType: event.eventType,
    actorId: event.actorId,
    actorType: event.actorType,
    actorName: event.actorName,
    entityType: event.entityType,
    entityId: event.entityId,
    customerId: event.customerId,
    jobId: event.jobId,
    estimateId: event.estimateId,
    invoiceId: event.invoiceId,
    payload: event.payload ?? {},
    summary: event.summary,
    occurredAt: event.occurredAt
  };
}

async function emitJobEvent(
  executor: TransactionExecutor,
  actor: UserRow | null,
  actorId: string,
  job: JobRow,
  eventType: EmitEventContext["eventType"],
  summary: string,
  payload?: Record<string, unknown>
): Promise<void> {
  await emitEventWithExecutor(executor, {
    companyId: job.companyId,
    eventType,
    actorId,
    actorName: actor ? buildActorName(actor.firstName, actor.lastName) : undefined,
    entityType: "job",
    entityId: job.id,
    customerId: job.customerId,
    jobId: job.id,
    payload: payload ?? {},
    summary
  });
}

function resolveTransitionEventType(fromStatus: JobStatus, toStatus: JobStatus): TransitionEventType {
  if (fromStatus === "cancelled" && toStatus !== "cancelled") {
    return "job.reopened";
  }

  switch (toStatus) {
    case "scheduled":
      return "job.scheduled";
    case "dispatched":
      return "job.dispatched";
    case "in_progress":
      return "job.started";
    case "on_hold":
      return "job.paused";
    case "cancelled":
      return "job.cancelled";
    case "closed":
      return "job.closed";
    default:
      return "job.updated";
  }
}

export async function listJobs(
  companyId: string,
  query: ListJobsQuery
): Promise<PaginatedResult<JobListItem>> {
  const normalizedQuery = normalizeListJobsQuery(query);
  const companyJobs = await listCompanyJobs(companyId, db);

  const filteredJobs = companyJobs.filter((job) => {
    if (normalizedQuery.status.length > 0 && !normalizedQuery.status.includes(job.status)) {
      return false;
    }

    if (normalizedQuery.technicianId && job.technicianId !== normalizedQuery.technicianId) {
      return false;
    }

    if (normalizedQuery.customerId && job.customerId !== normalizedQuery.customerId) {
      return false;
    }

    if (normalizedQuery.propertyId && job.propertyId !== normalizedQuery.propertyId) {
      return false;
    }

    if (normalizedQuery.assetId && job.assetId !== normalizedQuery.assetId) {
      return false;
    }

    if (normalizedQuery.type && job.type !== normalizedQuery.type) {
      return false;
    }

    if (normalizedQuery.priority && job.priority !== normalizedQuery.priority) {
      return false;
    }

    if (normalizedQuery.scheduledAfter) {
      if (!job.scheduledStart || job.scheduledStart.getTime() < normalizedQuery.scheduledAfter.getTime()) {
        return false;
      }
    }

    if (normalizedQuery.scheduledBefore) {
      if (!job.scheduledStart || job.scheduledStart.getTime() > normalizedQuery.scheduledBefore.getTime()) {
        return false;
      }
    }

    if (normalizedQuery.search) {
      const searchTarget = `${job.title} ${job.description ?? ""}`.toLowerCase();

      if (!searchTarget.includes(normalizedQuery.search)) {
        return false;
      }
    }

    return true;
  });

  const sortedJobs = [...filteredJobs].sort((left, right) => {
    switch (normalizedQuery.sortBy) {
      case "scheduledStart":
        return compareNullableDates(left.scheduledStart, right.scheduledStart, normalizedQuery.sortOrder);
      case "createdAt":
        return compareDates(left.createdAt, right.createdAt, normalizedQuery.sortOrder);
      case "priority":
        return compareRankedValues(left.priority, right.priority, PRIORITY_ORDER, normalizedQuery.sortOrder);
      case "status":
        return compareRankedValues(left.status, right.status, STATUS_ORDER, normalizedQuery.sortOrder);
    }
  });
  const customerIds = [...new Set(sortedJobs.map((job) => job.customerId))];
  const propertyIds = [...new Set(sortedJobs.map((job) => job.propertyId).filter((value): value is string => Boolean(value)))];
  const technicianIds = [
    ...new Set(sortedJobs.map((job) => job.technicianId).filter((value): value is string => Boolean(value)))
  ];

  const [companyCustomers, companyProperties, companyTechnicians] = await Promise.all([
    customerIds.length === 0
      ? Promise.resolve([] as CustomerRow[])
      : db
          .select()
          .from(customers)
          .where(and(eq(customers.companyId, companyId), isNull(customers.deletedAt)))
          .limit(MAX_RESULT_WINDOW),
    propertyIds.length === 0
      ? Promise.resolve([] as PropertyRow[])
      : db
          .select()
          .from(properties)
          .where(and(eq(properties.companyId, companyId), isNull(properties.deletedAt)))
          .limit(MAX_RESULT_WINDOW),
    technicianIds.length === 0
      ? Promise.resolve([] as TechnicianRow[])
      : db
          .select()
          .from(technicians)
          .where(and(eq(technicians.companyId, companyId), isNull(technicians.deletedAt)))
          .limit(MAX_RESULT_WINDOW)
  ]);

  const customerMap = new Map(companyCustomers.map((customer) => [customer.id, customer]));
  const propertyMap = new Map(companyProperties.map((property) => [property.id, property]));
  const technicianMap = new Map(companyTechnicians.map((technician) => [technician.id, technician]));
  const total = sortedJobs.length;
  const offset = (normalizedQuery.page - 1) * normalizedQuery.limit;
  const pageItems = sortedJobs.slice(offset, offset + normalizedQuery.limit).flatMap((job) => {
    const customer = customerMap.get(job.customerId);

    if (!customer) {
      return [];
    }

    return [
      toJobListItem(
        job,
        customer,
        job.propertyId ? propertyMap.get(job.propertyId) ?? null : null,
        job.technicianId ? technicianMap.get(job.technicianId) ?? null : null
      )
    ];
  });

  return {
    data: pageItems,
    total,
    page: normalizedQuery.page,
    limit: normalizedQuery.limit,
    totalPages: Math.ceil(total / normalizedQuery.limit)
  };
}

export async function getJob(companyId: string, jobId: string): Promise<JobDetail> {
  const job = await getJobRecord(companyId, jobId, db);
  const [customer, property, asset, technician] = await Promise.all([
    getCustomerRecord(companyId, job.customerId, db),
    job.propertyId ? getPropertyRecord(companyId, job.propertyId, db) : Promise.resolve(null),
    job.assetId ? getAssetRecord(companyId, job.assetId, db) : Promise.resolve(null),
    job.technicianId ? getTechnicianRecord(companyId, job.technicianId, db) : Promise.resolve(null)
  ]);

  return toJobDetail(job, customer, property, asset, technician);
}

export async function createJob(
  companyId: string,
  actorId: string,
  input: CreateJobInput
): Promise<Job> {
  const normalizedInput = normalizeCreateJobInput(input);

  const createdJob = await runTenantAwareTransaction(companyId, async (tx) => {
    await enforceJobCreationPlanLimit(companyId, tx);
    const actor = await getActor(companyId, actorId, tx);
    const customer = await getCustomerRecord(companyId, normalizedInput.customerId, tx);
    const property =
      normalizedInput.propertyId !== undefined
        ? await getPropertyRecord(companyId, normalizedInput.propertyId, tx)
        : null;
    const asset =
      normalizedInput.assetId !== undefined
        ? await getAssetRecord(companyId, normalizedInput.assetId, tx)
        : null;

    if (property) {
      assertPropertyBelongsToCustomer(property, customer.id);
    }

    if (asset) {
      assertAssetBelongsToCustomer(asset, customer.id);

      if (property) {
        assertAssetBelongsToProperty(asset, property.id);
      }
    }

    if (normalizedInput.technicianId) {
      await getTechnicianRecord(companyId, normalizedInput.technicianId, tx);
    }

    const jobNumber = await generateJobNumber(companyId, tx);
    const insertedJobs = await tx
      .insert(jobs)
      .values({
        companyId,
        customerId: customer.id,
        propertyId: property?.id ?? null,
        assetId: asset?.id ?? null,
        technicianId: normalizedInput.technicianId ?? null,
        type: normalizedInput.type,
        priority: normalizedInput.priority,
        status: "lead",
        leadSource: normalizedInput.leadSource,
        title: normalizedInput.title,
        description: normalizedInput.description,
        scheduledStart: normalizedInput.scheduledStart,
        scheduledEnd: normalizedInput.scheduledEnd,
        scheduledDurationMinutes: normalizedInput.scheduledDurationMinutes,
        tags: normalizedInput.tags,
        jobNumber
      })
      .returning();
    const createdJob = insertedJobs[0];

    if (!createdJob) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create job");
    }

    await emitJobEvent(
      tx,
      actor,
      actorId,
      createdJob,
      "job.created",
      `Job ${createdJob.jobNumber} created`,
      {
        status: createdJob.status,
        technicianId: createdJob.technicianId
      }
    );

    return createdJob;
  });

  void trackConversion(companyId, normalizedInput.customerId, createdJob.id).catch((error: unknown) => {
    logger.warn(
      {
        err: error,
        companyId,
        customerId: normalizedInput.customerId,
        jobId: createdJob.id
      },
      "Campaign conversion attribution failed after job creation"
    );
  });

  await invalidateDispatchDates(companyId, createdJob.scheduledStart);

  return createdJob;
}

export async function updateJob(
  companyId: string,
  actorId: string,
  jobId: string,
  input: UpdateJobInput
): Promise<Job> {
  const normalizedInput = normalizeUpdateJobInput(input);
  const existingJob = await getJobRecord(companyId, jobId, db);
  const updateValues = {
    ...(normalizedInput.title !== undefined ? { title: normalizedInput.title } : {}),
    ...(normalizedInput.description !== undefined ? { description: normalizedInput.description } : {}),
    ...(normalizedInput.type !== undefined ? { type: normalizedInput.type } : {}),
    ...(normalizedInput.priority !== undefined ? { priority: normalizedInput.priority } : {}),
    ...(normalizedInput.tags !== undefined ? { tags: normalizedInput.tags } : {}),
    ...(normalizedInput.techNotes !== undefined ? { techNotes: normalizedInput.techNotes } : {})
  };

  if (Object.keys(updateValues).length === 0) {
    return existingJob;
  }

  const updatedJob = await db.transaction(async (tx) => {
    const actor = await getActor(companyId, actorId, tx);
    const updatedJobs = await tx
      .update(jobs)
      .set({
        ...updateValues,
        updatedAt: new Date()
      })
      .where(and(eq(jobs.companyId, companyId), eq(jobs.id, jobId), isNull(jobs.deletedAt)))
      .returning();
    const updatedJob = updatedJobs[0];

    if (!updatedJob) {
      throw new AppError(ErrorCode.NOT_FOUND, "Job not found");
    }

    await emitJobEvent(
      tx,
      actor,
      actorId,
      updatedJob,
      "job.updated",
      `Job ${updatedJob.jobNumber} updated`,
      updateValues
    );

    return updatedJob;
  });

  await invalidateDispatchDates(companyId, existingJob.scheduledStart, updatedJob.scheduledStart);
  return updatedJob;
}

function hasMetadataUpdates(input: UpdateJobInput): boolean {
  return input.title !== undefined ||
    input.description !== undefined ||
    input.type !== undefined ||
    input.priority !== undefined ||
    input.tags !== undefined ||
    input.techNotes !== undefined;
}

function scheduledWindowChanged(
  job: JobDetail,
  scheduledStart: string | undefined,
  scheduledEnd: string | undefined
): boolean {
  if (!scheduledStart || !scheduledEnd) {
    return false;
  }

  return job.scheduledStart?.toISOString() !== scheduledStart || job.scheduledEnd?.toISOString() !== scheduledEnd;
}

export async function patchJob(
  companyId: string,
  actorId: string,
  jobId: string,
  input: UpdateJobInput
): Promise<JobDetail> {
  const currentJob = await getJob(companyId, jobId);

  if (hasMetadataUpdates(input)) {
    await updateJob(companyId, actorId, jobId, input);
  }

  if (input.technicianId && input.technicianId !== currentJob.technicianId) {
    await assignTechnician(companyId, actorId, jobId, input.technicianId);
  }

  if (scheduledWindowChanged(currentJob, input.scheduledStart, input.scheduledEnd)) {
    await scheduleJob(companyId, actorId, jobId, {
      scheduledStart: input.scheduledStart as string,
      scheduledEnd: input.scheduledEnd as string
    });
  }

  return getJob(companyId, jobId);
}

export async function transitionStatus(
  companyId: string,
  actorId: string,
  jobId: string,
  toStatus: JobStatus,
  reason?: string
): Promise<Job> {
  if (toStatus === "completed") {
    throw new AppError(ErrorCode.CONFLICT, "Use the complete job flow to mark a job as completed");
  }

  const existingJob = await getJobRecord(companyId, jobId, db);
  const nextStatus = applyTransition(existingJob.status, toStatus);
  const eventType = resolveTransitionEventType(existingJob.status, nextStatus);

  const updatedJob = await db.transaction(async (tx) => {
    const actor = await getActor(companyId, actorId, tx);
    const updateValues: Partial<JobRow> = {
      status: nextStatus,
      updatedAt: new Date()
    };

    if (nextStatus === "in_progress" && !existingJob.actualStart) {
      updateValues.actualStart = new Date();
    }

    const updatedJobs = await tx
      .update(jobs)
      .set(updateValues)
      .where(and(eq(jobs.companyId, companyId), eq(jobs.id, jobId), isNull(jobs.deletedAt)))
      .returning();
    const updatedJob = updatedJobs[0];

    if (!updatedJob) {
      throw new AppError(ErrorCode.NOT_FOUND, "Job not found");
    }

    await emitJobEvent(
      tx,
      actor,
      actorId,
      updatedJob,
      eventType,
      `Job ${updatedJob.jobNumber} moved from ${existingJob.status} to ${updatedJob.status}`,
      {
        fromStatus: existingJob.status,
        toStatus: updatedJob.status,
        ...(reason ? { reason } : {})
      }
    );

    return updatedJob;
  });

  await invalidateDispatchDates(companyId, existingJob.scheduledStart, updatedJob.scheduledStart);
  return updatedJob;
}

export async function assignTechnician(
  companyId: string,
  actorId: string,
  jobId: string,
  technicianId: string
): Promise<Job> {
  const existingJob = await getJobRecord(companyId, jobId, db);

  const updatedJob = await db.transaction(async (tx) => {
    const actor = await getActor(companyId, actorId, tx);
    const technician = await getTechnicianRecord(companyId, technicianId, tx);
    const updatedJobs = await tx
      .update(jobs)
      .set({
        technicianId: technician.id,
        assignedById: actorId,
        updatedAt: new Date()
      })
      .where(and(eq(jobs.companyId, companyId), eq(jobs.id, jobId), isNull(jobs.deletedAt)))
      .returning();
    const updatedJob = updatedJobs[0];

    if (!updatedJob) {
      throw new AppError(ErrorCode.NOT_FOUND, "Job not found");
    }

    const jobScheduleSlots = await listJobScheduleSlots(companyId, jobId, tx);

    if (jobScheduleSlots.length > 0) {
      await tx
        .update(scheduleSlots)
        .set({
          technicianId: technician.id,
          updatedAt: new Date()
        })
        .where(and(eq(scheduleSlots.companyId, companyId), eq(scheduleSlots.jobId, jobId), isNull(scheduleSlots.deletedAt)))
        .returning();
    }

    await emitJobEvent(
      tx,
      actor,
      actorId,
      updatedJob,
      "technician.assigned",
      `Technician ${technician.firstName} ${technician.lastName} assigned to job ${updatedJob.jobNumber}`,
      {
        previousTechnicianId: existingJob.technicianId,
        technicianId: technician.id
      }
    );

    return updatedJob;
  });

  await invalidateDispatchDates(companyId, existingJob.scheduledStart, updatedJob.scheduledStart);
  return updatedJob;
}

export async function scheduleJob(
  companyId: string,
  actorId: string,
  jobId: string,
  input: ScheduleJobInput
): Promise<Job> {
  const normalizedInput = normalizeScheduleJobInput(input);
  const existingJob = await getJobRecord(companyId, jobId, db);
  const wasScheduled = existingJob.scheduledStart !== null;
  const shouldTransitionToScheduled = existingJob.status !== "scheduled";

  if (shouldTransitionToScheduled && !canTransition(existingJob.status, "scheduled")) {
    throw new AppError(
      ErrorCode.CONFLICT,
      `Job cannot be scheduled from ${existingJob.status}`,
      {
        currentStatus: existingJob.status,
        nextStatus: "scheduled"
      }
    );
  }

  const updatedJob = await db.transaction(async (tx) => {
    const actor = await getActor(companyId, actorId, tx);
    const updatedJobs = await tx
      .update(jobs)
      .set({
        scheduledStart: normalizedInput.scheduledStart,
        scheduledEnd: normalizedInput.scheduledEnd,
        scheduledDurationMinutes: normalizedInput.scheduledDurationMinutes,
        status: shouldTransitionToScheduled
          ? applyTransition(existingJob.status, "scheduled")
          : existingJob.status,
        updatedAt: new Date()
      })
      .where(and(eq(jobs.companyId, companyId), eq(jobs.id, jobId), isNull(jobs.deletedAt)))
      .returning();
    const updatedJob = updatedJobs[0];

    if (!updatedJob) {
      throw new AppError(ErrorCode.NOT_FOUND, "Job not found");
    }

    if (updatedJob.technicianId) {
      const existingSlots = await listJobScheduleSlots(companyId, updatedJob.id, tx);

      if (existingSlots.length === 0) {
        await tx
          .insert(scheduleSlots)
          .values({
            companyId,
            technicianId: updatedJob.technicianId,
            jobId: updatedJob.id,
            startTime: normalizedInput.scheduledStart,
            endTime: normalizedInput.scheduledEnd,
            isConfirmed: false
          })
          .returning();
      } else {
        await tx
          .update(scheduleSlots)
          .set({
            technicianId: updatedJob.technicianId,
            startTime: normalizedInput.scheduledStart,
            endTime: normalizedInput.scheduledEnd,
            updatedAt: new Date()
          })
          .where(and(eq(scheduleSlots.companyId, companyId), eq(scheduleSlots.jobId, updatedJob.id), isNull(scheduleSlots.deletedAt)))
          .returning();
      }
    }

    await emitJobEvent(
      tx,
      actor,
      actorId,
      updatedJob,
      wasScheduled ? "job.rescheduled" : "job.scheduled",
      `${wasScheduled ? "Rescheduled" : "Scheduled"} job ${updatedJob.jobNumber}`,
      {
        previousScheduledStart: existingJob.scheduledStart?.toISOString() ?? null,
        previousScheduledEnd: existingJob.scheduledEnd?.toISOString() ?? null,
        scheduledStart: updatedJob.scheduledStart?.toISOString() ?? null,
        scheduledEnd: updatedJob.scheduledEnd?.toISOString() ?? null
      }
    );

    return updatedJob;
  });

  await invalidateDispatchDates(companyId, existingJob.scheduledStart, updatedJob.scheduledStart);
  return updatedJob;
}

export async function completeJob(
  companyId: string,
  actorId: string,
  jobId: string,
  input: CompleteJobInput
): Promise<Job> {
  const existingJob = await getJobRecord(companyId, jobId, db);
  applyTransition(existingJob.status, "completed");

  const normalizedInput = normalizeCompleteJobInput(input);
  const completionTimestamp = new Date();
  const signedAt =
    normalizedInput.signedAt ??
    (normalizedInput.signatureUrl || normalizedInput.signedByName ? completionTimestamp : null);
  const completedJob = await db.transaction(async (tx) => {
    const actor = await getActor(companyId, actorId, tx);
    const customer = await getCustomerRecord(companyId, existingJob.customerId, tx);
    const technician =
      existingJob.technicianId !== null
        ? await getTechnicianRecord(companyId, existingJob.technicianId, tx)
        : null;
    const asset =
      existingJob.assetId !== null
        ? await getAssetRecord(companyId, existingJob.assetId, tx)
        : null;
    const updatedJobs = await tx
      .update(jobs)
      .set({
        status: "completed",
        actualEnd: completionTimestamp,
        completionNotes: normalizedInput.completionNotes,
        signatureUrl: normalizedInput.signatureUrl,
        signedByName: normalizedInput.signedByName,
        signedAt,
        updatedAt: completionTimestamp
      })
      .where(and(eq(jobs.companyId, companyId), eq(jobs.id, jobId), isNull(jobs.deletedAt)))
      .returning();
    const finalizedJob = updatedJobs[0];

    if (!finalizedJob) {
      throw new AppError(ErrorCode.NOT_FOUND, "Job not found");
    }

    const serviceDate = formatDateOnly(completionTimestamp);
    await tx
      .update(customers)
      .set({
        lifetimeValue: addMoneyStrings(customer.lifetimeValue, finalizedJob.invoiceTotal),
        totalJobs: (customer.totalJobs ?? 0) + 1,
        lastServiceDate: serviceDate,
        firstServiceDate: customer.firstServiceDate ?? serviceDate,
        updatedAt: completionTimestamp
      })
      .where(and(eq(customers.companyId, companyId), eq(customers.id, customer.id), isNull(customers.deletedAt)))
      .returning();

    if (technician) {
      await tx
        .update(technicians)
        .set({
          totalJobsCompleted: (technician.totalJobsCompleted ?? 0) + 1,
          updatedAt: completionTimestamp
        })
        .where(and(eq(technicians.companyId, companyId), eq(technicians.id, technician.id), isNull(technicians.deletedAt)))
        .returning();
    }

    if (asset) {
      await tx
        .update(assets)
        .set({
          lastServiceDate: serviceDate,
          updatedAt: completionTimestamp
        })
        .where(and(eq(assets.companyId, companyId), eq(assets.id, asset.id), isNull(assets.deletedAt)))
        .returning();
    }

    await emitJobEvent(
      tx,
      actor,
      actorId,
      finalizedJob,
      "job.completed",
      `Completed job ${finalizedJob.jobNumber}`,
      {
        fromStatus: existingJob.status,
        toStatus: "completed"
      }
    );

    return finalizedJob;
  });

  try {
    await aiQueue.add(
      "evaluate-revenue-opportunities",
      {
        companyId,
        jobId: completedJob.id,
        customerId: completedJob.customerId
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
    logger.error(
      {
        err: error,
        companyId,
        jobId: completedJob.id
      },
      "Failed to enqueue AI job"
    );
  }

  try {
    await enqueuePostJobLoyaltyReminderEvaluation({
      companyId,
      customerId: completedJob.customerId,
      triggerJobId: completedJob.id
    });
  } catch (error: unknown) {
    logger.error(
      {
        err: error,
        companyId,
        jobId: completedJob.id
      },
      "Failed to enqueue loyalty reminder candidate evaluation"
    );
  }

  await invalidateDispatchDates(companyId, existingJob.scheduledStart, completedJob.scheduledStart);

  return completedJob;
}

export async function addNote(
  companyId: string,
  actorId: string,
  jobId: string,
  input: AddNoteInput
): Promise<JobNote> {
  const existingJob = await getJobRecord(companyId, jobId, db);
  const normalizedInput = normalizeAddNoteInput(input);

  return db.transaction(async (tx) => {
    const actor = await getActor(companyId, actorId, tx);
    const insertedNotes = await tx
      .insert(jobNotes)
      .values({
        companyId,
        jobId: existingJob.id,
        authorId: actorId,
        content: normalizedInput.content,
        isInternal: normalizedInput.isInternal
      })
      .returning();
    const note = insertedNotes[0];

    if (!note) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to add job note");
    }

    await emitJobEvent(
      tx,
      actor,
      actorId,
      existingJob,
      "job.updated",
      `Added note to job ${existingJob.jobNumber}`,
      {
        noteId: note.id,
        isInternal: note.isInternal
      }
    );

    return note;
  });
}

export async function getJobNotes(companyId: string, jobId: string): Promise<JobNote[]> {
  await getJobRecord(companyId, jobId, db);
  return listCompanyJobNotes(companyId, jobId, db);
}

export async function addPhoto(
  companyId: string,
  actorId: string,
  jobId: string,
  input: AddPhotoInput
): Promise<JobPhoto> {
  const existingJob = await getJobRecord(companyId, jobId, db);
  const normalizedInput = normalizeAddPhotoInput(input);

  return db.transaction(async (tx) => {
    const actor = await getActor(companyId, actorId, tx);
    const insertedPhotos = await tx
      .insert(jobPhotos)
      .values({
        companyId,
        jobId: existingJob.id,
        uploadedById: actorId,
        url: normalizedInput.url,
        thumbnailUrl: normalizedInput.thumbnailUrl,
        caption: normalizedInput.caption,
        photoType: normalizedInput.photoType,
        takenAt: normalizedInput.takenAt
      })
      .returning();
    const photo = insertedPhotos[0];

    if (!photo) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to add job photo");
    }

    await emitJobEvent(
      tx,
      actor,
      actorId,
      existingJob,
      "job.updated",
      `Added photo to job ${existingJob.jobNumber}`,
      {
        photoId: photo.id,
        photoType: photo.photoType
      }
    );

    return {
      ...photo,
      photoType: (photo.photoType ?? null) as JobPhoto["photoType"]
    };
  });
}

export async function getJobPhotos(companyId: string, jobId: string): Promise<JobPhoto[]> {
  await getJobRecord(companyId, jobId, db);
  const photos = await listCompanyJobPhotos(companyId, jobId, db);

  return photos.map((photo) => ({
    ...photo,
    photoType: (photo.photoType ?? null) as JobPhoto["photoType"]
  }));
}

export async function getJobTimeline(companyId: string, jobId: string): Promise<ActivityEvent[]> {
  await getJobRecord(companyId, jobId, db);
  const timeline = await listCompanyJobActivity(companyId, jobId, db);
  return timeline.map((event) => toActivityEventRecord(event));
}
