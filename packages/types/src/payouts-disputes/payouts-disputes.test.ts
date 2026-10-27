import { describe, expect, it } from "vitest";

import {
  DisputeStatusFilterSchema,
  buildStripeDisputeResourceVersion,
  isDisputeStatusOpen,
  isRegisteredDisputeStatus,
  normalizeDisputeToken,
  registerDisputeStatus
} from "./index.js";

describe("dispute status registry", () => {
  it("knows Stripe's built-in statuses and open/closed grouping", () => {
    expect(isRegisteredDisputeStatus("needs_response")).toBe(true);
    expect(isDisputeStatusOpen("needs_response")).toBe(true);
    expect(isDisputeStatusOpen("won")).toBe(false);
    expect(isDisputeStatusOpen("brand_new_status")).toBe(true);
  });

  it("accepts plug-in statuses without a migration and rejects malformed ones", () => {
    expect(DisputeStatusFilterSchema.safeParse("pending_bank").success).toBe(false);
    registerDisputeStatus({ status: "pending_bank", open: true });
    expect(DisputeStatusFilterSchema.safeParse("pending_bank").success).toBe(true);
    expect(() => registerDisputeStatus({ status: "Bad Status", open: true })).toThrow();
  });

  it("normalises tokens and orders resource versions lexically by event time", () => {
    expect(normalizeDisputeToken("Fraudulent")).toBe("fraudulent");
    expect(normalizeDisputeToken("")).toBe("unknown");
    const older = buildStripeDisputeResourceVersion(1_700_000_000, "evt_b");
    const newer = buildStripeDisputeResourceVersion(1_700_000_001, "evt_a");
    expect(older < newer).toBe(true);
  });
});
