import { afterEach, describe, expect, it, vi } from "vitest";

const resendSend = vi.hoisted(() => vi.fn());

vi.mock("@fsm/config", () => ({
  env: { RESEND_API_KEY: "", EMAIL_FROM: "", EMAIL_LOGO_URL: "" }
}));

describe("deliverTransactionalEmail", () => {
  afterEach(() => {
    vi.resetModules();
    resendSend.mockReset();
  });

  it("no-ops (and does not throw) when RESEND_API_KEY is missing", async () => {
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
      env: { RESEND_API_KEY: "re_test", EMAIL_FROM: "Renvani <hello@mail.getrenvani.com>", EMAIL_LOGO_URL: "" }
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
