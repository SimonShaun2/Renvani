import { describe, expect, it } from "vitest";

import { parseRuntimeEnv } from "./runtime-env.js";

const apiSource = {
  DATABASE_URL: "postgresql://synthetic:db-private@localhost:5432/fsm_test",
  REDIS_URL: "redis://:redis-private@localhost:6379",
  APP_URL: "https://staging.example.test",
  JWT_SECRET: "synthetic-jwt-private",
  JWT_REFRESH_SECRET: "synthetic-refresh-private",
  BOOKING_HOLD_TOKEN_SECRET: "synthetic-booking-private",
  ACCESS_TOKEN_TTL_SECONDS: "900",
  REFRESH_TOKEN_TTL_SECONDS: "604800",
  RESET_TOKEN_TTL_SECONDS: "900",
  STRIPE_SECRET_KEY: ["sk", "test", "synthetic"].join("_"),
  SENDGRID_API_KEY: "synthetic-sendgrid-private",
  SENDGRID_FROM_EMAIL: "sender@example.test",
  STRIPE_WEBHOOK_SECRET: ["whsec", "synthetic"].join("_"),
  TWILIO_AUTH_TOKEN: "synthetic-twilio-private",
  SOURCE_QUEUE_REPLAY_ENABLED: "true",
  WEBHOOK_PORT: "3002",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ["pk", "test", "synthetic"].join("_")
};

function errorMessage(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("Expected API runtime validation to fail");
}

describe("API runtime environment boundary", () => {
  it("accepts a synthetic Stripe test key with required API core and auth fields", () => {
    const parsed = parseRuntimeEnv("api", apiSource);
    expect(parsed.STRIPE_SECRET_KEY).toBe(apiSource.STRIPE_SECRET_KEY);
    expect(parsed.DATABASE_URL).toBe(apiSource.DATABASE_URL);
    expect(parsed.JWT_SECRET).toBe(apiSource.JWT_SECRET);
    expect(Object.isFrozen(parsed)).toBe(true);
  });

  it("names a missing API Stripe key without echoing any supplied value", () => {
    const message = errorMessage(() => parseRuntimeEnv("api", {
      ...apiSource,
      STRIPE_SECRET_KEY: undefined
    }));
    expect(message).toContain("STRIPE_SECRET_KEY");
    for (const value of [apiSource.DATABASE_URL, apiSource.REDIS_URL, apiSource.JWT_SECRET, apiSource.TWILIO_AUTH_TOKEN]) {
      expect(message).not.toContain(value);
    }
  });

  it("rejects a live Stripe key on staging without disclosing the key", () => {
    const live = ["sk", "live", "synthetic-private"].join("_");
    const message = errorMessage(() => parseRuntimeEnv("api", {
      ...apiSource,
      STRIPE_SECRET_KEY: live,
      RENVANI_DEPLOYMENT_TIER: "staging"
    }));
    expect(message).toContain("STRIPE_SECRET_KEY");
    expect(message).not.toContain(live);
  });

  it("omits supplied worker, webhook, and browser fields from the API view", () => {
    const parsed = parseRuntimeEnv("api", apiSource);
    for (const field of [
      "STRIPE_WEBHOOK_SECRET",
      "TWILIO_AUTH_TOKEN",
      "SOURCE_QUEUE_REPLAY_ENABLED",
      "WEBHOOK_PORT",
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
    ]) {
      expect(parsed).not.toHaveProperty(field);
    }
  });
});
