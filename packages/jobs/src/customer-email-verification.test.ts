import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ enabled: false, add: vi.fn() }));
vi.mock("@fsm/config/feature-flags", () => ({
  featureFlags: { get customerEmailVerificationDeliveryEnabled() { return state.enabled; } },
}));
vi.mock("./queues.js", () => ({ notificationsQueue: { add: state.add } }));

import { enqueueCustomerEmailVerificationJob } from "./customer-email-verification.js";

describe("FS-234 customer email verification enqueue", () => {
  const payload = { companyId: randomUUID(), customerId: randomUUID(), challengeId: randomUUID() };
  beforeEach(() => { state.enabled = false; state.add.mockReset(); });

  it("leaves delivery disabled by default", async () => {
    expect(await enqueueCustomerEmailVerificationJob(payload)).toBe("disabled");
    expect(state.add).not.toHaveBeenCalled();
  });

  it("enqueues only tenant/customer/challenge IDs and a stable job ID when enabled", async () => {
    state.enabled = true;
    expect(await enqueueCustomerEmailVerificationJob(payload)).toBe("queued");
    const [name, queued, options] = state.add.mock.calls[0] as [string, unknown, { jobId: string }];
    expect(name).toBe("send-customer-email-verification");
    expect(queued).toEqual(payload);
    expect(JSON.stringify(queued)).not.toMatch(/token|email/i);
    expect(options.jobId).toBe(`fs234-email-${payload.challengeId}`);
  });

  it("rejects client-supplied destination or token", async () => {
    await expect(enqueueCustomerEmailVerificationJob({ ...payload, email: "forged@example.test" })).rejects.toThrow();
    await expect(enqueueCustomerEmailVerificationJob({ ...payload, token: "secret" })).rejects.toThrow();
    expect(state.add).not.toHaveBeenCalled();
  });
});
