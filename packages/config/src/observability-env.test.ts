import { describe, expect, it } from "vitest";

import {
  resolvePostHogServerEnv,
  resolvePostHogWebEnv,
  resolveSentryNodeEnv,
  resolveSentryWebEnv
} from "./observability-env.js";

describe("observability-env", () => {
  it("disables Sentry when DSN is empty", () => {
    expect(resolveSentryNodeEnv({})).toEqual({ enabled: false, reason: "missing_credentials" });
  });

  it("enables Sentry with a valid DSN", () => {
    const result = resolveSentryNodeEnv({
      SENTRY_DSN: "https://example@o123.ingest.sentry.io/456",
      NODE_ENV: "test"
    });
    expect(result.enabled).toBe(true);
    if (result.enabled) {
      expect(result.config.SENTRY_ENVIRONMENT).toBe("test");
      expect(result.config.SENTRY_TRACES_SAMPLE_RATE).toBe(0);
    }
  });

  it("enables PostHog server when API key is set", () => {
    const result = resolvePostHogServerEnv({ POSTHOG_API_KEY: "phc_test" });
    expect(result.enabled).toBe(true);
  });

  it("resolves web PostHog and Sentry from NEXT_PUBLIC vars", () => {
    expect(resolvePostHogWebEnv({})).toEqual({ enabled: false });
    expect(
      resolvePostHogWebEnv({ NEXT_PUBLIC_POSTHOG_KEY: "phc_web" }).enabled
    ).toBe(true);
    expect(
      resolveSentryWebEnv({ NEXT_PUBLIC_SENTRY_DSN: "https://example@o123.ingest.sentry.io/456" })
        .enabled
    ).toBe(true);
  });
});
