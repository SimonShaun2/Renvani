import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DISABLED_SMS_PROVIDER_ID,
  registerSmsProvider,
  resolveSmsChannel,
  unregisterSmsProviderForTests
} from "./sms-provider.registry.js";

describe("SMS provider registry", () => {
  afterEach(() => unregisterSmsProviderForTests("twilio"));

  it("defaults to the disabled stub (no network) when nothing is registered", async () => {
    const resolved = resolveSmsChannel({ providerId: "twilio", outboundSmsEnabled: true });
    expect(resolved).toMatchObject({ providerId: DISABLED_SMS_PROVIDER_ID, live: false });
    await expect(resolved.channel.sendSms({ to: "+15550100", body: "hi" })).resolves.toMatchObject({
      providerMessageId: expect.stringMatching(/^sms_disabled_stub_/)
    });
  });

  it("stays disabled while the flag is off even if a provider is registered", () => {
    const factory = vi.fn();
    registerSmsProvider("twilio", factory);
    expect(resolveSmsChannel({ providerId: "twilio", outboundSmsEnabled: false }).live).toBe(false);
    expect(factory).not.toHaveBeenCalled();
  });

  it("activates a registered provider only when the flag is on", async () => {
    const sendSms = vi.fn(async () => ({ providerMessageId: "SM1" }));
    registerSmsProvider("twilio", () => ({ sendSms }));
    const resolved = resolveSmsChannel({ providerId: "twilio", outboundSmsEnabled: true });
    expect(resolved).toMatchObject({ providerId: "twilio", live: true });
    await resolved.channel.sendSms({ to: "+15550100", body: "hi" });
    expect(sendSms).toHaveBeenCalledOnce();
  });

  it("refuses to override the built-in disabled provider", () => {
    expect(() => registerSmsProvider(DISABLED_SMS_PROVIDER_ID, vi.fn())).toThrow();
  });
});
