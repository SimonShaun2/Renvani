import { describe, expect, it } from "vitest";

import { parseRuntimeEnv } from "./runtime-env.js";

const core = {
  DATABASE_URL: "postgresql://synthetic:db-private@localhost:5432/fsm_test",
  REDIS_URL: "redis://:redis-private@localhost:6379"
};

const webhook = {
  ...core,
  APP_URL: "https://staging.example.test",
  STRIPE_SECRET_KEY: ["sk", "test", "synthetic"].join("_"),
  STRIPE_WEBHOOK_SECRET: ["whsec", "synthetic"].join("_"),
  TWILIO_AUTH_TOKEN: "synthetic-twilio-private",
  TWILIO_FROM_NUMBER: "+15555550100"
};

function thrownMessage(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("Expected environment validation to fail");
}

describe("parseRuntimeEnv runtime boundaries", () => {
  it("boots core with only database and Redis, without unrelated providers", () => {
    const parsed = parseRuntimeEnv("core", core);
    expect(parsed.DATABASE_URL).toBe(core.DATABASE_URL);
    expect(parsed.REDIS_URL).toBe(core.REDIS_URL);
    expect(Object.isFrozen(parsed)).toBe(true);
    for (const field of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "TWILIO_AUTH_TOKEN", "OPENAI_API_KEY", "R2_SECRET_ACCESS_KEY"]) {
      expect(parsed).not.toHaveProperty(field);
    }
  });

  it("names a missing core key without echoing supplied secrets", () => {
    const message = thrownMessage(() => parseRuntimeEnv("core", { REDIS_URL: core.REDIS_URL }));
    expect(message).toContain("DATABASE_URL");
    expect(message).not.toContain(core.REDIS_URL);
    expect(message).not.toContain("redis-private");
  });

  it("boots a worker without outbound provider credentials but requires its app URL", () => {
    const parsed = parseRuntimeEnv("worker", { ...core, APP_URL: "https://staging.example.test" });
    expect(parsed.APP_URL).toBe("https://staging.example.test");
    expect(parsed.SENDGRID_API_KEY).toBe("");
    expect(parsed.TWILIO_FROM_NUMBER).toBe("");
    expect(Object.isFrozen(parsed)).toBe(true);
    const message = thrownMessage(() => parseRuntimeEnv("worker", core));
    expect(message).toContain("APP_URL");
    expect(message).not.toContain("db-private");
  });

  it("boots the API without unrelated providers but requires its auth boundary", () => {
    const source = {
      ...core,
      APP_URL: "https://staging.example.test",
      JWT_SECRET: "synthetic-jwt-private",
      JWT_REFRESH_SECRET: "synthetic-refresh-private",
      BOOKING_HOLD_TOKEN_SECRET: "synthetic-booking-private",
      OPENAI_API_KEY: "synthetic-openai-private",
      R2_SECRET_ACCESS_KEY: "synthetic-storage-private"
    };
    const parsed = parseRuntimeEnv("api", source);
    expect(parsed.JWT_SECRET).toBe(source.JWT_SECRET);
    expect(parsed).not.toHaveProperty("OPENAI_API_KEY");
    expect(parsed).not.toHaveProperty("R2_SECRET_ACCESS_KEY");
    const message = thrownMessage(() => parseRuntimeEnv("api", { ...source, JWT_SECRET: undefined }));
    expect(message).toContain("JWT_SECRET");
    expect(message).not.toContain(source.JWT_REFRESH_SECRET);
    expect(message).not.toContain(source.BOOKING_HOLD_TOKEN_SECRET);
  });

  it("requires only the webhook's own verification keys", () => {
    const parsed = parseRuntimeEnv("webhook", webhook);
    expect(parsed.STRIPE_WEBHOOK_SECRET).toBe(webhook.STRIPE_WEBHOOK_SECRET);
    expect(parsed.TWILIO_AUTH_TOKEN).toBe(webhook.TWILIO_AUTH_TOKEN);
    expect(parsed).not.toHaveProperty("OPENAI_API_KEY");
    expect(parsed).not.toHaveProperty("R2_SECRET_ACCESS_KEY");
    expect(parsed).not.toHaveProperty("SENDGRID_API_KEY");

    for (const field of ["APP_URL", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"] as const) {
      const missing: Record<string, string | undefined> = { ...webhook };
      delete missing[field];
      const message = thrownMessage(() => parseRuntimeEnv("webhook", missing));
      expect(message).toContain(field);
      expect(message).not.toContain("synthetic-twilio-private");
      expect(message).not.toContain("db-private");
    }
  });

  it("picks only public fields for the browser even when server secrets are present", () => {
    const source = {
      ...webhook,
      JWT_SECRET: "synthetic-jwt-private",
      CLERK_SECRET_KEY: "synthetic-clerk-private",
      NEXT_PUBLIC_API_URL: "https://api.staging.example.test",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ["pk", "test", "synthetic"].join("_")
    };
    const parsed = parseRuntimeEnv("browser", source);
    expect(parsed).toEqual({
      NEXT_PUBLIC_API_URL: source.NEXT_PUBLIC_API_URL,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: source.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    });
    expect(Object.isFrozen(parsed)).toBe(true);
    for (const field of ["DATABASE_URL", "REDIS_URL", "JWT_SECRET", "CLERK_SECRET_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "TWILIO_AUTH_TOKEN"]) {
      expect(parsed).not.toHaveProperty(field);
    }
  });

  it("keeps database, queue, and payment secrets out of the web-server view", () => {
    const parsed = parseRuntimeEnv("web-server", webhook);
    for (const field of ["DATABASE_URL", "REDIS_URL", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "TWILIO_AUTH_TOKEN"]) {
      expect(parsed).not.toHaveProperty(field);
    }
    expect(parsed.APP_URL).toBe(webhook.APP_URL);
  });

  it("rejects live Stripe credentials outside production without disclosing the value", () => {
    const live = ["sk", "live", "synthetic-private"].join("_");
    for (const tier of ["staging", "invalid-tier"]) {
      const message = thrownMessage(() => parseRuntimeEnv("webhook", {
        ...webhook,
        STRIPE_SECRET_KEY: live,
        RENVANI_DEPLOYMENT_TIER: tier
      }));
      expect(message).toMatch(/STRIPE_SECRET_KEY|RENVANI_DEPLOYMENT_TIER/u);
      expect(message).not.toContain(live);
    }
  });
});
