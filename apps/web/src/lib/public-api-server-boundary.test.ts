import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = join(__dirname, "../..");

function productionFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionFiles(path);
    if (!/\.(?:ts|tsx)$/u.test(entry.name) || /\.(?:test|spec)\.(?:ts|tsx)$/u.test(entry.name)) return [];
    return [path];
  });
}

describe("server-only public API origin", () => {
  it("has an enforced marker and no client-reachable direct importer", () => {
    const serverModule = readFileSync(join(__dirname, "public-api-server.ts"), "utf8");
    expect(serverModule).toMatch(/^import "server-only";/u);

    const importers = [...productionFiles(join(webRoot, "app")), ...productionFiles(join(webRoot, "src"))]
      .filter((path) => /(?:from\s+|import\(\s*)["'][^"']*public-api-server(?:\.js)?["']/u.test(readFileSync(path, "utf8")))
      .map((path) => relative(webRoot, path).replaceAll("\\", "/"));
    expect(importers).toEqual(["src/lib/public-booking-server.ts"]);
    expect(readFileSync(join(webRoot, importers[0] ?? ""), "utf8")).not.toMatch(/^\s*["']use client["']/u);
  });
});
