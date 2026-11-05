import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

vi.mock("./fonts", () => ({ geist: { variable: "g" }, inter: { variable: "i", className: "inter" }, newsreader: { variable: "n" } }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", notFound: () => { throw new Error("404"); } }));

import TradeRoute, { generateMetadata, generateStaticParams } from "../../../../app/(marketing)/industries/[slug]/page";
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
const EXPECTED = [
  ["hvac", "HVAC & Refrigeration"], ["plumbing", "Plumbing"], ["electrical", "Electrical"],
  ["appliance-repair", "Appliance Repair"], ["garage-doors", "Overhead & Garage Door"],
  ["locksmith", "Locksmith"], ["cleaning", "Cleaning"], ["pest-control", "Pest Control"],
  ["chimney", "Chimney"], ["pressure-washing", "Pressure Washing"], ["tree-care", "Tree Care"],
  ["alarm", "Alarm"], ["air-duct", "Air Duct"], ["carpet-cleaning", "Carpet Cleaning"]
] as const;
const INDUSTRY_HREFS = [INDUSTRIES_OVERVIEW.href, ...EXPECTED.map(([slug]) => `/industries/${slug}`)];
const resolves = (h: string) => {
  const path = h.split("#")[0] || "/";
  if (h.startsWith("#")) return true;
  if (path.startsWith("/product/")) return PRODUCT_PAGES.some((p) => `/product/${p.slug}` === path);
  if (INDUSTRY_HREFS.includes(path)) return true;
  return ["/", "/product", "/how-it-works", "/pricing", "/signup", "/demo", "/growth-check", "/login", "/tour"].includes(path);
};
const anchors = (el: Element) => Array.from(el.querySelectorAll("a")).map((a) => a.getAttribute("href")!);

describe("expanded marketing industries", () => {
  it("registers exactly the requested fourteen industries and generates each public trade route", () => {
    expect(existsSync(join(APP, "(marketing)/industries/page.tsx"))).toBe(true);
    expect(existsSync(join(APP, "(marketing)/industries/[slug]/page.tsx"))).toBe(true);
    expect(INDUSTRY_PAGES.map((p) => [p.slug, p.name])).toEqual(EXPECTED);
    expect(generateStaticParams()).toEqual(EXPECTED.map(([slug]) => ({ slug })));
    expect(new Set(INDUSTRY_PAGES.map((p) => p.href)).size).toBe(14);
  });

  for (const tree of ["hvac", "plumbing", "electrical"] as const) {
    it(`renders the responsive ${tree} page with one semantic heading`, () => {
      const { container } = render(<IndustryFrames tree={tree} />);
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
      const hrefs = anchors(container);
      expect(hrefs).toContain("/demo");
      for (const h of hrefs) expect(resolves(h), h).toBe(true);
    });
  }

  for (const [slug, name] of EXPECTED.slice(3)) {
    it(`renders the ${slug} route with an explicitly illustrative workflow and working next steps`, async () => {
      const { container } = render(await TradeRoute({ params: Promise.resolve({ slug }) }));
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
      expect(container.textContent).toContain(name);
      expect(container.textContent).toContain("Illustrative workflow");
      const hrefs = anchors(container);
      expect(hrefs).toContain("/demo");
      expect(hrefs).toContain("/tour");
      expect(hrefs).toContain("/industries");
      for (const h of hrefs) expect(resolves(h), h).toBe(true);
      await expect(generateMetadata({ params: Promise.resolve({ slug }) })).resolves.toMatchObject({ title: `${name} · Renvani` });
    });
  }

  it.each(["no-such-trade", "remodeling", "pool", "irrigation", "tree"])("unknown or omitted %s route returns 404", async (slug) => {
    await expect(TradeRoute({ params: Promise.resolve({ slug }) })).rejects.toThrow("404");
    await expect(generateMetadata({ params: Promise.resolve({ slug }) })).resolves.toEqual({});
  });

  it("the industry directory offers all fourteen destinations with one h1", () => {
    const { container } = render(<IndustryFrames tree="industries" />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const hrefs = anchors(container);
    for (const [slug, name] of EXPECTED) {
      expect(hrefs).toContain(`/industries/${slug}`);
      expect(screen.getByRole("link", { name }).getAttribute("href")).toBe(`/industries/${slug}`);
    }
  });

  it("header, footer and home preserve their public navigation", () => {
    render(<MarketingShell><p>x</p></MarketingShell>);
    const main = screen.getByRole("navigation", { name: "Main" });
    for (const h of INDUSTRY_HREFS) expect(anchors(main)).toContain(h);
    expect(SITE_FOOTER.links.find((l) => l.label === "Industries")?.href).toBe("/industries");
    expect(JSON.stringify(HOME)).not.toContain("hvac#plumbing");
    expect(JSON.stringify(HOME)).toContain("/industries/plumbing");
  });

  it("every advertised industry is public and appears once in the sitemap", () => {
    const urls = buildMarketingSitemap({ PUBLIC_SITE_URL: "https://x.test" } as unknown as NodeJS.ProcessEnv).map((e) => e.url);
    for (const h of INDUSTRY_HREFS) {
      expect(isPublicRoute(h)).toBe(true);
      expect(urls.filter((url) => url === `https://x.test${h}`)).toHaveLength(1);
    }
  });

  it("unknown industry slugs stay public for a 404 without opening deeper paths", () => {
    expect(isPublicRoute("/industries/roofing")).toBe(true);
    expect(isPublicRoute("/industries/hvac/admin")).toBe(false);
    expect(isPublicRoute("/industries/pest-control/admin")).toBe(false);
  });

  it("every preserved image exists", () => {
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

  it("copy stays on home services without competitor references or invented prices", () => {
    const strings = (n: VNode): string => (typeof n === "string" ? n : (n.label ?? "") + " " + (n.k ?? []).map(strings).join(" "));
    const text = Object.values(INDUSTRY_TREES).map((t) => strings(t.desktop) + " " + (t.mobile ? strings(t.mobile) : "")).join(" ") + JSON.stringify(INDUSTRY_PAGES);
    expect(readFileSync(join(__dirname, "industry-visuals.ts"), "utf8")).not.toMatch(/jobber|servicetitan|housecall/i);
    expect(text).not.toMatch(/jobber|servicetitan|housecall|service fusion|fieldedge/i);
    expect(text).not.toMatch(/restaurant|diner|reservation|\btable\b|\bmenu/i);
    expect(text).not.toMatch(/\$1\.99|booking fee|\$399|\$999|\$199/);
  });
});
