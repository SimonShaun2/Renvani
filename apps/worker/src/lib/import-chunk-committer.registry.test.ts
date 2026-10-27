import { afterEach, describe, expect, it } from "vitest";

import {
  ImportChunkCommitError,
  UNSUPPORTED_ENTITY_TYPE,
  getImportChunkCommitter,
  hasImportChunkCommitter,
  listImportChunkCommitterTypes,
  registerImportChunkCommitter,
  unregisterImportChunkCommitter,
  type ImportChunkCommitter,
} from "./import-chunk-committer.registry.js";

const okCommitter: ImportChunkCommitter = async () => ({ rowsOk: 1, rowsFailed: 0 });
const otherCommitter: ImportChunkCommitter = async () => ({ rowsOk: 0, rowsFailed: 1 });

afterEach(() => {
  unregisterImportChunkCommitter("addon_widgets");
});

describe("import chunk committer registry", () => {
  it("registers and looks up a committer by entity type", () => {
    expect(registerImportChunkCommitter("addon_widgets", okCommitter)).toBeUndefined();
    expect(hasImportChunkCommitter("addon_widgets")).toBe(true);
    expect(getImportChunkCommitter("addon_widgets")).toBe(okCommitter);
    expect(listImportChunkCommitterTypes()).toContain("addon_widgets");
  });

  it("overrides an existing committer and returns the previous one", () => {
    registerImportChunkCommitter("addon_widgets", okCommitter);
    expect(registerImportChunkCommitter("addon_widgets", otherCommitter)).toBe(okCommitter);
    expect(getImportChunkCommitter("addon_widgets")).toBe(otherCommitter);
  });

  it("throws a handled UNSUPPORTED_ENTITY_TYPE error for unregistered types", () => {
    let caught: unknown;
    try {
      getImportChunkCommitter("not_registered_type");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ImportChunkCommitError);
    expect((caught as ImportChunkCommitError).code).toBe(UNSUPPORTED_ENTITY_TYPE);
    expect((caught as Error).message).toContain('"not_registered_type"');
  });

  it("rejects an empty entity type", () => {
    expect(() => registerImportChunkCommitter("  ", okCommitter)).toThrow(ImportChunkCommitError);
  });

  it("unregisters a committer", () => {
    registerImportChunkCommitter("addon_widgets", okCommitter);
    expect(unregisterImportChunkCommitter("addon_widgets")).toBe(true);
    expect(hasImportChunkCommitter("addon_widgets")).toBe(false);
  });
});
