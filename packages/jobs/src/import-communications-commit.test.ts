import { describe, expect, it } from "vitest";

import { ImportCommunicationsCommitPayloadSchema } from "./import-communications-commit.js";

describe("import-communications-commit job contract", () => {
  it("parses a minimal chunk payload", () => {
    const parsed = ImportCommunicationsCommitPayloadSchema.safeParse({
      companyId: "11111111-1111-4111-8111-111111111111",
      importSessionId: "22222222-2222-4222-8222-222222222222",
      sourceSystem: "jobber",
      chunkIndex: 0,
      chunksTotal: 2,
      lineageMaps: {
        customers: { "cust-1": "33333333-3333-4333-8333-333333333333" },
      },
    });

    expect(parsed.success).toBe(true);
  });
});
