import { describe, expect, it } from "vitest";
import { publicSiteUrl } from "./public-site-origin";
import { withMarketingSeo, marketingStructuredData, serializeJsonLd } from "./marketing-metadata";
import { buildFullSitemap, buildSitemapIndexXml, buildPublicRobots, MARKETING_SITEMAP_PATHS } from "./public-sitemap";
const env = (values: Record<string, string>) => values as NodeJS.ProcessEnv;
const prod = env({ VERCEL_ENV: "production", VERCEL_TARGET_ENV: "production", PUBLIC_SITE_URL: "https://getrenvani.com" });

describe("marketing launch SEO", () => {
  it.each(["preview", "development", "staging"])("keeps %s non-indexable even with an inherited production URL", async target => {
    const e = env({ PUBLIC_SITE_URL: "https://getrenvani.com", VERCEL_ENV: target });
    expect(publicSiteUrl(e)).toBeNull();
    expect(buildPublicRobots(e)).toEqual({ rules: [{ userAgent: "*", disallow: "/" }] });
    expect(buildSitemapIndexXml(e)).toBeNull();
    expect(await buildFullSitemap(e)).toEqual([]);
    expect(withMarketingSeo("/pricing", { title: "Pricing" }, e)).toMatchObject({ robots: { index: false, follow: false }, alternates: null });
    expect(marketingStructuredData(e)).toBeNull();
  });
  it("honors a custom non-production target even when the system environment says production", () => {
    expect(publicSiteUrl(env({ ...prod, VERCEL_TARGET_ENV: "qa" }))).toBeNull();
  });
  it("fails closed without configuration and rejects credentials and non-http origins", () => {
    for (const url of ["", "javascript:alert(1)", "https://user:password@example.com", "not-a-url"]) expect(publicSiteUrl(env({ PUBLIC_SITE_URL: url }))).toBeNull();
    expect(withMarketingSeo("/pricing", {title:"Pricing"}, env({})).robots).toEqual({index:false,follow:false});
  });
  it.each(MARKETING_SITEMAP_PATHS)("uses a page-specific canonical for $path", ({path}) => {
    const metadata = withMarketingSeo(path,{title:"Example",description:"Description"},prod);
    expect(metadata.alternates?.canonical).toBe(new URL(path,prod.PUBLIC_SITE_URL).href);
    expect(metadata.robots).toEqual({index:true,follow:true});
    expect(metadata.title).toBe("Example");
  });
  it.each(["//elsewhere.test", "/pricing?email=private", "/pricing#fragment", "/bad\\path"])("rejects unsafe canonical input %s", path => {
    expect(withMarketingSeo(path,{},prod)).toMatchObject({alternates:null,robots:{index:false,follow:false}});
  });
  it("publishes populated sitemaps without requesting any shop unless explicitly opted in",async () => {
    const map=await buildFullSitemap(prod,async()=>{throw Error("No shop calls allowed");});
    expect(map).toHaveLength(MARKETING_SITEMAP_PATHS.length);
    expect(map.some(x=>x.url.includes("/dashboard"))).toBe(false);
    expect(buildSitemapIndexXml(prod)).toContain("https://getrenvani.com/sitemap/0.xml");
  });
  it("provides Organization and SoftwareApplication without invented proof",()=>{
    const data=marketingStructuredData(prod)!;
    expect(data["@graph"].map(x=>x["@type"])).toEqual(["Organization","SoftwareApplication"]);
    expect(JSON.stringify(data)).not.toMatch(/aggregateRating|reviewCount|award|sameAs/);
  });
  it("round-trips JSON while preventing an inline script breakout",()=>{
    const input={value:'</script><script>alert(1)</script>&'};
    const output=serializeJsonLd(input);
    expect(output).not.toContain("<");expect(output).not.toContain(">");
    expect(JSON.parse(output)).toEqual(input);
  });
});
