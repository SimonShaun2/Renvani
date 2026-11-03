import { describe, expect, it } from "vitest";

import {
  MigratePhotoMigrationStateSchema,
  buildMigratePhotoVendorFileId
} from "./migrate-photo-link-preview.js";

describe("migrate-photo-link-preview contract", () => {
  it("builds stable vendor file ids from relative paths", () => {
    expect(buildMigratePhotoVendorFileId("media/job-12/photo.jpg")).toBe("media/job-12/photo.jpg");
  });

  it("parses migration state with resumable client batches", () => {
    const parsed = MigratePhotoMigrationStateSchema.parse({
      mediaImportSessionId: "11111111-1111-4111-8111-111111111111",
      clientBatches: {
        "batch-a": { receivedAt: "2026-10-23T12:00:00.000Z", objectCount: 2 }
      },
      objects: [
        {
          vendorFileId: "media/a.jpg",
          relativePath: "media/a.jpg",
          r2Key: "co/imports/bundle/media/a.jpg",
          uploadedAt: "2026-10-23T12:00:00.000Z"
        }
      ]
    });
    expect(parsed.objects).toHaveLength(1);
    expect(parsed.clientBatches["batch-a"].objectCount).toBe(2);
  });
});
