import { and, eq, isNull } from "drizzle-orm";
import { Decimal } from "decimal.js";
import pino from "pino";

import { generateCampaignMessage } from "@fsm/ai";
import { isOpenAiConfigured } from "@fsm/config";
import {
  aiRecommendations,
  assets,
  campaignRecipients,
  campaigns,
  companies,
  customers,
  db,
  emitEventWithExecutor,
  estimates,
  jobs,
  messageLogs
} from "@fsm/db";
import { notificationsQueue } from "@fsm/jobs";
import {
  AppError,
  ErrorCode,
  type Campaign,
  type CampaignChannel,
  type CampaignDetail,
  type CampaignDetailRecipient,
  type CampaignListItem,
  type CampaignRecipientListItem,
  type CampaignRecipientStatus,
  type CampaignStatus,
  type CampaignType,
  type CreateCampaignInput,
  type ListCampaignsQuery,
  type ListRecipientsQuery,
  type PaginatedCampaignRecipients,
  type PaginatedCampaigns,
  type UpdateCampaignInput
} from "@fsm/types";

type CampaignRow = typeof campaigns.$inferSelect;
type CampaignRecipientRow = typeof campaignRecipients.$inferSelect;
type AiRecommendationRow = typeof aiRecommendations.$inferSelect;
type AssetRow = typeof assets.$inferSelect;
type CompanyRow = typeof companies.$inferSelect;
type CustomerRow = typeof customers.$inferSelect;
type EstimateRow = typeof estimates.$inferSelect;
type JobRow = typeof jobs.$inferSelect;
type MessageLogRow = typeof messageLogs.$inferSelect;
type SelectExecutor = Pick<typeof db, "select">;

const logger = pino({
  name: "campaign-service"
});

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeOptionalString(value: string | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeCampaignStatus(status: CampaignRow["status"]): CampaignStatus {
  return status as CampaignStatus;
}

function normalizeCampaignChannel(channel: CampaignRow["channel"]): CampaignChannel {
  return channel as CampaignChannel;
}

function normalizeCampaignType(type: CampaignRow["type"]): CampaignType {
  return type as CampaignType;
}

function formatMoney(value: Decimal): string {
  return value.toFixed(2);
}

function toCampaign(row: CampaignRow): Campaign {
  return {
    ...row,
    type: normalizeCampaignType(row.type),
    status: normalizeCampaignStatus(row.status),
    channel: normalizeCampaignChannel(row.channel)
  };
}

function toCampaignListItem(row: CampaignRow): CampaignListItem {
  return {
    id: row.id,
    name: row.name,
    type: normalizeCampaignType(row.type),
    status: normalizeCampaignStatus(row.status),
    channel: normalizeCampaignChannel(row.channel),
    recipientCount: row.recipientCount ?? 0,
    deliveredCount: row.deliveredCount ?? 0,
    convertedCount: row.convertedCount ?? 0,
    revenueAttributed: row.revenueAttributed ?? "0.00",
    sentAt: row.sentAt,
    createdAt: row.createdAt
  };
}

function toCampaignDetailRecipient(
  row: CampaignRecipientRow,
  customer: CustomerRow
): CampaignDetailRecipient {
  return {
    id: row.id,
    customer: {
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName
    },
    sentToPhone: row.sentToPhone,
    sentToEmail: row.sentToEmail,
    sentAt: row.sentAt,
    deliveredAt: row.deliveredAt,
    convertedAt: row.convertedAt
  };
}

function deriveRecipientStatus(
  row: CampaignRecipientRow,
  failedRecipientIds: Set<string>
): CampaignRecipientStatus | null {
  if (row.convertedAt) {
    return "converted";
  }

  if (row.deliveredAt) {
    return "delivered";
  }

  if (failedRecipientIds.has(row.id)) {
    return "failed";
  }

  return null;
}

function toCampaignRecipientListItem(
  row: CampaignRecipientRow,
  customer: CustomerRow,
  failedRecipientIds: Set<string>
): CampaignRecipientListItem {
  return {
    ...toCampaignDetailRecipient(row, customer),
    status: deriveRecipientStatus(row, failedRecipientIds)
  };
}

function normalizeDraftBodyForResponse(body: string): string | null {
  const trimmedBody = body.trim();
  return trimmedBody.length > 0 ? trimmedBody : null;
}

function normalizePage(value: number | undefined): number {
  return value ?? DEFAULT_PAGE;
}

function normalizeLimit(value: number | undefined): number {
  return Math.min(value ?? DEFAULT_LIMIT, MAX_LIMIT);
}

function paginate<T>(rows: T[], page: number, limit: number) {
  const total = rows.length;
  const start = (page - 1) * limit;
  const data = rows.slice(start, start + limit);

  return {
    data,
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit)
  };
}

function calculateDaysSince(dateValue: string | null): number | undefined {
  if (!dateValue) {
    return undefined;
  }

  const parsedDate = new Date(`${dateValue}T00:00:00.000Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    return undefined;
  }

  return Math.max(Math.floor((Date.now() - parsedDate.getTime()) / (24 * 60 * 60 * 1000)), 0);
}

function getCurrentSeason(currentDate: Date = new Date()): string {
  const month = currentDate.getUTCMonth();

  if (month >= 2 && month <= 4) {
    return "spring";
  }

  if (month >= 5 && month <= 7) {
    return "summer";
  }

  if (month >= 8 && month <= 10) {
    return "fall";
  }

  return "winter";
}

function toRecommendationReason(type: CampaignType): string {
  switch (type) {
    case "reactivation":
      return "customer reactivation";
    case "estimate_follow_up":
      return "estimate follow-up";
    case "invoice_reminder":
      return "invoice reminder";
    case "seasonal":
      return "seasonal outreach";
    case "maintenance_reminder":
      return "maintenance reminder";
    case "custom":
      return "custom outreach";
  }
}

async function getCampaignRowOrThrow(
  companyId: string,
  campaignId: string,
  executor: SelectExecutor
): Promise<CampaignRow> {
  const [campaign] = await executor
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.companyId, companyId), eq(campaigns.id, campaignId), isNull(campaigns.deletedAt)))
    .limit(1);

  if (!campaign) {
    throw new AppError(ErrorCode.NOT_FOUND, "Campaign not found");
  }

  return campaign;
}

async function getCompanyRowOrThrow(companyId: string, executor: SelectExecutor): Promise<CompanyRow> {
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

async function loadCompanyCustomers(companyId: string, executor: SelectExecutor): Promise<CustomerRow[]> {
  return executor
    .select()
    .from(customers)
    .where(and(eq(customers.companyId, companyId), isNull(customers.deletedAt)));
}

async function loadCompanyRecommendations(
  companyId: string,
  executor: SelectExecutor
): Promise<AiRecommendationRow[]> {
  return executor
    .select()
    .from(aiRecommendations)
    .where(and(eq(aiRecommendations.companyId, companyId), isNull(aiRecommendations.deletedAt)));
}

async function loadCampaignRecipients(
  companyId: string,
  campaignId: string,
  executor: SelectExecutor
): Promise<CampaignRecipientRow[]> {
  return executor
    .select()
    .from(campaignRecipients)
    .where(
      and(
        eq(campaignRecipients.companyId, companyId),
        eq(campaignRecipients.campaignId, campaignId),
        isNull(campaignRecipients.deletedAt)
      )
    );
}

async function loadCampaignMessageLogs(companyId: string, campaignId: string): Promise<MessageLogRow[]> {
  return db
    .select()
    .from(messageLogs)
    .where(and(eq(messageLogs.companyId, companyId), eq(messageLogs.campaignId, campaignId), isNull(messageLogs.deletedAt)));
}

function buildFailedRecipientIdSet(
  recipients: CampaignRecipientRow[],
  logs: MessageLogRow[]
): Set<string> {
  const failureByCustomerId = new Set(
    logs
      .filter((row) => row.failedAt !== null && row.customerId !== null)
      .map((row) => row.customerId as string)
  );

  return new Set(
    recipients
      .filter((row) => failureByCustomerId.has(row.customerId))
      .map((row) => row.id)
  );
}

async function buildCampaignDetail(companyId: string, row: CampaignRow): Promise<CampaignDetail> {
  const [recipientRows, customerRows] = await Promise.all([
    loadCampaignRecipients(companyId, row.id, db),
    loadCompanyCustomers(companyId, db)
  ]);
  const customerById = new Map(customerRows.map((customer) => [customer.id, customer]));
  const recipients = recipientRows
    .filter((recipient) => customerById.has(recipient.customerId))
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 20)
    .map((recipient) => toCampaignDetailRecipient(recipient, customerById.get(recipient.customerId)!));

  return {
    id: row.id,
    name: row.name,
    type: normalizeCampaignType(row.type),
    status: normalizeCampaignStatus(row.status),
    channel: normalizeCampaignChannel(row.channel),
    body: normalizeDraftBodyForResponse(row.body),
    subject: row.subject,
    isAiGenerated: row.isAiGenerated ?? false,
    recipientCount: row.recipientCount ?? 0,
    deliveredCount: row.deliveredCount ?? 0,
    openedCount: row.openedCount ?? 0,
    repliedCount: row.repliedCount ?? 0,
    convertedCount: row.convertedCount ?? 0,
    revenueAttributed: row.revenueAttributed ?? "0.00",
    sentAt: row.sentAt,
    createdAt: row.createdAt,
    recipients
  };
}

function assertDraftCampaign(campaign: CampaignRow, message: string): void {
  if (campaign.status !== "draft") {
    throw new AppError(ErrorCode.CONFLICT, message);
  }
}

function assertEmailCampaignHasSubject(channel: CampaignChannel, subject: string | null): void {
  if (channel === "email" && (!subject || subject.trim().length === 0)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Campaign subject is required for email campaigns", {
      subject: "Required for email campaigns"
    });
  }
}

export async function createCampaign(
  companyId: string,
  actorId: string,
  input: CreateCampaignInput
): Promise<Campaign> {
  assertEmailCampaignHasSubject(input.channel, input.subject ?? null);

  const [recommendationRows, customerRows] = await Promise.all([
    loadCompanyRecommendations(companyId, db),
    loadCompanyCustomers(companyId, db)
  ]);
  const recommendationById = new Map(recommendationRows.map((row) => [row.id, row]));
  const customerById = new Map(customerRows.map((row) => [row.id, row]));
  const resolvedRecommendations = input.recommendationIds.map((recommendationId) => {
    const recommendation = recommendationById.get(recommendationId);

    if (!recommendation) {
      throw new AppError(ErrorCode.NOT_FOUND, "AI recommendation not found");
    }

    if (!recommendation.customerId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "Recommendation is missing a customer", {
        recommendationIds: "All recommendations must be tied to a customer"
      });
    }

    return recommendation;
  });

  const uniqueCustomerIds = [...new Set(resolvedRecommendations.map((recommendation) => recommendation.customerId!))];

  for (const customerId of uniqueCustomerIds) {
    if (!customerById.has(customerId)) {
      throw new AppError(ErrorCode.NOT_FOUND, "Customer not found");
    }
  }

  const createdCampaign = await db.transaction(async (tx) => {
    const insertedCampaigns = await tx
      .insert(campaigns)
      .values({
        companyId,
        createdById: actorId,
        type: input.type,
        status: "draft",
        name: input.name.trim(),
        subject: normalizeOptionalString(input.subject) ?? null,
        body: "",
        channel: input.channel,
        isAiGenerated: false,
        aiRecommendationId: resolvedRecommendations[0]?.id ?? null,
        recipientCount: uniqueCustomerIds.length,
        deliveredCount: 0,
        openedCount: 0,
        repliedCount: 0,
        convertedCount: 0,
        revenueAttributed: "0.00"
      })
      .returning();
    const campaign = insertedCampaigns[0];

    if (!campaign) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create campaign");
    }

    await tx.insert(campaignRecipients).values(
      uniqueCustomerIds.map((customerId) => ({
        campaignId: campaign.id,
        customerId,
        companyId
      }))
    );

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "campaign.created",
      actorId,
      actorType: "user",
      entityType: "campaign",
      entityId: campaign.id,
      payload: {
        recommendationIds: input.recommendationIds,
        recipientCount: uniqueCustomerIds.length,
        channel: input.channel
      },
      summary: `Campaign ${campaign.name} created`
    });

    return campaign;
  });

  return toCampaign(createdCampaign);
}

export async function generateDraft(
  companyId: string,
  _actorId: string,
  campaignId: string
): Promise<Campaign> {
  const campaign = await getCampaignRowOrThrow(companyId, campaignId, db);
  assertDraftCampaign(campaign, "Only draft campaigns can generate a message draft");

  const [recipientRows, customerRows, company, recommendationRows, assetRows, estimateRows] = await Promise.all([
    loadCampaignRecipients(companyId, campaignId, db),
    loadCompanyCustomers(companyId, db),
    getCompanyRowOrThrow(companyId, db),
    loadCompanyRecommendations(companyId, db),
    db.select().from(assets).where(and(eq(assets.companyId, companyId), isNull(assets.deletedAt))),
    db.select().from(estimates).where(and(eq(estimates.companyId, companyId), isNull(estimates.deletedAt)))
  ]);

  const firstRecipient = recipientRows
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
    .at(0);

  if (!firstRecipient) {
    throw new AppError(ErrorCode.CONFLICT, "Campaign has no recipients");
  }

  const customer = customerRows.find((row) => row.id === firstRecipient.customerId);

  if (!customer) {
    throw new AppError(ErrorCode.NOT_FOUND, "Customer not found");
  }

  const recommendation = campaign.aiRecommendationId
    ? recommendationRows.find((row) => row.id === campaign.aiRecommendationId) ?? null
    : null;
  const relatedAsset = recommendation?.assetId
    ? assetRows.find((row) => row.id === recommendation.assetId) ?? null
    : null;
  const relatedEstimate = recommendation?.estimateId
    ? estimateRows.find((row) => row.id === recommendation.estimateId) ?? null
    : null;
  const daysSinceLastService = calculateDaysSince(customer.lastServiceDate);
  const assetAgeInDays = calculateDaysSince(relatedAsset?.installDate ?? null);
  const assetAgeYears =
    assetAgeInDays !== undefined ? Math.floor(assetAgeInDays / 365) : undefined;

  if (!isOpenAiConfigured()) {
    throw new AppError(ErrorCode.CONFLICT, "AI message drafting is disabled: OpenAI is not configured");
  }

  const draftBody = await generateCampaignMessage({
    customerFirstName: customer.firstName,
    recommendationType: toRecommendationReason(normalizeCampaignType(campaign.type)),
    companyName: company.name,
    ...(daysSinceLastService !== undefined ? { daysSinceLastService } : {}),
    ...(relatedAsset?.assetType ? { assetType: relatedAsset.assetType } : {}),
    ...(assetAgeYears !== undefined ? { assetAge: assetAgeYears } : {}),
    ...(relatedEstimate?.estimateNumber ? { estimateNumber: relatedEstimate.estimateNumber } : {}),
    ...(relatedEstimate?.total ? { estimateTotal: relatedEstimate.total } : {}),
    season: getCurrentSeason()
  });

  const updatedCampaigns = await db
    .update(campaigns)
    .set({
      body: draftBody,
      isAiGenerated: true,
      updatedAt: new Date()
    })
    .where(and(eq(campaigns.companyId, companyId), eq(campaigns.id, campaignId), isNull(campaigns.deletedAt)))
    .returning();
  const updatedCampaign = updatedCampaigns[0];

  if (!updatedCampaign) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to update campaign draft");
  }

  return toCampaign(updatedCampaign);
}

export async function updateCampaign(
  companyId: string,
  _actorId: string,
  campaignId: string,
  input: UpdateCampaignInput
): Promise<Campaign> {
  const campaign = await getCampaignRowOrThrow(companyId, campaignId, db);
  assertDraftCampaign(campaign, "Only draft campaigns can be updated");

  const nextChannel = input.channel ?? normalizeCampaignChannel(campaign.channel);
  const nextSubject = input.subject !== undefined ? normalizeOptionalString(input.subject) ?? null : campaign.subject;
  const nextBody = input.body !== undefined ? input.body.trim() : campaign.body;

  assertEmailCampaignHasSubject(nextChannel, nextSubject);

  const updatedCampaigns = await db
    .update(campaigns)
    .set({
      ...(input.body !== undefined ? { body: nextBody } : {}),
      ...(input.subject !== undefined ? { subject: nextSubject } : {}),
      ...(input.channel !== undefined ? { channel: input.channel } : {}),
      updatedAt: new Date()
    })
    .where(and(eq(campaigns.companyId, companyId), eq(campaigns.id, campaignId), isNull(campaigns.deletedAt)))
    .returning();
  const updatedCampaign = updatedCampaigns[0];

  if (!updatedCampaign) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to update campaign");
  }

  return toCampaign(updatedCampaign);
}

export async function sendCampaign(
  companyId: string,
  actorId: string,
  campaignId: string
): Promise<Campaign> {
  const campaign = await getCampaignRowOrThrow(companyId, campaignId, db);
  assertDraftCampaign(campaign, "Only draft campaigns can be sent");

  const body = campaign.body.trim();

  if (body.length === 0) {
    throw new AppError(ErrorCode.CONFLICT, "Campaign body is required before sending");
  }

  const channel = normalizeCampaignChannel(campaign.channel);
  assertEmailCampaignHasSubject(channel, campaign.subject);

  if (channel === "sms" && body.length > 160) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "SMS campaigns must be 160 characters or fewer", {
      body: "SMS campaigns must be 160 characters or fewer"
    });
  }

  const [recipientRows, customerRows] = await Promise.all([
    loadCampaignRecipients(companyId, campaignId, db),
    loadCompanyCustomers(companyId, db)
  ]);

  if (recipientRows.length === 0) {
    throw new AppError(ErrorCode.CONFLICT, "Campaign has no recipients");
  }

  const customerById = new Map(customerRows.map((row) => [row.id, row]));
  const recipientsToSend: Array<{
    recipientId: string;
    customerId: string;
    toAddress: string;
  }> = [];

  for (const recipient of recipientRows) {
    const customer = customerById.get(recipient.customerId);

    if (!customer) {
      logger.warn({ companyId, campaignId, recipientId: recipient.id }, "Campaign recipient skipped because customer is missing");
      continue;
    }

    if (customer.doNotContact) {
      logger.info({ companyId, campaignId, customerId: customer.id }, "Campaign recipient skipped because do-not-contact is enabled");
      continue;
    }

    if (recipient.sentAt) {
      logger.info({ companyId, campaignId, recipientId: recipient.id }, "Campaign recipient skipped because it was already sent");
      continue;
    }

    const toAddress = channel === "sms" ? customer.phone : customer.email;

    if (!toAddress) {
      logger.info(
        { companyId, campaignId, customerId: customer.id, channel },
        "Campaign recipient skipped because delivery address is missing"
      );
      continue;
    }

    recipientsToSend.push({
      recipientId: recipient.id,
      customerId: customer.id,
      toAddress
    });
  }

  if (recipientsToSend.length === 0) {
    throw new AppError(ErrorCode.CONFLICT, "Campaign has no sendable recipients");
  }

  const sentAt = new Date();

  await db
    .update(campaigns)
    .set({
      status: "sending",
      sentAt,
      recipientCount: recipientsToSend.length,
      updatedAt: sentAt
    })
    .where(and(eq(campaigns.companyId, companyId), eq(campaigns.id, campaignId), isNull(campaigns.deletedAt)))
    .returning();

  for (const recipient of recipientsToSend) {
    await notificationsQueue.add(
      "send-campaign-message",
      {
        companyId,
        campaignId,
        recipientId: recipient.recipientId,
        customerId: recipient.customerId,
        channel,
        body,
        subject: campaign.subject,
        toAddress: recipient.toAddress
      },
      {
        jobId: `campaign:${campaignId}:recipient:${recipient.recipientId}`
      }
    );
  }

  const updatedCampaign = await db.transaction(async (tx) => {
    const updatedCampaigns = await tx
      .update(campaigns)
      .set({
        status: "sent",
        sentAt,
        recipientCount: recipientsToSend.length,
        updatedAt: new Date()
      })
      .where(and(eq(campaigns.companyId, companyId), eq(campaigns.id, campaignId), isNull(campaigns.deletedAt)))
      .returning();
    const nextCampaign = updatedCampaigns[0];

    if (!nextCampaign) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to mark campaign as sent");
    }

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "campaign.sent",
      actorId,
      actorType: "user",
      entityType: "campaign",
      entityId: nextCampaign.id,
      payload: {
        channel,
        recipientCount: recipientsToSend.length
      },
      summary: `Campaign ${nextCampaign.name} sent`
    });

    return nextCampaign;
  });

  return toCampaign(updatedCampaign);
}

export async function listCampaigns(
  companyId: string,
  query: ListCampaignsQuery
): Promise<PaginatedCampaigns> {
  const page = normalizePage(query.page);
  const limit = normalizeLimit(query.limit);
  const createdAfter = query.createdAfter ? new Date(query.createdAfter) : null;
  const createdBefore = query.createdBefore ? new Date(query.createdBefore) : null;
  const rows = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.companyId, companyId), isNull(campaigns.deletedAt)));

  const filteredRows = rows
    .filter((row) => {
      if (query.status && row.status !== query.status) {
        return false;
      }

      if (query.type && row.type !== query.type) {
        return false;
      }

      if (query.channel && row.channel !== query.channel) {
        return false;
      }

      if (createdAfter && row.createdAt.getTime() < createdAfter.getTime()) {
        return false;
      }

      if (createdBefore && row.createdAt.getTime() > createdBefore.getTime()) {
        return false;
      }

      return true;
    })
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .map((row) => toCampaignListItem(row));

  return paginate(filteredRows, page, limit);
}

export async function getCampaign(companyId: string, campaignId: string): Promise<CampaignDetail> {
  const campaign = await getCampaignRowOrThrow(companyId, campaignId, db);
  return buildCampaignDetail(companyId, campaign);
}

export async function listRecipients(
  companyId: string,
  campaignId: string,
  query: ListRecipientsQuery
): Promise<PaginatedCampaignRecipients> {
  await getCampaignRowOrThrow(companyId, campaignId, db);

  const page = normalizePage(query.page);
  const limit = normalizeLimit(query.limit);
  const [recipientRows, customerRows, logs] = await Promise.all([
    loadCampaignRecipients(companyId, campaignId, db),
    loadCompanyCustomers(companyId, db),
    loadCampaignMessageLogs(companyId, campaignId)
  ]);
  const customerById = new Map(customerRows.map((row) => [row.id, row]));
  const failedRecipientIds = buildFailedRecipientIdSet(recipientRows, logs);
  const filteredRows = recipientRows
    .filter((row) => customerById.has(row.customerId))
    .filter((row) => {
      if (!query.status) {
        return true;
      }

      return deriveRecipientStatus(row, failedRecipientIds) === query.status;
    })
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .map((row) => toCampaignRecipientListItem(row, customerById.get(row.customerId)!, failedRecipientIds));

  return paginate(filteredRows, page, limit);
}

export async function trackConversion(
  companyId: string,
  customerId: string,
  jobId: string
): Promise<void> {
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.companyId, companyId), eq(jobs.id, jobId), isNull(jobs.deletedAt)))
    .limit(1);

  if (!job) {
    return;
  }

  const recipientRows = await db
    .select()
    .from(campaignRecipients)
    .where(
      and(
        eq(campaignRecipients.companyId, companyId),
        eq(campaignRecipients.customerId, customerId),
        isNull(campaignRecipients.deletedAt)
      )
    );
  const now = new Date();
  const eligibleRecipient = recipientRows
    .filter((row) => row.sentAt && row.convertedAt === null)
    .filter((row) => (row.sentAt as Date).getTime() >= now.getTime() - THIRTY_DAYS_MS)
    .sort((left, right) => (right.sentAt as Date).getTime() - (left.sentAt as Date).getTime())
    .at(0);

  if (!eligibleRecipient) {
    return;
  }

  await db.transaction(async (tx) => {
    const updatedRecipients = await tx
      .update(campaignRecipients)
      .set({
        convertedAt: now,
        conversionJobId: jobId,
        updatedAt: now
      })
      .where(
        and(
          eq(campaignRecipients.companyId, companyId),
          eq(campaignRecipients.id, eligibleRecipient.id),
          isNull(campaignRecipients.deletedAt)
        )
      )
      .returning();
    const updatedRecipient = updatedRecipients[0];

    if (!updatedRecipient) {
      return;
    }

    const [campaign] = await tx
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.companyId, companyId), eq(campaigns.id, eligibleRecipient.campaignId), isNull(campaigns.deletedAt)))
      .limit(1);

    if (!campaign) {
      return;
    }

    const nextConvertedCount = (campaign.convertedCount ?? 0) + 1;
    const nextRevenueAttributed = new Decimal(campaign.revenueAttributed ?? "0").add(job.estimateTotal ?? "0");

    await tx
      .update(campaigns)
      .set({
        convertedCount: nextConvertedCount,
        revenueAttributed: formatMoney(nextRevenueAttributed),
        updatedAt: now
      })
      .where(and(eq(campaigns.companyId, companyId), eq(campaigns.id, campaign.id), isNull(campaigns.deletedAt)))
      .returning();

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "campaign.converted",
      actorType: "system",
      entityType: "campaign",
      entityId: campaign.id,
      customerId,
      jobId,
      payload: {
        campaignRecipientId: updatedRecipient.id,
        revenueAttributed: formatMoney(new Decimal(job.estimateTotal ?? "0"))
      },
      summary: `Campaign ${campaign.name} converted`
    });
  });
}
