import { beforeEach, describe, expect, it, vi } from "vitest";

const { addMock, getJobMock } = vi.hoisted(() => ({
  addMock: vi.fn(),
  getJobMock: vi.fn()
}));

vi.mock("./queues.js", () => ({
  notificationsQueue: {
    add: addMock,
    getJob: getJobMock
  }
}));

vi.mock("./queue-policy.js", () => ({
  buildDefaultEnqueueJobOptions: () => ({
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 }
  })
}));

import {
  buildVipDunningEmailJobId,
  buildVipWelcomeEmailJobId,
  SEND_VIP_MEMBERSHIP_EMAIL_JOB_NAME
} from "./vip-membership-email.js";

describe("vip-membership-email enqueue", () => {
  beforeEach(() => {
    addMock.mockReset();
    getJobMock.mockReset();
  });

  it("builds stable job ids", () => {
    expect(buildVipWelcomeEmailJobId("sub_1")).toBe("vip-welcome-sub_1");
    expect(buildVipDunningEmailJobId("sub_1", "in_1", 3)).toBe("vip-dunning-sub_1-in_1-d3");
  });

  it("schedules dunning steps with delays", async () => {
    const { scheduleVipMembershipDunningEmails } = await import("./vip-membership-email.js");

    await scheduleVipMembershipDunningEmails({
      companyId: "11111111-1111-4111-8111-111111111111",
      customerId: "22222222-2222-4222-8222-222222222222",
      stripeSubscriptionId: "sub_1",
      stripeInvoiceId: "in_1",
      planName: "VIP Plus",
      amount: "29.00",
      paymentUrl: "https://pay.example.test/in_1",
      graceEndsAtIso: "2026-10-30T00:00:00.000Z",
      nextRetryAtIso: "2026-10-24T00:00:00.000Z",
      graceDays: 7
    });

    expect(addMock).toHaveBeenCalledTimes(3);
    expect(addMock.mock.calls[0]?.[0]).toBe(SEND_VIP_MEMBERSHIP_EMAIL_JOB_NAME);
    expect(addMock.mock.calls[1]?.[2]?.delay).toBe(3 * 24 * 60 * 60 * 1000);
  });
});
