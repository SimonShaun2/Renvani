import { createHash, randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

type ChallengeService = typeof import("./outbound-consent-email-verification.service.js");

describe("FS-234 customer email challenge token boundary", () => {
  let service: ChallengeService;
  beforeAll(async () => {
    service = await import("./outbound-consent-email-verification.service.js");
  });

  it("binds a deterministic worker-reconstructible token to tenant and challenge without persisting raw token", () => {
    const companyId = randomUUID();
    const challengeId = randomUUID();
    const token = service.buildCustomerEmailChallengeToken(companyId, challengeId);
    expect(token).toHaveLength(138);
    expect(service.parseCustomerEmailChallengeToken(token)).toEqual({
      companyId, challengeId, tokenHash: createHash("sha256").update(token).digest("hex"),
    });
    expect(token).toBe(service.buildCustomerEmailChallengeToken(companyId, challengeId));
    expect(service.buildCustomerEmailChallengeToken(companyId, randomUUID())).not.toBe(token);
  });

  it("rejects a token copied to another tenant or challenge", () => {
    const companyId = randomUUID();
    const challengeId = randomUUID();
    const token = service.buildCustomerEmailChallengeToken(companyId, challengeId);
    const [, , mac] = token.split(".");
    expect(() => service.parseCustomerEmailChallengeToken(`${randomUUID()}.${challengeId}.${mac}`))
      .toThrow("Invalid or expired verification link");
    expect(() => service.parseCustomerEmailChallengeToken(`${companyId}.${randomUUID()}.${mac}`))
      .toThrow("Invalid or expired verification link");
  });

  it("rejects malformed, missing, and changed authenticators without revealing details", () => {
    const companyId = randomUUID();
    const challengeId = randomUUID();
    const token = service.buildCustomerEmailChallengeToken(companyId, challengeId);
    const changedMac = `${token.slice(0, -1)}${token.endsWith("0") ? "1" : "0"}`;
    for (const value of [undefined, "", "not-a-token", changedMac, token.repeat(2)]) {
      expect(() => service.parseCustomerEmailChallengeToken(value)).toThrow("Invalid or expired verification link");
    }
  });

  it("keeps issuance and consumption disabled before delivery and legal activation", async () => {
    const companyId = randomUUID();
    const customerId = randomUUID();
    const token = service.buildCustomerEmailChallengeToken(companyId, randomUUID());
    await expect(service.issueCustomerEmailChallenge({ companyId, customerId }, "synthetic-request"))
      .rejects.toMatchObject({ code: "POLICY_DENIED" });
    await expect(service.consumeCustomerEmailChallenge(token))
      .rejects.toMatchObject({ code: "POLICY_DENIED" });
  });
});
