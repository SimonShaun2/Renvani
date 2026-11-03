import { GROWTH_CHECK_REPORT_DELIVERY_CHANNEL_REGISTRY } from "@fsm/types";
import { describe, expect, it, vi } from "vitest";

import { assertGrowthCheckReportDeliveryAvailable, getGrowthCheckReportDeliveryAdapter } from "./report-delivery.registry.js";

describe("FS-57 report delivery registry", () => {
  it("has every channel disabled and resolves no adapter", () => {
    expect(GROWTH_CHECK_REPORT_DELIVERY_CHANNEL_REGISTRY.length).toBeGreaterThan(0);
    for (const channel of GROWTH_CHECK_REPORT_DELIVERY_CHANNEL_REGISTRY) {
      expect(channel.enabled).toBe(false);
      expect(getGrowthCheckReportDeliveryAdapter(channel.key)).toBeNull();
    }
    expect(getGrowthCheckReportDeliveryAdapter("__proto__")).toBeNull();
  });

  it("refuses with POLICY_DENIED delivery_disabled and makes no network call", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(() => assertGrowthCheckReportDeliveryAvailable("email")).toThrow(expect.objectContaining({ code: "POLICY_DENIED", fields: expect.objectContaining({ reason: "delivery_disabled" }) }));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("reads no environment variables at import", async () => {
    vi.resetModules();
    const env = process.env;
    const reads: string[] = [];
    process.env = new Proxy(env, { get: (t, k) => { if (typeof k === "string" && /KEY|TOKEN|SECRET|RESEND|TWILIO/.test(k)) reads.push(k); return Reflect.get(t, k); } });
    try {
      await import("./report-delivery.registry.js");
    } finally {
      process.env = env;
    }
    expect(reads).toEqual([]);
  });
});
