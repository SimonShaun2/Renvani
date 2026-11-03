import { afterEach, describe, expect, it, vi } from "vitest";

const SENSITIVE_ENV = /CALL|TRACK|RECORD|TWILIO|PHONE|VOICE|API_KEY|SECRET|TOKEN/i;

describe("FS-200 call tracking adapter registry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("loads with no env reads and registers only the disabled adapter", async () => {
    vi.resetModules();
    const accessed: string[] = [];
    const realEnv = process.env;
    process.env = new Proxy(realEnv, {
      get(target, key, receiver) {
        if (typeof key === "string") accessed.push(key);
        return Reflect.get(target, key, receiver);
      }
    });
    try {
      const registry = await import("./call-tracking-adapter.registry.js");
      expect(registry.listCallTrackingAdapterIds()).toEqual(["disabled"]);
    } finally {
      process.env = realEnv;
    }
    expect(accessed.filter((key) => SENSITIVE_ENV.test(key))).toEqual([]);
  });

  it("disabled adapter makes no network calls, rejects every signature and never yields a call", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { disabledCallTrackingAdapter } = await import("./call-tracking-adapter.registry.js");
    expect(disabledCallTrackingAdapter.enabled).toBe(false);
    expect(
      disabledCallTrackingAdapter.verifyWebhookSignature({ headers: { "x-signature": "anything" }, rawBody: "{}", url: "https://x.test/" })
    ).toBe(false);
    expect(() => disabledCallTrackingAdapter.parseInboundCall("{}")).toThrow(/disabled/);
    await expect(disabledCallTrackingAdapter.verifyNumberOwnership({ trackingNumber: "+15125550111", providerNumberId: "PN1" })).resolves.toBe(
      "unverified"
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("registers extendable adapters by validated text id and never removes `disabled`", async () => {
    const registry = await import("./call-tracking-adapter.registry.js");
    const adapter = {
      id: "acme_calls",
      enabled: true,
      verifyWebhookSignature: () => true,
      parseInboundCall: () => ({}),
      verifyNumberOwnership: async () => "verified"
    };
    registry.registerCallTrackingAdapter(adapter);
    expect(registry.findCallTrackingAdapter("acme_calls")).toBe(adapter);
    expect(() => registry.registerCallTrackingAdapter({ ...adapter, id: "Bad Id" })).toThrow(/Invalid/);
    registry.unregisterCallTrackingAdapter("acme_calls");
    registry.unregisterCallTrackingAdapter("disabled");
    expect(registry.listCallTrackingAdapterIds()).toEqual(["disabled"]);
  });
});
