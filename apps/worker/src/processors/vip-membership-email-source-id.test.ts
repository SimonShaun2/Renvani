import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { recordMock, selectResults } = vi.hoisted(() => ({
  recordMock: vi.fn(async () => undefined),
  selectResults: [] as unknown[][]
}));

vi.mock("./transactional-email-message-log.js", () => ({ recordTransactionalEmailMessageLog: recordMock }));
vi.mock("pino", () => ({ default: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }) }));
vi.mock("@fsm/config", () => ({
  env: { APP_URL: "http://localhost:3000", SENDGRID_FROM_EMAIL: "noreply@example.com", TWILIO_FROM_NUMBER: "+15555555555" }
}));
vi.mock("@fsm/db", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const chain = () => {
    const c: Record<string, unknown> = {};
    c.from = () => c;
    c.where = () => c;
    c.limit = async () => selectResults.shift() ?? [];
    return c;
  };
  return { ...actual, db: { select: () => chain() } };
});

import { handleSendVipMembershipEmail } from "./notifications.processor.js";

const delivery = { templateId: "vip.renewal", subject: "Renewed", providerMessageId: "m" };

function deps() {
  return {
    email: {
      sendVipMembershipWelcomeEmail: vi.fn(async () => delivery),
      sendVipMembershipRenewalEmail: vi.fn(async () => delivery),
      sendVipMembershipPaymentFailedEmail: vi.fn(async () => delivery)
    }
  } as never;
}

function job(id: string, data: Record<string, unknown>) {
  return { id, name: "send-vip-membership-email", data } as unknown as Job<Record<string, unknown>>;
}

describe("VIP membership email source id", () => {
  beforeEach(() => {
    recordMock.mockClear();
    selectResults.length = 0;
  });

  it("uses a unique per-job id (not 'unknown') when Stripe ids are missing", async () => {
    for (const id of ["job-a", "job-b"]) {
      selectResults.push([{ email: "c@example.com", firstName: "C" }], [{ name: "Co" }]);
      await handleSendVipMembershipEmail(
        job(id, { companyId: "co", customerId: "cu", emailKind: "renewal_receipt" }),
        deps()
      );
    }
    const ids = recordMock.mock.calls.map((c) => ((c as unknown[])[0] as { sourceId: string }).sourceId);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
    for (const id of ids) expect(id).not.toContain("unknown");
    expect(ids[0]).toContain("job-a");
  });

  it("keeps Stripe ids when present", async () => {
    selectResults.push([{ email: "c@example.com", firstName: "C" }], [{ name: "Co" }]);
    await handleSendVipMembershipEmail(
      job("job-c", { companyId: "co", customerId: "cu", emailKind: "renewal_receipt", stripeSubscriptionId: "sub_1", stripeInvoiceId: "in_1" }),
      deps()
    );
    expect(((recordMock.mock.calls[0] as unknown[])[0] as { sourceId: string }).sourceId).toBe("sub_1:renewal:in_1");
  });
});
