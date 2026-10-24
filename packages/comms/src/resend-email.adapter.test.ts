import { describe, expect, it, vi } from "vitest";

import { createResendEmailChannel } from "./resend-email.adapter.js";

function mockClient(result: unknown) {
  const send = vi.fn(async () => result);
  return { send, client: { emails: { send } } as never };
}

describe("createResendEmailChannel", () => {
  it("sends through the Resend SDK and returns the provider message id", async () => {
    const { send, client } = mockClient({ data: { id: "msg_abc123" }, error: null });
    const channel = createResendEmailChannel({ apiKey: "re_test_key", defaultFrom: "Renvani <hello@mail.getrenvani.com>" }, client);

    const result = await channel.sendTransactionalEmail({
      to: "customer@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
      tags: ["invoice.sent"]
    });

    expect(result.providerMessageId).toBe("msg_abc123");
    expect(send).toHaveBeenCalledWith({
      from: "Renvani <hello@mail.getrenvani.com>",
      to: ["customer@example.com"],
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
      tags: [{ name: "invoice_sent", value: "true" }]
    });
  });

  it("throws when Resend returns an error", async () => {
    const { client } = mockClient({ data: null, error: { name: "validation_error", message: "bad" } });
    const channel = createResendEmailChannel({ apiKey: "k", defaultFrom: "a@b.c" }, client);
    await expect(channel.sendTransactionalEmail({ to: "x@y.z", subject: "s", html: "h" })).rejects.toThrow(
      "Resend send failed (validation_error): bad"
    );
  });
});
