import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { MIGRATE_ONBOARDING_WIZARD_API_ROUTES } from "@fsm/types";

const routeModulePath = join(dirname(fileURLToPath(import.meta.url)), "index.ts");

function extractRegisteredRoutes(source: string): Array<{ method: string; path: string }> {
  const routes: Array<{ method: string; path: string }> = [];
  const pattern =
    /fastify\.(get|post|patch)\("([^"]+)"/gu;

  for (const match of source.matchAll(pattern)) {
    const method = match[1];
    const pathSuffix = match[2];
    if (!method || !pathSuffix) {
      continue;
    }

    routes.push({
      method: method.toUpperCase(),
      path: `/api/v1${pathSuffix}`
    });
  }

  return routes;
}

describe("migrate onboarding wizard API route registration contract", () => {
  it("matches the shared wizard API contract manifest", () => {
    const source = readFileSync(routeModulePath, "utf8");
    const registered = extractRegisteredRoutes(source);
    const expected = MIGRATE_ONBOARDING_WIZARD_API_ROUTES.map((route) => ({
      method: route.method,
      path: route.path
    }));

    expect(registered.sort((a, b) => a.path.localeCompare(b.path))).toEqual(
      [...expected].sort((a, b) => a.path.localeCompare(b.path))
    );
  });
});
