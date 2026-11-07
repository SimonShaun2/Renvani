import { afterEach, describe, expect, it, vi } from "vitest";

import robotsRoute from "@/app/robots";
import { APP_ROUTE_PREFIXES, AUTH_ROUTES, NO_ROLE_SETUP_ROUTES } from "@/src/lib/route-access";
import { isProductionDeployment, PRODUCTION_SITE_ORIGIN, publicSiteUrl } from "./public-site-origin";
import { buildPublicRobots, ROBOTS_DISALLOW } from "./public-sitemap";
import { isCrawlable } from "./robots-match";

const PRODUCTION: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  VERCEL_ENV: "production",
  VERCEL_TARGET_ENV: "production",
  PUBLIC_SITE_URL: PRODUCTION_SITE_ORIGIN
};
const VALUES = [undefined, "", "preview", "development", "staging", "unknown", "production", "Production", " production ", "production\n"] as const;
const label = (value: string | undefined) => value === undefined ? "absent" : JSON.stringify(value);
const CASES = VALUES.flatMap(source => VALUES.map(target => ({
  source, target, sourceLabel: label(source), targetLabel: label(target),
  open: source === "production" && (target === undefined || target === "production")
})));

// This expected inventory is independent of the generated robots list, so omitted categories fail the tests.
const PRIVATE_PREFIXES = [...new Set([
  "/studio", "/api", "/login", "/signup", "/sign-in", "/sign-up", "/verify-email", "/no-access",
  "/app", "/auth", "/onboarding", "/booking-requests", "/pay", "/approve", "/portal", "/review", "/vip",
  ...AUTH_ROUTES, ...NO_ROLE_SETUP_ROUTES, ...APP_ROUTE_PREFIXES
])];
const BOOKING_ACTIONS = ["manage", "confirm", "confirmed", "commit"] as const;

afterEach(() => vi.unstubAllEnvs());

describe("robots deployment identity matrix", () => {
  it.each(CASES)("VERCEL_ENV=$sourceLabel, VERCEL_TARGET_ENV=$targetLabel: open=$open", ({ source, target, open }) => {
    // A configured public hostname must never override missing or conflicting deployment identity.
    for (const configured of [false, true]) {
      const env: NodeJS.ProcessEnv = {
        NODE_ENV: "production",
        ...(source === undefined ? {} : { VERCEL_ENV: source }),
        ...(target === undefined ? {} : { VERCEL_TARGET_ENV: target }),
        ...(configured ? { PUBLIC_SITE_URL: PRODUCTION_SITE_ORIGIN } : {})
      };
      expect(isProductionDeployment(env)).toBe(open);
      const result = buildPublicRobots(env);
      if (open) {
        expect(publicSiteUrl(env)).toBe(PRODUCTION_SITE_ORIGIN);
        expect(result.rules).toEqual([expect.objectContaining({ userAgent: "*", allow: expect.arrayContaining(["/"]) })]);
        expect(result.sitemap).toContain("https://getrenvani.com/sitemap.xml");
        expect(isCrawlable(result, "/growth-check?ref=google")).toBe(true);
      } else {
        expect(publicSiteUrl(env)).toBeNull();
        expect(result).toEqual({ rules: [{ userAgent: "*", disallow: "/" }] });
        expect(result).not.toHaveProperty("sitemap");
        expect(result).not.toHaveProperty("host");
        expect(isCrawlable(result, "/growth-check")).toBe(false);
        expect(isCrawlable(result, "/sitemap.xml")).toBe(false);
      }
    }
    // Exercise the actual Next.js metadata entry point as well as the pure builder.
    vi.stubEnv("VERCEL_ENV", source);
    vi.stubEnv("VERCEL_TARGET_ENV", target);
    vi.stubEnv("PUBLIC_SITE_URL", PRODUCTION_SITE_ORIGIN);
    expect(robotsRoute()).toEqual(buildPublicRobots({ ...PRODUCTION, VERCEL_ENV: source, VERCEL_TARGET_ENV: target }));
  });
});

describe("private path boundaries", () => {
  const robots = buildPublicRobots(PRODUCTION);

  it.each(PRIVATE_PREFIXES)("blocks %s exactly, with a query, and below the path", prefix => {
    for (const suffix of ["$", "?", "/"]) expect(ROBOTS_DISALLOW).toContain(`${prefix}${suffix}`);
    for (const suffix of ["", "?", "?q=1", "/", "/child", "/child?q=1"]) {
      expect(isCrawlable(robots, prefix + suffix), prefix + suffix).toBe(false);
    }
    // Prefix lookalikes are not private directories, e.g. /growth-check must remain allowed.
    if (!prefix.slice(1).includes("/")) expect(isCrawlable(robots, `${prefix}-public-guide`)).toBe(true);
  });

  it.each([
    "/login?redirect=x", "/login?redirect=%2Fdashboard", "/dashboard?tab=summary",
    "/api?operation=health", "/pay?token=example", "/approve?token=example",
    "/review?token=example", "/vip?token=example", "/booking-requests?filter=new"
  ])("blocks query-string regression %s", path => {
    expect(isCrawlable(robots, path)).toBe(false);
  });

  it.each(BOOKING_ACTIONS)("blocks the %s booking action without catching public siblings", action => {
    for (const suffix of ["$", "?", "/"]) expect(ROBOTS_DISALLOW).toContain(`/book/*/${action}${suffix}`);
    for (const slug of ["summit", "another-shop"]) {
      for (const suffix of ["", "?token=example", "/", "/details?token=example"]) {
        const path = `/book/${slug}/${action}${suffix}`;
        expect(isCrawlable(robots, path), path).toBe(false);
      }
      expect(isCrawlable(robots, `/book/${slug}/${action}-guide`)).toBe(true);
    }
  });

  it.each([
    "/", "/growth-check", "/growth-check?ref=google", "/pricing?plan=flex", "/product/growth",
    "/industries/hvac", "/blog?page=2", "/compare/jobber", "/privacy", "/terms",
    "/book/summit", "/book/summit?service=repair", "/book/summit/schedule", "/site/summit",
    "/sitemap.xml", "/sitemap-index.xml", "/sitemap/0.xml", "/robots.txt"
  ])("keeps public URL %s crawlable", path => {
    expect(isCrawlable(robots, path)).toBe(true);
  });

  it("has no duplicate rules or malformed doubled directory separators", () => {
    expect(new Set(ROBOTS_DISALLOW).size).toBe(ROBOTS_DISALLOW.length);
    for (const rule of ROBOTS_DISALLOW) expect(rule).not.toContain("//");
  });
});
