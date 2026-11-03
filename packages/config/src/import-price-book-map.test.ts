import { describe, expect, it } from "vitest";

import {
  importSourceSystemFromPreset,
  mapVendorItemTypeToCategory,
  normalizeImportMoney
} from "./import-price-book-map.js";

describe("import-price-book-map", () => {
  it("normalizes currency strings", () => {
    expect(normalizeImportMoney("$1,234.50")).toBe("1234.50");
    expect(normalizeImportMoney("")).toBeNull();
  });

  it("maps QuickBooks Desktop inventory parts to material", () => {
    expect(mapVendorItemTypeToCategory("Inventory Part", "qbd")).toBe("material");
    expect(mapVendorItemTypeToCategory("Service", "qbd")).toBe("service");
  });

  it("resolves source system from preset id", () => {
    expect(importSourceSystemFromPreset("quickbooks_desktop_items")).toBe("qbd");
    expect(importSourceSystemFromPreset("quickbooks_desktop_customers")).toBe("qbd");
    expect(importSourceSystemFromPreset("quickbooks_items")).toBe("qbo");
    expect(importSourceSystemFromPreset("service_titan_jobs")).toBe("service_titan");
    expect(importSourceSystemFromPreset("housecall_pro_jobs")).toBe("housecall_pro");
    expect(importSourceSystemFromPreset("housecall_pro_invoices")).toBe("housecall_pro");
  });
});
