import { randomBytes } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";
import { Decimal } from "decimal.js";

import {
  bookingRequests,
  bookingSettings,
  companies,
  customers,
  db,
  emitEventWithExecutor,
  jobs,
  properties,
  scheduleSlots,
  technicians,
  users
} from "@fsm/db";
import { normalizeImportBusinessDate, normalizeImportPhone } from "@fsm/import-normalize";
import { notificationsQueue } from "@fsm/jobs";
import {
  AppError,
  type BookingAvailabilityWindow,
  type BookingConfirmationView,
  type BookingRequest,
  type BookingRequestListResult,
  type BookingSettings,
  type CheckZipCoverageResult,
  type ConfirmBookingRequestInput,
  type HoldBookingSlotInput,
  type PublicHoldBookingSlotInput,
  type BookingSlotHoldView,
  type ListBookingRequestsQuery,
  type PublicBookingSettings,
  type SubmitBookingRequestInput,
  type UpdateBookingSettingsInput,
  type BookingRequestStatus,
  ErrorCode
} from "@fsm/types";

import {
  finalizeBookingHoldTokenClaim,
  generateBookingHoldToken,
  inspectBookingHoldToken,
  type BookingHoldTokenInspection,
  verifyAndClaimBookingHoldToken
} from "../lib/booking-hold-token.js";
import { generateJobNumber } from "../lib/job-number.js";
import { attachConfirmedBookingToRecurringSchedules } from "./booking-recurring-schedule.service.js";
import { assertNonTerminalBookingRequest } from "./booking-request-guards.js";
import { invalidateDispatchCache } from "./dispatch.service.js";
import { issueBookingManageTokenIfEligible } from "../lib/booking-manage-token.js";

type BookingRequestRow = typeof bookingRequests.$inferSelect;
type BookingSettingsRow = typeof bookingSettings.$inferSelect;
type CompanyRow = typeof companies.$inferSelect;
type CustomerRow = typeof customers.$inferSelect;
type JobRow = typeof jobs.$inferSelect;
type PropertyRow = typeof properties.$inferSelect;
type ScheduleSlotRow = typeof scheduleSlots.$inferSelect;
type TechnicianRow = typeof technicians.$inferSelect;
type UserRow = typeof users.$inferSelect;
type SelectExecutor = Pick<typeof db, "select">;
type TransactionExecutor = Pick<typeof db, "select" | "insert" | "update">;
type BookingActor = {
  id: string | null;
  type: "user" | "customer" | "system";
  name?: string;
};
type NormalizedBookingInput = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  zip: string;
  propertyType: string | null;
  serviceCategory: string | null;
  serviceType: string | null;
  serviceDetail: string | null;
  urgency: SubmitBookingRequestInput["urgency"];
  customerNotes: string | null;
  preferredDate: string | null;
  preferredWindow: SubmitBookingRequestInput["preferredWindow"];
  isPropertyOwner: boolean;
  smsConsentAppointments: boolean;
  smsConsentMarketing: boolean;
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const DEFAULT_AVAILABLE_DAYS = ["mon", "tue", "wed", "thu", "fri"];
const DEFAULT_SLOT_DURATION = 2;
const DEFAULT_MAX_ADVANCE_DAYS = 14;
const BOOKING_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const BOOKING_SOURCE_VALUES = new Set([
  "google",
  "facebook",
  "instagram",
  "yelp",
  "direct",
  "website",
  "qr_code"
]);
const BOOKING_TIME_ZONE = "America/Chicago";
const BOOKING_SLOT_HOLD_NOTE_PREFIX = "booking_hold:";

function normalizeOptionalString(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeBookingSlug(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string): string {
  const normalizedDigits = normalizeImportPhone(value);
  return normalizedDigits ?? value.trim();
}

/** Phone used only for matching/creating customers — not placeholder inbox values. */
function isUsableContactPhone(phone: string): boolean {
  const trimmed = normalizePhone(phone);
  return trimmed.length > 0 && trimmed !== "+10000000000";
}

function normalizeOptionalEmail(value: string | null | undefined): string | null | undefined {
  const normalizedValue = normalizeOptionalString(value);

  if (normalizedValue === undefined || normalizedValue === null) {
    return normalizedValue;
  }

  return normalizedValue.toLowerCase();
}

function toBookingRequest(row: BookingRequestRow): BookingRequest {
  return {
    ...row,
    preferredDate: row.preferredDate,
    urgency: row.urgency as BookingRequest["urgency"],
    preferredWindow: row.preferredWindow as BookingRequest["preferredWindow"],
    status: row.status as BookingRequest["status"],
    source: row.source as BookingRequest["source"]
  };
}

function toBookingSettings(row: BookingSettingsRow): BookingSettings {
  return {
    ...row,
    offeredServices: Array.isArray(row.offeredServices) ? (row.offeredServices as Array<Record<string, unknown>>) : []
  };
}

function toPublicBookingSettings(
  company: CompanyRow,
  row: BookingSettingsRow,
  serviceAreaZipCodes: string[]
): PublicBookingSettings {
  return {
    companyName: company.name,
    companySlug: company.slug,
    bookingSlug: row.bookingSlug ?? company.slug,
    offeredServices: Array.isArray(row.offeredServices) ? (row.offeredServices as Array<Record<string, unknown>>) : [],
    availableHoursStart: row.availableHoursStart ?? 8,
    availableHoursEnd: row.availableHoursEnd ?? 17,
    availableDays: row.availableDays ?? DEFAULT_AVAILABLE_DAYS,
    slotDuration: row.slotDuration ?? DEFAULT_SLOT_DURATION,
    maxAdvanceDays: row.maxAdvanceDays ?? DEFAULT_MAX_ADVANCE_DAYS,
    googleReviewUrl: row.googleReviewUrl,
    yelpReviewUrl: row.yelpReviewUrl,
    facebookReviewUrl: row.facebookReviewUrl,
    customReviewUrl: row.customReviewUrl,
    tagline: row.tagline,
    phone: company.phone,
    logoUrl: company.logoUrl,
    serviceAreaZipCodes
  };
}

function buildActorName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

function parseIsoDateTime(value: string, fieldName: string): Date {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, `${fieldName} must be a valid ISO datetime`);
  }

  return parsed;
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDateOnly(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = normalizeImportBusinessDate(value);

  if (!normalized) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "preferredDate must be a valid date");
  }

  return normalized;
}

function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
}

function getWeekdayKey(date: Date): string {
  return date.toLocaleDateString("en-US", {
    timeZone: BOOKING_TIME_ZONE,
    weekday: "short"
  }).toLowerCase();
}

function createUtcDate(date: string, hour: number): Date {
  return new Date(`${date}T${String(hour).padStart(2, "0")}:00:00.000Z`);
}

function createBookingDateCursor(date: string): Date {
  return new Date(`${date}T12:00:00.000Z`);
}

function buildReferenceNumber(now: Date): string {
  const datePart = now.toISOString().slice(0, 10).replace(/-/gu, "");
  const entropy = randomBytes(12).toString("base64url");
  return `BK-${datePart}-${entropy}`;
}

function deriveSource(value: string | undefined): BookingRequest["source"] {
  if (!value) {
    return "direct";
  }

  return BOOKING_SOURCE_VALUES.has(value) ? (value as BookingRequest["source"]) : "direct";
}

function getPropertyType(value: string | null): "residential" | "commercial" | "industrial" | "multi_family" {
  if (value === "commercial" || value === "industrial" || value === "multi_family") {
    return value;
  }

  return "residential";
}

function buildJobTitle(request: BookingRequestRow): string {
  const parts = [request.serviceCategory, request.serviceType, request.serviceDetail]
    .filter((value): value is string => Boolean(value && value.trim().length > 0))
    .map((value) => value.trim());

  return parts.length > 0 ? parts.join(" - ") : "Online booking request";
}

function buildPendingCustomerMessage(companyName: string, referenceNumber: string): string {
  return `${companyName}: we received your booking request ${referenceNumber}. We will confirm your appointment soon.`;
}

function buildConfirmedCustomerMessage(
  companyName: string,
  referenceNumber: string,
  scheduledStart: Date
): string {
  const scheduledLabel = scheduledStart.toLocaleString("en-US", {
    timeZone: BOOKING_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });

  return `${companyName}: your booking ${referenceNumber} is confirmed for ${scheduledLabel}.`;
}

function buildDeclinedCustomerMessage(
  companyName: string,
  referenceNumber: string,
  reason: string | null
): string {
  return reason
    ? `${companyName}: booking ${referenceNumber} was declined. ${reason}`
    : `${companyName}: booking ${referenceNumber} was declined. Please contact our office to reschedule.`;
}

function formatBookingScheduledLabel(scheduledStart: Date): string {
  return scheduledStart.toLocaleString("en-US", {
    timeZone: BOOKING_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

type BookingNotificationContact = {
  id: string;
  referenceNumber: string | null;
  firstName: string;
  email: string | null;
  phone: string;
};

function buildBookingCustomerNotificationJobData(input: {
  companyId: string;
  bookingRequest: BookingNotificationContact;
  customerId: string;
  companyName: string;
  body: string;
  scheduledStart?: Date | null;
  reason?: string | null;
}): Record<string, unknown> {
  const referenceNumber = input.bookingRequest.referenceNumber ?? input.bookingRequest.id;

  return {
    companyId: input.companyId,
    bookingRequestId: input.bookingRequest.id,
    customerId: input.customerId,
    toEmail: input.bookingRequest.email ?? null,
    firstName: input.bookingRequest.firstName,
    companyName: input.companyName,
    referenceNumber,
    scheduledLabel: input.scheduledStart ? formatBookingScheduledLabel(input.scheduledStart) : null,
    reason: input.reason ?? null,
    toPhone: input.bookingRequest.phone,
    body: input.body
  };
}

function buildDispatcherAlertMessage(companyName: string, request: BookingRequestRow): string {
  return `${companyName}: new booking request ${request.referenceNumber ?? request.id} from ${request.firstName} ${request.lastName} (${request.zip}).`;
}

function normalizeDaysRange(days: number | undefined): number {
  return Math.min(Math.max(days ?? 30, 1), 365);
}

function buildRangeStart(days: number): Date {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start;
}

async function getCompanyById(companyId: string, executor: SelectExecutor): Promise<CompanyRow> {
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

async function getCompanyByBookingSlug(
  slug: string,
  executor: SelectExecutor
): Promise<{ company: CompanyRow; settings: BookingSettingsRow }> {
  const [settings] = await executor
    .select()
    .from(bookingSettings)
    .where(
      and(eq(bookingSettings.bookingSlug, slug), eq(bookingSettings.isEnabled, true), isNull(bookingSettings.deletedAt))
    )
    .limit(1);

  if (!settings) {
    throw new AppError(ErrorCode.NOT_FOUND, "Booking page not found");
  }

  const company = await getCompanyById(settings.companyId, executor);
  return { company, settings };
}

async function isBookingSlugAvailable(
  companyId: string,
  slug: string,
  executor: SelectExecutor
): Promise<boolean> {
  const normalizedSlug = normalizeBookingSlug(slug);
  const [matchingBookingSettings] = await executor
    .select()
    .from(bookingSettings)
    .where(and(eq(bookingSettings.bookingSlug, normalizedSlug), isNull(bookingSettings.deletedAt)))
    .limit(1);

  if (matchingBookingSettings && matchingBookingSettings.companyId !== companyId) {
    return false;
  }

  const [matchingCompany] = await executor
    .select()
    .from(companies)
    .where(and(eq(companies.slug, normalizedSlug), isNull(companies.deletedAt)))
    .limit(1);

  return !matchingCompany || matchingCompany.id === companyId;
}

async function assertBookingSlugAvailable(
  companyId: string,
  slug: string,
  executor: SelectExecutor
): Promise<void> {
  if (!(await isBookingSlugAvailable(companyId, slug, executor))) {
    throw new AppError(ErrorCode.CONFLICT, "That booking URL is already in use");
  }
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

async function getBookingRequestRecord(
  companyId: string,
  bookingRequestId: string,
  executor: SelectExecutor
): Promise<BookingRequestRow> {
  const [bookingRequest] = await executor
    .select()
    .from(bookingRequests)
    .where(
      and(
        eq(bookingRequests.companyId, companyId),
        eq(bookingRequests.id, bookingRequestId),
        isNull(bookingRequests.deletedAt)
      )
    )
    .limit(1);

  if (!bookingRequest) {
    throw new AppError(ErrorCode.NOT_FOUND, "Booking request not found");
  }

  return bookingRequest;
}

async function ensureBookingSettingsRow(companyId: string, executor: TransactionExecutor | SelectExecutor): Promise<BookingSettingsRow> {
  const [existingSettings] = await executor
    .select()
    .from(bookingSettings)
    .where(and(eq(bookingSettings.companyId, companyId), isNull(bookingSettings.deletedAt)))
    .limit(1);

  if (existingSettings) {
    return existingSettings;
  }

  const company = await getCompanyById(companyId, executor);

  if (!("insert" in executor)) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Booking settings must be created in a transaction");
  }

  const insertedRows = await executor
    .insert(bookingSettings)
    .values({
      companyId,
      bookingSlug: company.slug,
      availableDays: DEFAULT_AVAILABLE_DAYS
    })
    .returning();
  const insertedSettings = insertedRows[0];

  if (!insertedSettings) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to initialize booking settings");
  }

  return insertedSettings;
}

async function listCompanyTechnicians(companyId: string, executor: SelectExecutor): Promise<TechnicianRow[]> {
  return executor
    .select()
    .from(technicians)
    .where(and(eq(technicians.companyId, companyId), isNull(technicians.deletedAt)));
}

async function findCustomerByContact(
  companyId: string,
  phone: string,
  email: string | null,
  executor: SelectExecutor
): Promise<CustomerRow | null> {
  const companyCustomers = await executor
    .select()
    .from(customers)
    .where(and(eq(customers.companyId, companyId), isNull(customers.deletedAt)));

  const normalizedEmail = email ? normalizeOptionalEmail(email) ?? null : null;

  if (isUsableContactPhone(phone)) {
    const normalizedPhone = normalizePhone(phone);
    const byPhone = companyCustomers.find((customer) => customer.phone === normalizedPhone);
    if (byPhone) {
      return byPhone;
    }
  }

  if (normalizedEmail) {
    return companyCustomers.find((customer) => customer.email === normalizedEmail) ?? null;
  }

  return null;
}

async function findPropertyForCustomer(
  companyId: string,
  customerId: string,
  input: NormalizedBookingInput,
  executor: SelectExecutor
): Promise<PropertyRow | null> {
  const companyProperties = await executor
    .select()
    .from(properties)
    .where(and(eq(properties.companyId, companyId), isNull(properties.deletedAt)));

  return (
    companyProperties.find(
      (property) =>
        property.customerId === customerId &&
        property.addressLine1.toLowerCase() === input.addressLine1.trim().toLowerCase() &&
        property.zip.toLowerCase() === input.zip.trim().toLowerCase()
    ) ?? null
  );
}

async function createCustomerForBooking(
  companyId: string,
  input: NormalizedBookingInput,
  executor: TransactionExecutor,
  actor: BookingActor
): Promise<CustomerRow> {
  const insertedCustomers = await executor
    .insert(customers)
    .values({
      companyId,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: normalizeOptionalEmail(input.email) ?? null,
      phone: isUsableContactPhone(input.phone) ? normalizePhone(input.phone) : null,
      prefersSms: input.smsConsentAppointments ?? true,
      prefersEmail: Boolean(input.email),
      doNotContact: false
    })
    .returning();
  const customer = insertedCustomers[0];

  if (!customer) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create customer");
  }

  await emitEventWithExecutor(executor, {
    companyId,
    eventType: "customer.created",
    actorId: actor.id ?? undefined,
    actorType: actor.type,
    actorName: actor.name,
    entityType: "customer",
    entityId: customer.id,
    customerId: customer.id,
    summary: `Customer ${customer.firstName} ${customer.lastName} created from booking`
  });

  return customer;
}

async function createPropertyForBooking(
  companyId: string,
  customerId: string,
  input: NormalizedBookingInput,
  executor: TransactionExecutor,
  actor: BookingActor
): Promise<PropertyRow> {
  const insertedProperties = await executor
    .insert(properties)
    .values({
      companyId,
      customerId,
      addressLine1: input.addressLine1.trim(),
      addressLine2: normalizeOptionalString(input.addressLine2) ?? null,
      city: input.city.trim(),
      state: input.state.trim(),
      zip: input.zip.trim(),
      type: getPropertyType(input.propertyType ?? null),
      isPrimary: true
    })
    .returning();
  const property = insertedProperties[0];

  if (!property) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create property");
  }

  await emitEventWithExecutor(executor, {
    companyId,
    eventType: "property.created",
    actorId: actor.id ?? undefined,
    actorType: actor.type,
    actorName: actor.name,
    entityType: "property",
    entityId: property.id,
    customerId,
    summary: `Property ${property.addressLine1} created from booking`
  });

  return property;
}

async function createJobFromBooking(
  companyId: string,
  bookingRequest: BookingRequestRow,
  customerId: string,
  propertyId: string,
  technicianId: string,
  scheduledStart: Date,
  scheduledEnd: Date,
  executor: TransactionExecutor,
  actor: BookingActor
): Promise<JobRow> {
  const jobNumber = await generateJobNumber(companyId, executor);
  const insertedJobs = await executor
    .insert(jobs)
    .values({
      companyId,
      customerId,
      propertyId,
      technicianId,
      assignedById: actor.type === "user" ? actor.id ?? null : null,
      type: "service_call",
      priority: bookingRequest.urgency === "emergency" ? "urgent" : "normal",
      status: "scheduled",
      leadSource: bookingRequest.source,
      title: buildJobTitle(bookingRequest),
      description: bookingRequest.customerNotes,
      scheduledStart,
      scheduledEnd,
      scheduledDurationMinutes: minutesBetween(scheduledStart, scheduledEnd),
      tags: ["online_booking"],
      jobNumber
    })
    .returning();
  const job = insertedJobs[0];

  if (!job) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create job");
  }

  await executor
    .insert(scheduleSlots)
    .values({
      companyId,
      technicianId,
      jobId: job.id,
      startTime: scheduledStart,
      endTime: scheduledEnd,
      isConfirmed: true
    })
    .returning();

  await emitEventWithExecutor(executor, {
    companyId,
    eventType: "job.created",
    actorId: actor.id ?? undefined,
    actorType: actor.type,
    actorName: actor.name,
    entityType: "job",
    entityId: job.id,
    customerId,
    jobId: job.id,
    payload: {
      bookingRequestId: bookingRequest.id,
      technicianId
    },
    summary: `Job ${job.jobNumber} created from booking`
  });

  await emitEventWithExecutor(executor, {
    companyId,
    eventType: "job.scheduled",
    actorId: actor.id ?? undefined,
    actorType: actor.type,
    actorName: actor.name,
    entityType: "job",
    entityId: job.id,
    customerId,
    jobId: job.id,
    payload: {
      scheduledStart: scheduledStart.toISOString(),
      scheduledEnd: scheduledEnd.toISOString(),
      technicianId
    },
    summary: `Job ${job.jobNumber} scheduled from booking`
  });

  return job;
}

async function getDispatcherPhones(companyId: string, executor: SelectExecutor): Promise<string[]> {
  const companyUsers = await executor
    .select()
    .from(users)
    .where(and(eq(users.companyId, companyId), isNull(users.deletedAt)));

  const preferredUsers = companyUsers.filter((user) => ["dispatcher", "owner", "admin", "office"].includes(user.role));
  return preferredUsers
    .map((user) => user.phone?.trim() ?? "")
    .filter((phone, index, all) => phone.length > 0 && all.indexOf(phone) === index);
}

function normalizeListQuery(query: ListBookingRequestsQuery) {
  return {
    page: query.page && query.page > 0 ? query.page : DEFAULT_PAGE,
    limit: query.limit && query.limit > 0 ? Math.min(query.limit, MAX_LIMIT) : DEFAULT_LIMIT
  };
}

function buildConfirmationView(
  companyName: string,
  request: BookingRequestRow,
  job: JobRow | null
): BookingConfirmationView {
  return {
    referenceNumber: request.referenceNumber ?? request.id,
    status: request.status as BookingConfirmationView["status"],
    companyName,
    scheduledStart: job?.scheduledStart?.toISOString() ?? null,
    scheduledEnd: job?.scheduledEnd?.toISOString() ?? null
  };
}

function filterTechniciansByZip(technicianRows: TechnicianRow[], zip: string): TechnicianRow[] {
  return technicianRows.filter((technician) => (technician.serviceZipCodes ?? []).includes(zip));
}

function buildAvailabilityWindowsForDay(
  date: string,
  settings: BookingSettingsRow,
  technicianRows: TechnicianRow[],
  companySlots: ScheduleSlotRow[]
): BookingAvailabilityWindow[] {
  const morningStartHour = settings.availableHoursStart ?? 8;
  const morningEndHour = Math.min(12, settings.availableHoursEnd ?? 17);
  const afternoonStartHour = Math.max(12, settings.availableHoursStart ?? 8);
  const afternoonEndHour = settings.availableHoursEnd ?? 17;
  const windows: Array<{
    key: BookingAvailabilityWindow["window"];
    startHour: number;
    endHour: number;
  }> = [];

  if (morningEndHour > morningStartHour) {
    windows.push({ key: "morning", startHour: morningStartHour, endHour: morningEndHour });
  }

  if (afternoonEndHour > afternoonStartHour) {
    windows.push({ key: "afternoon", startHour: afternoonStartHour, endHour: afternoonEndHour });
  }

  return windows.flatMap((window) => {
    const start = createUtcDate(date, window.startHour);
    const end = createUtcDate(date, window.endHour);
    const availableTechnicianIds = technicianRows
      .filter((technician) => {
        const conflictingSlots = companySlots.filter((slot) => {
          if (slot.technicianId !== technician.id || slot.deletedAt) {
            return false;
          }

          return slot.startTime.getTime() < end.getTime() && slot.endTime.getTime() > start.getTime();
        });

        return conflictingSlots.length === 0;
      })
      .map((technician) => technician.id);

    if (availableTechnicianIds.length === 0) {
      return [];
    }

    return [{
      date,
      window: window.key,
      start: start.toISOString(),
      end: end.toISOString(),
      technicianIds: availableTechnicianIds
    }];
  });
}

export async function resolvePublicBookingCompanyId(slug: string): Promise<string> {
  const { settings } = await getCompanyByBookingSlug(slug, db);
  return settings.companyId;
}

export async function getPublicBookingSettingsBySlug(slug: string): Promise<PublicBookingSettings> {
  const { company, settings } = await getCompanyByBookingSlug(slug, db);
  const companyTechnicians = await listCompanyTechnicians(settings.companyId, db);
  const serviceAreaZipCodes = Array.from(
    new Set(
      companyTechnicians.flatMap((technician) => technician.serviceZipCodes ?? []).filter((zip) => zip.trim().length > 0)
    )
  ).sort((left, right) => left.localeCompare(right));

  return toPublicBookingSettings(company, settings, serviceAreaZipCodes);
}

export async function checkZipCoverage(slug: string, zip: string): Promise<CheckZipCoverageResult> {
  const normalizedZip = zip.trim();

  if (normalizedZip.length === 0) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "zip is required");
  }

  const { settings } = await getCompanyByBookingSlug(slug, db);
  const technicianRows = await listCompanyTechnicians(settings.companyId, db);
  const coveredTechnicians = filterTechniciansByZip(technicianRows, normalizedZip);
  const covered = coveredTechnicians.length > 0 || Boolean(settings.allowZipOverflow);

  return {
    covered,
    techCount: coveredTechnicians.length
  };
}

export async function getBookingAvailability(
  slug: string,
  zip: string,
  startDate?: string
): Promise<BookingAvailabilityWindow[]> {
  const normalizedZip = zip.trim();
  const { settings } = await getCompanyByBookingSlug(slug, db);
  const companyTechnicians = await listCompanyTechnicians(settings.companyId, db);
  const coveredTechnicians = filterTechniciansByZip(companyTechnicians, normalizedZip);

  if (coveredTechnicians.length === 0 && !settings.allowZipOverflow) {
    return [];
  }

  const technicianPool = coveredTechnicians.length > 0 ? coveredTechnicians : companyTechnicians;
  const companySlots = await db
    .select()
    .from(scheduleSlots)
    .where(and(eq(scheduleSlots.companyId, settings.companyId), isNull(scheduleSlots.deletedAt)));
  const rangeStart = startDate ? parseDateOnly(startDate) ?? formatDateOnly(new Date()) : formatDateOnly(new Date());
  const days: string[] = [];
  const cursor = createBookingDateCursor(rangeStart);
  const maxAdvanceDays = settings.maxAdvanceDays ?? DEFAULT_MAX_ADVANCE_DAYS;
  const allowedDays = settings.availableDays ?? DEFAULT_AVAILABLE_DAYS;

  while (days.length < maxAdvanceDays) {
    if (allowedDays.includes(getWeekdayKey(cursor))) {
      days.push(formatDateOnly(cursor));
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days.flatMap((date) => buildAvailabilityWindowsForDay(date, settings, technicianPool, companySlots));
}

async function assertHoldSlotMatchesPublishedAvailability(
  slug: string,
  zip: string,
  technicianId: string,
  scheduledStart: Date,
  scheduledEnd: Date
): Promise<void> {
  const date = formatDateOnly(scheduledStart);
  const windows = await getBookingAvailability(slug, zip, date);
  const startIso = scheduledStart.toISOString();
  const endIso = scheduledEnd.toISOString();
  const matched = windows.some(
    (window) =>
      window.start === startIso && window.end === endIso && window.technicianIds.includes(technicianId)
  );

  if (!matched) {
    throw new AppError(ErrorCode.CONFLICT, "Selected slot is not available for this booking area");
  }
}

export async function listBookingRequests(
  companyId: string,
  query: ListBookingRequestsQuery
): Promise<BookingRequestListResult> {
  const { page, limit } = normalizeListQuery(query);
  const rows = await db
    .select()
    .from(bookingRequests)
    .where(and(eq(bookingRequests.companyId, companyId), isNull(bookingRequests.deletedAt)));
  const filteredRows = rows
    .filter((row) => (query.status ? row.status === query.status : true))
    .filter((row) => (query.source ? row.source === query.source : true))
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  const total = filteredRows.length;
  const totalPages = total === 0 ? 1 : Math.ceil(total / limit);
  const offset = (page - 1) * limit;

  return {
    data: filteredRows.slice(offset, offset + limit).map((row) => ({
      id: row.id,
      referenceNumber: row.referenceNumber,
      status: row.status as BookingRequest["status"],
      source: row.source as BookingRequest["source"],
      firstName: row.firstName,
      lastName: row.lastName,
      phone: row.phone,
      zip: row.zip,
      serviceCategory: row.serviceCategory,
      serviceType: row.serviceType,
      preferredDate: row.preferredDate,
      preferredWindow: row.preferredWindow as BookingRequest["preferredWindow"],
      assignedTechnicianId: row.assignedTechnicianId,
      createdAt: row.createdAt
    })),
    total,
    page,
    limit,
    totalPages
  };
}

export async function getBookingRequest(companyId: string, bookingRequestId: string): Promise<BookingRequest> {
  const bookingRequest = await getBookingRequestRecord(companyId, bookingRequestId, db);
  return toBookingRequest(bookingRequest);
}

function buildBookingSlotHoldNote(bookingRequestId: string): string {
  return `${BOOKING_SLOT_HOLD_NOTE_PREFIX}${bookingRequestId}`;
}

async function assertActiveHoldMatchesSelection(
  companyId: string,
  bookingRequestId: string,
  input: ConfirmBookingRequestInput,
  executor: TransactionExecutor
): Promise<void> {
  const holdNote = buildBookingSlotHoldNote(bookingRequestId);
  const holds = await executor
    .select()
    .from(scheduleSlots)
    .where(
      and(
        eq(scheduleSlots.companyId, companyId),
        eq(scheduleSlots.notes, holdNote),
        isNull(scheduleSlots.deletedAt)
      )
    );

  const activeHold = holds.find((slot) => !slot.isConfirmed);

  if (!activeHold) {
    throw new AppError(
      ErrorCode.CONFLICT,
      "Booking confirmation requires an active in-platform slot hold before commitment"
    );
  }

  const scheduledStart = parseIsoDateTime(input.scheduledStart, "scheduledStart");
  const scheduledEnd = parseIsoDateTime(input.scheduledEnd, "scheduledEnd");

  if (
    activeHold.technicianId !== input.technicianId ||
    activeHold.startTime.getTime() !== scheduledStart.getTime() ||
    activeHold.endTime.getTime() !== scheduledEnd.getTime()
  ) {
    throw new AppError(
      ErrorCode.CONFLICT,
      "Confirmation must match the active slot hold"
    );
  }
}

async function clearBookingSlotHolds(
  companyId: string,
  bookingRequestId: string,
  executor: TransactionExecutor
): Promise<void> {
  const holdNote = buildBookingSlotHoldNote(bookingRequestId);
  const existingHolds = await executor
    .select()
    .from(scheduleSlots)
    .where(
      and(
        eq(scheduleSlots.companyId, companyId),
        eq(scheduleSlots.notes, holdNote),
        isNull(scheduleSlots.deletedAt)
      )
    );

  const now = new Date();

  for (const slot of existingHolds) {
    await executor
      .update(scheduleSlots)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(scheduleSlots.id, slot.id));
  }
}

async function assertTechnicianScheduleSlotAvailable(
  companyId: string,
  technicianId: string,
  scheduledStart: Date,
  scheduledEnd: Date,
  executor: TransactionExecutor,
  ignoreBookingRequestId?: string
): Promise<void> {
  const companySlots = await executor
    .select()
    .from(scheduleSlots)
    .where(
      and(
        eq(scheduleSlots.companyId, companyId),
        eq(scheduleSlots.technicianId, technicianId),
        isNull(scheduleSlots.deletedAt)
      )
    );

  const ignoreNote = ignoreBookingRequestId ? buildBookingSlotHoldNote(ignoreBookingRequestId) : null;
  const hasConflict = companySlots.some((slot) => {
    if (ignoreNote && slot.notes === ignoreNote) {
      return false;
    }

    return (
      slot.startTime.getTime() < scheduledEnd.getTime() && slot.endTime.getTime() > scheduledStart.getTime()
    );
  });

  if (hasConflict) {
    throw new AppError(ErrorCode.CONFLICT, "Selected slot is no longer available");
  }
}

async function holdBookingSlot(
  companyId: string,
  bookingRequestId: string,
  input: HoldBookingSlotInput,
  _actor: BookingActor
): Promise<{ bookingRequest: BookingRequest; hold: BookingSlotHoldView }> {
  const scheduledStart = parseIsoDateTime(input.scheduledStart, "scheduledStart");
  const scheduledEnd = parseIsoDateTime(input.scheduledEnd, "scheduledEnd");

  if (scheduledEnd.getTime() <= scheduledStart.getTime()) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "scheduledEnd must be after scheduledStart");
  }

  return db.transaction(async (tx) => {
    const bookingRequest = await getBookingRequestRecord(companyId, bookingRequestId, tx);
    assertNonTerminalBookingRequest(bookingRequest.status as BookingRequestStatus, "held");

    const [technician] = await tx
      .select()
      .from(technicians)
      .where(
        and(
          eq(technicians.companyId, companyId),
          eq(technicians.id, input.technicianId),
          isNull(technicians.deletedAt)
        )
      )
      .limit(1);

    if (!technician) {
      throw new AppError(ErrorCode.NOT_FOUND, "Technician not found");
    }

    await assertTechnicianScheduleSlotAvailable(
      companyId,
      input.technicianId,
      scheduledStart,
      scheduledEnd,
      tx,
      bookingRequestId
    );

    await clearBookingSlotHolds(companyId, bookingRequestId, tx);

    await tx.insert(scheduleSlots).values({
      companyId,
      technicianId: input.technicianId,
      jobId: null,
      startTime: scheduledStart,
      endTime: scheduledEnd,
      isConfirmed: false,
      notes: buildBookingSlotHoldNote(bookingRequestId)
    });

    const updatedRows = await tx
      .update(bookingRequests)
      .set({
        assignedTechnicianId: input.technicianId,
        preferredDate: formatDateOnly(scheduledStart),
        updatedAt: new Date()
      })
      .where(
        and(
          eq(bookingRequests.companyId, companyId),
          eq(bookingRequests.id, bookingRequest.id),
          isNull(bookingRequests.deletedAt)
        )
      )
      .returning();
    const updatedRequest = updatedRows[0];

    if (!updatedRequest) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to hold booking slot");
    }

    return {
      bookingRequest: toBookingRequest(updatedRequest),
      hold: {
        technicianId: input.technicianId,
        scheduledStart: scheduledStart.toISOString(),
        scheduledEnd: scheduledEnd.toISOString()
      }
    };
  });
}

export async function inspectPublicBookingHoldToken(
  slug: string,
  holdToken: string
): Promise<BookingHoldTokenInspection & { slugMatches: boolean }> {
  const inspection = inspectBookingHoldToken(holdToken);

  if (inspection.status === "invalid" || !inspection.companyId) {
    return {
      ...inspection,
      slugMatches: false
    };
  }

  const { settings } = await getCompanyByBookingSlug(slug, db);

  return {
    ...inspection,
    slugMatches: settings.companyId === inspection.companyId
  };
}

export async function holdPublicBookingSlot(
  slug: string,
  referenceNumber: string,
  input: PublicHoldBookingSlotInput
): Promise<{ bookingRequest: BookingRequest; hold: BookingSlotHoldView }> {
  const normalizedRef = referenceNumber.trim();
  const claims = await verifyAndClaimBookingHoldToken(input.holdToken);

  try {
    const { settings } = await getCompanyByBookingSlug(slug, db);

    if (claims.companyId !== settings.companyId) {
      throw new AppError(ErrorCode.FORBIDDEN, "Hold token is not valid for this booking page");
    }

    if (claims.referenceNumber !== normalizedRef) {
      throw new AppError(ErrorCode.FORBIDDEN, "Hold token does not match booking reference");
    }

    const bookingRequest = await getBookingRequestRecord(settings.companyId, claims.bookingRequestId, db);

    if (bookingRequest.referenceNumber !== normalizedRef) {
      throw new AppError(ErrorCode.NOT_FOUND, "Booking request not found");
    }

    const coverage = await checkZipCoverage(slug, bookingRequest.zip);

    if (!coverage.covered) {
      throw new AppError(ErrorCode.CONFLICT, "This zip code is outside the current booking area");
    }

    const scheduledStart = parseIsoDateTime(input.scheduledStart, "scheduledStart");
    const scheduledEnd = parseIsoDateTime(input.scheduledEnd, "scheduledEnd");

    await assertHoldSlotMatchesPublishedAvailability(
      slug,
      bookingRequest.zip,
      input.technicianId,
      scheduledStart,
      scheduledEnd
    );

    const { holdToken: _holdToken, ...holdInput } = input;

    return await holdBookingSlot(settings.companyId, bookingRequest.id, holdInput, {
      id: null,
      type: "customer",
      name: `${bookingRequest.firstName} ${bookingRequest.lastName}`.trim()
    });
  } catch (error) {
    await finalizeBookingHoldTokenClaim(claims, error);
    throw error;
  }
}

export async function confirmPublicBookingSlot(
  slug: string,
  referenceNumber: string,
  input: ConfirmBookingRequestInput
): Promise<{
  bookingRequest: BookingRequest;
  jobId: string;
  recurringSchedule: Awaited<ReturnType<typeof attachConfirmedBookingToRecurringSchedules>>;
  manageToken: string | null;
}> {
  const normalizedRef = referenceNumber.trim();
  const { settings } = await getCompanyByBookingSlug(slug, db);
  const bookingRows = await db
    .select()
    .from(bookingRequests)
    .where(
      and(
        eq(bookingRequests.companyId, settings.companyId),
        eq(bookingRequests.referenceNumber, normalizedRef),
        isNull(bookingRequests.deletedAt)
      )
    )
    .limit(1);
  const bookingRow = bookingRows[0];

  if (!bookingRow) {
    throw new AppError(ErrorCode.NOT_FOUND, "Booking request not found");
  }

  const actor: BookingActor = {
    id: null,
    type: "customer",
    name: `${bookingRow.firstName} ${bookingRow.lastName}`.trim()
  };

  const confirmed = await confirmBookingWithActor(settings.companyId, bookingRow.id, input, actor, {
    confirmedById: null,
    requireActiveHold: true
  });

  if (!confirmed.jobId) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Confirmed booking is missing job linkage");
  }

  const manageToken = issueBookingManageTokenIfEligible(
    {
      companyId: settings.companyId,
      bookingRequestId: confirmed.bookingRequest.id,
      jobId: confirmed.jobId,
      bookingSlug: slug,
      referenceNumber: normalizedRef
    },
    { linked: confirmed.recurringSchedule.linked, scheduleKind: confirmed.recurringSchedule.scheduleKind }
  );

  return {
    bookingRequest: confirmed.bookingRequest,
    jobId: confirmed.jobId,
    recurringSchedule: confirmed.recurringSchedule,
    manageToken
  };
}

export async function holdBookingSlotForOperator(
  companyId: string,
  actorId: string,
  bookingRequestId: string,
  input: HoldBookingSlotInput
): Promise<{ bookingRequest: BookingRequest; hold: BookingSlotHoldView }> {
  const actorUser = await getActor(companyId, actorId, db);

  return holdBookingSlot(companyId, bookingRequestId, input, {
    id: actorUser.id,
    type: "user",
    name: buildActorName(actorUser.firstName, actorUser.lastName)
  });
}

export async function getBookingSettings(companyId: string): Promise<BookingSettings> {
  return db.transaction(async (tx) => {
    const settings = await ensureBookingSettingsRow(companyId, tx);
    return toBookingSettings(settings);
  });
}

export async function checkBookingSlugAvailability(
  companyId: string,
  slug: string
): Promise<{ slug: string; available: boolean }> {
  const normalizedSlug = normalizeBookingSlug(slug);

  if (!BOOKING_SLUG_PATTERN.test(normalizedSlug)) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "booking slug must use lowercase letters, numbers, and hyphens only"
    );
  }

  return {
    slug: normalizedSlug,
    available: await isBookingSlugAvailable(companyId, normalizedSlug, db)
  };
}

export async function updateBookingSettings(
  companyId: string,
  actorId: string,
  input: UpdateBookingSettingsInput
): Promise<BookingSettings> {
  return db.transaction(async (tx) => {
    await getActor(companyId, actorId, tx);
    const existingSettings = await ensureBookingSettingsRow(companyId, tx);
    const normalizedBookingSlug = input.bookingSlug !== undefined ? normalizeBookingSlug(input.bookingSlug) : undefined;

    if (normalizedBookingSlug !== undefined) {
      if (!BOOKING_SLUG_PATTERN.test(normalizedBookingSlug)) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          "booking slug must use lowercase letters, numbers, and hyphens only"
        );
      }

      await assertBookingSlugAvailable(companyId, normalizedBookingSlug, tx);
    }

    const updatedRows = await tx
      .update(bookingSettings)
      .set({
        ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
        ...(normalizedBookingSlug !== undefined ? { bookingSlug: normalizedBookingSlug } : {}),
        ...(input.offeredServices !== undefined ? { offeredServices: input.offeredServices } : {}),
        ...(input.availableHoursStart !== undefined ? { availableHoursStart: input.availableHoursStart } : {}),
        ...(input.availableHoursEnd !== undefined ? { availableHoursEnd: input.availableHoursEnd } : {}),
        ...(input.availableDays !== undefined ? { availableDays: input.availableDays } : {}),
        ...(input.slotDuration !== undefined ? { slotDuration: input.slotDuration } : {}),
        ...(input.maxAdvanceDays !== undefined ? { maxAdvanceDays: input.maxAdvanceDays } : {}),
        ...(input.autoConfirm !== undefined ? { autoConfirm: input.autoConfirm } : {}),
        ...(input.googleReviewUrl !== undefined ? { googleReviewUrl: normalizeOptionalString(input.googleReviewUrl) ?? null } : {}),
        ...(input.yelpReviewUrl !== undefined ? { yelpReviewUrl: normalizeOptionalString(input.yelpReviewUrl) ?? null } : {}),
        ...(input.facebookReviewUrl !== undefined ? { facebookReviewUrl: normalizeOptionalString(input.facebookReviewUrl) ?? null } : {}),
        ...(input.customReviewUrl !== undefined ? { customReviewUrl: normalizeOptionalString(input.customReviewUrl) ?? null } : {}),
        ...(input.tagline !== undefined ? { tagline: normalizeOptionalString(input.tagline) ?? null } : {}),
        ...(input.allowZipOverflow !== undefined ? { allowZipOverflow: input.allowZipOverflow } : {}),
        ...(input.balanceWorkload !== undefined ? { balanceWorkload: input.balanceWorkload } : {}),
        ...(input.notifyOnNewBooking !== undefined ? { notifyOnNewBooking: input.notifyOnNewBooking } : {}),
        ...(input.notificationEmail !== undefined ? { notificationEmail: normalizeOptionalEmail(input.notificationEmail) ?? null } : {}),
        updatedAt: new Date()
      })
      .where(and(eq(bookingSettings.companyId, companyId), eq(bookingSettings.id, existingSettings.id), isNull(bookingSettings.deletedAt)))
      .returning();
    const updatedSettings = updatedRows[0];

    if (!updatedSettings) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to update booking settings");
    }

    return toBookingSettings(updatedSettings);
  });
}

export async function submitBookingRequest(
  slug: string,
  input: SubmitBookingRequestInput,
  sourceParam?: string
): Promise<{ bookingRequest: BookingRequest; confirmation: BookingConfirmationView; holdToken: string | null }> {
  const { company, settings } = await getCompanyByBookingSlug(slug, db);
  const normalizedInput: NormalizedBookingInput = {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    phone: normalizePhone(input.phone),
    email: normalizeOptionalEmail(input.email) ?? null,
    addressLine1: input.addressLine1.trim(),
    addressLine2: normalizeOptionalString(input.addressLine2) ?? null,
    city: input.city.trim(),
    state: input.state.trim(),
    zip: input.zip.trim(),
    propertyType: normalizeOptionalString(input.propertyType) ?? null,
    serviceCategory: normalizeOptionalString(input.serviceCategory) ?? null,
    serviceType: normalizeOptionalString(input.serviceType) ?? null,
    serviceDetail: normalizeOptionalString(input.serviceDetail) ?? null,
    urgency: input.urgency ?? "this_week",
    customerNotes: normalizeOptionalString(input.customerNotes) ?? null,
    preferredDate: parseDateOnly(input.preferredDate),
    preferredWindow: input.preferredWindow ?? "first_available",
    isPropertyOwner: input.isPropertyOwner ?? false,
    smsConsentAppointments: input.smsConsentAppointments ?? false,
    smsConsentMarketing: input.smsConsentMarketing ?? false
  };
  const source = deriveSource(sourceParam ?? input.source);
  const coverage = await checkZipCoverage(slug, normalizedInput.zip);

  if (!coverage.covered) {
    throw new AppError(ErrorCode.CONFLICT, "This zip code is outside the current booking area");
  }

  const result = await db.transaction(async (tx) => {
    const actor: BookingActor = {
      id: null,
      type: "customer",
      name: `${normalizedInput.firstName} ${normalizedInput.lastName}`.trim()
    };
    const existingCustomer = await findCustomerByContact(company.id, normalizedInput.phone, normalizedInput.email, tx);
    const customer =
      existingCustomer ??
      (await createCustomerForBooking(company.id, normalizedInput, tx, actor));
    const property =
      (await findPropertyForCustomer(company.id, customer.id, normalizedInput, tx)) ??
      (await createPropertyForBooking(company.id, customer.id, normalizedInput, tx, actor));
    const insertedRows = await tx
      .insert(bookingRequests)
      .values({
        companyId: company.id,
        customerId: customer.id,
        firstName: normalizedInput.firstName,
        lastName: normalizedInput.lastName,
        phone: normalizedInput.phone,
        email: normalizedInput.email,
        addressLine1: normalizedInput.addressLine1,
        addressLine2: normalizedInput.addressLine2,
        city: normalizedInput.city,
        state: normalizedInput.state,
        zip: normalizedInput.zip,
        propertyType: normalizedInput.propertyType,
        serviceCategory: normalizedInput.serviceCategory,
        serviceType: normalizedInput.serviceType,
        serviceDetail: normalizedInput.serviceDetail,
        urgency: normalizedInput.urgency ?? "this_week",
        customerNotes: normalizedInput.customerNotes,
        preferredDate: normalizedInput.preferredDate,
        preferredWindow: normalizedInput.preferredWindow ?? "first_available",
        status: settings.autoConfirm ? "confirmed" : "pending",
        source,
        referenceNumber: buildReferenceNumber(new Date()),
        isPropertyOwner: input.isPropertyOwner ?? false,
        smsConsentAppointments: input.smsConsentAppointments ?? false,
        smsConsentMarketing: input.smsConsentMarketing ?? false,
        confirmedAt: settings.autoConfirm ? new Date() : null,
        confirmationSentAt: new Date()
      })
      .returning();
    const bookingRequest = insertedRows[0];

    if (!bookingRequest) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create booking request");
    }

    await emitEventWithExecutor(tx, {
      companyId: company.id,
      eventType: "booking.requested",
      actorType: "customer",
      actorName: actor.name,
      entityType: "booking_request",
      entityId: bookingRequest.id,
      customerId: customer.id,
      payload: {
        source,
        zip: bookingRequest.zip
      },
      summary: `Booking request ${bookingRequest.referenceNumber ?? bookingRequest.id} submitted`
    });

    let createdJob: JobRow | null = null;
    const queueJobs: Array<{ name: string; data: Record<string, unknown> }> = [];

    if (settings.autoConfirm) {
      const technicianRows = await listCompanyTechnicians(company.id, tx);
      const assignedTechnician = filterTechniciansByZip(technicianRows, normalizedInput.zip)[0] ?? technicianRows[0] ?? null;

      if (!assignedTechnician) {
        throw new AppError(ErrorCode.CONFLICT, "No technicians are available for auto-confirm booking");
      }

      const startDate = normalizedInput.preferredDate ?? formatDateOnly(new Date());
      const window = normalizedInput.preferredWindow === "afternoon" ? "afternoon" : "morning";
      const scheduledStart = createUtcDate(startDate, window === "afternoon" ? 13 : settings.availableHoursStart ?? 8);
      const scheduledEnd = new Date(
        scheduledStart.getTime() + (settings.slotDuration ?? DEFAULT_SLOT_DURATION) * 60 * 60 * 1000
      );

      createdJob = await createJobFromBooking(
        company.id,
        bookingRequest,
        customer.id,
        property.id,
        assignedTechnician.id,
        scheduledStart,
        scheduledEnd,
        tx,
        actor
      );

      const [updatedBookingRequest] = await tx
        .update(bookingRequests)
        .set({
          jobId: createdJob.id,
          assignedTechnicianId: assignedTechnician.id,
          confirmedAt: new Date(),
          updatedAt: new Date()
        })
        .where(
          and(eq(bookingRequests.companyId, company.id), eq(bookingRequests.id, bookingRequest.id), isNull(bookingRequests.deletedAt))
        )
        .returning();

      if (updatedBookingRequest) {
        await emitEventWithExecutor(tx, {
          companyId: company.id,
          eventType: "booking.confirmed",
          actorType: "system",
          entityType: "booking_request",
          entityId: updatedBookingRequest.id,
          customerId: customer.id,
          jobId: createdJob.id,
          payload: {
            technicianId: assignedTechnician.id,
            scheduledStart: createdJob.scheduledStart?.toISOString() ?? null
          },
          summary: `Booking ${updatedBookingRequest.referenceNumber ?? updatedBookingRequest.id} auto-confirmed`
        });
      }

      queueJobs.push({
        name: "send-booking-confirmation",
        data: buildBookingCustomerNotificationJobData({
          companyId: company.id,
          bookingRequest,
          customerId: customer.id,
          companyName: company.name,
          body: buildConfirmedCustomerMessage(company.name, bookingRequest.referenceNumber ?? bookingRequest.id, scheduledStart),
          scheduledStart
        })
      });
    } else {
      if (settings.notifyOnNewBooking) {
        const dispatcherPhones = await getDispatcherPhones(company.id, tx);

        for (const phone of dispatcherPhones) {
          queueJobs.push({
            name: "send-booking-request-alert",
            data: {
              companyId: company.id,
              bookingRequestId: bookingRequest.id,
              toPhone: phone,
              body: buildDispatcherAlertMessage(company.name, bookingRequest)
            }
          });
        }
      }

      queueJobs.push({
        name: "send-booking-confirmation",
        data: buildBookingCustomerNotificationJobData({
          companyId: company.id,
          bookingRequest,
          customerId: customer.id,
          companyName: company.name,
          body: buildPendingCustomerMessage(company.name, bookingRequest.referenceNumber ?? bookingRequest.id)
        })
      });
    }

    return {
      bookingRequest: toBookingRequest(bookingRequest),
      companyName: company.name,
      createdJob,
      queueJobs
    };
  });

  for (const queueJob of result.queueJobs) {
    await notificationsQueue.add(queueJob.name, queueJob.data);
  }

  if (result.createdJob?.scheduledStart) {
    await invalidateDispatchCache(result.bookingRequest.companyId, formatDateOnly(result.createdJob.scheduledStart));
  }

  const holdToken =
    result.bookingRequest.status === "pending"
      ? generateBookingHoldToken({
          companyId: result.bookingRequest.companyId,
          bookingRequestId: result.bookingRequest.id,
          referenceNumber: result.bookingRequest.referenceNumber ?? result.bookingRequest.id
        })
      : null;

  return {
    bookingRequest: result.bookingRequest,
    confirmation: buildConfirmationView(result.companyName, result.bookingRequest as BookingRequestRow, result.createdJob),
    holdToken
  };
}

async function confirmBookingWithActor(
  companyId: string,
  bookingRequestId: string,
  input: ConfirmBookingRequestInput,
  actor: BookingActor,
  options: { confirmedById: string | null; requireActiveHold?: boolean }
): Promise<{
  bookingRequest: BookingRequest;
  jobId: string;
  companyName: string;
  scheduledStart: Date;
  recurringSchedule: Awaited<ReturnType<typeof attachConfirmedBookingToRecurringSchedules>>;
}> {
  const scheduledStart = parseIsoDateTime(input.scheduledStart, "scheduledStart");
  const scheduledEnd = parseIsoDateTime(input.scheduledEnd, "scheduledEnd");

  if (scheduledEnd.getTime() <= scheduledStart.getTime()) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "scheduledEnd must be after scheduledStart");
  }

  const result = await db.transaction(async (tx) => {
    const bookingRequest = await getBookingRequestRecord(companyId, bookingRequestId, tx);

    assertNonTerminalBookingRequest(bookingRequest.status as BookingRequestStatus, "confirmed");

    if (options.requireActiveHold) {
      await assertActiveHoldMatchesSelection(companyId, bookingRequestId, input, tx);
    }

    await assertTechnicianScheduleSlotAvailable(
      companyId,
      input.technicianId,
      scheduledStart,
      scheduledEnd,
      tx,
      bookingRequestId
    );

    const company = await getCompanyById(companyId, tx);
    const normalizedInput: NormalizedBookingInput = {
      firstName: bookingRequest.firstName,
      lastName: bookingRequest.lastName,
      phone: bookingRequest.phone,
      email: bookingRequest.email ?? null,
      addressLine1: bookingRequest.addressLine1,
      addressLine2: bookingRequest.addressLine2 ?? null,
      city: bookingRequest.city,
      state: bookingRequest.state,
      zip: bookingRequest.zip,
      propertyType: bookingRequest.propertyType ?? null,
      serviceCategory: bookingRequest.serviceCategory ?? null,
      serviceType: bookingRequest.serviceType ?? null,
      serviceDetail: bookingRequest.serviceDetail ?? null,
      urgency: bookingRequest.urgency as SubmitBookingRequestInput["urgency"],
      customerNotes: bookingRequest.customerNotes ?? null,
      preferredDate: bookingRequest.preferredDate ?? null,
      preferredWindow: bookingRequest.preferredWindow as SubmitBookingRequestInput["preferredWindow"],
      isPropertyOwner: bookingRequest.isPropertyOwner ?? false,
      smsConsentAppointments: bookingRequest.smsConsentAppointments ?? false,
      smsConsentMarketing: bookingRequest.smsConsentMarketing ?? false
    };
    const customer =
      (bookingRequest.customerId
        ? await findCustomerByContact(companyId, bookingRequest.phone, bookingRequest.email, tx)
        : null) ??
      (await createCustomerForBooking(companyId, normalizedInput, tx, actor));
    const property =
      (await findPropertyForCustomer(companyId, customer.id, normalizedInput, tx)) ??
      (await createPropertyForBooking(companyId, customer.id, normalizedInput, tx, actor));
    await clearBookingSlotHolds(companyId, bookingRequest.id, tx);

    const job = await createJobFromBooking(
      companyId,
      bookingRequest,
      customer.id,
      property.id,
      input.technicianId,
      scheduledStart,
      scheduledEnd,
      tx,
      actor
    );
    const recurringSchedule = await attachConfirmedBookingToRecurringSchedules(
      companyId,
      bookingRequest,
      customer.id,
      job,
      tx,
      actor
    );
    const updatedRows = await tx
      .update(bookingRequests)
      .set({
        customerId: customer.id,
        jobId: job.id,
        assignedTechnicianId: input.technicianId,
        status: "confirmed",
        confirmedAt: new Date(),
        confirmedById: options.confirmedById,
        confirmationSentAt: new Date(),
        updatedAt: new Date()
      })
      .where(
        and(eq(bookingRequests.companyId, companyId), eq(bookingRequests.id, bookingRequest.id), isNull(bookingRequests.deletedAt))
      )
      .returning();
    const updatedRequest = updatedRows[0];

    if (!updatedRequest) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to confirm booking request");
    }

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "booking.confirmed",
      actorId: actor.id ?? undefined,
      actorType: actor.type,
      actorName: actor.name,
      entityType: "booking_request",
      entityId: updatedRequest.id,
      customerId: customer.id,
      jobId: job.id,
      payload: {
        technicianId: input.technicianId,
        scheduledStart: scheduledStart.toISOString(),
        scheduledEnd: scheduledEnd.toISOString(),
        recurringSchedule
      },
      summary: `Booking ${updatedRequest.referenceNumber ?? updatedRequest.id} confirmed`
    });

    return {
      bookingRequest: toBookingRequest(updatedRequest),
      jobId: job.id,
      companyName: company.name,
      scheduledStart,
      recurringSchedule
    };
  });

  await notificationsQueue.add(
    "send-booking-confirmation",
    buildBookingCustomerNotificationJobData({
      companyId,
      bookingRequest: result.bookingRequest,
      customerId: result.bookingRequest.customerId ?? "",
      companyName: result.companyName,
      body: buildConfirmedCustomerMessage(
        result.companyName,
        result.bookingRequest.referenceNumber ?? result.bookingRequest.id,
        result.scheduledStart
      ),
      scheduledStart: result.scheduledStart
    })
  );
  await invalidateDispatchCache(companyId, formatDateOnly(result.scheduledStart));
  return result;
}

export async function confirmBookingRequest(
  companyId: string,
  actorId: string,
  bookingRequestId: string,
  input: ConfirmBookingRequestInput
): Promise<BookingRequest> {
  const actorUser = await getActor(companyId, actorId, db);
  const actor: BookingActor = {
    id: actorUser.id,
    type: "user",
    name: buildActorName(actorUser.firstName, actorUser.lastName)
  };

  const result = await confirmBookingWithActor(companyId, bookingRequestId, input, actor, {
    confirmedById: actorId
  });

  return result.bookingRequest;
}

export async function declineBookingRequest(
  companyId: string,
  actorId: string,
  bookingRequestId: string,
  reason?: string
): Promise<BookingRequest> {
  const result = await db.transaction(async (tx) => {
    const actor = await getActor(companyId, actorId, tx);
    const company = await getCompanyById(companyId, tx);
    const bookingRequest = await getBookingRequestRecord(companyId, bookingRequestId, tx);

    if (bookingRequest.status === "cancelled") {
      return {
        bookingRequest: toBookingRequest(bookingRequest),
        companyName: company.name
      };
    }

    const updatedRows = await tx
      .update(bookingRequests)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancellationReason: normalizeOptionalString(reason) ?? null,
        updatedAt: new Date()
      })
      .where(
        and(eq(bookingRequests.companyId, companyId), eq(bookingRequests.id, bookingRequest.id), isNull(bookingRequests.deletedAt))
      )
      .returning();
    const updatedRequest = updatedRows[0];

    if (!updatedRequest) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to decline booking request");
    }

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "booking.cancelled",
      actorId,
      actorType: "user",
      actorName: buildActorName(actor.firstName, actor.lastName),
      entityType: "booking_request",
      entityId: updatedRequest.id,
      customerId: updatedRequest.customerId ?? undefined,
      payload: {
        reason: normalizeOptionalString(reason) ?? null
      },
      summary: `Booking ${updatedRequest.referenceNumber ?? updatedRequest.id} declined`
    });

    return {
      bookingRequest: toBookingRequest(updatedRequest),
      companyName: company.name
    };
  });

  await notificationsQueue.add(
    "send-booking-decline",
    buildBookingCustomerNotificationJobData({
      companyId,
      bookingRequest: result.bookingRequest,
      customerId: result.bookingRequest.customerId ?? "",
      companyName: result.companyName,
      body: buildDeclinedCustomerMessage(
        result.companyName,
        result.bookingRequest.referenceNumber ?? result.bookingRequest.id,
        normalizeOptionalString(reason) ?? null
      ),
      reason: normalizeOptionalString(reason) ?? null
    })
  );

  return result.bookingRequest;
}

export async function captureBookingInterest(
  slug: string,
  zip: string,
  email: string
): Promise<{ success: true }> {
  await getCompanyByBookingSlug(slug, db);

  if (!/^\d{5}$/u.test(zip.trim())) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "zip must be a valid 5-digit ZIP code");
  }

  if (email.trim().length === 0) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "email is required");
  }

  return { success: true };
}

export async function getBookingRequestStats(
  companyId: string,
  days?: number
): Promise<{
  totalRequests: number;
  confirmationRate: number;
  confirmedBookings: number;
  estimatedRevenue: string;
  bySource: Array<{ source: string; count: number }>;
}> {
  const normalizedDays = normalizeDaysRange(days);
  const rangeStart = buildRangeStart(normalizedDays);
  const [requests, companyJobs] = await Promise.all([
    db
      .select()
      .from(bookingRequests)
      .where(and(eq(bookingRequests.companyId, companyId), isNull(bookingRequests.deletedAt))),
    db
      .select()
      .from(jobs)
      .where(and(eq(jobs.companyId, companyId), isNull(jobs.deletedAt)))
  ]);

  const filteredRequests = requests.filter((request) => request.createdAt.getTime() >= rangeStart.getTime());
  const bySourceMap = new Map<string, number>();
  let confirmedBookings = 0;
  let estimatedRevenue = new Decimal(0);
  const jobsById = new Map(companyJobs.map((job) => [job.id, job]));

  for (const request of filteredRequests) {
    bySourceMap.set(request.source, (bySourceMap.get(request.source) ?? 0) + 1);

    if (request.status === "confirmed" || request.status === "completed") {
      confirmedBookings += 1;
    }

    if (request.jobId) {
      const linkedJob = jobsById.get(request.jobId);
      if (linkedJob) {
        estimatedRevenue = estimatedRevenue.add(linkedJob.invoiceTotal ?? linkedJob.estimateTotal ?? "0");
      }
    }
  }

  return {
    totalRequests: filteredRequests.length,
    confirmationRate:
      filteredRequests.length === 0 ? 0 : Math.round((confirmedBookings / filteredRequests.length) * 100),
    confirmedBookings,
    estimatedRevenue: estimatedRevenue.toFixed(2),
    bySource: Array.from(bySourceMap.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((left, right) => right.count - left.count)
  };
}

export async function getBookingDemandByZip(
  companyId: string,
  days?: number
): Promise<Array<{ zip: string; count: number }>> {
  const normalizedDays = normalizeDaysRange(days);
  const rangeStart = buildRangeStart(normalizedDays);
  const requests = await db
    .select()
    .from(bookingRequests)
    .where(and(eq(bookingRequests.companyId, companyId), isNull(bookingRequests.deletedAt)));
  const zipMap = new Map<string, number>();

  for (const request of requests) {
    if (request.createdAt.getTime() < rangeStart.getTime()) {
      continue;
    }

    const zip = request.zip.trim();
    if (zip.length === 0) {
      continue;
    }

    zipMap.set(zip, (zipMap.get(zip) ?? 0) + 1);
  }

  return Array.from(zipMap.entries())
    .map(([zip, count]) => ({ zip, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);
}

export async function getBookingConfirmation(slug: string, referenceNumber: string): Promise<BookingConfirmationView> {
  const { company, settings } = await getCompanyByBookingSlug(slug, db);
  const [bookingRequest] = await db
    .select()
    .from(bookingRequests)
    .where(
      and(
        eq(bookingRequests.companyId, settings.companyId),
        eq(bookingRequests.referenceNumber, referenceNumber),
        isNull(bookingRequests.deletedAt)
      )
    )
    .limit(1);

  if (!bookingRequest) {
    throw new AppError(ErrorCode.NOT_FOUND, "Booking confirmation not found");
  }

  const [job] = bookingRequest.jobId
    ? await db
        .select()
        .from(jobs)
        .where(and(eq(jobs.companyId, settings.companyId), eq(jobs.id, bookingRequest.jobId), isNull(jobs.deletedAt)))
        .limit(1)
    : [];

  return buildConfirmationView(company.name, bookingRequest, job ?? null);
}

export interface CompanyInquiryBookingInput {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
  customerNotes: string | null;
  source: BookingRequest["source"];
  smsConsentAppointments?: boolean;
  smsConsentMarketing?: boolean;
}

/** Staff/inbox inquiry intake — no zip gate, no outbound notification enqueue (FS-17). */
export async function createCompanyScopedInquiryBooking(
  companyId: string,
  input: CompanyInquiryBookingInput,
  actor: BookingActor
): Promise<{ bookingRequest: BookingRequest; customerId: string }> {
  const normalizedInput: NormalizedBookingInput = {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    phone: normalizePhone(input.phone),
    email: normalizeOptionalEmail(input.email) ?? null,
    addressLine1: input.addressLine1.trim(),
    addressLine2: null,
    city: input.city.trim(),
    state: input.state.trim(),
    zip: input.zip.trim(),
    propertyType: null,
    serviceCategory: null,
    serviceType: null,
    serviceDetail: null,
    urgency: "flexible",
    customerNotes: normalizeOptionalString(input.customerNotes) ?? null,
    preferredDate: null,
    preferredWindow: "first_available",
    isPropertyOwner: true,
    smsConsentAppointments: input.smsConsentAppointments ?? false,
    smsConsentMarketing: input.smsConsentMarketing ?? false
  };

  const result = await db.transaction(async (tx) => {
    const existingCustomer = await findCustomerByContact(
      companyId,
      normalizedInput.phone,
      normalizedInput.email,
      tx
    );
    const customer =
      existingCustomer ??
      (await createCustomerForBooking(companyId, normalizedInput, tx, actor));
    const property =
      (await findPropertyForCustomer(companyId, customer.id, normalizedInput, tx)) ??
      (await createPropertyForBooking(companyId, customer.id, normalizedInput, tx, actor));

    const insertedRows = await tx
      .insert(bookingRequests)
      .values({
        companyId,
        customerId: customer.id,
        firstName: normalizedInput.firstName,
        lastName: normalizedInput.lastName,
        phone: normalizedInput.phone,
        email: normalizedInput.email,
        addressLine1: normalizedInput.addressLine1,
        addressLine2: normalizedInput.addressLine2,
        city: normalizedInput.city,
        state: normalizedInput.state,
        zip: normalizedInput.zip,
        customerNotes: normalizedInput.customerNotes,
        status: "pending",
        source: input.source,
        referenceNumber: buildReferenceNumber(new Date()),
        isPropertyOwner: true,
        smsConsentAppointments: normalizedInput.smsConsentAppointments ?? false,
        smsConsentMarketing: normalizedInput.smsConsentMarketing ?? false
      })
      .returning();
    const bookingRequest = insertedRows[0];

    if (!bookingRequest) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create inquiry booking request");
    }

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "booking.requested",
      actorId: actor.id ?? undefined,
      actorType: actor.type,
      actorName: actor.name,
      entityType: "booking_request",
      entityId: bookingRequest.id,
      customerId: customer.id,
      payload: {
        source: input.source,
        zip: bookingRequest.zip,
        intakePath: "direct_inquiry"
      },
      summary: `Inquiry ${bookingRequest.referenceNumber ?? bookingRequest.id} captured`
    });

    return { bookingRequest: toBookingRequest(bookingRequest), customerId: customer.id };
  });

  return result;
}
