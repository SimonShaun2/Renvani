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
import { TOOL_GROUPS } from "./platform-config";
import { PRODUCTS_MENU } from "./site-config";

const SLUGS = PRODUCT_PAGES.map((p) => p.slug);
const PUBLIC = join(__dirname, "../../../../public");
const resolves = (h: string) => {
  const path = h.split("#")[0] || "/";
  if (h.startsWith("#")) return true;
  if (path.startsWith("/product/")) return SLUGS.includes(path.slice(9));
  return ["/", "/product", "/how-it-works", "/pricing", "/industries", "/industries/hvac", "/industries/plumbing", "/industries/electrical", "/signup", "/demo", "/growth-check", "/login", "/tour"].includes(path);
};

describe("flagship + product-detail + tool pages (Figma 175:3…175:4156, 215:6308…216:6313)", () => {
  it("registry covers every built frame with desktop + mobile ids", () => {
    expect(SLUGS).toEqual([
      "growth", "revenue", "operations", "retention", "command-center", "online-booking", "estimates-approvals", "scheduling-dispatch",
      "technician-app", "invoices-payments", "service-agreements", "ai-revenue-intelligence", "customers-properties-assets", "onboarding-data-import",
      "inquiry-response-follow-up", "jobs-work-orders", "time-tracking-job-photos", "reminders-win-backs", "reporting-job-sources",
      "websites", "price-book-service-catalog", "customer-portal"
    ]);
    for (const p of PRODUCT_PAGES) expect(p.frames.mobile).toMatch(/^(175|215|216):\d+$/);
  });

  for (const page of PRODUCT_PAGES) {
    it(`renders ${page.slug} with real links only`, () => {
      const { container } = render(<FlagshipPage page={page} />);
      const h1s = screen.getAllByRole("heading", { level: 1 });
      expect(h1s).toHaveLength(2); // desktop (md+) and mobile frame; only one is displayed
      if (page.template === "page") for (const h of h1s) expect(h.textContent?.replace(/\s+/g, "")).toBe(page.headline.replace(/\s+/g, "")); // multi-line headings render as block lines
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
    for (const g of PRODUCTS_MENU.groups) for (const i of g.items) expect(i.href, i.label).toBeTruthy();
    expect(productLinkFor("Websites")).toBe("/product/websites");
    expect(productLinkFor("Technician App & On-the-Way →")).toBe("/product/technician-app");
  });

  it("tool items without a Current-page frame stay plain text (no dead links)", () => {
    expect(productLinkFor("Job Source Reporting →")).toBe("/product/reporting-job-sources");
    for (const l of ["Local Search · Preview →", "Owner App & Approval Rules →", "Owner rules"]) expect(productLinkFor(l), l).toBeNull();
    const tools = [...TOOL_GROUPS.left, ...TOOL_GROUPS.right].flatMap((g) => g.tools);
    for (const t of tools) if (t.href) expect(resolves(t.href), t.href).toBe(true);
    expect(tools.filter((t) => !t.href).map((t) => t.label)).toEqual(["Local Search · Preview →", "Owner App & Approval Rules →"]);
  });

  it("sitemap lists every product page", () => {
    const urls = buildMarketingSitemap({ PUBLIC_SITE_URL: "https://x.test" } as unknown as NodeJS.ProcessEnv).map((e) => e.url);
    for (const s of SLUGS) expect(urls).toContain(`https://x.test/product/${s}`);
  });

  it("copy guard: home services only, no competitors, Service Fee wording", () => {
    // Rendered copy only (text + button labels); layer names like "Icon / menu" and asset paths are not copy.
    const copy: string[] = [];
    const grab = (n: unknown): void => {
      if (typeof n === "string") return void copy.push(n);
      const o = n as { label?: string; k?: unknown[] };
      if (o.label) copy.push(o.label);
      o.k?.forEach(grab);
    };
    Object.values(FLAGSHIP_TREES).forEach((t) => { grab(t.desktop); grab(t.mobile); });
    const text = copy.join("\n") + JSON.stringify(PRODUCT_PAGES);
    expect(readFileSync(join(__dirname, "flagship-visuals.ts"), "utf8")).not.toMatch(/jobber|servicetitan|housecall|owner\.com|broccoli|restaurant/i);
    expect(text).not.toMatch(/jobber|servicetitan|housecall|service fusion|fieldedge|owner\.com|broccoli/i);
    expect(text).not.toMatch(/restaurant|menu|diner|reservation|\btable\b/i);
    expect(text).not.toMatch(/\$1\.99|booking fee|\$399|\$999|\$199/i);
  });
});
