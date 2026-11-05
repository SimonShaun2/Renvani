import { describe, expect, it, vi } from "vitest";
import { canSubmitEstimateDecision, settleEstimateDecision } from "./estimate-decision";

describe("estimate decision acknowledgement", () => {
  it("acknowledges the write before refreshing details", async () => {
    const calls: string[] = [];
    const result = await settleEstimateDecision({
      write: async () => { calls.push("write"); },
      acknowledge: () => { calls.push("acknowledged"); },
      refresh: async () => { calls.push("read"); }
    });
    expect(result).toBe("saved");
    expect(calls).toEqual(["write", "acknowledged", "read"]);
  });

  it("does not acknowledge or refresh a failed write", async () => {
    const acknowledge = vi.fn();
    const refresh = vi.fn();
    const result = await settleEstimateDecision({ write: async () => { throw new Error("unavailable"); }, acknowledge, refresh });
    expect(result).toBe("write-unconfirmed");
    expect(acknowledge).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("does not replay a successful write when its follow-up read fails", async () => {
    const write = vi.fn().mockResolvedValue({ success: true });
    const acknowledge = vi.fn();
    const refresh = vi.fn().mockRejectedValue(new Error("read failed"));
    expect(await settleEstimateDecision({ write, acknowledge, refresh })).toBe("saved-refresh-unavailable");
    expect(write).toHaveBeenCalledOnce();
    expect(acknowledge).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it.each(["sent", "viewed"])("allows an actionable %s status", (status) => expect(canSubmitEstimateDecision(status)).toBe(true));
  it.each(["draft", "approved", "declined", "expired", "converted", "revised", "unknown"])("does not offer another response for %s", (status) => expect(canSubmitEstimateDecision(status)).toBe(false));
});
