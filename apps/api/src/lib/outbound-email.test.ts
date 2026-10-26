import { afterEach, describe, expect, it, vi } from "vitest";

const resendSend = vi.hoisted(() => vi.fn());

const sgSend = vi.hoisted(() => vi.fn());
vi.mock("@sendgrid/mail", () => ({ default: { setApiKey: vi.fn(), send: sgSend } }));

const baseEnv = {
  NODE_ENV: "test",
  RESEND_API_KEY: "",
  RESEND_FROM_EMAIL: "",
  SENDGRID_API_KEY: "",
  SENDGRID_FROM_EMAIL: "noreply@example.com",
  EMAIL_FROM: "",
  EMAIL_LOGO_URL: ""
};
vi.mock("@fsm/config", () => ({ env: { ...baseEnv } }));

describe("deliverTransactionalEmail", () => {
  afterEach(() => {
    vi.resetModules();
    resendSend.mockReset();
    sgSend.mockReset();
  });

  it("throws loudly in production when no provider key is configured", async () => {
    vi.doMock("@fsm/config", () => ({ env: { ...baseEnv, NODE_ENV: "production" } }));
    const mod = await import("./outbound-email.js");
    mod.setEmailChannelForTests(null);
    expect(mod.resolveEmailProvider()).toBe("none");
    await expect(mod.deliverTransactionalEmail({ to: "u@example.com", subject: "s", html: "h" })).rejects.toThrow(
      "EMAIL_PROVIDER_NOT_CONFIGURED"
    );
  });

  it("falls back to SendGrid (SENDGRID_FROM_EMAIL) when RESEND_API_KEY is unset outside tests", async () => {
    vi.doMock("@fsm/config", () => ({
      env: { ...baseEnv, NODE_ENV: "production", SENDGRID_API_KEY: "sg_test" }
    }));
    sgSend.mockResolvedValue([{ headers: { "x-message-id": "sg_1" } }]);
    const mod = await import("./outbound-email.js");
    mod.setEmailChannelForTests(null);
    expect(mod.resolveEmailProvider()).toBe("sendgrid");
    await expect(mod.deliverTransactionalEmail({ to: "u@example.com", subject: "s", html: "h" })).resolves.toEqual({
      providerMessageId: "sg_1"
    });
    expect(sgSend).toHaveBeenCalledWith(expect.objectContaining({ from: "noreply@example.com", to: "u@example.com" }));
  });

  it("prefers Resend and uses RESEND_FROM_EMAIL when set", async () => {
    vi.doMock("@fsm/config", () => ({
      env: { ...baseEnv, RESEND_API_KEY: "re_test", RESEND_FROM_EMAIL: "Renvani <r@mail.getrenvani.com>", SENDGRID_API_KEY: "sg" }
    }));
    const mod = await import("./outbound-email.js");
    expect(mod.resolveEmailProvider()).toBe("resend");
    expect(mod.getTransactionalEmailFromAddress()).toBe("Renvani <r@mail.getrenvani.com>");
  });

  it("no-ops outside production (tests never reach a live provider) when no provider is configured", async () => {
    vi.doMock("@fsm/config", () => ({ env: { ...baseEnv } }));
    const mod = await import("./outbound-email.js");
    mod.setEmailChannelForTests(null);
    await expect(mod.deliverTransactionalEmail({ to: "u@example.com", subject: "s", html: "h" })).resolves.toEqual({
      providerMessageId: null
    });
    expect(resendSend).not.toHaveBeenCalled();
    expect(mod.getTransactionalEmailFromAddress()).toBe("Renvani <hello@mail.getrenvani.com>");
  });

  it("sends via the Resend SDK with EMAIL_FROM and a plain-text fallback", async () => {
    vi.doMock("@fsm/config", () => ({
      env: { ...baseEnv, RESEND_API_KEY: "re_test", EMAIL_FROM: "Renvani <hello@mail.getrenvani.com>", EMAIL_LOGO_URL: "" }
    }));
    resendSend.mockResolvedValue({ data: { id: "msg_1" }, error: null });
    const mod = await import("./outbound-email.js");
    const { createResendEmailChannel } = await import("@fsm/comms");
    // Mocked Resend client injected into the real adapter.
    mod.setEmailChannelForTests(
      createResendEmailChannel(
        { apiKey: "re_test", defaultFrom: mod.getTransactionalEmailFromAddress() },
        { emails: { send: resendSend } } as never
      )
    );

    await mod.sendRenderedTemplateEmail("u@example.com", "auth.verify_email", { firstName: "Ava", verifyUrl: "https://x/v" });

    expect(resendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Renvani <hello@mail.getrenvani.com>",
        to: ["u@example.com"],
        subject: "Verify your email for Renvani",
        text: expect.stringContaining("https://x/v")
      })
    );
  });

  it("sendEmailInBackground logs errors instead of throwing", async () => {
    const mod = await import("./outbound-email.js");
    const task = vi.fn(async () => {
      throw new Error("boom");
    });
    expect(() => mod.sendEmailInBackground(task, "test")).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));
    expect(task).toHaveBeenCalled();
  });
});
