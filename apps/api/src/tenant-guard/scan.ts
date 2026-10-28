/**
 * H1 static tenant-guard scan (heuristic, not a parser).
 *
 * Finds drizzle `.from(T)`, `.update(T)` and `.delete(T)` calls on tenant tables (every schema table with a
 * `company_id` column, derived from @fsm/db/schema at runtime) in apps/api, apps/worker and apps/webhook, and
 * reports the ones whose `.where(...)` doesn't mention companyId / company_id. Reviewed exceptions live in
 * ./allowlist.ts.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { is } from "drizzle-orm";

export interface TenantGuardFinding {
  /** Repo-relative path, e.g. apps/api/src/services/foo.service.ts */
  file: string;
  line: number;
  op: "from" | "update" | "delete";
  table: string;
  /** Normalized call text (call + chained where), used to match allowlist patterns. */
  snippet: string;
  reason: "no-where" | "where-without-companyId";
}

const SCANNED_APPS = ["apps/api/src", "apps/worker/src", "apps/webhook/src"];
const COMPANY_GUARD = /companyId|company_id/;

export function tenantTableVariables(schema: Record<string, unknown>): Map<string, string> {
  const result = new Map<string, string>();
  for (const [exportName, value] of Object.entries(schema)) {
    if (!is(value, PgTable)) continue;
    const config = getTableConfig(value);
    if (config.columns.some((column) => column.name === "company_id")) {
      result.set(exportName, config.name);
    }
  }
  return result;
}

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === "dist" || entry === "test-support" || entry === "tenant-guard") continue;
      out.push(...listSourceFiles(full));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts") && !/\.(test|spec)\.ts$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Text of the chained call expression starting at `start`, stopping at the end of the statement/argument. */
function chainExtent(source: string, start: number): string {
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i]!;
    if (ch === "(" || ch === "[" || ch === "{") depth += 1;
    else if (ch === ")" || ch === "]" || ch === "}") {
      depth -= 1;
      if (depth < 0) return source.slice(start, i);
    } else if (depth === 0 && (ch === ";" || ch === ",")) {
      return source.slice(start, i);
    }
  }
  return source.slice(start);
}

function whereArgs(chain: string): string[] {
  const args: string[] = [];
  let depth = 0;
  for (let i = 0; i < chain.length; i += 1) {
    const ch = chain[i]!;
    if (depth === 0 && chain.startsWith(".where(", i)) {
      let d = 0;
      for (let j = i + 6; j < chain.length; j += 1) {
        if (chain[j] === "(") d += 1;
        else if (chain[j] === ")") {
          d -= 1;
          if (d === 0) {
            args.push(chain.slice(i + 7, j));
            break;
          }
        }
      }
    }
    if (ch === "(" || ch === "[" || ch === "{") depth += 1;
    else if (ch === ")" || ch === "]" || ch === "}") depth -= 1;
  }
  return args;
}

/** A bare identifier where (e.g. `.where(conditions)`) counts as guarded when that name is built with companyId. */
function identifierIsCompanyScoped(source: string, name: string): boolean {
  const re = new RegExp(`\\b(?:const|let)\\s+${name}\\b[^;]*?(?:;|$)`, "gs");
  for (const match of source.matchAll(re)) {
    if (COMPANY_GUARD.test(source.slice(match.index ?? 0, (match.index ?? 0) + 1200))) return true;
  }
  return false;
}

export function scanTenantGuards(repoRoot: string, tenantVars: Map<string, string>): TenantGuardFinding[] {
  const findings: TenantGuardFinding[] = [];
  const callRe = /\.(from|update|delete)\(\s*(\w+)\s*\)/g;
  for (const appDir of SCANNED_APPS) {
    const absDir = path.join(repoRoot, appDir);
    for (const absFile of listSourceFiles(absDir)) {
      const source = readFileSync(absFile, "utf8");
      const rel = path.relative(repoRoot, absFile).split(path.sep).join("/");
      for (const match of source.matchAll(callRe)) {
        const [, op, variable] = match;
        const table = tenantVars.get(variable!);
        if (!table) continue;
        const start = match.index ?? 0;
        const chain = chainExtent(source, start);
        const wheres = whereArgs(chain);
        const guarded = wheres.some((arg) => {
          if (COMPANY_GUARD.test(arg)) return true;
          const bare = arg.trim().match(/^(?:and\(\s*\.\.\.)?(\w+)\)?$/);
          return bare ? identifierIsCompanyScoped(source, bare[1]!) : false;
        });
        if (guarded) continue;
        findings.push({
          file: rel,
          line: source.slice(0, start).split("\n").length,
          op: op as TenantGuardFinding["op"],
          table,
          snippet: chain.replace(/\s+/g, " ").slice(0, 400),
          reason: wheres.length === 0 ? "no-where" : "where-without-companyId"
        });
      }
    }
  }
  return findings;
}
