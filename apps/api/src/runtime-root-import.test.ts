import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function productionSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "test-support" || entry.name.endsWith(".test.ts")) return [];
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionSourceFiles(path);
    return entry.name.endsWith(".ts") ? [path] : [];
  });
}

describe("API runtime import boundary", () => {
  it("keeps production API imports off the broad config root", () => {
    const files = productionSourceFiles(__dirname);
    const broadImports = files.filter((path) => /from\s+["']@fsm\/config["']/u.test(readFileSync(path, "utf8")));
    expect(broadImports).toEqual([]);
  });
});
