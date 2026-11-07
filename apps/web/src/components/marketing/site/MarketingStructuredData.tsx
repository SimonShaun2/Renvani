import { marketingStructuredData, serializeJsonLd } from "@/src/lib/seo/marketing-metadata";

export function MarketingStructuredData() {
  const data = marketingStructuredData();
  if (!data) return null;
  return <script id="renvani-structured-data" type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
