import { describe, expect, it } from "vitest";

import {
  parseImportedNoteVisibility,
  parseImportedNotedAt,
  resolveImportedNoteScope,
} from "./import-notes-map.js";

describe("import-notes-map", () => {
  it("defaults ambiguous visibility to internal", () => {
    expect(parseImportedNoteVisibility(null, null)).toBe(true);
    expect(parseImportedNoteVisibility("misc", null)).toBe(true);
  });

  it("maps customer-facing visibility labels", () => {
    expect(parseImportedNoteVisibility("customer visible", null)).toBe(false);
    expect(parseImportedNoteVisibility(null, "public")).toBe(false);
  });

  it("infers scope from parent ids", () => {
    expect(resolveImportedNoteScope("job-1", null, null)).toBe("job");
    expect(resolveImportedNoteScope(null, "cust-9", null)).toBe("customer");
    expect(resolveImportedNoteScope(null, null, "Job note")).toBe("job");
  });

  it("parses vendor noted-at timestamps", () => {
    const parsed = parseImportedNotedAt("2022-05-14T10:15:00Z");
    expect(parsed?.toISOString()).toBe("2022-05-14T10:15:00.000Z");
  });
});
