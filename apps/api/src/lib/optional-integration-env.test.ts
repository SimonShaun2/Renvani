import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  env,
  isOpenAiConfigured,
  isSendgridConfigured,
  isTwilioConfigured,
  resetEnvCacheForTests
} from "@fsm/config";

import { setupTestEnv } from "../test-support/env-setup.js";

const OPTIONAL = [
  "OPENAI_API_KEY",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "SENDGRID_API_KEY",
  "SENDGRID_FROM_EMAIL"
] as const;

function setVar(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    vi.stubEnv(name, undefined as unknown as string);
  } else {
    process.env[name] = value;
    vi.stubEnv(name, value);
  }
}

function readEnv(): unknown {
  resetEnvCacheForTests();
  return env.NODE_ENV;
}

beforeEach(() => {
  setupTestEnv();
});

afterEach(() => {
  vi.unstubAllEnvs();
  setupTestEnv();
});

describe("optional non-core integration keys at boot", () => {
  it("boots with OpenAI, Twilio and SendGrid all unset and reports them disabled", () => {
    for (const name of OPTIONAL) setVar(name, undefined);

    expect(readEnv()).toBe("test");
    expect(env.OPENAI_API_KEY).toBe("");
    expect(isOpenAiConfigured()).toBe(false);
    expect(isTwilioConfigured()).toBe(false);
    expect(isSendgridConfigured()).toBe(false);
  });

  it("reports them enabled when configured", () => {
    expect(readEnv()).toBe("test");
    expect(isOpenAiConfigured()).toBe(true);
    expect(isTwilioConfigured()).toBe(true);
    expect(isSendgridConfigured()).toBe(true);
  });

  it("rejects a partial Twilio config, naming missing vars without leaking values", () => {
    setVar("TWILIO_AUTH_TOKEN", "");

    let message = "";
    try {
      readEnv();
    } catch (error: unknown) {
      message = (error as Error).message;
    }

    expect(message).toContain("Twilio is partially configured");
    expect(message).toContain("TWILIO_AUTH_TOKEN");
    expect(message).not.toContain("twilio_sid");
    expect(message).not.toContain("+15555555555");
  });

  it("requires SENDGRID_FROM_EMAIL when SENDGRID_API_KEY is set, and still validates its format", () => {
    setVar("SENDGRID_FROM_EMAIL", "");
    expect(() => readEnv()).toThrow(/SENDGRID_FROM_EMAIL is required when SENDGRID_API_KEY is set/);

    setVar("SENDGRID_FROM_EMAIL", "not-an-email");
    expect(() => readEnv()).toThrow(/SENDGRID_FROM_EMAIL must be a valid email/);
  });

  it.each(["DATABASE_URL", "REDIS_URL", "STRIPE_SECRET_KEY"])("still requires core %s", (name) => {
    setVar(name, undefined);
    expect(() => readEnv()).toThrow(/Environment validation failed/);
  });
});
