import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

vi.mock("./fonts", () => ({ geist: { variable: "g" }, newsreader: { variable: "n" } }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", notFound: () => { throw new Error("404"); } }));

import { isPublicRoute } from "@/src/lib/route-access";
import { buildMarketingSitemap } from "@/src/lib/seo/public-sitemap";

import { FlagshipPage } from "./FlagshipPage";
import { PRODUCT_PAGES, productLinkFor } from "./flagship-registry";
import { FLAGSHIP_TREES } from "./flagship-visuals";
import { MarketingShell } from "./MarketingShell";
import { PRODUCTS_MENU } from "./site-config";

const SLUGS = PRODUCT_PAGES.map((p) => p.slug);
const PUBLIC = join(__dirname, "../../../../public");
const resolves = (h: string) => {
  const path = h.split("#")[0] || "/";
  if (h.startsWith("#")) return true;
  if (path.startsWith("/product/")) return SLUGS.includes(path.slice(9));
  return ["/", "/product", "/how-it-works", "/pricing", "/industries", "/industries/hvac", "/industries/plumbing", "/industries/electrical", "/signup", "/login", "/product-tour"].includes(path);
};

describe("flagship + product-detail pages (Figma 175:3…175:2154)", () => {
  it("registry covers the eight frames with desktop + mobile ids", () => {
    expect(SLUGS).toEqual(["growth", "revenue", "operations", "retention", "command-center", "online-booking", "estimates-approvals", "scheduling-dispatch"]);
    for (const p of PRODUCT_PAGES) expect(p.frames.mobile).toMatch(/^175:\d+$/);
  });

  for (const page of PRODUCT_PAGES) {
    it(`renders ${page.slug} with real links only`, () => {
      const { container } = render(<FlagshipPage page={page} />);
      const h1s = screen.getAllByRole("heading", { level: 1 });
      expect(h1s).toHaveLength(2); // desktop (md+) and mobile frame; only one is displayed
      expect(container.querySelector("#workflow")).toBeTruthy();
      expect(container.querySelector("#workflow-m")).toBeTruthy();
      expect(FLAGSHIP_TREES[page.slug]!.desktop).toMatchObject({ id: page.frames.desktop });
      expect(FLAGSHIP_TREES[page.slug]!.mobile).toMatchObject({ id: page.frames.mobile });
      for (const a of Array.from(container.querySelectorAll("a"))) expect(resolves(a.getAttribute("href")!), a.getAttribute("href")!).toBe(true);
      expect(isPublicRoute(`/product/${page.slug}`)).toBe(true);
    });
  }

  it("every illustration and image asset exists", () => {
    const srcs = new Set<string>();
    const walk = (n: unknown): void => {
      if (!n || typeof n === "string") return;
      const o = n as { src?: string; k?: unknown[] };
      if (o.src) srcs.add(o.src);
      o.k?.forEach(walk);
    };
    Object.values(FLAGSHIP_TREES).forEach((t) => { walk(t.desktop); walk(t.mobile); });
    expect(srcs.size).toBeGreaterThan(0);
    for (const s of srcs) expect(existsSync(join(PUBLIC, s)), s).toBe(true);
  });

  it("header products menu links built pages and keeps the rest as text", () => {
    render(<MarketingShell><p>x</p></MarketingShell>);
    const main = screen.getByRole("navigation", { name: "Main" });
    for (const g of PRODUCTS_MENU.groups) expect(main.querySelector(`a[href="${g.href}"]`)).toBeTruthy();
    expect(main.querySelector('a[href="/product/online-booking"]')).toBeTruthy();
    for (const a of Array.from(main.querySelectorAll("a"))) expect(resolves(a.getAttribute("href")!)).toBe(true);
    expect(productLinkFor("Websites")).toBeNull();
  });

  it("sitemap lists every product page", () => {
    const urls = buildMarketingSitemap({ PUBLIC_SITE_URL: "https://x.test" } as unknown as NodeJS.ProcessEnv).map((e) => e.url);
    for (const s of SLUGS) expect(urls).toContain(`https://x.test/product/${s}`);
  });

  it("copy guard: home services only, no competitors, Service Fee wording", () => {
    const text = readFileSync(join(__dirname, "flagship-visuals.ts"), "utf8") + JSON.stringify(PRODUCT_PAGES);
    expect(text).not.toMatch(/jobber|servicetitan|housecall|service fusion|fieldedge|owner\.com|broccoli/i);
    expect(text).not.toMatch(/restaurant|menu|diner|reservation|\btable\b/i);
    expect(text).not.toMatch(/\$1\.99|booking fee|\$399|\$999|\$199/i);
  });
});
