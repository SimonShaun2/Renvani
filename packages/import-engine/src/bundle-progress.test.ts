import { describe, expect, it } from "vitest";

import {
  buildImportBundleFileDescriptors,
  computeImportBundleProgress,
  countMappedImportBundleFiles
} from "./bundle-progress.js";

describe("bundle-progress", () => {
  it("counts mapped bundle files", () => {
    const files = buildImportBundleFileDescriptors([
      { fileName: "customers.csv", mimeType: "text/csv", byteSize: 10 },
      { fileName: "readme.txt", mimeType: "text/plain", byteSize: 5 }
    ]);
    expect(countMappedImportBundleFiles(files)).toBe(1);
  });

  it("computes bundle progress with chunk totals", () => {
    const files = buildImportBundleFileDescriptors([
      { fileName: "customers.csv", mimeType: "text/csv", byteSize: 10 },
      { fileName: "locations.csv", mimeType: "text/csv", byteSize: 20 }
    ]);
    const progress = computeImportBundleProgress({
      files,
      chunksCommitted: 1,
      chunksTotal: 4
    });
    expect(progress).toEqual({
      filesTotal: 2,
      filesMapped: 2,
      chunksCommitted: 1,
      chunksTotal: 4
    });
  });
});
