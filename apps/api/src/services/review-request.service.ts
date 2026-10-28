import { and, eq, gte, isNull, sql } from "drizzle-orm";
import pino from "pino";

import {
  activityEvents,
  automationRules,
  bookingSettings,
  companies,
  customers,
  db,
  emitEventWithExecutor,
  invoices,
  jobs,
  reviewRequests,
  technicians,
  users
} from "@fsm/db";
import { notificationsQueue } from "@fsm/jobs";
import {
  AppError,
  ErrorCode,
  type CompleteReviewRequestInput,
  type CreateReviewRequestInput,
  type ListReviewRequestsQuery,
  type PaginatedResult,
  type PublicReviewLanding,
  type ReviewRequest,
  type ReviewRequestFunnelStats,
  type ReviewRequestListItem,
  type UpdateReviewRequestInput
} from "@fsm/types";

import { isOutboundSmsLive } from "../lib/sms.js";
import {
  customerCooldownDays,
  decideInvoicePaidReviewRequest,
  invoiceReviewRequestQueueJobId,
  routeReviewRating,
  type InvoicePaidReviewDecision,
  type ReviewRatingRoute
} from "./automation/review-request-policy.js";

type BookingSettingsRow = typeof bookingSettings.$inferSelect;
type CompanyRow = typeof companies.$inferSelect;
type CustomerRow = typeof customers.$inferSelect;
type JobRow = typeof jobs.$inferSelect;
type ReviewRequestRow = typeof reviewRequests.$inferSelect;
type TechnicianRow = typeof technicians.$inferSelect;
type UserRow = typeof users.$inferSelect;
type SelectExecutor = Pick<typeof db, "select">;
type TransactionExecutor = Pick<typeof db, "select" | "insert" | "update">;

const logger = pino({
  name: "review-request-service"
});

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

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

function getReviewSettings(settings: BookingSettingsRow | null): PublicReviewLanding["settings"] {
  return {
    google: {
      label: "Google",
      url: settings?.googleReviewUrl ?? null,
      isActive: Boolean(settings?.googleReviewUrl)
    },
    yelp: {
      label: "Yelp",
      url: settings?.yelpReviewUrl ?? null,
      isActive: Boolean(settings?.yelpReviewUrl)
    },
    facebook: {
      label: "Facebook",
      url: settings?.facebookReviewUrl ?? null,
      isActive: Boolean(settings?.facebookReviewUrl)
    },
    custom: {
      label: "Custom",
      url: settings?.customReviewUrl ?? null,
      isActive: Boolean(settings?.customReviewUrl)
    }
  };
}

function toReviewRequest(row: ReviewRequestRow): ReviewRequest {
  return {
    ...row,
    status: row.status as ReviewRequest["status"],
    channel: (row.channel ?? "sms") as ReviewRequest["channel"]
  };
}

async function queueReviewRequestNotification(
  companyId: string,
  reviewRequest: ReviewRequestRow,
  executor: SelectExecutor
): Promise<void> {
  const [customer, company, technician] = await Promise.all([
    getCustomerRecord(companyId, reviewRequest.customerId, executor),
    getCompanyRecord(companyId, executor),
    reviewRequest.technicianId
      ? getTechnicianRecord(companyId, reviewRequest.technicianId, executor)
      : Promise.resolve(null)
  ]);

  await notificationsQueue.add("send-review-request", {
    companyId,
    reviewRequestId: reviewRequest.id,
    customerId: reviewRequest.customerId,
    customerPhone: customer.phone,
    referenceId: reviewRequest.referenceId,
    companyName: company.name,
    technicianName: technician ? `${technician.firstName} ${technician.lastName}`.trim() : null
  });
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

async function getTechnicianRecord(
  companyId: string,
  technicianId: string,
  executor: SelectExecutor
): Promise<TechnicianRow> {
  const [technician] = await executor
    .select()
    .from(technicians)
    .where(
      and(eq(technicians.companyId, companyId), eq(technicians.id, technicianId), isNull(technicians.deletedAt))
    )
    .limit(1);

  if (!technician) {
    throw new AppError(ErrorCode.NOT_FOUND, "Technician not found");
  }

  return technician;
}

async function getBookingSettingsRecord(companyId: string, executor: SelectExecutor): Promise<BookingSettingsRow | null> {
  const [settings] = await executor
    .select()
    .from(bookingSettings)
    .where(and(eq(bookingSettings.companyId, companyId), isNull(bookingSettings.deletedAt)))
    .limit(1);

  return settings ?? null;
}

async function getReviewRequestRecord(
  companyId: string,
  reviewRequestId: string,
  executor: SelectExecutor
): Promise<ReviewRequestRow> {
  const [reviewRequest] = await executor
    .select()
    .from(reviewRequests)
    .where(
      and(
        eq(reviewRequests.companyId, companyId),
        eq(reviewRequests.id, reviewRequestId),
        isNull(reviewRequests.deletedAt)
      )
    )
    .limit(1);

  if (!reviewRequest) {
    throw new AppError(ErrorCode.NOT_FOUND, "Review request not found");
  }

  return reviewRequest;
}

export async function createReviewRequest(
  companyId: string,
  actorId: string,
  jobId: string,
  input: CreateReviewRequestInput
): Promise<ReviewRequest> {
  const result = await db.transaction(async (tx: TransactionExecutor) => {
    const actor = await getActor(companyId, actorId, tx);
    const job = await getJobRecord(companyId, jobId, tx);
    const [customer, company, technician] = await Promise.all([
      getCustomerRecord(companyId, job.customerId, tx),
      getCompanyRecord(companyId, tx),
      job.technicianId ? getTechnicianRecord(companyId, job.technicianId, tx) : Promise.resolve(null)
    ]);
    const settings = await getBookingSettingsRecord(companyId, tx);
    const channel = input.channel ?? "sms";
    const now = new Date();
    const [existingOpenRequest] = (await tx
      .select()
      .from(reviewRequests)
      .where(
        and(
          eq(reviewRequests.companyId, companyId),
          eq(reviewRequests.jobId, jobId),
          isNull(reviewRequests.deletedAt)
        )
      ))
      .filter((reviewRequest) => reviewRequest.status !== "completed" && reviewRequest.status !== "declined");

    if (existingOpenRequest) {
      throw new AppError(ErrorCode.CONFLICT, "A review request is already open for this job");
    }

    const primaryReviewUrl =
      settings?.googleReviewUrl ??
      settings?.yelpReviewUrl ??
      settings?.facebookReviewUrl ??
      settings?.customReviewUrl ??
      null;
    const insertedRequests = await tx
      .insert(reviewRequests)
      .values({
        companyId,
        jobId: job.id,
        customerId: job.customerId,
        technicianId: job.technicianId,
        status: "sent",
        channel,
        reviewUrl: primaryReviewUrl,
        sentAt: now
      })
      .returning();
    const reviewRequest = insertedRequests[0];

    if (!reviewRequest) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create review request");
    }

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "review_request.sent",
      actorId: actor.id,
      actorType: "user",
      actorName: buildActorName(actor.firstName, actor.lastName),
      entityType: "review_request",
      entityId: reviewRequest.id,
      customerId: reviewRequest.customerId,
      jobId: reviewRequest.jobId,
      payload: {
        reviewRequestId: reviewRequest.id,
        referenceId: reviewRequest.referenceId,
        channel
      },
      summary: `Review request sent for ${job.jobNumber}`
    });

    return {
      reviewRequest: toReviewRequest(reviewRequest),
      queueData: {
        companyId,
        reviewRequestId: reviewRequest.id,
        customerId: reviewRequest.customerId,
        customerPhone: customer.phone,
        referenceId: reviewRequest.referenceId,
        companyName: company.name,
        technicianName: technician ? `${technician.firstName} ${technician.lastName}`.trim() : null
      }
    };
  });

  await notificationsQueue.add("send-review-request", result.queueData);
  logger.info({ companyId, jobId, reviewRequestId: result.reviewRequest.id }, "Queued review request");
  return result.reviewRequest;
}

export type PaidInvoiceReviewResult =
  | { status: "queued"; reviewRequestId: string; channel: "email" | "sms" }
  | { status: "skipped"; reason: Extract<InvoicePaidReviewDecision, { action: "skip" }>["reason"] | "invoice_not_found" };

/**
 * invoice.paid automation: reuses the review_requests table, the review_request.sent event and the
 * send-review-request notification job. Idempotent per invoice (activity_events.invoice_id on the
 * review_request.sent event + per-invoice advisory lock + BullMQ jobId), consent-aware and rate limited.
 */
export async function requestReviewForPaidInvoice(
  companyId: string,
  invoiceId: string,
  now: Date = new Date()
): Promise<PaidInvoiceReviewResult> {
  const smsLive = isOutboundSmsLive();
  const result = await db.transaction(async (tx: TransactionExecutor) => {
    const lockable = tx as unknown as { execute?: (query: unknown) => Promise<unknown> };
    if (typeof lockable.execute === "function") {
      await lockable.execute(sql`select pg_advisory_xact_lock(hashtext(${`review-request:invoice:${invoiceId}`}))`);
    }

    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.companyId, companyId), eq(invoices.id, invoiceId), isNull(invoices.deletedAt)))
      .limit(1);
    if (!invoice) {
      return { outcome: { status: "skipped", reason: "invoice_not_found" } as PaidInvoiceReviewResult };
    }

    const [rule] = await tx
      .select()
      .from(automationRules)
      .where(
        and(
          eq(automationRules.companyId, companyId),
          eq(automationRules.ruleType, "review_request"),
          isNull(automationRules.deletedAt)
        )
      )
      .limit(1);
    const ruleConfig =
      rule?.config && typeof rule.config === "object" && !Array.isArray(rule.config)
        ? (rule.config as Record<string, unknown>)
        : null;
    const customer = await getCustomerRecord(companyId, invoice.customerId, tx);

    const priorInvoiceEvents = await tx
      .select()
      .from(activityEvents)
      .where(
        and(
          eq(activityEvents.companyId, companyId),
          eq(activityEvents.eventType, "review_request.sent"),
          eq(activityEvents.invoiceId, invoice.id)
        )
      )
      .limit(1);

    const jobRequests = invoice.jobId
      ? await tx
          .select()
          .from(reviewRequests)
          .where(
            and(
              eq(reviewRequests.companyId, companyId),
              eq(reviewRequests.jobId, invoice.jobId),
              isNull(reviewRequests.deletedAt)
            )
          )
      : [];

    const cooldownStart = new Date(now.getTime() - customerCooldownDays(ruleConfig) * 24 * 60 * 60 * 1000);
    const customerRecent = await tx
      .select()
      .from(reviewRequests)
      .where(
        and(
          eq(reviewRequests.companyId, companyId),
          eq(reviewRequests.customerId, customer.id),
          gte(reviewRequests.createdAt, cooldownStart),
          isNull(reviewRequests.deletedAt)
        )
      );
    const companyRecent = await tx
      .select()
      .from(reviewRequests)
      .where(
        and(
          eq(reviewRequests.companyId, companyId),
          gte(reviewRequests.createdAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)),
          isNull(reviewRequests.deletedAt)
        )
      );

    const decision = decideInvoicePaidReviewRequest({
      invoiceStatus: invoice.status,
      rule: rule ? { isEnabled: rule.isEnabled, delayHours: rule.delayHours, config: ruleConfig } : null,
      customer: {
        email: customer.email,
        phone: customer.phone,
        prefersEmail: customer.prefersEmail,
        prefersSms: customer.prefersSms,
        doNotContact: customer.doNotContact
      },
      alreadyRequestedForInvoice: priorInvoiceEvents.length > 0,
      openRequestForJob: jobRequests.some((row) => row.status !== "completed" && row.status !== "declined"),
      customerRecentRequestCount: customerRecent.length,
      companyRequestsLast24h: companyRecent.length,
      smsLive
    });

    if (decision.action === "skip") {
      return { outcome: { status: "skipped", reason: decision.reason } as PaidInvoiceReviewResult };
    }

    const job = invoice.jobId ? await getJobRecord(companyId, invoice.jobId, tx) : null;
    const [company, technician, settings] = await Promise.all([
      getCompanyRecord(companyId, tx),
      job?.technicianId ? getTechnicianRecord(companyId, job.technicianId, tx) : Promise.resolve(null),
      getBookingSettingsRecord(companyId, tx)
    ]);
    const [reviewRequest] = await tx
      .insert(reviewRequests)
      .values({
        companyId,
        jobId: invoice.jobId,
        customerId: customer.id,
        technicianId: job?.technicianId ?? null,
        status: "sent",
        channel: decision.channel,
        reviewUrl: settings?.googleReviewUrl ?? null,
        sentAt: now
      })
      .returning();
    if (!reviewRequest) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create review request");
    }

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "review_request.sent",
      actorType: "system",
      actorName: "Review request automation",
      entityType: "review_request",
      entityId: reviewRequest.id,
      customerId: customer.id,
      invoiceId: invoice.id,
      ...(invoice.jobId ? { jobId: invoice.jobId } : {}),
      payload: {
        reviewRequestId: reviewRequest.id,
        referenceId: reviewRequest.referenceId,
        channel: decision.channel,
        trigger: "invoice.paid",
        invoiceId: invoice.id
      },
      summary: `Review request queued after invoice ${invoice.invoiceNumber} was paid`
    });

    return {
      outcome: { status: "queued", reviewRequestId: reviewRequest.id, channel: decision.channel } as PaidInvoiceReviewResult,
      delayMs: decision.delayMs,
      queueData: {
        companyId,
        reviewRequestId: reviewRequest.id,
        customerId: customer.id,
        invoiceId: invoice.id,
        channel: decision.channel,
        customerPhone: decision.channel === "sms" ? customer.phone : null,
        customerEmail: decision.channel === "email" ? customer.email : null,
        customerFirstName: customer.firstName,
        referenceId: reviewRequest.referenceId,
        companyName: company.name,
        technicianName: technician ? `${technician.firstName} ${technician.lastName}`.trim() : null
      }
    };
  });

  if (result.queueData) {
    await notificationsQueue.add("send-review-request", result.queueData, {
      jobId: invoiceReviewRequestQueueJobId(invoiceId),
      delay: result.delayMs ?? 0
    });
    logger.info({ companyId, invoiceId, reviewRequestId: result.queueData.reviewRequestId }, "Queued invoice.paid review request");
  } else {
    logger.info({ companyId, invoiceId, outcome: result.outcome }, "invoice.paid review request skipped");
  }
  return result.outcome;
}

export async function resendReviewRequest(
  companyId: string,
  reviewRequestId: string
): Promise<ReviewRequest> {
  const reviewRequest = await db.transaction(async (tx: TransactionExecutor) => {
    const existingReviewRequest = await getReviewRequestRecord(companyId, reviewRequestId, tx);

    if (existingReviewRequest.status === "completed") {
      throw new AppError(ErrorCode.CONFLICT, "Completed review requests cannot be resent");
    }

    if (existingReviewRequest.status === "declined") {
      throw new AppError(ErrorCode.CONFLICT, "Declined review requests cannot be resent");
    }

    const now = new Date();
    const updatedRows = await tx
      .update(reviewRequests)
      .set({
        status: "sent",
        sentAt: now,
        clickedAt: null,
        updatedAt: now
      })
      .where(
        and(
          eq(reviewRequests.companyId, companyId),
          eq(reviewRequests.id, reviewRequestId),
          isNull(reviewRequests.deletedAt)
        )
      )
      .returning();
    const updatedReviewRequest = updatedRows[0];

    if (!updatedReviewRequest) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to resend review request");
    }

    return updatedReviewRequest;
  });

  await queueReviewRequestNotification(companyId, reviewRequest, db);
  logger.info({ companyId, reviewRequestId }, "Queued review request resend");

  return toReviewRequest(reviewRequest);
}

export async function listReviewRequests(
  companyId: string,
  query: ListReviewRequestsQuery
): Promise<{ result: PaginatedResult<ReviewRequestListItem>; stats: ReviewRequestFunnelStats }> {
  const page = query.page && query.page > 0 ? query.page : DEFAULT_PAGE;
  const limit = query.limit && query.limit > 0 ? Math.min(query.limit, MAX_LIMIT) : DEFAULT_LIMIT;

  const [rows, customerRows, technicianRows, jobRows] = await Promise.all([
    db
      .select()
      .from(reviewRequests)
      .where(and(eq(reviewRequests.companyId, companyId), isNull(reviewRequests.deletedAt))),
    db.select().from(customers).where(and(eq(customers.companyId, companyId), isNull(customers.deletedAt))),
    db.select().from(technicians).where(and(eq(technicians.companyId, companyId), isNull(technicians.deletedAt))),
    db.select().from(jobs).where(and(eq(jobs.companyId, companyId), isNull(jobs.deletedAt)))
  ]);

  const filteredRows = rows
    .filter((row) => (query.status ? row.status === query.status : true))
    .filter((row) => (query.channel ? row.channel === query.channel : true))
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

  const customerById = new Map(customerRows.map((customer) => [customer.id, customer]));
  const technicianById = new Map(technicianRows.map((technician) => [technician.id, technician]));
  const jobById = new Map(jobRows.map((job) => [job.id, job]));
  const total = filteredRows.length;
  const totalPages = total === 0 ? 1 : Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const data = filteredRows.slice(startIndex, startIndex + limit).map((row) => {
    const customer = customerById.get(row.customerId);
    const technician = row.technicianId ? technicianById.get(row.technicianId) : null;
    const job = row.jobId ? jobById.get(row.jobId) : null;

    return {
      id: row.id,
      referenceId: row.referenceId,
      status: row.status as ReviewRequestListItem["status"],
      channel: (row.channel ?? "sms") as ReviewRequestListItem["channel"],
      sentAt: row.sentAt,
      completedAt: row.completedAt,
      rating: row.rating,
      customer: {
        id: customer?.id ?? row.customerId,
        firstName: customer?.firstName ?? "",
        lastName: customer?.lastName ?? "",
        phone: customer?.phone ?? null,
        email: customer?.email ?? null
      },
      technician: technician
        ? {
            id: technician.id,
            firstName: technician.firstName,
            lastName: technician.lastName
          }
        : null,
      job: job
        ? {
            id: job.id,
            jobNumber: job.jobNumber,
            title: job.title
          }
        : null,
      createdAt: row.createdAt
    };
  });

  const stats: ReviewRequestFunnelStats = {
    pending: rows.filter((row) => row.status === "pending").length,
    sent: rows.filter((row) => row.status === "sent").length,
    clicked: rows.filter((row) => row.status === "clicked").length,
    completed: rows.filter((row) => row.status === "completed").length,
    declined: rows.filter((row) => row.status === "declined").length,
    averageRating:
      rows.filter((row) => typeof row.rating === "number").length > 0
        ? Number(
            (
              rows
                .filter((row): row is ReviewRequestRow & { rating: number } => typeof row.rating === "number")
                .reduce((total, row) => total + row.rating, 0) /
              rows.filter((row) => typeof row.rating === "number").length
            ).toFixed(1)
          )
        : null
  };

  return {
    result: {
      data,
      total,
      page,
      limit,
      totalPages
    },
    stats
  };
}

export async function updateReviewRequest(
  companyId: string,
  actorId: string,
  reviewRequestId: string,
  input: UpdateReviewRequestInput
): Promise<ReviewRequest> {
  return db.transaction(async (tx: TransactionExecutor) => {
    const actor = await getActor(companyId, actorId, tx);
    const reviewRequest = await getReviewRequestRecord(companyId, reviewRequestId, tx);
    const nextStatus = input.status ?? reviewRequest.status;
    const now = new Date();
    const updatedRows = await tx
      .update(reviewRequests)
      .set({
        status: nextStatus,
        rating: input.rating ?? reviewRequest.rating,
        reviewText: normalizeOptionalString(input.reviewText) ?? reviewRequest.reviewText,
        completedAt:
          nextStatus === "completed" && reviewRequest.completedAt === null ? now : reviewRequest.completedAt,
        updatedAt: now
      })
      .where(
        and(
          eq(reviewRequests.companyId, companyId),
          eq(reviewRequests.id, reviewRequestId),
          isNull(reviewRequests.deletedAt)
        )
      )
      .returning();
    const updatedReviewRequest = updatedRows[0];

    if (!updatedReviewRequest) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to update review request");
    }

    if (nextStatus === "completed" && reviewRequest.status !== "completed") {
      await emitEventWithExecutor(tx, {
        companyId,
        eventType: "review_request.completed",
        actorId: actor.id,
        actorType: "user",
        actorName: buildActorName(actor.firstName, actor.lastName),
        entityType: "review_request",
        entityId: updatedReviewRequest.id,
        customerId: updatedReviewRequest.customerId,
        jobId: updatedReviewRequest.jobId,
        payload: {
          rating: updatedReviewRequest.rating
        },
        summary: "Review request completed"
      });
    }

    return toReviewRequest(updatedReviewRequest);
  });
}

export async function getPublicReviewLanding(referenceId: string): Promise<PublicReviewLanding> {
  return db.transaction(async (tx: TransactionExecutor) => {
    const [reviewRequest] = await tx
      .select()
      .from(reviewRequests)
      .where(and(eq(reviewRequests.referenceId, referenceId), isNull(reviewRequests.deletedAt)))
      .limit(1);

    if (!reviewRequest) {
      throw new AppError(ErrorCode.NOT_FOUND, "Review request not found");
    }

    const shouldTrackClick = reviewRequest.status === "sent" && reviewRequest.clickedAt === null;
    const resolvedReviewRequest = shouldTrackClick
      ? (
          await tx
            .update(reviewRequests)
            .set({
              status: "clicked",
              clickedAt: new Date(),
              updatedAt: new Date()
            })
            .where(
              and(
                eq(reviewRequests.companyId, reviewRequest.companyId),
                eq(reviewRequests.id, reviewRequest.id),
                isNull(reviewRequests.deletedAt)
              )
            )
            .returning()
        )[0] ?? reviewRequest
      : reviewRequest;

    const [company, technician, settings] = await Promise.all([
      getCompanyRecord(resolvedReviewRequest.companyId, tx),
      resolvedReviewRequest.technicianId
        ? getTechnicianRecord(resolvedReviewRequest.companyId, resolvedReviewRequest.technicianId, tx)
        : Promise.resolve(null),
      getBookingSettingsRecord(resolvedReviewRequest.companyId, tx)
    ]);

    return {
      reviewRequestId: resolvedReviewRequest.id,
      companyName: company.name,
      technicianName: technician ? `${technician.firstName} ${technician.lastName}`.trim() : null,
      status: resolvedReviewRequest.status as PublicReviewLanding["status"],
      reviewUrl: resolvedReviewRequest.reviewUrl,
      expiresAt: null,
      settings: getReviewSettings(settings),
      reviewLinks: {
        google: settings?.googleReviewUrl ?? null,
        yelp: settings?.yelpReviewUrl ?? null,
        facebook: settings?.facebookReviewUrl ?? null,
        custom: settings?.customReviewUrl ?? null
      }
    };
  });
}

export async function completePublicReviewRequest(
  referenceId: string,
  input: CompleteReviewRequestInput
): Promise<ReviewRequest & { routing: ReviewRatingRoute }> {
  return db.transaction(async (tx: TransactionExecutor) => {
    const [reviewRequest] = await tx
      .select()
      .from(reviewRequests)
      .where(and(eq(reviewRequests.referenceId, referenceId), isNull(reviewRequests.deletedAt)))
      .limit(1);

    if (!reviewRequest) {
      throw new AppError(ErrorCode.NOT_FOUND, "Review request not found");
    }

    const now = new Date();
    const updatedRows = await tx
      .update(reviewRequests)
      .set({
        status: "completed",
        clickedAt: reviewRequest.clickedAt ?? now,
        completedAt: now,
        rating: input.rating,
        reviewText: normalizeOptionalString(input.reviewText) ?? null,
        updatedAt: now
      })
      .where(
        and(
          eq(reviewRequests.companyId, reviewRequest.companyId),
          eq(reviewRequests.id, reviewRequest.id),
          isNull(reviewRequests.deletedAt)
        )
      )
      .returning();
    const updatedReviewRequest = updatedRows[0];

    if (!updatedReviewRequest) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to complete review request");
    }

    const settings = await getBookingSettingsRecord(updatedReviewRequest.companyId, tx);
    const routing = routeReviewRating(input.rating, settings?.googleReviewUrl ?? null);

    await emitEventWithExecutor(tx, {
      companyId: updatedReviewRequest.companyId,
      eventType: "review_request.completed",
      actorType: "customer",
      entityType: "review_request",
      entityId: updatedReviewRequest.id,
      customerId: updatedReviewRequest.customerId,
      jobId: updatedReviewRequest.jobId,
      payload: {
        rating: updatedReviewRequest.rating,
        routing: routing.kind
      },
      summary: routing.kind === "private_feedback" ? "Private feedback received" : "Review request completed"
    });

    return { ...toReviewRequest(updatedReviewRequest), routing };
  });
}
