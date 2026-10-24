"use client";

/** FS-43: env-gated Sentry + PostHog browser init (batch 5 / #142). */

import * as Sentry from "@sentry/react";
import posthog from "posthog-js";

import { resolvePostHogWebEnv, resolveSentryWebEnv } from "@fsm/config/observability-env";

let webObservabilityInitialized = false;

export function initWebObservability(): void {
  if (webObservabilityInitialized || typeof window === "undefined") {
    return;
  }

  const sentry = resolveSentryWebEnv();
  if (sentry.enabled) {
    Sentry.init({
      dsn: sentry.dsn,
      environment: sentry.environment,
      tracesSampleRate: 0
    });
  }

  const postHog = resolvePostHogWebEnv();
  if (postHog.enabled) {
    posthog.init(postHog.apiKey, {
      api_host: postHog.host,
      capture_pageview: true,
      persistence: "localStorage"
    });
  }

  webObservabilityInitialized = true;
}

export function registerWebTenantContext(input: {
  companyId: string;
  userId?: string;
}): void {
  if (!webObservabilityInitialized) {
    return;
  }

  Sentry.setTag("companyId", input.companyId);
  if (input.userId) {
    Sentry.setUser({ id: input.userId });
  }

  const postHog = resolvePostHogWebEnv();
  if (!postHog.enabled) {
    return;
  }

  posthog.identify(input.companyId, {
    companyId: input.companyId,
    userId: input.userId ?? null
  });
  posthog.register({ companyId: input.companyId });
}

export function captureWebException(error: unknown, context?: {
  companyId?: string;
  importSessionId?: string;
  jobId?: string;
}): void {
  if (context?.companyId) {
    Sentry.setTag("companyId", context.companyId);
  }
  if (context?.importSessionId) {
    Sentry.setTag("importSessionId", context.importSessionId);
  }
  if (context?.jobId) {
    Sentry.setTag("jobId", context.jobId);
  }

  Sentry.captureException(error);
}
