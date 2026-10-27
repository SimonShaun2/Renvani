import { describe, expect, it } from "vitest";

import { resolveTransactionalEmailFromAddress, selectTransactionalEmailProvider } from "./email-provider.js";

/** Same table as apps/api/src/lib/outbound-email.test.ts and apps/worker/src/processors/email-from-parity.test.ts. */
const CASES = [
  { name: "Resend key + RESEND_FROM_EMAIL", env: { NODE_ENV: "production", RESEND_API_KEY: "re_x", SENDGRID_API_KEY: "sg_x", RESEND_FROM_EMAIL: "R <r@mail.test>", EMAIL_FROM: "E <e@mail.test>" }, provider: "resend", from: "R <r@mail.test>" },
  { name: "Resend key, EMAIL_FROM only", env: { NODE_ENV: "production", RESEND_API_KEY: "re_x", SENDGRID_API_KEY: "", RESEND_FROM_EMAIL: "", EMAIL_FROM: "E <e@mail.test>" }, provider: "resend", from: "E <e@mail.test>" },
  { name: "Resend key, no from configured", env: { NODE_ENV: "production", RESEND_API_KEY: " re_x ", SENDGRID_API_KEY: "", RESEND_FROM_EMAIL: " ", EMAIL_FROM: "" }, provider: "resend", from: "Renvani <hello@mail.getrenvani.com>" },
  { name: "SendGrid fallback outside tests", env: { NODE_ENV: "production", RESEND_API_KEY: "", SENDGRID_API_KEY: "sg_x", RESEND_FROM_EMAIL: "R <r@mail.test>", EMAIL_FROM: "E <e@mail.test>" }, provider: "sendgrid", from: "noreply@sendgrid.test" },
  { name: "SendGrid key ignored under NODE_ENV=test", env: { NODE_ENV: "test", RESEND_API_KEY: "", SENDGRID_API_KEY: "sg_x", RESEND_FROM_EMAIL: "", EMAIL_FROM: "" }, provider: "none", from: "Renvani <hello@mail.getrenvani.com>" },
  { name: "no keys", env: { NODE_ENV: "production", RESEND_API_KEY: "", SENDGRID_API_KEY: "", RESEND_FROM_EMAIL: "R <r@mail.test>", EMAIL_FROM: "" }, provider: "none", from: "R <r@mail.test>" }
] as const;

const config = (env: (typeof CASES)[number]["env"]) => ({
  resendApiKey: env.RESEND_API_KEY,
  sendgridApiKey: env.SENDGRID_API_KEY,
  nodeEnv: env.NODE_ENV,
  resendFromEmail: env.RESEND_FROM_EMAIL,
  emailFrom: env.EMAIL_FROM,
  sendgridFromEmail: "noreply@sendgrid.test"
});

describe("FS-155 follow-up: shared transactional email provider selection", () => {
  it.each(CASES)("$name", ({ env, provider, from }) => {
    expect(selectTransactionalEmailProvider(config(env))).toBe(provider);
    expect(resolveTransactionalEmailFromAddress(config(env))).toBe(from);
  });
});
