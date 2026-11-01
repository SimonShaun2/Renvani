import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

vi.mock("./fonts", () => ({ geist: { variable: "g" }, newsreader: { variable: "n" } }));
vi.mock("next/navigation", () => ({ usePathname: () => "/pricing" }));

import { isPublicRoute } from "@/src/lib/route-access";
import { buildMarketingSitemap } from "@/src/lib/seo/public-sitemap";

import { PLANS, pricingTokens } from "./pricing-config";
import { PRICING_TREES } from "./pricing-visuals";
import type { VNode } from "./FigmaNode";
import { PricingFrames } from "./PricingPage";
import { SITE_FOOTER, SITE_NAV } from "./site-config";

const APP = join(__dirname, "../../../../app");
const PUBLIC = join(__dirname, "../../../../public");
const COMPETITORS = /jobber|servicetitan|housecall|service fusion|fieldedge|owner\.com|\bowner com\b|broccoli/i;

describe("pricing (Figma 203:15719 desktop / 203:15720 mobile)", () => {
  it("every button label has a text color that contrasts with its pill (review 5721672368)", () => {
    const buttons: { c?: string; kind?: string }[] = [];
    const walk = (n: VNode) => {
      if (typeof n === "string") return;
      if (n.t === "button") buttons.push(n as { c?: string; kind?: string });
      n.k?.forEach(walk);
    };
    walk(PRICING_TREES.desktop);
    walk(PRICING_TREES.mobile);
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) {
      if (b.c?.includes("bg-[#0f1530]")) expect(b.c).toContain("text-[color:#fbf6ef]");
      if (b.c?.includes("bg-[#f6b400]")) expect(b.c).toContain("text-[color:#0f1530]");
    }
  });

  it("plans follow the pricing rulings", () => {
    const by = Object.fromEntries(PLANS.map((p) => [p.key, p]));
    expect(by.flex).toMatchObject({ monthly: 399, serviceFeePct: 2 });
    expect(by.flat).toMatchObject({ monthly: 999, serviceFeePct: 0 });
    expect(by.founding).toMatchObject({ monthly: 199, basedOn: "flex" });
    expect(by.startup).toMatchObject({ monthly: 99, basedOn: "flex" });
    const t = pricingTokens();
    expect(t["ex.flexFee"]).toBe("$5.48");
    expect(t["ex.flexTotal"]).toBe("$279.48");
    expect(t["ex.flatTotal"]).toBe("$274.00");
  });

  it("renders desktop and mobile frames with resolved figures and one h1 each", () => {
    const { container } = render(<PricingFrames />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/\{\{/);
    for (const s of ["$399", "$999", "2% customer-paid Service Fee", "No customer-paid Service Fee", "Startup $99/mo · Founding $199/mo", "Pay $279.48", "Pay $274.00"]) {
      expect(text).toContain(s);
    }
    expect(container.querySelectorAll("h1")).toHaveLength(2);
    expect(container.querySelector(".xl\\:hidden")).not.toBeNull();
    expect(container.querySelector(".hidden.xl\\:block")).not.toBeNull();
  });

  it("every link resolves to a real route and images exist", () => {
    const { container } = render(<PricingFrames />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href")!);
    expect(hrefs.length).toBeGreaterThanOrEqual(8);
    for (const h of hrefs) {
      const path = h.split("?")[0]!;
      expect(existsSync(join(APP, `(auth)${path}`)) || existsSync(join(APP, `(marketing)${path}/page.tsx`))).toBe(true);
    }
    for (const img of Array.from(container.querySelectorAll("img"))) {
      expect(existsSync(join(PUBLIC, img.getAttribute("src")!))).toBe(true);
    }
  });

  it("plan CTAs follow the Figma prototype links (204:7829 / I204:7831;204:7829 / 204:7952 / I204:7954;204:7952 / 204:7915 / 204:8038)", () => {
    const { container } = render(<PricingFrames />);
    const byLabel = (label: string) => Array.from(container.querySelectorAll("a")).filter((a) => a.textContent?.trim() === label).map((a) => a.getAttribute("href"));
    expect(byLabel("Explore Flex")).toEqual(["/demo?plan=flex", "/demo?plan=flex"]);
    expect(byLabel("Explore Flat")).toEqual(["/demo?plan=flat", "/demo?plan=flat"]);
    expect(byLabel("Ask about programs")).toEqual(["/demo", "/demo"]);
    expect(byLabel("Get a free demo").every((h) => h === "/demo")).toBe(true);
    expect(Array.from(container.querySelectorAll("a")).some((a) => a.getAttribute("href")?.startsWith("/signup?plan"))).toBe(false);
  });

  it("copy guard: no $1.99 booking fee, no competitors, no restaurant language", () => {
    const { container } = render(<PricingFrames />);
    const src = ["pricing-config.ts", "pricing-visuals.ts", "PricingPage.tsx"].map((f) => readFileSync(join(__dirname, f), "utf8")).join("\n");
    for (const s of [container.textContent ?? "", src]) {
      expect(s).not.toMatch(/1\.99/);
      expect(s).not.toMatch(COMPETITORS);
      expect(s).not.toMatch(/restaurant|diner|menu item|table service/i);
    }
  });

  it("route is real, public, in the sitemap, and linked from nav and footer", () => {
    const page = readFileSync(join(APP, "(marketing)/pricing/page.tsx"), "utf8");
    expect(page).toContain("PricingFrames");
    expect(page).not.toMatch(/redirect\(/);
    expect(isPublicRoute("/pricing")).toBe(true);
    expect(buildMarketingSitemap({ PUBLIC_SITE_URL: "https://x.test" } as unknown as NodeJS.ProcessEnv).map((e) => e.url)).toContain("https://x.test/pricing");
    expect(JSON.stringify(SITE_NAV)).toContain('"/pricing"');
    expect(JSON.stringify(SITE_FOOTER)).toContain('"/pricing"');
  });
});
