import { describe, expect, it } from "vitest";

import { env } from "../env.js";
import { buildImportBundleObjectKey } from "../import-bundle-storage.js";
import { MemoryObjectStorageProvider } from "./memory-provider.js";
import { R2ObjectStorageProvider } from "./r2-provider.js";

describe("FS-85 / FS-MIGRATE object storage adapters — import bundle keys", () => {
  const companyId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const bundleId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

  it("memory provider stores and resolves import bundle object keys", async () => {
    const provider = new MemoryObjectStorageProvider();
    const objectKey = buildImportBundleObjectKey(companyId, bundleId, "media/photo-a.jpg");
    const buffer = Buffer.from("fake-image");

    const stored = await provider.putObject(objectKey, buffer, "image/jpeg");
    expect(stored.objectKey).toBe(objectKey);
    expect(provider.resolveObjectKey(stored.reference)).toBe(objectKey);
  });

  it("R2 provider builds references that preserve import bundle object keys", async () => {
    const provider = new R2ObjectStorageProvider();
    const objectKey = buildImportBundleObjectKey(companyId, bundleId, "reports/summary.pdf");

    const reference = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME}/${objectKey}`;
    expect(provider.resolveObjectKey(reference)).toBe(objectKey);
  });
});
