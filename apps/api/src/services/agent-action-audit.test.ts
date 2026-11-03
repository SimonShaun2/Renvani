import { beforeAll, describe, expect, it } from "vitest";

import { featureFlags } from "@fsm/config/feature-flags";

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

type AuditModule = typeof import("./agent-action-audit.js");

let auditModule: AuditModule;

beforeAll(async () => {
  auditModule = await import("./agent-action-audit.js");
});

describe("agent-action-audit", () => {
  it("embeds FS-72 loyalty gate flags in activity audit payloads", () => {
    const payload = auditModule.buildAgentActionAuditPayload("proposal_created", {
      id: "00000000-0000-4000-8000-000000000020",
      agentProduct: "retention",
      actionType: "loyalty.reminder.propose",
      policyVersion: "agent-policy-v1",
      requiresApproval: true
    });

    expect(payload.loyaltyRemindersDryRun).toBe(featureFlags.loyaltyRemindersDryRun);
    expect(payload.loyaltyRemindersEnabled).toBe(featureFlags.loyaltyRemindersEnabled);
    expect(payload.actionType).toBe("loyalty.reminder.propose");
  });
});
