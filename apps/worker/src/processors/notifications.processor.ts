import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { Job, Processor } from "bullmq";
import pino from "pino";

import { resolveTransactionalEmailFromAddress, type EmailTemplateId } from "@fsm/comms";
import { env } from "@fsm/config";
import { recordTransactionalEmailMessageLog } from "./transactional-email-message-log.js";
import {
  automationRules,
  campaignRecipients,
  campaigns,
  companies,
  customers,
  db,
  estimateItems,
  estimates,
  invoices,
  maintenancePlans,
  reviewRequests,
  messageLogs,
  serviceAgreementTemplates,
  users
} from "@fsm/db";

const logger = pino({
  name: "notifications-processor"
});

type ReminderLevel = 1 | 2 | 3;
type InvoiceStatus = (typeof invoices.$inferSelect)["status"];
type AutomationRuleType = (typeof automationRules.$inferSelect)["ruleType"];
type AgreementEmailType = "renewal_reminder" | "payment_failed";

type TransactionalEmailSendResult = {
  templateId: EmailTemplateId;
  subject: string;
  providerMessageId: string | null;
};

interface EmailModule {
  sendPlanReminderEmail?(
    to: string,
    params: { firstName: string; companyName: string; planName: string; dueDateLabel: string; reminderKind: "renewal" | "tune_up" }
  ): Promise<unknown>;
  sendReviewRequestEmail?(
    to: string,
    params: { firstName: string; companyName: string; technicianName: string | null; reviewUrl: string }
  ): Promise<unknown>;
  sendPasswordResetEmail(to: string, resetUrl: string, firstName: string): Promise<void>;
  sendEstimateEmail(
    to: string,
    params: {
      firstName: string;
      estimateNumber: string;
      title: string | null;
      total: string;
      expiresAt: string | null;
      approvalUrl: string;
      companyName: string;
    }
  ): Promise<void>;
  sendInvoiceEmail(
    to: string,
    params: {
      firstName: string;
      invoiceNumber: string;
      total: string;
      dueAt: string | null;
      paymentLinkUrl: string;
      companyName: string;
    }
  ): Promise<void>;
  sendInvoiceReminderEmail(
    to: string,
    params: {
      firstName: string;
      invoiceNumber: string;
      total: string;
      balanceDue: string;
      dueAt: string | null;
      paymentLinkUrl: string;
      companyName: string;
      reminderLevel: ReminderLevel;
    }
  ): Promise<void>;
  sendInvoiceReminderOwnerAlertEmail(
    to: string,
    params: {
      ownerFirstName: string;
      customerName: string;
      invoiceNumber: string;
      balanceDue: string;
      paymentLinkUrl: string;
      companyName: string;
    }
  ): Promise<void>;
  sendServiceAgreementRenewalReminderEmail(
    to: string,
    params: {
      firstName: string;
      planName: string;
      nextServiceDate: string | null;
      companyName: string;
    }
  ): Promise<void>;
  sendServiceAgreementPaymentFailedEmail(
    to: string,
    params: {
      ownerFirstName: string;
      customerName: string;
      planName: string;
      amount: string;
      manageUrl: string;
      companyName: string;
    }
  ): Promise<void>;
  sendCampaignEmail(
    to: string,
    params: {
      firstName: string;
      subject: string;
      body: string;
      companyName: string;
    }
  ): Promise<void>;
  sendBookingConfirmationEmail(
    to: string,
    params: {
      firstName: string;
      companyName: string;
      referenceNumber: string;
      scheduledLabel: string | null;
    }
  ): Promise<TransactionalEmailSendResult>;
  sendBookingDeclineEmail(
    to: string,
    params: {
      firstName: string;
      companyName: string;
      referenceNumber: string;
      reason: string | null;
    }
  ): Promise<TransactionalEmailSendResult>;
  sendVipMembershipWelcomeEmail(
    to: string,
    params: {
      firstName: string;
      companyName: string;
      planName: string;
      portalUrl: string | null;
    }
  ): Promise<TransactionalEmailSendResult>;
  sendVipMembershipRenewalEmail(
    to: string,
    params: {
      firstName: string;
      companyName: string;
      planName: string;
      amount: string;
      renewalDateLabel: string | null;
    }
  ): Promise<TransactionalEmailSendResult>;
  sendVipMembershipPaymentFailedEmail(
    to: string,
    params: {
      firstName: string;
      companyName: string;
      planName: string;
      amount: string;
      paymentUrl: string | null;
      graceEndsAtLabel: string | null;
      nextRetryAtLabel: string | null;
      dunningStepIndex: number;
    }
  ): Promise<TransactionalEmailSendResult>;
}

interface SmsModule {
  sendSms(to: string, body: string): Promise<string>;
}

interface EstimateEmailContext {
  companyId: string;
  estimateId: string;
  customerId: string;
  status: (typeof estimates.$inferSelect)["status"];
  estimateNumber: string;
  title: string | null;
  total: string;
  approvalToken: string | null;
  expiresAt: Date | null;
  customer: {
    firstName: string;
    email: string | null;
  };
  company: {
    name: string;
  };
  items: Array<{
    id: string;
  }>;
}

interface InvoiceEmailContext {
  companyId: string;
  invoiceId: string;
  customerId: string;
  status: InvoiceStatus;
  invoiceNumber: string;
  total: string;
  balanceDue: string;
  dueAt: Date | null;
  stripePaymentLinkUrl: string | null;
  reminder1SentAt: Date | null;
  reminder2SentAt: Date | null;
  reminder3SentAt: Date | null;
  customer: {
    firstName: string;
    lastName: string;
    email: string | null;
  };
  company: {
    name: string;
  };
}

interface ServiceAgreementEmailContext {
  companyId: string;
  maintenancePlanId: string;
  customerId: string;
  name: string;
  price: string | null;
  nextServiceDate: string | null;
  customer: {
    firstName: string;
    lastName: string;
    email: string | null;
  };
  company: {
    name: string;
  };
  template: {
    name: string;
  } | null;
}

interface CampaignDeliveryContext {
  companyId: string;
  campaignId: string;
  recipientId: string;
  customerId: string;
  recipient: {
    sentAt: Date | null;
  };
  customer: {
    firstName: string;
    email: string | null;
    phone: string | null;
  };
  company: {
    name: string;
  };
}

interface CompanyOwnerContext {
  id: string;
  firstName: string;
  email: string | null;
}

interface AutomationRuleContext {
  companyId: string;
  ruleType: AutomationRuleType;
}

export interface ReviewRequestSendContext {
  requestStatus: string;
  requestDeleted: boolean;
  invoice: { status: string; total: string | number | null; deleted: boolean } | null;
  customer: { prefersEmail: boolean | null; prefersSms: boolean | null; doNotContact: boolean | null } | null;
  ruleEnabled: boolean;
}

export interface PlanReminderSendContext {
  plan: { status: string; deleted: boolean; customerId: string } | null;
  customer: { prefersEmail: boolean | null; prefersSms: boolean | null; doNotContact: boolean | null } | null;
  ruleEnabled: boolean;
}

export type PlanReminderSendSkipReason =
  | "plan_not_found"
  | "plan_not_active"
  | "rule_disabled"
  | "customer_do_not_contact"
  | "customer_opted_out";

/** Send-time re-check for plan reminders (the #264 standard): reloaded by companyId just before sending. */
export function planReminderSendSkipReason(
  context: PlanReminderSendContext | null,
  channel: "email" | "sms",
  customerId: string | null
): PlanReminderSendSkipReason | null {
  if (!context?.plan || context.plan.deleted) return "plan_not_found";
  if (context.plan.status !== "active") return "plan_not_active";
  if (!context.ruleEnabled) return "rule_disabled";
  if (!context.customer || (customerId && context.plan.customerId !== customerId)) return "customer_opted_out";
  if (context.customer.doNotContact === true) return "customer_do_not_contact";
  const consent = channel === "email" ? context.customer.prefersEmail : context.customer.prefersSms;
  if (consent !== true) return "customer_opted_out";
  return null;
}

export type ReviewRequestSendSkipReason =
  | "request_not_found"
  | "request_not_active"
  | "invoice_not_paid"
  | "customer_do_not_contact"
  | "customer_opted_out"
  | "rule_disabled";

/**
 * Send-time re-check (the review email/SMS may be delayed by hours). Invoice-originated requests also need the
 * invoice still paid with total > 0 and the review_request rule still on. NULL channel preference = no consent.
 */
export function reviewRequestSendSkipReason(
  context: ReviewRequestSendContext | null,
  channel: "email" | "sms",
  fromInvoice: boolean
): ReviewRequestSendSkipReason | null {
  if (!context || context.requestDeleted) return "request_not_found";
  if (context.requestStatus !== "pending" && context.requestStatus !== "sent") return "request_not_active";
  if (fromInvoice) {
    if (!context.invoice || context.invoice.deleted) return "invoice_not_paid";
    if (context.invoice.status !== "paid" || !(Number(context.invoice.total ?? 0) > 0)) return "invoice_not_paid";
    if (!context.ruleEnabled) return "rule_disabled";
  }
  if (!context.customer) return "customer_opted_out";
  if (context.customer.doNotContact === true) return "customer_do_not_contact";
  const consent = channel === "email" ? context.customer.prefersEmail : context.customer.prefersSms;
  if (consent !== true) return "customer_opted_out";
  return null;
}

export interface NotificationsDependencies {
  email: EmailModule;
  sms: SmsModule;
  loadEstimateEmailContext(companyId: string, estimateId: string): Promise<EstimateEmailContext | null>;
  loadInvoiceEmailContext(companyId: string, invoiceId: string): Promise<InvoiceEmailContext | null>;
  loadServiceAgreementEmailContext(
    companyId: string,
    maintenancePlanId: string
  ): Promise<ServiceAgreementEmailContext | null>;
  loadCampaignDeliveryContext(
    companyId: string,
    campaignId: string,
    recipientId: string
  ): Promise<CampaignDeliveryContext | null>;
  loadCompanyOwner(companyId: string): Promise<CompanyOwnerContext | null>;
  /** Fresh plan/consent/rule facts for the send-time re-check of a plan reminder. */
  loadPlanReminderSendContext?(companyId: string, maintenancePlanId: string): Promise<PlanReminderSendContext | null>;
  /** Fresh facts for the send-time re-check of a (possibly delayed) review request. */
  loadReviewRequestSendContext?(
    companyId: string,
    reviewRequestId: string,
    invoiceId: string | null
  ): Promise<ReviewRequestSendContext | null>;
  findAutomationRule(
    companyId: string,
    ruleType: AutomationRuleType
  ): Promise<AutomationRuleContext | null>;
  markInvoiceReminderSent(companyId: string, invoiceId: string, reminderLevel: ReminderLevel): Promise<void>;
  markCampaignRecipientDelivered(input: {
    companyId: string;
    campaignId: string;
    recipientId: string;
    customerId: string;
    channel: "sms" | "email";
    toAddress: string;
    body: string;
    subject: string | null;
    providerMessageId: string | null;
    providerStatus: string | null;
  }): Promise<void>;
  recordCampaignDeliveryFailure(input: {
    companyId: string;
    campaignId: string;
    recipientId: string;
    customerId: string;
    channel: "sms" | "email";
    toAddress: string;
    body: string;
    subject: string | null;
    failureReason: string;
  }): Promise<void>;
}

function getJobString(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getReminderLevel(data: Record<string, unknown>): ReminderLevel | null {
  const value = data.reminderLevel;
  return value === 1 || value === 2 || value === 3 ? value : null;
}

function getAgreementEmailType(data: Record<string, unknown>): AgreementEmailType | null {
  const value = data.emailType;
  return value === "renewal_reminder" || value === "payment_failed" ? value : null;
}

type VipMembershipEmailKind = "welcome" | "renewal_receipt" | "payment_failed_dunning";

function getVipMembershipEmailKind(data: Record<string, unknown>): VipMembershipEmailKind | null {
  const value = data.emailKind;
  return value === "welcome" || value === "renewal_receipt" || value === "payment_failed_dunning"
    ? value
    : null;
}

function formatVipLabelFromIso(iso: string | null): string | null {
  if (!iso) {
    return null;
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Same key-based selection as the API sender (apps/api/src/lib/outbound-email.ts), via @fsm/comms. */
export function getOutboundEmailFromAddress(): string {
  return resolveTransactionalEmailFromAddress({
    resendApiKey: env.RESEND_API_KEY,
    sendgridApiKey: env.SENDGRID_API_KEY,
    nodeEnv: env.NODE_ENV,
    resendFromEmail: env.RESEND_FROM_EMAIL,
    emailFrom: env.EMAIL_FROM,
    sendgridFromEmail: env.SENDGRID_FROM_EMAIL
  });
}

async function handleSmsNotificationJob(
  job: Job<Record<string, unknown>>,
  dependencies: NotificationsDependencies,
  options: {
    jobLabel: string;
    requiredKeys?: string[];
    buildBody?: (data: Record<string, unknown>) => string | null;
  }
): Promise<void> {
  const companyId = getJobString(job.data, "companyId");
  const toPhone = getJobString(job.data, "toPhone") ?? getJobString(job.data, "customerPhone");
  const body = options.buildBody ? options.buildBody(job.data) : getJobString(job.data, "body") ?? getJobString(job.data, "message");

  if (!companyId || !toPhone || !body) {
    logger.warn({ jobId: job.id ?? null, jobName: job.name }, `${options.jobLabel} job missing required SMS data`);
    return;
  }

  try {
    await dependencies.sms.sendSms(toPhone, body);
    logger.info(
      {
        companyId,
        jobName: job.name,
        notificationId: getJobString(job.data, "notificationId"),
        bookingRequestId: getJobString(job.data, "bookingRequestId"),
        reviewRequestId: getJobString(job.data, "reviewRequestId"),
        jobId: getJobString(job.data, "jobId")
      },
      `${options.jobLabel} SMS sent`
    );
  } catch (error) {
    logger.error(
      {
        err: error,
        companyId,
        jobName: job.name,
        notificationId: getJobString(job.data, "notificationId"),
        bookingRequestId: getJobString(job.data, "bookingRequestId"),
        reviewRequestId: getJobString(job.data, "reviewRequestId"),
        jobId: getJobString(job.data, "jobId")
      },
      `${options.jobLabel} SMS failed`
    );
    throw error;
  }
}

function isInvoiceUnpaid(status: InvoiceStatus): boolean {
  return status === "sent" || status === "partially_paid" || status === "overdue";
}

async function loadEmailModule(): Promise<EmailModule> {
  const moduleUrl = new URL("../../../api/dist/lib/email.js", import.meta.url);
  return import(moduleUrl.href) as Promise<EmailModule>;
}

async function loadSmsModule(): Promise<SmsModule> {
  const moduleUrl = new URL("../../../api/dist/lib/sms.js", import.meta.url);
  return import(moduleUrl.href) as Promise<SmsModule>;
}

let productionDependenciesPromise: Promise<NotificationsDependencies> | null = null;

function createProductionDependencies(): Promise<NotificationsDependencies> {
  return (async () => {
    const [email, sms] = await Promise.all([loadEmailModule(), loadSmsModule()]);

    return {
    email,
    sms,
    async loadEstimateEmailContext(companyId, estimateId) {
      const [estimate] = await db
        .select()
        .from(estimates)
        .where(and(eq(estimates.companyId, companyId), eq(estimates.id, estimateId), isNull(estimates.deletedAt)))
        .limit(1);

      if (!estimate) {
        return null;
      }

      const [customer, company, items] = await Promise.all([
        db
          .select()
          .from(customers)
          .where(and(eq(customers.companyId, companyId), eq(customers.id, estimate.customerId), isNull(customers.deletedAt)))
          .limit(1),
        db
          .select()
          .from(companies)
          .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
          .limit(1),
        db
          .select({
            id: estimateItems.id
          })
          .from(estimateItems)
          .where(
            and(
              eq(estimateItems.companyId, companyId),
              eq(estimateItems.estimateId, estimate.id),
              isNull(estimateItems.deletedAt)
            )
          )
      ]);

      const customerRecord = customer[0];
      const companyRecord = company[0];

      if (!customerRecord || !companyRecord) {
        return null;
      }

      return {
        companyId,
        estimateId: estimate.id,
        customerId: estimate.customerId,
        status: estimate.status,
        estimateNumber: estimate.estimateNumber,
        title: estimate.title,
        total: estimate.total,
        approvalToken: estimate.approvalToken,
        expiresAt: estimate.expiresAt,
        customer: {
          firstName: customerRecord.firstName,
          email: customerRecord.email
        },
        company: {
          name: companyRecord.name
        },
        items
      };
    },
    async loadInvoiceEmailContext(companyId, invoiceId) {
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.companyId, companyId), eq(invoices.id, invoiceId), isNull(invoices.deletedAt)))
        .limit(1);

      if (!invoice) {
        return null;
      }

      const [customer, company] = await Promise.all([
        db
          .select()
          .from(customers)
          .where(and(eq(customers.companyId, companyId), eq(customers.id, invoice.customerId), isNull(customers.deletedAt)))
          .limit(1),
        db
          .select()
          .from(companies)
          .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
          .limit(1)
      ]);

      const customerRecord = customer[0];
      const companyRecord = company[0];

      if (!customerRecord || !companyRecord) {
        return null;
      }

      return {
        companyId,
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        status: invoice.status,
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.total,
        balanceDue: invoice.balanceDue,
        dueAt: invoice.dueAt,
        stripePaymentLinkUrl: invoice.stripePaymentLinkUrl,
        reminder1SentAt: invoice.reminder1SentAt,
        reminder2SentAt: invoice.reminder2SentAt,
        reminder3SentAt: invoice.reminder3SentAt,
        customer: {
          firstName: customerRecord.firstName,
          lastName: customerRecord.lastName,
          email: customerRecord.email
        },
        company: {
          name: companyRecord.name
        }
      };
    },
    async loadServiceAgreementEmailContext(companyId, maintenancePlanId) {
      const [plan] = await db
        .select()
        .from(maintenancePlans)
        .where(
          and(
            eq(maintenancePlans.companyId, companyId),
            eq(maintenancePlans.id, maintenancePlanId),
            isNull(maintenancePlans.deletedAt)
          )
        )
        .limit(1);

      if (!plan) {
        return null;
      }

      const [customer, company, template] = await Promise.all([
        db
          .select()
          .from(customers)
          .where(and(eq(customers.companyId, companyId), eq(customers.id, plan.customerId), isNull(customers.deletedAt)))
          .limit(1),
        db
          .select()
          .from(companies)
          .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
          .limit(1),
        plan.serviceAgreementTemplateId
          ? db
              .select()
              .from(serviceAgreementTemplates)
              .where(
                and(
                  eq(serviceAgreementTemplates.companyId, companyId),
                  eq(serviceAgreementTemplates.id, plan.serviceAgreementTemplateId),
                  isNull(serviceAgreementTemplates.deletedAt)
                )
              )
              .limit(1)
          : Promise.resolve([])
      ]);

      const customerRecord = customer[0];
      const companyRecord = company[0];
      const templateRecord = template[0] ?? null;

      if (!customerRecord || !companyRecord) {
        return null;
      }

      return {
        companyId,
        maintenancePlanId: plan.id,
        customerId: plan.customerId,
        name: plan.name,
        price: plan.price,
        nextServiceDate: plan.nextServiceDate,
        customer: {
          firstName: customerRecord.firstName,
          lastName: customerRecord.lastName,
          email: customerRecord.email
        },
        company: {
          name: companyRecord.name
        },
        template: templateRecord
          ? {
              name: templateRecord.name
            }
          : null
      };
    },
    async loadCampaignDeliveryContext(companyId, campaignId, recipientId) {
      const [recipient] = await db
        .select()
        .from(campaignRecipients)
        .where(
          and(
            eq(campaignRecipients.companyId, companyId),
            eq(campaignRecipients.campaignId, campaignId),
            eq(campaignRecipients.id, recipientId),
            isNull(campaignRecipients.deletedAt)
          )
        )
        .limit(1);

      if (!recipient) {
        return null;
      }

      const [customer, company] = await Promise.all([
        db
          .select()
          .from(customers)
          .where(and(eq(customers.companyId, companyId), eq(customers.id, recipient.customerId), isNull(customers.deletedAt)))
          .limit(1),
        db
          .select()
          .from(companies)
          .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
          .limit(1)
      ]);

      const customerRecord = customer[0];
      const companyRecord = company[0];

      if (!customerRecord || !companyRecord) {
        return null;
      }

      return {
        companyId,
        campaignId,
        recipientId,
        customerId: recipient.customerId,
        recipient: {
          sentAt: recipient.sentAt
        },
        customer: {
          firstName: customerRecord.firstName,
          email: customerRecord.email,
          phone: customerRecord.phone
        },
        company: {
          name: companyRecord.name
        }
      };
    },
    async loadCompanyOwner(companyId) {
      const [owner] = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          email: users.email
        })
        .from(users)
        .where(
          and(eq(users.companyId, companyId), eq(users.role, "owner"), isNull(users.deletedAt))
        )
        .limit(1);

      return owner ?? null;
    },
    async loadPlanReminderSendContext(companyId, maintenancePlanId) {
      const [plan] = await db
        .select()
        .from(maintenancePlans)
        .where(and(eq(maintenancePlans.companyId, companyId), eq(maintenancePlans.id, maintenancePlanId)))
        .limit(1);
      if (!plan) return null;
      const [customerRows, ruleRows] = await Promise.all([
        db
          .select()
          .from(customers)
          .where(and(eq(customers.companyId, companyId), eq(customers.id, plan.customerId), isNull(customers.deletedAt)))
          .limit(1),
        db
          .select()
          .from(automationRules)
          .where(
            and(
              eq(automationRules.companyId, companyId),
              eq(automationRules.ruleType, "service_agreement_renewal"),
              eq(automationRules.isEnabled, true),
              isNull(automationRules.deletedAt)
            )
          )
          .limit(1)
      ]);
      const customer = customerRows[0];
      return {
        plan: { status: plan.status, deleted: plan.deletedAt !== null, customerId: plan.customerId },
        customer: customer
          ? { prefersEmail: customer.prefersEmail, prefersSms: customer.prefersSms, doNotContact: customer.doNotContact }
          : null,
        ruleEnabled: ruleRows.length > 0
      };
    },
    async loadReviewRequestSendContext(companyId, reviewRequestId, invoiceId) {
      const [request] = await db
        .select()
        .from(reviewRequests)
        .where(and(eq(reviewRequests.companyId, companyId), eq(reviewRequests.id, reviewRequestId)))
        .limit(1);
      if (!request) return null;
      const [customerRows, invoiceRows, ruleRows] = await Promise.all([
        db
          .select()
          .from(customers)
          .where(and(eq(customers.companyId, companyId), eq(customers.id, request.customerId), isNull(customers.deletedAt)))
          .limit(1),
        invoiceId
          ? db.select().from(invoices).where(and(eq(invoices.companyId, companyId), eq(invoices.id, invoiceId))).limit(1)
          : Promise.resolve([]),
        db
          .select()
          .from(automationRules)
          .where(
            and(
              eq(automationRules.companyId, companyId),
              eq(automationRules.ruleType, "review_request"),
              eq(automationRules.isEnabled, true),
              isNull(automationRules.deletedAt)
            )
          )
          .limit(1)
      ]);
      const customer = customerRows[0];
      const invoice = invoiceRows[0];
      return {
        requestStatus: request.status,
        requestDeleted: request.deletedAt !== null,
        invoice: invoice ? { status: invoice.status, total: invoice.total, deleted: invoice.deletedAt !== null } : null,
        customer: customer
          ? { prefersEmail: customer.prefersEmail, prefersSms: customer.prefersSms, doNotContact: customer.doNotContact }
          : null,
        ruleEnabled: ruleRows.length > 0
      };
    },
    async findAutomationRule(companyId, ruleType) {
      const [rule] = await db
        .select({
          companyId: automationRules.companyId,
          ruleType: automationRules.ruleType
        })
        .from(automationRules)
        .where(
          and(
            eq(automationRules.companyId, companyId),
            eq(automationRules.ruleType, ruleType),
            eq(automationRules.isEnabled, true),
            isNull(automationRules.deletedAt)
          )
        )
        .limit(1);

      return rule ?? null;
    },
    async markInvoiceReminderSent(companyId, invoiceId, reminderLevel) {
      const now = new Date();
      const reminderColumn =
        reminderLevel === 1
          ? { reminder1SentAt: now }
          : reminderLevel === 2
            ? { reminder2SentAt: now }
            : { reminder3SentAt: now };

      await db
        .update(invoices)
        .set({
          ...reminderColumn,
          updatedAt: now
        })
        .where(and(eq(invoices.companyId, companyId), eq(invoices.id, invoiceId), isNull(invoices.deletedAt)));
    },
    async markCampaignRecipientDelivered(input) {
      const now = new Date();
      const [recipient] = await db
        .update(campaignRecipients)
        .set({
          sentAt: now,
          deliveredAt: now,
          ...(input.channel === "sms" ? { sentToPhone: input.toAddress } : { sentToEmail: input.toAddress }),
          updatedAt: now
        })
        .where(
          and(
            eq(campaignRecipients.companyId, input.companyId),
            eq(campaignRecipients.campaignId, input.campaignId),
            eq(campaignRecipients.id, input.recipientId),
            isNull(campaignRecipients.deletedAt)
          )
        )
        .returning();

      if (!recipient) {
        return;
      }

      await db.insert(messageLogs).values({
        companyId: input.companyId,
        customerId: input.customerId,
        campaignId: input.campaignId,
        channel: input.channel,
        direction: "outbound",
        toAddress: input.toAddress,
        fromAddress: input.channel === "sms" ? env.TWILIO_FROM_NUMBER : getOutboundEmailFromAddress(),
        subject: input.subject,
        body: input.body,
        providerMessageId: input.providerMessageId,
        providerStatus: input.providerStatus,
        sentAt: now,
        deliveredAt: now
      });

      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(and(eq(campaigns.companyId, input.companyId), eq(campaigns.id, input.campaignId), isNull(campaigns.deletedAt)))
        .limit(1);

      if (!campaign) {
        return;
      }

      await db
        .update(campaigns)
        .set({
          deliveredCount: (campaign.deliveredCount ?? 0) + 1,
          updatedAt: now
        })
        .where(and(eq(campaigns.companyId, input.companyId), eq(campaigns.id, input.campaignId), isNull(campaigns.deletedAt)));
    },
    async recordCampaignDeliveryFailure(input) {
      const now = new Date();

      await db.insert(messageLogs).values({
        companyId: input.companyId,
        customerId: input.customerId,
        campaignId: input.campaignId,
        channel: input.channel,
        direction: "outbound",
        toAddress: input.toAddress,
        fromAddress: input.channel === "sms" ? env.TWILIO_FROM_NUMBER : getOutboundEmailFromAddress(),
        subject: input.subject,
        body: input.body,
        failedAt: now,
        failureReason: input.failureReason
      });
    }
    };
  })();
}

async function getProductionDependencies(): Promise<NotificationsDependencies> {
  if (!productionDependenciesPromise) {
    productionDependenciesPromise = createProductionDependencies();
  }

  return productionDependenciesPromise;
}

export async function handleSendEstimateEmail(
  job: Job<Record<string, unknown>>,
  dependencies: NotificationsDependencies
): Promise<void> {
  const companyId = getJobString(job.data, "companyId");
  const estimateId = getJobString(job.data, "estimateId");
  const customerId = getJobString(job.data, "customerId");

  if (!companyId || !estimateId || !customerId) {
    logger.warn({ jobId: job.id ?? null }, "Estimate email job missing required identifiers");
    return;
  }

  const context = await dependencies.loadEstimateEmailContext(companyId, estimateId);

  if (!context || context.customerId !== customerId) {
    logger.warn({ companyId, estimateId, customerId }, "Estimate email job skipped because estimate context was not found");
    return;
  }

  if (context.status !== "sent") {
    logger.info({ companyId, estimateId, customerId }, "Estimate email job skipped because estimate is no longer sent");
    return;
  }

  if (!context.customer.email) {
    logger.warn({ companyId, estimateId, customerId }, "Estimate email job skipped because customer email is missing");
    return;
  }

  if (!context.approvalToken) {
    logger.warn({ companyId, estimateId, customerId }, "Estimate email job skipped because approval token is missing");
    return;
  }

  await dependencies.email.sendEstimateEmail(context.customer.email, {
    firstName: context.customer.firstName,
    estimateNumber: context.estimateNumber,
    title: context.title,
    total: context.total,
    expiresAt: context.expiresAt ? context.expiresAt.toISOString() : null,
    approvalUrl: `${env.APP_URL.replace(/\/$/, "")}/approve/${context.approvalToken}`,
    companyName: context.company.name
  });

  logger.info({ companyId, estimateId, customerId }, "Estimate email sent");
}

export async function handleSendInvoiceEmail(
  job: Job<Record<string, unknown>>,
  dependencies: NotificationsDependencies
): Promise<void> {
  const companyId = getJobString(job.data, "companyId");
  const invoiceId = getJobString(job.data, "invoiceId");
  const customerId = getJobString(job.data, "customerId");

  if (!companyId || !invoiceId || !customerId) {
    logger.warn({ jobId: job.id ?? null }, "Invoice email job missing required identifiers");
    return;
  }

  const context = await dependencies.loadInvoiceEmailContext(companyId, invoiceId);

  if (!context || context.customerId !== customerId) {
    logger.warn({ companyId, invoiceId, customerId }, "Invoice email job skipped because invoice context was not found");
    return;
  }

  if (!isInvoiceUnpaid(context.status)) {
    logger.info({ companyId, invoiceId, customerId }, "Invoice email job skipped because invoice is no longer unpaid");
    return;
  }

  if (!context.stripePaymentLinkUrl) {
    logger.warn({ companyId, invoiceId, customerId }, "Invoice email job skipped because payment link is missing");
    return;
  }

  if (!context.customer.email) {
    logger.warn({ companyId, invoiceId, customerId }, "Invoice email job skipped because customer email is missing");
    return;
  }

  await dependencies.email.sendInvoiceEmail(context.customer.email, {
    firstName: context.customer.firstName,
    invoiceNumber: context.invoiceNumber,
    total: context.total,
    dueAt: context.dueAt ? context.dueAt.toISOString() : null,
    paymentLinkUrl: context.stripePaymentLinkUrl,
    companyName: context.company.name
  });

  logger.info({ companyId, invoiceId, customerId }, "Invoice email sent");
}

export async function handleSendCampaignMessage(
  job: Job<Record<string, unknown>>,
  dependencies: NotificationsDependencies
): Promise<void> {
  const companyId = getJobString(job.data, "companyId");
  const campaignId = getJobString(job.data, "campaignId");
  const recipientId = getJobString(job.data, "recipientId");
  const customerId = getJobString(job.data, "customerId");
  const channel = getJobString(job.data, "channel");
  const body = getJobString(job.data, "body");
  const toAddress = getJobString(job.data, "toAddress");
  const subject = getJobString(job.data, "subject");

  if (!companyId || !campaignId || !recipientId || !customerId || !body || !toAddress) {
    logger.warn({ jobId: job.id ?? null }, "Campaign message job missing required identifiers");
    return;
  }

  if (channel !== "sms" && channel !== "email") {
    logger.warn({ jobId: job.id ?? null, campaignId, recipientId }, "Campaign message job has an unsupported channel");
    return;
  }

  const context = await dependencies.loadCampaignDeliveryContext(companyId, campaignId, recipientId);

  if (!context || context.customerId !== customerId) {
    logger.warn(
      { companyId, campaignId, recipientId, customerId },
      "Campaign message job skipped because recipient context was not found"
    );
    return;
  }

  if (context.recipient.sentAt) {
    logger.info(
      { companyId, campaignId, recipientId, customerId },
      "Campaign message job skipped because recipient was already sent"
    );
    return;
  }

  try {
    if (channel === "sms") {
      const providerMessageId = await dependencies.sms.sendSms(toAddress, body);

      await dependencies.markCampaignRecipientDelivered({
        companyId,
        campaignId,
        recipientId,
        customerId,
        channel: "sms",
        toAddress,
        body,
        subject,
        providerMessageId,
        providerStatus: "sent"
      });

      logger.info({ companyId, campaignId, recipientId, customerId }, "Campaign SMS sent");
      return;
    }

    if (!subject) {
      logger.warn({ companyId, campaignId, recipientId, customerId }, "Campaign email job skipped because subject is missing");
      return;
    }

    await dependencies.email.sendCampaignEmail(toAddress, {
      firstName: context.customer.firstName,
      subject,
      body,
      companyName: context.company.name
    });

    await dependencies.markCampaignRecipientDelivered({
      companyId,
      campaignId,
      recipientId,
      customerId,
      channel: "email",
      toAddress,
      body,
      subject,
      providerMessageId: null,
      providerStatus: "sent"
    });

    logger.info({ companyId, campaignId, recipientId, customerId }, "Campaign email sent");
  } catch (error) {
    await dependencies.recordCampaignDeliveryFailure({
      companyId,
      campaignId,
      recipientId,
      customerId,
      channel,
      toAddress,
      body,
      subject,
      failureReason: error instanceof Error ? error.message : "Unknown delivery failure"
    });

    logger.error({ err: error, companyId, campaignId, recipientId, customerId }, "Campaign delivery failed");
    throw error;
  }
}

export async function handleSendInvoiceReminder(
  job: Job<Record<string, unknown>>,
  dependencies: NotificationsDependencies
): Promise<void> {
  const companyId = getJobString(job.data, "companyId");
  const invoiceId = getJobString(job.data, "invoiceId");
  const customerId = getJobString(job.data, "customerId");
  const reminderLevel = getReminderLevel(job.data);

  if (!companyId || !invoiceId || !customerId || !reminderLevel) {
    logger.warn({ jobId: job.id ?? null }, "Invoice reminder job missing required identifiers");
    return;
  }

  const rule = await dependencies.findAutomationRule(companyId, "invoice_reminder");

  if (!rule) {
    logger.info({ companyId, invoiceId, customerId, reminderLevel }, "Invoice reminder skipped because automation is disabled");
    return;
  }

  const context = await dependencies.loadInvoiceEmailContext(companyId, invoiceId);

  if (!context || context.customerId !== customerId) {
    logger.warn({ companyId, invoiceId, customerId, reminderLevel }, "Invoice reminder job skipped because invoice context was not found");
    return;
  }

  if (!isInvoiceUnpaid(context.status)) {
    logger.info({ companyId, invoiceId, customerId, reminderLevel }, "Invoice reminder job skipped because invoice is no longer unpaid");
    return;
  }

  if (!context.stripePaymentLinkUrl) {
    logger.warn({ companyId, invoiceId, customerId, reminderLevel }, "Invoice reminder job skipped because payment link is missing");
    return;
  }

  if (!context.customer.email) {
    logger.warn({ companyId, invoiceId, customerId, reminderLevel }, "Invoice reminder job skipped because customer email is missing");
    return;
  }

  const existingReminderTimestamp =
    reminderLevel === 1
      ? context.reminder1SentAt
      : reminderLevel === 2
        ? context.reminder2SentAt
        : context.reminder3SentAt;

  if (existingReminderTimestamp) {
    logger.info(
      { companyId, invoiceId, customerId, reminderLevel },
      "Invoice reminder job skipped because reminder already sent"
    );
    return;
  }

  await dependencies.email.sendInvoiceReminderEmail(context.customer.email, {
    firstName: context.customer.firstName,
    invoiceNumber: context.invoiceNumber,
    total: context.total,
    balanceDue: context.balanceDue,
    dueAt: context.dueAt ? context.dueAt.toISOString() : null,
    paymentLinkUrl: context.stripePaymentLinkUrl,
    companyName: context.company.name,
    reminderLevel
  });

  if (reminderLevel === 3) {
    const owner = await dependencies.loadCompanyOwner(companyId);

    if (!owner?.email) {
      logger.warn(
        { companyId, invoiceId, customerId, reminderLevel },
        "Invoice reminder owner alert skipped because owner email is missing"
      );
    } else {
      await dependencies.email.sendInvoiceReminderOwnerAlertEmail(owner.email, {
        ownerFirstName: owner.firstName,
        customerName: `${context.customer.firstName} ${context.customer.lastName}`.trim(),
        invoiceNumber: context.invoiceNumber,
        balanceDue: context.balanceDue,
        paymentLinkUrl: context.stripePaymentLinkUrl,
        companyName: context.company.name
      });
    }
  }

  await dependencies.markInvoiceReminderSent(companyId, invoiceId, reminderLevel);
  logger.info({ companyId, invoiceId, customerId, reminderLevel }, "Invoice reminder sent");
}

export async function handleSendServiceAgreementEmail(
  job: Job<Record<string, unknown>>,
  dependencies: NotificationsDependencies
): Promise<void> {
  const companyId = getJobString(job.data, "companyId");
  const maintenancePlanId = getJobString(job.data, "maintenancePlanId");
  const emailType = getAgreementEmailType(job.data);
  const manageUrl =
    getJobString(job.data, "manageUrl") ??
    `${env.APP_URL.replace(/\/$/, "")}/settings/service-agreements`;

  if (!companyId || !maintenancePlanId || !emailType) {
    logger.warn({ jobId: job.id ?? null }, "Service agreement email job missing required identifiers");
    return;
  }

  const context = await dependencies.loadServiceAgreementEmailContext(companyId, maintenancePlanId);

  if (!context) {
    logger.warn({ companyId, maintenancePlanId, emailType }, "Service agreement email job skipped because plan context was not found");
    return;
  }

  if (emailType === "renewal_reminder") {
    const rule = await dependencies.findAutomationRule(companyId, "service_agreement_renewal");

    if (!rule) {
      logger.info({ companyId, maintenancePlanId, emailType }, "Service agreement renewal reminder skipped because automation is disabled");
      return;
    }

    if (!context.customer.email) {
      logger.warn({ companyId, maintenancePlanId, emailType }, "Service agreement renewal reminder skipped because customer email is missing");
      return;
    }

    await dependencies.email.sendServiceAgreementRenewalReminderEmail(context.customer.email, {
      firstName: context.customer.firstName,
      planName: context.template?.name ?? context.name,
      nextServiceDate: context.nextServiceDate,
      companyName: context.company.name
    });

    logger.info({ companyId, maintenancePlanId, customerId: context.customerId }, "Service agreement renewal reminder sent");
    return;
  }

  const owner = await dependencies.loadCompanyOwner(companyId);

  if (!owner?.email) {
    logger.warn({ companyId, maintenancePlanId, emailType }, "Service agreement payment failure email skipped because owner email is missing");
    return;
  }

  await dependencies.email.sendServiceAgreementPaymentFailedEmail(owner.email, {
    ownerFirstName: owner.firstName,
    customerName: `${context.customer.firstName} ${context.customer.lastName}`.trim(),
    planName: context.template?.name ?? context.name,
    amount: context.price ?? "0.00",
    manageUrl,
    companyName: context.company.name
  });

  logger.info({ companyId, maintenancePlanId, ownerId: owner.id }, "Service agreement payment failure email sent");
}

export async function handleSendOnTheWayNotification(
  job: Job<Record<string, unknown>>,
  dependencies: NotificationsDependencies
): Promise<void> {
  await handleSmsNotificationJob(job, dependencies, {
    jobLabel: "OTW notification"
  });
}

/** Plan renewal / tune-up reminder (queued by the API with a fixed job id). SMS goes through the provider registry. */
export async function handleSendPlanReminder(
  job: Job<Record<string, unknown>>,
  dependencies: NotificationsDependencies
): Promise<void> {
  const data = job.data;
  const kind = getJobString(data, "reminderKind") === "tune_up" ? "tune_up" : "renewal";
  const log = { jobId: job.id ?? null, companyId: getJobString(data, "companyId"), maintenancePlanId: getJobString(data, "maintenancePlanId"), kind };
  const channel = getJobString(data, "channel") === "sms" ? "sms" : "email";
  if (dependencies.loadPlanReminderSendContext) {
    const companyId = getJobString(data, "companyId");
    const maintenancePlanId = getJobString(data, "maintenancePlanId");
    const context =
      companyId && maintenancePlanId ? await dependencies.loadPlanReminderSendContext(companyId, maintenancePlanId) : null;
    const skip = planReminderSendSkipReason(context, channel, getJobString(data, "customerId"));
    if (skip) {
      logger.info({ ...log, channel, reason: skip }, "Plan reminder skipped at send time");
      return;
    }
  }
  if (getJobString(data, "channel") === "sms") {
    const phone = getJobString(data, "customerPhone");
    const body = getJobString(data, "smsBody");
    if (!phone || !body) {
      logger.warn(log, "Plan reminder SMS job missing required data");
      return;
    }
    await dependencies.sms.sendSms(phone, body);
    logger.info(log, "Plan reminder SMS processed");
    return;
  }
  const to = getJobString(data, "customerEmail");
  if (!to || !dependencies.email.sendPlanReminderEmail) {
    logger.warn(log, "Plan reminder email job missing required data");
    return;
  }
  await dependencies.email.sendPlanReminderEmail(to, {
    firstName: getJobString(data, "firstName") ?? "",
    companyName: getJobString(data, "companyName") ?? "",
    planName: getJobString(data, "planName") ?? "maintenance plan",
    dueDateLabel: getJobString(data, "dueDateLabel") ?? "",
    reminderKind: kind
  });
  logger.info(log, "Plan reminder email sent");
}

export async function handleSendReviewRequest(
  job: Job<Record<string, unknown>>,
  dependencies: NotificationsDependencies
): Promise<void> {
  const companyId = getJobString(job.data, "companyId");
  const reviewRequestId = getJobString(job.data, "reviewRequestId");
  const invoiceId = getJobString(job.data, "invoiceId");
  const channel = getJobString(job.data, "channel") === "email" ? "email" : "sms";
  if (companyId && reviewRequestId && dependencies.loadReviewRequestSendContext) {
    const context = await dependencies.loadReviewRequestSendContext(companyId, reviewRequestId, invoiceId);
    const skip = reviewRequestSendSkipReason(context, channel, Boolean(invoiceId));
    if (skip) {
      logger.info(
        { jobId: job.id ?? null, companyId, reviewRequestId, invoiceId, channel, reason: skip },
        "Review request skipped at send time"
      );
      return;
    }
  }

  if (channel === "email") {
    const to = getJobString(job.data, "customerEmail");
    const referenceId = getJobString(job.data, "referenceId");
    if (!to || !referenceId || !dependencies.email.sendReviewRequestEmail) {
      logger.warn({ jobId: job.id ?? null }, "Review request email job missing required data");
      return;
    }
    await dependencies.email.sendReviewRequestEmail(to, {
      firstName: getJobString(job.data, "customerFirstName") ?? "",
      companyName: getJobString(job.data, "companyName") ?? "Renvani",
      technicianName: getJobString(job.data, "technicianName"),
      reviewUrl: `${env.APP_URL.replace(/\/$/, "")}/review/${referenceId}`
    });
    logger.info(
      { companyId: getJobString(job.data, "companyId"), reviewRequestId: getJobString(job.data, "reviewRequestId") },
      "Review request email sent"
    );
    return;
  }

  await handleSmsNotificationJob(job, dependencies, {
    jobLabel: "Review request",
    buildBody(data) {
      const referenceId = getJobString(data, "referenceId");
      const companyName = getJobString(data, "companyName") ?? "ServiceRev";
      const technicianName = getJobString(data, "technicianName");

      if (!referenceId) {
        return null;
      }

      const technicianFragment = technicianName ? ` from ${technicianName}` : "";
      const reviewUrl = `${env.APP_URL.replace(/\/$/, "")}/review/${referenceId}`;
      return `${companyName}: thanks for your recent visit${technicianFragment}. Please leave a quick review: ${reviewUrl}`;
    }
  });
}

export async function handleSendVipMembershipEmail(
  job: Job<Record<string, unknown>>,
  dependencies: NotificationsDependencies
): Promise<void> {
  const companyId = getJobString(job.data, "companyId");
  const customerId = getJobString(job.data, "customerId");
  const emailKind = getVipMembershipEmailKind(job.data);
  const planName = getJobString(job.data, "planName") ?? "VIP Plus";

  if (!companyId || !customerId || !emailKind) {
    logger.warn({ jobId: job.id ?? null }, "VIP membership email job missing required identifiers");
    return;
  }

  const [customerRow, companyRow] = await Promise.all([
    db
      .select()
      .from(customers)
      .where(and(eq(customers.companyId, companyId), eq(customers.id, customerId), isNull(customers.deletedAt)))
      .limit(1),
    db
      .select()
      .from(companies)
      .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
      .limit(1)
  ]);

  const customer = customerRow[0];
  const company = companyRow[0];

  if (!customer || !company) {
    logger.warn({ companyId, customerId, emailKind }, "VIP membership email job skipped because context was not found");
    return;
  }

  if (!customer.email) {
    logger.warn({ companyId, customerId, emailKind }, "VIP membership email job skipped because customer email is missing");
    return;
  }

  // Fall back to the (stable across retries) BullMQ job id so emails missing Stripe ids never collide
  // on the message_logs (company, source, source id) unique key.
  const fallbackSourceKey = `job-${job.id ?? randomUUID()}`;
  const stripeSubscriptionId = getJobString(job.data, "stripeSubscriptionId") ?? fallbackSourceKey;
  const stripeInvoiceId = getJobString(job.data, "stripeInvoiceId") ?? fallbackSourceKey;
  const fromAddress = getOutboundEmailFromAddress();

  if (emailKind === "welcome") {
    const delivery = await dependencies.email.sendVipMembershipWelcomeEmail(customer.email, {
      firstName: customer.firstName,
      companyName: company.name,
      planName,
      portalUrl: null
    });
    await recordTransactionalEmailMessageLog({
      companyId,
      customerId,
      toAddress: customer.email,
      fromAddress,
      delivery,
      sourceSystem: "vip_membership_email",
      sourceId: `${stripeSubscriptionId}:welcome`
    });
    logger.info({ companyId, customerId, emailKind }, "VIP membership welcome email sent");
    return;
  }

  if (emailKind === "renewal_receipt") {
    const amount = getJobString(job.data, "amount") ?? "0.00";
    const delivery = await dependencies.email.sendVipMembershipRenewalEmail(customer.email, {
      firstName: customer.firstName,
      companyName: company.name,
      planName,
      amount,
      renewalDateLabel: formatVipLabelFromIso(new Date().toISOString())
    });
    await recordTransactionalEmailMessageLog({
      companyId,
      customerId,
      toAddress: customer.email,
      fromAddress,
      delivery,
      sourceSystem: "vip_membership_email",
      sourceId: `${stripeSubscriptionId}:renewal:${stripeInvoiceId}`
    });
    logger.info({ companyId, customerId, emailKind }, "VIP membership renewal email sent");
    return;
  }

  const amount = getJobString(job.data, "amount") ?? "0.00";
  const paymentUrl = getJobString(job.data, "paymentUrl");
  const graceEndsAtLabel = formatVipLabelFromIso(getJobString(job.data, "graceEndsAtIso"));
  const nextRetryAtLabel = formatVipLabelFromIso(getJobString(job.data, "nextRetryAtIso"));
  const dunningStepIndex =
    typeof job.data.dunningStepIndex === "number" && Number.isInteger(job.data.dunningStepIndex)
      ? job.data.dunningStepIndex
      : 0;

  const delivery = await dependencies.email.sendVipMembershipPaymentFailedEmail(customer.email, {
    firstName: customer.firstName,
    companyName: company.name,
    planName,
    amount,
    paymentUrl,
    graceEndsAtLabel,
    nextRetryAtLabel,
    dunningStepIndex
  });

  await recordTransactionalEmailMessageLog({
    companyId,
    customerId,
    toAddress: customer.email,
    fromAddress,
    delivery,
    sourceSystem: "vip_membership_email",
    sourceId: `${stripeSubscriptionId}:dunning:${stripeInvoiceId}:step-${dunningStepIndex}`
  });

  logger.info({ companyId, customerId, emailKind, dunningStepIndex }, "VIP membership dunning email sent");
}

export async function handleSendPasswordResetEmail(
  job: Job<Record<string, unknown>>,
  dependencies: NotificationsDependencies
): Promise<void> {
  const companyId = getJobString(job.data, "companyId");
  const toEmail = getJobString(job.data, "toEmail");
  const firstName = getJobString(job.data, "firstName") ?? "there";
  const resetUrl = getJobString(job.data, "resetUrl");

  if (!companyId || !toEmail || !resetUrl) {
    logger.warn({ jobId: job.id ?? null, jobName: job.name }, "Password reset email job missing required data");
    return;
  }

  await dependencies.email.sendPasswordResetEmail(toEmail, resetUrl, firstName);
  logger.info({ companyId, jobName: job.name }, "Password reset email sent");
}

export async function handleSendBookingNotification(
  job: Job<Record<string, unknown>>,
  dependencies: NotificationsDependencies
): Promise<void> {
  const companyId = getJobString(job.data, "companyId");
  const toEmail = getJobString(job.data, "toEmail");
  const firstName = getJobString(job.data, "firstName") ?? "there";
  const companyName = getJobString(job.data, "companyName");
  const referenceNumber = getJobString(job.data, "referenceNumber");
  const scheduledLabel = getJobString(job.data, "scheduledLabel");
  const reason = getJobString(job.data, "reason");

  if (toEmail && companyName && referenceNumber) {
    const customerId = getJobString(job.data, "customerId");
    const bookingRequestId = getJobString(job.data, "bookingRequestId");
    const fromAddress = getOutboundEmailFromAddress();
    const delivery =
      job.name === "send-booking-decline"
        ? await dependencies.email.sendBookingDeclineEmail(toEmail, {
            firstName,
            companyName,
            referenceNumber,
            reason: reason ?? null
          })
        : await dependencies.email.sendBookingConfirmationEmail(toEmail, {
            firstName,
            companyName,
            referenceNumber,
            scheduledLabel: scheduledLabel ?? null
          });

    if (companyId && bookingRequestId) {
      await recordTransactionalEmailMessageLog({
        companyId,
        customerId: customerId ?? null,
        toAddress: toEmail,
        fromAddress,
        delivery,
        sourceSystem: "booking_notification",
        sourceId: `${bookingRequestId}:${job.name}`
      });
    }

    logger.info(
      {
        companyId,
        jobName: job.name,
        bookingRequestId: getJobString(job.data, "bookingRequestId")
      },
      "Booking notification email sent"
    );
    return;
  }

  if (job.name === "send-booking-request-alert") {
    await handleSmsNotificationJob(job, dependencies, {
      jobLabel: "Booking notification"
    });
    return;
  }

  logger.info(
    {
      companyId,
      jobName: job.name,
      bookingRequestId: getJobString(job.data, "bookingRequestId")
    },
    "Booking customer notification skipped (email-first; no customer email on file)"
  );
}

export function createNotificationsProcessor(
  dependenciesProvider: NotificationsDependencies | (() => Promise<NotificationsDependencies>)
): Processor<Record<string, unknown>, void, string> {
  return async (job) => {
    const dependencies =
      typeof dependenciesProvider === "function"
        ? await dependenciesProvider()
        : dependenciesProvider;

    switch (job.name) {
      case "send-estimate-email":
        await handleSendEstimateEmail(job, dependencies);
        return;
      case "send-campaign-message":
        await handleSendCampaignMessage(job, dependencies);
        return;
      case "send-invoice-email":
        await handleSendInvoiceEmail(job, dependencies);
        return;
      case "send-invoice-reminder":
        await handleSendInvoiceReminder(job, dependencies);
        return;
      case "send-service-agreement-email":
      case "send-service-agreement-payment-failed-email":
        await handleSendServiceAgreementEmail(job, dependencies);
        return;
      case "send-otw-notification":
        await handleSendOnTheWayNotification(job, dependencies);
        return;
      case "send-review-request":
        await handleSendReviewRequest(job, dependencies);
        return;
      case "send-plan-reminder":
        await handleSendPlanReminder(job, dependencies);
        return;
      case "send-booking-request-alert":
      case "send-booking-confirmation":
      case "send-booking-decline":
        await handleSendBookingNotification(job, dependencies);
        return;
      case "send-password-reset-email":
        await handleSendPasswordResetEmail(job, dependencies);
        return;
      case "send-vip-membership-email":
        await handleSendVipMembershipEmail(job, dependencies);
        return;
      default:
        logger.warn({ jobId: job.id ?? null, jobName: job.name }, "Unknown notifications job received");
    }
  };
}

export const processNotifications = createNotificationsProcessor(getProductionDependencies);
