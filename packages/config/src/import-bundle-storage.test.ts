import { describe, expect, it } from "vitest";

import {
  assertImportBundleObjectKeyBelongsToTenant,
  buildImportBundleObjectKey,
  buildImportBundleObjectKeyPrefix,
  sanitizeImportBundleRelativePath
} from "./import-bundle-storage.js";

describe("FS-MIGRATE import bundle R2 path convention", () => {
  const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const bundleId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  it("builds tenant-scoped prefix and object keys", () => {
    expect(buildImportBundleObjectKeyPrefix(companyId, bundleId)).toBe(
      `${companyId}/imports/${bundleId}/`
    );

    expect(buildImportBundleObjectKey(companyId, bundleId, "media/photo.jpg")).toBe(
      `${companyId}/imports/${bundleId}/media/photo.jpg`
    );
  });

  it("sanitizes relative paths and rejects traversal", () => {
    expect(sanitizeImportBundleRelativePath("media\\nested\\file.pdf")).toBe("media/nested/file.pdf");
    expect(() => sanitizeImportBundleRelativePath("../escape")).toThrow(/parent directory/);
  });

  it("asserts object keys stay within tenant and bundle scope", () => {
    const key = buildImportBundleObjectKey(companyId, bundleId, "forms/signed.pdf");
    assertImportBundleObjectKeyBelongsToTenant(key, companyId, bundleId);

    expect(() =>
      assertImportBundleObjectKeyBelongsToTenant("other-tenant/imports/x/file.pdf", companyId)
    ).toThrow(/tenant scope/);
  });
});
