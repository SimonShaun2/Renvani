import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { isPublicRoute } from "@/src/lib/route-access";
import { MARKETING_SITEMAP_PATHS, ROBOTS_ALLOW } from "@/src/lib/seo/public-sitemap";

import { TourPage } from "./TourPage";
import { TOUR_STEPS, tourPath } from "./tour-config";
import { TOUR_TREES } from "./tour-visuals";

afterEach(cleanup);

const APP = join(__dirname, "../../../../app");
const SITE = __dirname;
const STATIC = ["/", "/product", "/how-it-works", "/pricing", "/industries", "/demo", "/growth-check", "/signup", "/login"];
const resolves = (h: string) => STATIC.includes(h) || TOUR_STEPS.some((s) => tourPath(s.slug) === h) || (h.startsWith("/product/") && existsSync(join(APP, "(marketing)/product/[slug]/page.tsx")));
const text = (el: HTMLElement) => (el.textContent ?? "").replace(/\s+/g, " ");

describe("workflow tour", () => {
  it.each(TOUR_STEPS.map((s, i) => [s.slug, i] as const))("renders step %s on desktop + mobile with real links", (slug, i) => {
    const s = TOUR_STEPS[i]!;
    const { container } = render(<TourPage step={s} />);
    expect(container.querySelectorAll("h1")).toHaveLength(2);
    expect(text(container)).toContain("From request");
    expect(text(container)).toContain(s.name);
    // desktop selector: 6 step links, current one marked
    const cur = container.querySelectorAll('a[aria-current="page"]');
    expect(cur).toHaveLength(1);
    expect(cur[0]!.getAttribute("href")).toBe(tourPath(slug));
    for (const t of TOUR_STEPS) expect(container.querySelector(`a[href="${tourPath(t.slug)}"]`)).not.toBeNull();
    const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href")!);
    for (const h of hrefs) expect(resolves(h), h).toBe(true);
    const next = TOUR_STEPS[i + 1];
    const navs = [...container.querySelectorAll("a")].filter((a) => /^Next: /.test(a.textContent ?? ""));
    if (next) expect(navs.map((a) => a.getAttribute("href"))).toEqual([tourPath(next.slug), tourPath(next.slug)]);
    else expect([...container.querySelectorAll("a")].filter((a) => a.textContent === "See it for your business").map((a) => a.getAttribute("href"))).toEqual(["/demo", "/demo"]);
    const prev = [...container.querySelectorAll("a")].filter((a) => a.textContent === "Previous").map((a) => a.getAttribute("href"));
    expect(prev).toEqual(i ? [tourPath(TOUR_STEPS[i - 1]!.slug), tourPath(TOUR_STEPS[i - 1]!.slug)] : []);
  });

  it("every step has a route, is public and is in the sitemap; /product-tour is only a legacy redirect", () => {
    expect(existsSync(join(APP, "(marketing)/tour/page.tsx"))).toBe(true);
    expect(existsSync(join(APP, "(marketing)/tour/[step]/page.tsx"))).toBe(true);
    for (const s of TOUR_STEPS) {
      expect(isPublicRoute(tourPath(s.slug))).toBe(true);
      expect(MARKETING_SITEMAP_PATHS.some((p) => p.path === tourPath(s.slug))).toBe(true);
    }
    expect(isPublicRoute("/tour/nope")).toBe(false);
    expect(ROBOTS_ALLOW.some((r) => r.prefix === "/tour")).toBe(true);
    expect(readFileSync(join(APP, "(marketing)/product-tour/page.tsx"), "utf8")).toMatch(/permanentRedirect\("\/tour"\)/);
  });

  it("no site link points at /product-tour any more", () => {
    for (const f of readdirSync(SITE).filter((f) => /\.tsx?$/.test(f) && !f.includes(".test."))) expect(readFileSync(join(SITE, f), "utf8"), f).not.toContain("/product-tour");
  });

  it("copy guard: home-services only, rulings pricing, no competitors, no restaurant language", () => {
    const all = JSON.stringify(TOUR_TREES);
    expect(all).not.toMatch(/\$1\.99|owner\.com|broccoli|restaurant|menu item|diner|reservation|table for/i);
    expect(all).not.toMatch(/Oct(ober)? 29|29 Oct/i);
    expect(all).toContain("Service Fee · Flex");
  });
});
