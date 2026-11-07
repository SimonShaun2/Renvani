import { describe, expect, it } from "vitest";
import { INDUSTRY_PAGES } from "@/src/components/marketing/site/industry-registry";
import { PRODUCT_PAGES } from "@/src/components/marketing/site/flagship-registry";
import { publicSiteUrl } from "./public-site-origin";
import { serializeJsonLd, withMarketingSeo } from "./marketing-metadata";
import { HOME_SEARCH_COPY, INDUSTRY_SEARCH_COPY, PRODUCT_SEARCH_TITLES, industrySearchCopy, productSearchCopy,
  breadcrumbStructuredData, websiteStructuredData } from "./search-foundation";

const prod = { VERCEL_ENV: "production", VERCEL_TARGET_ENV: "production", PUBLIC_SITE_URL: "https://getrenvani.com" } as unknown as NodeJS.ProcessEnv;
describe("search foundation route integration", () => {
  it("covers exactly the shipped route inventories", () => {
    expect(Object.keys(INDUSTRY_SEARCH_COPY).sort()).toEqual(INDUSTRY_PAGES.map(p => p.slug).sort());
    expect(Object.keys(PRODUCT_SEARCH_TITLES).sort()).toEqual(PRODUCT_PAGES.map(p => p.slug).sort());
  });
  it.each(INDUSTRY_PAGES)("preserves canonical and breadcrumb identity for $slug", page => {
    const metadata = withMarketingSeo(page.href, industrySearchCopy(page), prod);
    expect(metadata.alternates?.canonical).toBe(`${prod.PUBLIC_SITE_URL}${page.href}`);
    expect(metadata.robots).toEqual({ index: true, follow: true });
    const data = breadcrumbStructuredData(publicSiteUrl(prod), [{ name: "Industries", path: "/industries" }, { name: page.name, path: page.href }]);
    expect(data?.itemListElement[1]).toMatchObject({ position: 2, name: page.name, item: `${prod.PUBLIC_SITE_URL}${page.href}` });
  });
  it.each(PRODUCT_PAGES)("keeps approved product description for $slug", page => {
    const copy = productSearchCopy(page);
    expect(copy.description).toBe(page.body);
    expect(withMarketingSeo(`/product/${page.slug}`, copy, prod).alternates?.canonical).toBe(`${prod.PUBLIC_SITE_URL}/product/${page.slug}`);
  });
  it.each([undefined, "preview", "development", "staging"])("fails closed for deployment %s", target => {
    const env = { ...prod, VERCEL_ENV: target };
    expect(withMarketingSeo("/", HOME_SEARCH_COPY, env)).toMatchObject({ alternates: null, robots: { index: false, follow: false } });
    expect(websiteStructuredData(publicSiteUrl(env))).toBeNull();
    expect(breadcrumbStructuredData(publicSiteUrl(env), [{ name: "Industries", path: "/industries" }, { name: "HVAC", path: "/industries/hvac" }])).toBeNull();
  });
  it("escapes structured data before rendering it in HTML", () => {
    const data = breadcrumbStructuredData(publicSiteUrl(prod), [{ name: "Industries", path: "/industries" }, { name: "</script><script>alert(1)</script>", path: "/industries/hvac" }]);
    const serialized = serializeJsonLd(data);
    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toEqual(data);
  });
  it("links the homepage WebSite to the existing Organization identity without invented proof", () => {
    expect(websiteStructuredData(publicSiteUrl(prod))).toMatchObject({ "@type": "WebSite", publisher: { "@id": `${prod.PUBLIC_SITE_URL}/#organization` } });
    expect(JSON.stringify(websiteStructuredData(publicSiteUrl(prod)))).not.toMatch(/aggregateRating|reviewCount|SearchAction|offers|sameAs/);
  });
});
