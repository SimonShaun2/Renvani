import { describe, expect, it } from "vitest";

import { defaultTierNumber, showFinancingTeaser } from "./CustomerEstimateView";

const t = (n: string, recommended?: boolean) => ({ estimateNumber: n, recommended }) as never;

describe("customer estimate view (FS-212)", () => {
  it("preselects the recommended option, else the middle one", () => {
    expect(defaultTierNumber([t("1"), t("2"), t("3", true)])).toBe("3");
    expect(defaultTierNumber([t("1"), t("2"), t("3")])).toBe("2");
    expect(defaultTierNumber([t("1")])).toBe("1");
  });

  it("hides the financing teaser while financing is disabled", () => {
    expect(showFinancingTeaser({})).toBe(false);
    expect(showFinancingTeaser({ financing: { offered: true, provider: "disabled", providerReady: false, monthlyFrom: null } })).toBe(false);
    expect(showFinancingTeaser({ financing: { offered: true, provider: "disabled", providerReady: true, monthlyFrom: null } })).toBe(true);
  });
});
