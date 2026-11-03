import fastifyCors from "@fastify/cors";

import { allowedAppOrigins, runWithRequestOrigin } from "./lib/app-origins.js";
import { parseClerkAuthorizedParties } from "./lib/clerk-auth.js";
import clerkWebhookRoutes from "./routes/webhooks/clerk.js";
import callTrackingWebhookRoutes from "./routes/webhooks/call-tracking.js";
import Fastify from "fastify";
import pino from "pino";

import { env } from "@fsm/config";

import { redactAccessTokenInUrl } from "./lib/request-log-path.js";
import authenticatePlugin from "./plugins/authenticate.js";
import companyScopedWritePlugin from "./plugins/company-scoped-write.js";
import errorHandlerPlugin from "./plugins/error-handler.js";
import requestLoggerPlugin from "./plugins/request-logger.js";
import activityEventRoutes from "./routes/activity-events/index.js";
import agentActionRoutes from "./routes/agent-actions/index.js";
import aiRoutes from "./routes/ai/index.js";
import automationRuleRoutes from "./routes/automation-rules/index.js";
import attachmentRoutes from "./routes/attachments/index.js";
import authRoutes from "./routes/auth/index.js";
import billingRoutes from "./routes/billing/index.js";
import bookingRoutes from "./routes/booking/index.js";
import companyRoutes from "./routes/company/index.js";
import companyHomeServicesRoutes from "./routes/company/home-services.js";
import campaignRoutes from "./routes/campaigns/index.js";
import customerRoutes from "./routes/customers/index.js";
import crewRoutes from "./routes/crews/index.js";
import dispatchRoutes from "./routes/dispatch/index.js";
import fieldWorkRoutes from "./routes/field-work/index.js";
import technicianMobileRoutes from "./routes/technician-mobile/index.js";
import healthRoutes from "./routes/health/index.js";
import globalRateLimitPlugin from "./plugins/global-rate-limit.js";
import growthCheckIntakeRoutes from "./routes/growth-checks/index.js";
import estimateRoutes from "./routes/estimates/index.js";
import growthCheckScanRoutes from "./routes/growth-check/index.js";
import invoiceRoutes from "./routes/invoices/index.js";
import importRoutes from "./routes/imports/index.js";
import importReconciliationRoutes from "./routes/import-reconciliation/index.js";
import internalAdminQueueRoutes from "./routes/internal-admin/queues/index.js";
import internalAdminQboSyncRoutes from "./routes/internal-admin/qbo-sync/index.js";
import quickbooksOnlineRoutes from "./routes/quickbooks-online/index.js";
import migrateOnboardingRoutes from "./routes/migrate-onboarding/index.js";
import integrationOutboxRoutes from "./routes/integration-outbox/index.js";
import payoutsDisputesRoutes from "./routes/payouts-disputes/index.js";
import migratePhotoLinkRoutes from "./routes/migrate-photo-link/index.js";
import internalAdminSavedCardMigrationRoutes from "./routes/internal-admin/saved-card-migrations/index.js";
import savedCardMigrationRoutes from "./routes/saved-card-migration/index.js";
import dataExportRoutes from "./routes/data-exports/index.js";
import jobEngagementRoutes from "./routes/job-engagement/index.js";
import jobEtaRoutes from "./routes/job-eta/index.js";
import googleBusinessProfileRoutes from "./routes/google-business-profile/index.js";
import callTrackingRoutes from "./routes/call-tracking/index.js";
import { assertGeoProviderConfigured } from "./services/geo/geo-provider.registry.js";
import jobRoutes from "./routes/jobs/index.js";
import loyaltyRoutes from "./routes/loyalty/index.js";
import messageLogRoutes from "./routes/message-logs/index.js";
import operatorRoutes from "./routes/operator/index.js";
import publicRoutes from "./routes/public/index.js";
import inventoryRoutes from "./routes/inventory/index.js";
import priceBookRoutes from "./routes/price-book/index.js";
import productRoutes from "./routes/products/index.js";
import qboSyncRoutes from "./routes/qbo-sync/index.js";
import reportingRoutes from "./routes/reporting/index.js";
import commandCenterRoutes from "./routes/command-center/index.js";
import reviewRequestRoutes from "./routes/review-requests/index.js";
import revenueInquiryRoutes from "./routes/revenue-inquiries/index.js";
import schedulingAgentRoutes from "./routes/scheduling-agent/index.js";
import tenantContextRoutes from "./routes/tenant-context/index.js";
import serviceAgreementRoutes from "./routes/service-agreements/index.js";
import vipMembershipRoutes from "./routes/vip-memberships/index.js";
import stripePlatformSyncPlugin from "./plugins/stripe-platform-sync.js";
import stripeRoutes from "./routes/stripe/index.js";
import technicianExtensionRoutes from "./routes/technician-extensions/index.js";
import technicianRoutes from "./routes/technicians/index.js";
import meRoutes from "./routes/me/index.js";
import userRoutes from "./routes/users/index.js";
import timeRoutes from "./routes/time/index.js";
import timesheetRoutes from "./routes/timesheets/index.js";

/** FS-66 — TRUST_PROXY_HOPS → Fastify trustProxy (0 = false; N = trust N hops of X-Forwarded-For). */
/** Fastify route-param length cap (see buildApp). */
export const API_MAX_PARAM_LENGTH = 512;

export function resolveTrustProxySetting(hops: number): false | number {
  return Number.isInteger(hops) && hops > 0 ? hops : false;
}

export async function buildApp() {
  const logger = pino({
    level: env.NODE_ENV === "production" ? "info" : "debug",
    serializers: {
      req(request) {
        return {
          method: request.method,
          url: redactAccessTokenInUrl(request.url),
          host: request.headers.host,
          remoteAddress: request.socket?.remoteAddress,
          remotePort: request.socket?.remotePort
        };
      }
    }
  });

  const app = Fastify({
    loggerInstance: logger,
    // Default is 100; signed public tokens (e.g. VIP join, ~165 chars) exceed it and 404'd before the handler.
    // Route schemas still cap each token (VIP: 256), so oversized-but-<512 values get the handler's 404.
    maxParamLength: API_MAX_PARAM_LENGTH,
    trustProxy: resolveTrustProxySetting(env.TRUST_PROXY_HOPS)
  });

  await app.register(fastifyCors, {
    // APP_URL primary + APP_URL_ALLOWED extras (staging tier only, exact match) + Clerk authorized parties.
    origin: [...new Set([...allowedAppOrigins(), ...parseClerkAuthorizedParties(env.CLERK_AUTHORIZED_PARTIES)])],
    credentials: true,
    allowedHeaders: ["Authorization", "Content-Type", "Idempotency-Key", "X-Request-Id", "X-Customer-Portal-Token"]
  });
  // Bind the caller's Origin so Stripe return URLs can target an allowed tester origin (falls back to APP_URL).
  app.addHook("onRequest", (request, _reply, done) => {
    const origin = typeof request.headers.origin === "string" ? request.headers.origin : null;
    runWithRequestOrigin(origin, done);
  });
  await app.register(requestLoggerPlugin);
  await app.register(globalRateLimitPlugin);
  await app.register(errorHandlerPlugin);
  await app.register(stripePlatformSyncPlugin);
  await app.register(healthRoutes);
  await app.register(authenticatePlugin);
  await app.register(companyScopedWritePlugin);

  await app.register(activityEventRoutes, { prefix: "/api/v1" });
  await app.register(agentActionRoutes, { prefix: "/api/v1" });
  await app.register(commandCenterRoutes, { prefix: "/api/v1" });
  await app.register(operatorRoutes, { prefix: "/api/v1" });
  await app.register(tenantContextRoutes, { prefix: "/api/v1" });
  await app.register(revenueInquiryRoutes, { prefix: "/api/v1" });
  await app.register(schedulingAgentRoutes, { prefix: "/api/v1" });
  await app.register(aiRoutes, { prefix: "/api/v1/ai" });
  await app.register(automationRuleRoutes, { prefix: "/api/v1" });
  await app.register(authRoutes, { prefix: "/api/v1/auth" });
  await app.register(campaignRoutes, { prefix: "/api/v1" });
  await app.register(companyRoutes, { prefix: "/api/v1/company" });
  await app.register(companyHomeServicesRoutes, { prefix: "/api/v1/company" });
  await app.register(customerRoutes, { prefix: "/api/v1/customers" });
  await app.register(dispatchRoutes, { prefix: "/api/v1" });
  await app.register(crewRoutes, { prefix: "/api/v1" });
  await app.register(fieldWorkRoutes, { prefix: "/api/v1" });
  await app.register(technicianMobileRoutes, { prefix: "/api/v1" });
  await app.register(growthCheckIntakeRoutes, { prefix: "/api/v1" });
  await app.register(internalAdminQueueRoutes, { prefix: "/api/v1" });
  await app.register(internalAdminQboSyncRoutes, { prefix: "/api/v1" });
  await app.register(quickbooksOnlineRoutes, { prefix: "/api/v1" });
  await app.register(internalAdminSavedCardMigrationRoutes, { prefix: "/api/v1" });
  await app.register(growthCheckScanRoutes, { prefix: "/api/v1" });
  await app.register(attachmentRoutes, { prefix: "/api/v1" });
  await app.register(bookingRoutes, { prefix: "/api/v1" });
  await app.register(reportingRoutes, { prefix: "/api/v1" });
  await app.register(reviewRequestRoutes, { prefix: "/api/v1" });
  await app.register(jobRoutes, { prefix: "/api/v1/jobs" });
  await app.register(jobEngagementRoutes, { prefix: "/api/v1/jobs" });
  await app.register(jobEtaRoutes, { prefix: "/api/v1/jobs" });
  await app.register(googleBusinessProfileRoutes, { prefix: "/api/v1/integrations/google-business-profile" });
  await app.register(callTrackingRoutes, { prefix: "/api/v1/growth/call-tracking" });
  await app.register(messageLogRoutes, { prefix: "/api/v1" });
  await app.register(productRoutes, { prefix: "/api/v1" });
  await app.register(inventoryRoutes, { prefix: "/api/v1" });
  await app.register(priceBookRoutes, { prefix: "/api/v1" });
  await app.register(technicianRoutes, { prefix: "/api/v1/technicians" });
  await app.register(userRoutes, { prefix: "/api/v1/users" });
  await app.register(meRoutes, { prefix: "/api/v1/me" });
  await app.register(technicianExtensionRoutes, { prefix: "/api/v1/technicians" });
  await app.register(timeRoutes, { prefix: "/api/v1/time" });
  await app.register(timesheetRoutes, { prefix: "/api/v1" });
  await app.register(stripeRoutes, { prefix: "/api/v1/stripe" });
  await app.register(billingRoutes, { prefix: "/api/v1/billing" });
  await app.register(estimateRoutes, { prefix: "/api/v1/estimates" });
  await app.register(invoiceRoutes, { prefix: "/api/v1" });
  await app.register(importRoutes, { prefix: "/api/v1" });
  await app.register(importReconciliationRoutes, { prefix: "/api/v1" });
  await app.register(migrateOnboardingRoutes, { prefix: "/api/v1" });
  await app.register(integrationOutboxRoutes, { prefix: "/api/v1" });
  await app.register(payoutsDisputesRoutes, { prefix: "/api/v1" });
  await app.register(migratePhotoLinkRoutes, { prefix: "/api/v1" });
  await app.register(savedCardMigrationRoutes, { prefix: "/api/v1" });
  await app.register(dataExportRoutes, { prefix: "/api/v1" });
  await app.register(serviceAgreementRoutes, { prefix: "/api/v1" });
  await app.register(vipMembershipRoutes, { prefix: "/api/v1" });
  await app.register(loyaltyRoutes, { prefix: "/api/v1" });
  await app.register(qboSyncRoutes, { prefix: "/api/v1" });
  await app.register(publicRoutes, { prefix: "/api/v1/public" });
  await app.register(clerkWebhookRoutes, { prefix: "/api/v1/webhooks" });
  await app.register(callTrackingWebhookRoutes, { prefix: "/api/v1/webhooks" });

  // FS-198 follow-up: all geo providers are registered by now; fail fast on a bad GEO_PROVIDER.
  assertGeoProviderConfigured(env.GEO_PROVIDER);

  return app;
}
