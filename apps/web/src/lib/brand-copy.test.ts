import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
// Persisted store keys keep the legacy name (renaming drops saved drafts); the reporting
// export is owned by #219's ReportingDashboardClient and is left untouched here.
const ALLOWED = new Set([
  "src/stores/csv-import.store.ts",
  "src/stores/booking-flow.store.ts",
  "src/stores/estimate-flow.store.ts",
  "src/components/reporting/ReportingDashboardClient.tsx",
  "src/components/marketing/marketing-copy.test.ts",
  "src/lib/brand-copy.test.ts"
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(tsx?|mdx?)$/.test(name)) out.push(path);
  }
  return out;
}

describe("brand copy", () => {
  it("no user-visible legacy brand name in apps/web", () => {
    const offenders = [...walk(join(ROOT, "src")), ...walk(join(ROOT, "app"))]
      .map((p) => relative(ROOT, p))
      .filter((p) => !ALLOWED.has(p))
      .filter((p) => /service ?rev/i.test(readFileSync(join(ROOT, p), "utf8")));
    expect(offenders).toEqual([]);
  });
});
