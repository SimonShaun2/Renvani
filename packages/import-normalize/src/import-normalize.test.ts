import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  formatImportMoney,
  normalizeImportDate,
  normalizeImportMoney,
  normalizeImportPhone,
  parseImportMoney
} from "./index.js";

describe("normalizeImportPhone", () => {
  it("returns digits-only phones", () => {
    expect(normalizeImportPhone("(555) 123-4567")).toBe("5551234567");
    expect(normalizeImportPhone("")).toBeNull();
    expect(normalizeImportPhone(null)).toBeNull();
  });
});

describe("normalizeImportDate", () => {
  it("accepts ISO dates", () => {
    expect(normalizeImportDate("2024-02-29")).toBe("2024-02-29");
    expect(normalizeImportDate("2024-02-30")).toBeNull();
  });

  it("accepts US slash and dash dates", () => {
    expect(normalizeImportDate("1/5/2024")).toBe("2024-01-05");
    expect(normalizeImportDate("01-15-24")).toBe("2024-01-15");
  });

  it("accepts Excel serial dates", () => {
    expect(normalizeImportDate("45351")).toBe("2024-02-29");
  });
});

describe("normalizeImportMoney", () => {
  it("normalizes currency strings", () => {
    expect(normalizeImportMoney("$1,234.50")).toBe("1234.50");
    expect(normalizeImportMoney("")).toBeNull();
  });
});

describe("parseImportMoney", () => {
  it("parses non-negative decimals", () => {
    expect(parseImportMoney("$12.50")?.equals(new Decimal("12.5"))).toBe(true);
    expect(parseImportMoney("-1")).toBeNull();
  });

  it("formats import money", () => {
    expect(formatImportMoney(new Decimal("12.5"))).toBe("12.50");
  });
});
