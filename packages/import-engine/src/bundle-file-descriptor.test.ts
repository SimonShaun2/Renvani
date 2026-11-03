import { describe, expect, it } from "vitest";

import { buildImportBundleFileDescriptor, inferImportBundleFileRole } from "./bundle-file-descriptor.js";

describe("bundle-file-descriptor", () => {
  it("infers role from file name", () => {
    expect(inferImportBundleFileRole("servicefusion_customers.xlsx")).toBe("customers");
    expect(inferImportBundleFileRole("misc.csv")).toBe("unknown");
  });

  it("builds descriptor", () => {
    const descriptor = buildImportBundleFileDescriptor({
      fileName: "locations_export.csv",
      mimeType: "text/csv",
      byteSize: 1200
    });
    expect(descriptor.role).toBe("properties");
    expect(descriptor.byteSize).toBe(1200);
  });
});
