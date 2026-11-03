import { describe, expect, it } from "vitest";

import {
  ImportEquipmentCommitPayloadSchema,
  buildImportEquipmentCommitJobId,
} from "./import-equipment-commit.js";

describe("import-equipment-commit job contract", () => {
  const importSessionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  it("builds deterministic job ids per chunk", () => {
    expect(buildImportEquipmentCommitJobId(importSessionId, 2)).toBe(
      `import-equipment-commit-${importSessionId}-2`,
    );
  });

  it("validates equipment chunk payload shape", () => {
    const parsed = ImportEquipmentCommitPayloadSchema.safeParse({
      companyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      importSessionId,
      sourceSystem: "service_fusion",
      chunkIndex: 0,
      chunksTotal: 4,
      lineageMaps: {
        customers: { "cust-1": "cccccccc-cccc-4ccc-8ccc-cccccccccccc" },
      },
    });

    expect(parsed.success).toBe(true);
  });
});
