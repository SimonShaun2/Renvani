import { buildSiteSitemapXml } from "@/src/lib/seo/public-sitemap";

export const revalidate = 3600;

/** Flat sitemap for crawlers: marketing, industries, /blog, posts and /compare pages. Shop pages are in /sitemap-index.xml. */
export async function GET(): Promise<Response> {
  const xml = await buildSiteSitemapXml();
  if (!xml) return new Response("Not found", { status: 404 });
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
