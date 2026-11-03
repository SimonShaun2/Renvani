import { buildSitemapIndexXml } from "@/src/lib/seo/public-sitemap";

export const revalidate = 3600;

export function GET(): Response {
  const xml = buildSitemapIndexXml();
  if (!xml) return new Response("Not found", { status: 404 });
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
