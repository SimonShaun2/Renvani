import { readFileSync } from "node:fs";
import { join } from "node:path";

import { FINANCING_PROVIDER_REGISTRY } from "@fsm/types";
import { describe, expect, it, vi } from "vitest";

import {
  financingProviderReady,
  financingSummary,
  getActiveFinancingAdapter,
  getFinancingAdapter,
  quoteFinancing,
  startFinancingApplication
} from "./financing-adapter.registry.js";

describe("FS-212 financing adapter registry (disabled)", () => {
  it("only knows the disabled provider and it is not ready", () => {
    expect(Object.keys(FINANCING_PROVIDER_REGISTRY)).toEqual(["disabled"]);
    expect(getActiveFinancingAdapter().id).toBe("disabled");
    expect(financingProviderReady()).toBe(false);
    expect(getFinancingAdapter("stripe")).toBeNull();
    expect(getFinancingAdapter("__proto__")).toBeNull();
    expect(financingSummary(true)).toEqual({ offered: false, provider: "disabled", providerReady: false, monthlyFrom: null, reason: "financing_disabled" });
  });

  it("quotes nothing and refuses applications without network calls", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(quoteFinancing({ companyId: "c", estimateId: "e", amount: "100.00" })).resolves.toEqual({
      quotes: [], provider: "disabled", providerReady: false, reason: "financing_disabled"
    });
    await expect(startFinancingApplication({ companyId: "c", estimateId: "e" })).rejects.toMatchObject({ code: "POLICY_DENIED" });
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("reads no env, keys or config at import and has no fee math", () => {
    const source = readFileSync(join(import.meta.dirname, "financing-adapter.registry.ts"), "utf8");
    expect(source).not.toMatch(/process\.env|@fsm\/config|fetch\(/);
    expect(source).not.toMatch(/\bfee\b\s*[=:*]|0\.02|serviceFee/i);
  });
});
