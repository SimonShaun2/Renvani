import { describe, expect, it, vi } from "vitest";

import { ErrorCode } from "@fsm/types";

vi.mock("@fsm/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [
            {
              id: "11111111-1111-4111-8111-111111111111",
              companyId: "company-1",
              doNotContact: false,
              prefersSms: true,
              prefersEmail: true,
              updatedAt: new Date("2026-10-01T12:00:00.000Z")
            }
          ])
        }))
      }))
    }))
  },
  customers: {}
}));

vi.mock("./tenant-context.service.js", () => ({
  resolveEntityRef: vi.fn(async () => ({
    contractVersion: "1.0.0",
    entityType: "customer",
    entityId: "11111111-1111-4111-8111-111111111111",
    companyId: "company-1",
    observedAt: "2026-10-23T00:00:00.000Z",
    recordVersion: "v1"
  }))
}));

vi.mock("./agent-action.service.js", () => ({
  createAgentActionProposal: vi.fn(async () => ({ id: "action-1", state: "awaiting_approval" }))
}));

import { createAgentActionProposal } from "./agent-action.service.js";
import { createLoyaltyReminderProposal } from "./loyalty-reminder-propose.service.js";

describe("loyalty-reminder-propose.service", () => {
  it("creates a loyalty agent proposal when consent passes", async () => {
    const result = await createLoyaltyReminderProposal({
      companyId: "company-1",
      actorId: "ai-actor",
      idempotencyKey: "loyalty:prop:1",
      parameters: {
        customerId: "11111111-1111-4111-8111-111111111111",
        ruleFamily: "plan_cadence",
        maintenancePlanId: "22222222-2222-4222-8222-222222222222",
        summary: "Quarterly visit due"
      }
    });

    expect(createAgentActionProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        agentProduct: "loyalty",
        actionType: "loyalty.reminder.propose"
      })
    );
    expect(result.state).toBe("awaiting_approval");
  });

  it("blocks do-not-contact customers", async () => {
    const { db } = await import("@fsm/db");
    vi.mocked(db.select).mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [
            {
              id: "11111111-1111-4111-8111-111111111111",
              companyId: "company-1",
              doNotContact: true,
              prefersSms: true,
              prefersEmail: true,
              updatedAt: new Date("2026-10-01T12:00:00.000Z")
            }
          ])
        }))
      }))
    } as unknown as ReturnType<typeof db.select>);

    await expect(
      createLoyaltyReminderProposal({
        companyId: "company-1",
        actorId: "ai-actor",
        idempotencyKey: "loyalty:prop:2",
        parameters: {
          customerId: "11111111-1111-4111-8111-111111111111",
          ruleFamily: "lapsed_reactivation",
          summary: "Win back"
        }
      })
    ).rejects.toMatchObject({ code: ErrorCode.POLICY_DENIED });
  });
});
