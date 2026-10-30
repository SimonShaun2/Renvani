import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

vi.mock("./fonts", () => ({ geist: { variable: "g" }, newsreader: { variable: "n" } }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", notFound: () => { throw new Error("404"); } }));

import { isPublicRoute } from "@/src/lib/route-access";
import { buildMarketingSitemap } from "@/src/lib/seo/public-sitemap";

import type { VNode } from "./FigmaNode";
import { PRODUCT_PAGES } from "./flagship-registry";
import { IndustryFrames } from "./IndustryPage";
import { INDUSTRIES_OVERVIEW, INDUSTRY_PAGES } from "./industry-registry";
import { INDUSTRY_TREES } from "./industry-visuals";
import { MarketingShell } from "./MarketingShell";
import { HOME, SITE_FOOTER } from "./site-config";

const APP = join(__dirname, "../../../../app");
const PUBLIC = join(__dirname, "../../../../public");
const INDUSTRY_HREFS = [INDUSTRIES_OVERVIEW.href, ...INDUSTRY_PAGES.map((p) => p.href)];
const resolves = (h: string) => {
  const path = h.split("#")[0] || "/";
  if (h.startsWith("#")) return true;
  if (path.startsWith("/product/")) return PRODUCT_PAGES.some((p) => `/product/${p.slug}` === path);
  if (INDUSTRY_HREFS.includes(path)) return true;
  return ["/", "/product", "/how-it-works", "/pricing", "/signup", "/demo", "/growth-check", "/login", "/product-tour"].includes(path);
};
const anchors = (el: Element) => Array.from(el.querySelectorAll("a")).map((a) => a.getAttribute("href")!);

describe("industries (Figma 176:417/176:504, 175:4297…175:5015, menu 177:686)", () => {
  it("route files exist for the overview and every trade", () => {
    expect(existsSync(join(APP, "(marketing)/industries/page.tsx"))).toBe(true);
    expect(existsSync(join(APP, "(marketing)/industries/[slug]/page.tsx"))).toBe(true);
    expect(INDUSTRY_PAGES.map((p) => p.slug)).toEqual(["hvac", "plumbing", "electrical"]);
  });

  for (const tree of ["industries", "hvac", "plumbing", "electrical"] as const) {
    it(`renders ${tree} desktop + mobile frames with real links`, () => {
      const { container } = render(<IndustryFrames tree={tree} />);
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(2);
      const hrefs = anchors(container);
      expect(hrefs).toContain("/demo");
      for (const h of hrefs) expect(resolves(h), h).toBe(true);
    });
  }

  it("overview cards link every trade page", () => {
    const { container } = render(<IndustryFrames tree="industries" />);
    const hrefs = anchors(container);
    for (const p of INDUSTRY_PAGES) expect(hrefs).toContain(p.href);
  });

  it("header industry menu, footer and home link the real pages", () => {
    render(<MarketingShell><p>x</p></MarketingShell>);
    const main = screen.getByRole("navigation", { name: "Main" });
    for (const h of INDUSTRY_HREFS) expect(anchors(main)).toContain(h);
    expect(SITE_FOOTER.links.find((l) => l.label === "Industries")?.href).toBe("/industries");
    expect(JSON.stringify(HOME)).not.toContain("hvac#plumbing");
    expect(JSON.stringify(HOME)).toContain("/industries/plumbing");
  });

  it("pages are public and in the sitemap", () => {
    const urls = buildMarketingSitemap({ PUBLIC_SITE_URL: "https://x.test" } as unknown as NodeJS.ProcessEnv).map((e) => e.url);
    for (const h of INDUSTRY_HREFS) {
      expect(isPublicRoute(h)).toBe(true);
      expect(urls).toContain(`https://x.test${h}`);
    }
  });

  it("every image exists", () => {
    const walk = (n: VNode): void => {
      if (typeof n === "string") return;
      if (n.src) expect(existsSync(join(PUBLIC, n.src)), n.src).toBe(true);
      n.k?.forEach(walk);
    };
    for (const t of Object.values(INDUSTRY_TREES)) {
      walk(t.desktop);
      if (t.mobile) walk(t.mobile);
    }
  });

  it("copy guard: home services only, no competitors, no off-list prices", () => {
    const strings = (n: VNode): string => (typeof n === "string" ? n : (n.label ?? "") + " " + (n.k ?? []).map(strings).join(" "));
    const text = Object.values(INDUSTRY_TREES).map((t) => strings(t.desktop) + " " + (t.mobile ? strings(t.mobile) : "")).join(" ");
    expect(readFileSync(join(__dirname, "industry-visuals.ts"), "utf8")).not.toMatch(/jobber|servicetitan|housecall/i);
    expect(text).not.toMatch(/jobber|servicetitan|housecall|service fusion|fieldedge/i);
    expect(text).not.toMatch(/restaurant|diner|reservation|\btable\b|\bmenu/i);
    expect(text).not.toMatch(/\$1\.99|booking fee|\$399|\$999|\$199/);
  });
});
