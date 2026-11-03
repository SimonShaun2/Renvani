import { describe, expect, it } from "vitest";

import {
  normalizeImportedEstimateStatus,
  normalizeImportedJobStatus,
  normalizeImportedJobType,
  resolveImportedJobCompletionTime,
} from "./import-history-chunk.logic.js";

describe("import-history-chunk.logic", () => {
  it("maps vendor job statuses into canonical job statuses", () => {
    expect(normalizeImportedJobStatus("Complete")).toBe("completed");
    expect(normalizeImportedJobStatus("in progress")).toBe("in_progress");
    expect(normalizeImportedJobStatus("Canceled")).toBe("cancelled");
  });

  it("defaults unknown job statuses to completed for historical imports", () => {
    expect(normalizeImportedJobStatus("weird-vendor-state")).toBe("completed");
  });

  it("maps vendor estimate statuses", () => {
    expect(normalizeImportedEstimateStatus("Accepted")).toBe("approved");
    expect(normalizeImportedEstimateStatus("rejected")).toBe("declined");
  });

  it("infers job type from description tokens", () => {
    expect(normalizeImportedJobType("Annual maintenance")).toBe("maintenance");
    expect(normalizeImportedJobType("New install")).toBe("installation");
  });

  it("prefers actual end for completion business time", () => {
    const actualEnd = new Date("2022-06-01T12:00:00.000Z");
    const scheduledStart = new Date("2022-06-01T08:00:00.000Z");

    expect(
      resolveImportedJobCompletionTime({
        actualEnd,
        scheduledStart,
      }),
    ).toEqual(actualEnd);
  });
});
