import { describe, expect, it } from "vitest";

import {
  normalizeImportBusinessDate,
  normalizeImportMoney,
  normalizeImportPhone,
  normalizeImportSourceId
} from "./index.js";

const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("FS-128 FS-MIGRATE import normalize pipeline contracts", () => {
  it("normalizes vendor source_id with trim and max length (ADR §1)", () => {
    expect(normalizeImportSourceId("  SF-1001  ")).toBe("SF-1001");
    const longId = "x".repeat(300);
    expect(normalizeImportSourceId(longId)?.length).toBe(256);
  });

  it("normalizes phones to last 10 digits for tenant-scoped dedupe keys", () => {
    const phone = normalizeImportPhone("+1 (512) 555-0199");
    expect(phone).toBe("5125550199");
    expect(`${companyId}:phone:${phone}`).toContain(companyId);
  });

  it("normalizes money without currency symbols", () => {
    expect(normalizeImportMoney("$1,234.50")).toBe("1234.50");
    expect(normalizeImportMoney(42)).toBe("42.00");
  });

  it("normalizes business dates without substituting now()", () => {
    expect(normalizeImportBusinessDate("2024-06-15")).toBe("2024-06-15");
    expect(normalizeImportBusinessDate("6/15/2024")).toBe("2024-06-15");
    expect(normalizeImportBusinessDate("2024-06-15T14:30:00Z")).toBe("2024-06-15");
  });

  it("rejects invalid business dates", () => {
    expect(normalizeImportBusinessDate("not-a-date")).toBeNull();
    expect(normalizeImportMoney("12.345")).toBeNull();
  });
});
