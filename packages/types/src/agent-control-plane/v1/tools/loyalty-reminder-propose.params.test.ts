import { describe, expect, it } from "vitest";

import { LoyaltyReminderProposeParamsV1Schema } from "./loyalty-reminder-propose.params.js";

describe("LoyaltyReminderProposeParamsV1Schema", () => {
  it("accepts FS-72 loyalty reminder propose tool payloads", () => {
    const parsed = LoyaltyReminderProposeParamsV1Schema.parse({
      customerId: "11111111-1111-4111-8111-111111111111",
      ruleFamily: "lapsed_reactivation",
      evidenceJobId: "22222222-2222-4222-8222-222222222222",
      importSessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      daysSinceLastService: 120,
      summary: "No completed visit in 120+ days after migration"
    });

    expect(parsed.ruleFamily).toBe("lapsed_reactivation");
  });
});
