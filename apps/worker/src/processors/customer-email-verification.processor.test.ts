import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../../../api/src/test-support/env-setup.js";
import type { CustomerEmailVerificationDeliveryDependencies } from "./customer-email-verification.processor.js";

setupTestEnv();
vi.mock("@fsm/jobs", () => ({ customerEmailVerificationJobSchema: {
  parse(input: unknown) {
    if (!input || typeof input !== "object" ||
        Object.keys(input).sort().join(",") !== "challengeId,companyId,customerId") throw new Error("invalid job payload");
    return input;
  },
} }));
let processCustomerEmailVerificationDelivery: typeof import("./customer-email-verification.processor.js").processCustomerEmailVerificationDelivery;
beforeAll(async () => {
  ({ processCustomerEmailVerificationDelivery } = await import("./customer-email-verification.processor.js"));
});

const payload = { companyId: randomUUID(), customerId: randomUUID(), challengeId: randomUUID() };
const facts = { ...payload, email: "synthetic@example.test" };

function deps(enabled: boolean, available = true): CustomerEmailVerificationDeliveryDependencies {
  return {
    enabled,
    load: vi.fn(async () => available ? facts : null),
    buildToken: vi.fn(() => "opaque-test-token"),
    send: vi.fn(async () => ({ providerMessageId: "test-provider-accepted" })),
    record: vi.fn(async () => undefined),
    markUncertain: vi.fn(async () => undefined),
    appUrl: "https://tester.example.test",
  };
}

describe("FS-234 verification delivery", () => {
  it("does no database or provider work while the feature is disabled", async () => {
    const d = deps(false);
    expect(await processCustomerEmailVerificationDelivery(payload, d)).toBe("disabled");
    expect(d.load).not.toHaveBeenCalled();
    expect(d.send).not.toHaveBeenCalled();
  });

  it("skips a missing, expired, consumed or changed-destination challenge", async () => {
    const d = deps(true, false);
    expect(await processCustomerEmailVerificationDelivery(payload, d)).toBe("skipped");
    expect(d.buildToken).not.toHaveBeenCalled();
    expect(d.send).not.toHaveBeenCalled();
  });

  it("sends a verification-only link to the freshly loaded destination", async () => {
    const d = deps(true);
    expect(await processCustomerEmailVerificationDelivery(payload, d)).toBe("accepted");
    expect(d.buildToken).toHaveBeenCalledWith(payload.companyId, payload.challengeId);
    expect(d.send).toHaveBeenCalledWith(expect.objectContaining({
      to: "synthetic@example.test", subject: "Verify your email for Renvani",
    }));
    const sent = vi.mocked(d.send).mock.calls[0]![0];
    expect(sent.text).toContain("#verify-email=opaque-test-token");
    expect(sent.text).not.toMatch(/marketing|offers|unsubscribe/i);
    expect(d.record).toHaveBeenCalledWith(facts, { providerMessageId: "test-provider-accepted" });
  });

  it("does not record a send that the provider did not accept", async () => {
    const d = deps(true);
    d.send = vi.fn(async () => ({ providerMessageId: null }));
    await expect(processCustomerEmailVerificationDelivery(payload, d)).rejects.toThrow("did not confirm acceptance");
    expect(d.record).not.toHaveBeenCalled();
    expect(d.markUncertain).toHaveBeenCalledWith(facts);
  });

  it("marks provider timeout or post-send recording failure uncertain for reconciliation", async () => {
    const timeout = deps(true);
    timeout.send = vi.fn(async () => { throw new Error("provider timeout"); });
    await expect(processCustomerEmailVerificationDelivery(payload, timeout)).rejects.toThrow("provider timeout");
    expect(timeout.markUncertain).toHaveBeenCalledWith(facts);
    expect(timeout.record).not.toHaveBeenCalled();

    const recordFailure = deps(true);
    recordFailure.record = vi.fn(async () => { throw new Error("log unavailable"); });
    await expect(processCustomerEmailVerificationDelivery(payload, recordFailure)).rejects.toThrow("log unavailable");
    expect(recordFailure.markUncertain).toHaveBeenCalledWith(facts);
  });

  it("reports when the uncertain outcome itself cannot be recorded", async () => {
    const d = deps(true);
    d.send = vi.fn(async () => { throw new Error("provider timeout"); });
    d.markUncertain = vi.fn(async () => { throw new Error("database unavailable"); });
    await expect(processCustomerEmailVerificationDelivery(payload, d))
      .rejects.toThrow("claim remains attempting");
  });

  it("rejects forged destination fields in the queued payload", async () => {
    const d = deps(true);
    await expect(processCustomerEmailVerificationDelivery({ ...payload, email: "forged@example.test" }, d)).rejects.toThrow();
    expect(d.load).not.toHaveBeenCalled();
  });
});
