import { describe, expect, it } from "vitest";

import { createDisabledSmsChannel } from "./sms-disabled.stub.js";

describe("createDisabledSmsChannel", () => {
  it("returns a deterministic stub id without calling Twilio", async () => {
    const channel = createDisabledSmsChannel();
    const first = await channel.sendSms({ to: "+15555550100", body: "hello" });
    const second = await channel.sendSms({ to: "+15555550100", body: "hello" });

    expect(first.providerMessageId).toMatch(/^sms_disabled_stub_/);
    expect(first.providerMessageId).toBe(second.providerMessageId);
  });
});
