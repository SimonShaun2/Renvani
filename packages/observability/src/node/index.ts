import * as Sentry from "@sentry/node";
import { PostHog } from "posthog-node";

import {
  resolvePostHogServerEnv,
  resolveSentryNodeEnv,
  type PostHogServerEnvConfig,
  type SentryEnvConfig
} from "@fsm/config/observability-env";

import {
  getObservabilityContext,
  observabilityTagsFromContext,
  type ObservabilityTagContext
} from "../context.js";

export type NodeObservabilityService = "api" | "worker";

let sentryEnabled = false;
let posthogClient: PostHog | null = null;
let posthogConfig: PostHogServerEnvConfig | null = null;

export function initNodeObservability(service: NodeObservabilityService): void {
  const sentryResolution = resolveSentryNodeEnv();
  if (sentryResolution.enabled) {
    const config: SentryEnvConfig = sentryResolution.config;
    Sentry.init({
      dsn: config.SENTRY_DSN,
      environment: config.SENTRY_ENVIRONMENT ?? "development",
      tracesSampleRate: config.SENTRY_TRACES_SAMPLE_RATE,
      initialScope: {
        tags: {
          service
        }
      }
    });
    sentryEnabled = true;
  }

  const posthogResolution = resolvePostHogServerEnv();
  if (posthogResolution.enabled) {
    posthogConfig = posthogResolution.config;
    posthogClient = new PostHog(posthogConfig.POSTHOG_API_KEY, {
      host: posthogConfig.POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0
    });
  }
}

export function isNodeSentryEnabled(): boolean {
  return sentryEnabled;
}

export function isNodePostHogEnabled(): boolean {
  return posthogClient !== null;
}

function resolvedContext(explicit?: ObservabilityTagContext): ObservabilityTagContext {
  return {
    ...getObservabilityContext(),
    ...explicit
  };
}

export function applyNodeObservabilityTags(explicit?: ObservabilityTagContext): void {
  const tags = observabilityTagsFromContext(resolvedContext(explicit));
  if (!sentryEnabled || Object.keys(tags).length === 0) {
    return;
  }

  Sentry.getIsolationScope().setTags(tags);
}

export function captureNodeException(
  error: unknown,
  explicit?: ObservabilityTagContext
): void {
  if (!sentryEnabled) {
    return;
  }

  Sentry.withScope((scope) => {
    scope.setTags(observabilityTagsFromContext(resolvedContext(explicit)));
    Sentry.captureException(error);
  });
}

export function trackNodeProductEvent(
  event: string,
  properties: Record<string, string | number | boolean | null>,
  explicit?: ObservabilityTagContext
): void {
  const context = resolvedContext(explicit);
  const tags = observabilityTagsFromContext(context);

  if (sentryEnabled) {
    Sentry.addBreadcrumb({
      category: "product",
      message: event,
      data: { ...tags, ...properties }
    });
  }

  if (!posthogClient) {
    return;
  }

  const distinctId = context.companyId ?? "anonymous";
  posthogClient.capture({
    distinctId,
    event,
    properties: {
      ...properties,
      ...tags
    }
  });
}

export async function shutdownNodeObservability(): Promise<void> {
  if (posthogClient) {
    await posthogClient.shutdown();
    posthogClient = null;
    posthogConfig = null;
  }

  if (sentryEnabled) {
    await Sentry.close(2_000);
    sentryEnabled = false;
  }
}
