import { describe, expect, it } from "vitest";
import { articleCards, filterResources, findTemplate, PLAYBOOK_PATHS, PLAYBOOK_TEMPLATES, templateCards, templatePath, templateText } from "./playbook";
import { isPublicRoute } from "../route-access";
import { buildMarketingSitemap } from "../seo/public-sitemap";
import { withMarketingSeo } from "../seo/marketing-metadata";
import { SITE_FOOTER, SITE_NAV } from "@/src/components/marketing/site/site-config";
import { GET } from "@/app/(marketing)/resources/templates/[slug]/download/route";
const prod = { NODE_ENV: "production", VERCEL_ENV: "production", PUBLIC_SITE_URL: "https://getrenvani.com" } as unknown as NodeJS.ProcessEnv;

describe("Renvani Playbook", () => {
  it("exposes the hub in the shared header and footer", () => {
    for (const links of [SITE_NAV.links, SITE_FOOTER.links]) expect(links.filter(link => link.href === "/resources")).toHaveLength(1);
  });
  it("has a unique route for every actual template", () => {
    expect(new Set(PLAYBOOK_PATHS).size).toBe(PLAYBOOK_TEMPLATES.length + 1);
    expect(PLAYBOOK_PATHS).toContain("/resources");
  });
  it.each(PLAYBOOK_TEMPLATES)("serves a real editable text download for $slug", async template => {
    expect(findTemplate(template.slug)).toBe(template);
    const response = await GET(new Request("https://example.test"), { params: Promise.resolve({ slug: template.slug }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toContain(`${template.slug}.txt`);
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(await response.text()).toBe(templateText(template));
    expect(template.sections.length).toBeGreaterThanOrEqual(3);
    expect(isPublicRoute(templatePath(template.slug))).toBe(true);
    expect(isPublicRoute(`${templatePath(template.slug)}/download`)).toBe(true);
  });
  it.each(["missing", "../settings", "constructor", "__proto__"])("rejects unknown download %s", async slug => {
    expect(findTemplate(slug)).toBeUndefined();
    expect((await GET(new Request("https://example.test"), { params: Promise.resolve({ slug }) })).status).toBe(404);
  });
  it.each(["/dashboard", "/studio", "/resources/private", "/resources-admin", "/resources/templates/a/private", "/resources/templates/%2e%2e", "/resources/templates/a/download/private"])("does not open unrelated or private path %s", path => {
    expect(isPublicRoute(path)).toBe(false);
  });
  it("only includes page URLs in the production sitemap", () => {
    const urls = buildMarketingSitemap(prod).map(entry => entry.url);
    for (const path of PLAYBOOK_PATHS) expect(urls).toContain(`https://getrenvani.com${path}`);
    expect(urls.some(url => url.endsWith("/download"))).toBe(false);
    expect(buildMarketingSitemap({ ...prod, VERCEL_ENV: "preview" })).toEqual([]);
  });
  it.each(PLAYBOOK_PATHS)("sets route-local SEO and blocks preview indexing for %s", path => {
    expect(withMarketingSeo(path, { title: "Playbook" }, prod).alternates?.canonical).toBe(`https://getrenvani.com${path}`);
    expect(withMarketingSeo(path, {}, { ...prod, VERCEL_ENV: "preview" }).robots).toEqual({ index: false, follow: false });
  });
  it("keeps published article paths and filters malformed or duplicate slugs", () => {
    expect(articleCards([{title:"Guide",slug:"existing-guide"},{title:"Again",slug:"existing-guide"},{title:"Bad",slug:"../admin"}]).map(card=>card.href)).toEqual(["/blog/existing-guide"]);
  });
  it("supports search, clear, and format filtering", () => {
    const resources = [...templateCards(), ...articleCards([{title:"HVAC calls",slug:"hvac-calls"}])];
    expect(filterResources(resources, " DISPATCH ", "template")).toHaveLength(1);
    expect(filterResources(resources, "HVAC", "article")).toHaveLength(1);
    expect(filterResources(resources, "HVAC", "template")).toHaveLength(0);
    expect(filterResources(resources, "")).toHaveLength(resources.length);
  });
});
