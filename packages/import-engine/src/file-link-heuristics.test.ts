import { describe, expect, it } from "vitest";

import {
  buildFileLinkTargetsFromPreviewRows,
  proposeImportFileLinksFromPaths
} from "./file-link-heuristics.js";

describe("file-link heuristics", () => {
  it("links a customer folder path to the customer source id", () => {
    const targets = buildFileLinkTargetsFromPreviewRows({
      customers: [{ sourceId: "cust-42", displayName: "Jane Doe" }],
      jobs: [],
      assets: []
    });

    const proposals = proposeImportFileLinksFromPaths(
      [{ vendorFileId: "f1", relativePath: "Customers/Jane_Doe/photo.jpg" }],
      targets
    );

    expect(proposals[0]?.suggestedEntityType).toBe("customer");
    expect(proposals[0]?.suggestedSourceId).toBe("cust-42");
    expect(proposals[0]?.confidence).toBeGreaterThan(0.3);
  });

  it("marks unknown paths as unlinked", () => {
    const proposals = proposeImportFileLinksFromPaths(
      [{ vendorFileId: "f2", relativePath: "misc/unknown.pdf" }],
      []
    );

    expect(proposals[0]?.suggestedEntityType).toBe("unlinked");
    expect(proposals[0]?.matchMethod).toBe("unresolved");
  });
});
