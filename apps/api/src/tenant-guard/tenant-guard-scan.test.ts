import path from "node:path";

import * as schema from "@fsm/db/schema";
import { describe, expect, it } from "vitest";

import { TENANT_GUARD_ALLOWLIST } from "./allowlist.js";
import { scanTenantGuards, tenantTableVariables, type TenantGuardFinding } from "./scan.js";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const ALLOWLIST_PATH = "apps/api/src/tenant-guard/allowlist.ts";

function isAllowlisted(finding: TenantGuardFinding): boolean {
  return TENANT_GUARD_ALLOWLIST.some((entry) => entry.file === finding.file && finding.snippet.includes(entry.pattern));
}

describe("H1 tenant-guard static scan", () => {
  const tenantVars = tenantTableVariables(schema as Record<string, unknown>);
  const findings = scanTenantGuards(REPO_ROOT, tenantVars);

  it("derives tenant tables from the schema (every table with company_id)", () => {
    expect(tenantVars.size).toBeGreaterThan(40);
    expect([...tenantVars.values()]).toEqual(expect.arrayContaining(["invoices", "payments", "jobs", "estimates", "customers"]));
    expect([...tenantVars.values()]).not.toContain("companies");
  });

  it("every select/update/delete on a tenant table filters on companyId or is on the reviewed allowlist", () => {
    const violations = findings.filter((finding) => !isAllowlisted(finding));
    const message = violations
      .map((v) => `  ${v.file}:${v.line}  .${v.op}(${v.table})  ${v.reason}\n      ${v.snippet.slice(0, 180)}`)
      .join("\n");
    expect(
      violations,
      violations.length === 0
        ? ""
        : `Unscoped tenant-table queries (no companyId in .where):\n${message}\n\n` +
            `Add eq(<table>.companyId, companyId) to the where clause. If the query is safe without it ` +
            `(public token, Stripe-signed id, auth-global, ...), add a reviewed entry with a reason to ${ALLOWLIST_PATH}.`
    ).toEqual([]);
  });

  it("allowlist entries are well-formed (file + pattern + category + reason)", () => {
    for (const entry of TENANT_GUARD_ALLOWLIST) {
      expect(entry.file).toMatch(/^apps\/(api|worker|webhook)\/src\/.+\.ts$/);
      expect(entry.pattern.length).toBeGreaterThan(3);
      expect(entry.reason.length).toBeGreaterThan(10);
    }
  });

  it("detects a synthetic unscoped query (scanner self-test)", async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const root = mkdtempSync(path.join(tmpdir(), "tenant-guard-"));
    for (const app of ["api", "worker", "webhook"]) mkdirSync(path.join(root, "apps", app, "src"), { recursive: true });
    writeFileSync(
      path.join(root, "apps/api/src/demo.service.ts"),
      [
        "await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);",
        "await db.select().from(invoices).where(and(eq(invoices.companyId, c), eq(invoices.id, id)));",
        "await db.update(jobs).set({ title }).where(eq(jobs.id, id));",
        "await db.delete(payments);",
        "await db.select().from(companies).where(eq(companies.id, id));"
      ].join("\n")
    );
    const found = scanTenantGuards(root, tenantVars).map((f) => `${f.op}:${f.table}:${f.reason}`);
    expect(found).toEqual([
      "from:invoices:where-without-companyId",
      "update:jobs:where-without-companyId",
      "delete:payments:no-where"
    ]);
  });
});
