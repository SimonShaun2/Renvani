import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveApiBaseUrl } from "./api-base-url";

describe("resolveApiBaseUrl", () => {
  it("prefers the build-inlined NEXT_PUBLIC_API_URL over the config default", () => {
    expect(resolveApiBaseUrl("http://localhost:4000/", "http://localhost:3001")).toBe("http://localhost:4000");
    expect(resolveApiBaseUrl(undefined, "http://localhost:3001")).toBe("http://localhost:3001");
    expect(resolveApiBaseUrl("  ", "http://localhost:3001")).toBe("http://localhost:3001");
  });

  it("reads process.env.NEXT_PUBLIC_API_URL as a literal so Next.js can inline it", () => {
    const src = readFileSync(join(__dirname, "api-base-url.ts"), "utf8");
    expect(src).toContain("resolveApiBaseUrl(process.env.NEXT_PUBLIC_API_URL,");
  });

  it("browser API clients use API_BASE_URL, not publicEnv", () => {
    for (const file of ["api.ts", "upload.ts", "../hooks/dispatch.hooks.ts"]) {
      const src = readFileSync(join(__dirname, file), "utf8");
      expect(src).not.toMatch(/publicEnv\.NEXT_PUBLIC_API_URL/);
    }
  });
});
