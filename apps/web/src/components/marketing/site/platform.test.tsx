import { existsSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

vi.mock("./fonts", () => ({ geist: { variable: "g" }, newsreader: { variable: "n" } }));

import { isPublicRoute } from "@/src/lib/route-access";
import { buildMarketingSitemap, ROBOTS_ALLOW } from "@/src/lib/seo/public-sitemap";

import { MarketingShell } from "./MarketingShell";
import { HowItWorksPage, ProductsPage } from "./PlatformPages";
import { HOW_PAGE, PLATFORM, PRODUCTS_PAGE, TOOL_GROUPS } from "./platform-config";
import { SITE_FOOTER, SITE_NAV } from "./site-config";

const APP = join(__dirname, "../../../../app");
const ROUTE_FILES: Record<string, string> = {
  "/": "page.tsx",
  "/product": "(marketing)/product/page.tsx",
  "/how-it-works": "(marketing)/how-it-works/page.tsx",
  "/pricing": "(marketing)/pricing/page.tsx",
  "/industries/hvac": "(marketing)/industries/hvac/page.tsx",
  "/signup": "(auth)/signup/[[...rest]]/page.tsx",
  "/login": "(auth)/login/[[...rest]]/page.tsx"
};
const path = (href: string) => href.split("#")[0] || "/";

describe("Products + How it works (Figma 176:204/176:313, 176:585/176:664)", () => {
  it("renders the Products page with the connected platform and the tool directory", () => {
    render(<ProductsPage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Five products.Every part of the job.");
    expect(screen.getByRole("heading", { name: "Find your next tool." })).toBeTruthy();
    expect(screen.getByText("YOUR RULES ACROSS THE WORK")).toBeTruthy();
    expect(document.querySelectorAll("[data-tool-group]")).toHaveLength(5);
    expect(screen.getByRole("link", { name: "Find your next tool ↓" }).getAttribute("href")).toBe("#tools");
    expect(document.getElementById("tools")).toBeTruthy();
  });

  it("renders the How it works page", () => {
    render(<HowItWorksPage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("One business.Every handoff connected.");
    expect(screen.getByRole("heading", { name: "No heat. Approved repair. Next tune-up." })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Explore the tools →" }).getAttribute("href")).toBe("/product#tools");
  });

  it("header and footer link to the real pages, each with a route file and public access", () => {
    const hrefs = [...SITE_NAV.links.map((l) => l.href), SITE_NAV.cta.href, SITE_NAV.signIn.href, ...SITE_FOOTER.links.map((l) => l.href)];
    expect(hrefs).toContain("/product");
    expect(hrefs).toContain("/how-it-works");
    for (const h of hrefs) {
      const p = path(h);
      expect(ROUTE_FILES[p], p).toBeTruthy();
      expect(existsSync(join(APP, ROUTE_FILES[p]!)), p).toBe(true);
    }
    expect(isPublicRoute("/product")).toBe(true);
    expect(isPublicRoute("/how-it-works")).toBe(true);
  });

  it("every rendered page link resolves to a route file (no dead links)", () => {
    render(<><ProductsPage /><HowItWorksPage /></>);
    for (const a of Array.from(document.querySelectorAll("a"))) {
      const h = a.getAttribute("href")!;
      if (h.startsWith("#")) continue;
      const p = path(h);
      const ok = ROUTE_FILES[p] ? existsSync(join(APP, ROUTE_FILES[p]!)) : /^\/product\/(growth|revenue|operations|retention|command-center)$/.test(p) || p === "/product-tour";
      expect(ok, h).toBe(true);
    }
  });

  it("mobile menu carries the same links", () => {
    render(<MarketingShell><p>x</p></MarketingShell>);
    const mobile = screen.getByRole("navigation", { name: "Mobile" });
    for (const l of SITE_NAV.links) expect(mobile.querySelector(`a[href="${l.href}"]`)).toBeTruthy();
  });

  it("sitemap and robots include both pages", () => {
    const urls = buildMarketingSitemap({ PUBLIC_SITE_URL: "https://x.test" } as unknown as NodeJS.ProcessEnv).map((e) => e.url);
    expect(urls).toEqual(expect.arrayContaining(["https://x.test/product", "https://x.test/how-it-works"]));
    expect(ROBOTS_ALLOW.map((a) => a.prefix)).toEqual(expect.arrayContaining(["/product$", "/how-it-works"]));
  });

  it("copy stays home-services with no competitors or plan pricing", () => {
    const text = JSON.stringify([PLATFORM, TOOL_GROUPS, PRODUCTS_PAGE, HOW_PAGE]);
    expect(text).not.toMatch(/jobber|servicetitan|housecall|service fusion|fieldedge/i);
    expect(text).not.toMatch(/restaurant|menu|diner|reservation|table/i);
    expect(text).not.toMatch(/\$1\.99|\$399|\$999|\$199|\$99\b/);
  });
});
