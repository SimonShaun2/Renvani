import { beforeEach, describe, expect, it, vi } from "vitest";

/** FS-155 follow-up: the worker's message_logs from-address must match the API sender's key-based selection. */
const mutableEnv = vi.hoisted(() => ({}) as Record<string, string>);
vi.mock("@fsm/config", () => ({ env: mutableEnv }));
vi.mock("pino", () => ({ default: () => ({ debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }) }));

/** Same table as packages/comms/src/email-provider.test.ts and apps/api/src/lib/outbound-email.test.ts. */
const CASES = [
  { name: "Resend key + RESEND_FROM_EMAIL", env: { NODE_ENV: "production", RESEND_API_KEY: "re_x", SENDGRID_API_KEY: "sg_x", RESEND_FROM_EMAIL: "R <r@mail.test>", EMAIL_FROM: "E <e@mail.test>" }, provider: "resend", from: "R <r@mail.test>" },
  { name: "Resend key, EMAIL_FROM only", env: { NODE_ENV: "production", RESEND_API_KEY: "re_x", SENDGRID_API_KEY: "", RESEND_FROM_EMAIL: "", EMAIL_FROM: "E <e@mail.test>" }, provider: "resend", from: "E <e@mail.test>" },
  { name: "Resend key, no from configured", env: { NODE_ENV: "production", RESEND_API_KEY: " re_x ", SENDGRID_API_KEY: "", RESEND_FROM_EMAIL: " ", EMAIL_FROM: "" }, provider: "resend", from: "Renvani <hello@mail.getrenvani.com>" },
  { name: "SendGrid fallback outside tests", env: { NODE_ENV: "production", RESEND_API_KEY: "", SENDGRID_API_KEY: "sg_x", RESEND_FROM_EMAIL: "R <r@mail.test>", EMAIL_FROM: "E <e@mail.test>" }, provider: "sendgrid", from: "noreply@sendgrid.test" },
  { name: "SendGrid key ignored under NODE_ENV=test", env: { NODE_ENV: "test", RESEND_API_KEY: "", SENDGRID_API_KEY: "sg_x", RESEND_FROM_EMAIL: "", EMAIL_FROM: "" }, provider: "none", from: "Renvani <hello@mail.getrenvani.com>" },
  { name: "no keys", env: { NODE_ENV: "production", RESEND_API_KEY: "", SENDGRID_API_KEY: "", RESEND_FROM_EMAIL: "R <r@mail.test>", EMAIL_FROM: "" }, provider: "none", from: "R <r@mail.test>" }
] as const;

describe("worker email from-address parity with the API sender", () => {
  beforeEach(() => {
    for (const k of Object.keys(mutableEnv)) delete mutableEnv[k];
  });

  it.each(CASES)("$name", async ({ env, from }) => {
    Object.assign(mutableEnv, env, { SENDGRID_FROM_EMAIL: "noreply@sendgrid.test" });
    const { getOutboundEmailFromAddress } = await import("./notifications.processor.js");
    expect(getOutboundEmailFromAddress()).toBe(from);
  });

  it("ignores the resendEmailEnabled feature flag (selection is by key, like the API)", async () => {
    Object.assign(mutableEnv, CASES[3].env, { SENDGRID_FROM_EMAIL: "noreply@sendgrid.test" });
    const { getOutboundEmailFromAddress } = await import("./notifications.processor.js");
    expect(getOutboundEmailFromAddress()).toBe("noreply@sendgrid.test");
  });
});
