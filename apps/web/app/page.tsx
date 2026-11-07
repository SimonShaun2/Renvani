import { MarketingStructuredData } from "@/src/components/marketing/site/MarketingStructuredData";
import { serializeJsonLd, withMarketingSeo } from "@/src/lib/seo/marketing-metadata";
import { publicSiteUrl } from "@/src/lib/seo/public-site-origin";
import { HOME_SEARCH_COPY, websiteStructuredData } from "@/src/lib/seo/search-foundation";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { HomePage } from "@/src/components/marketing/site/HomePage";
import { MarketingShell } from "@/src/components/marketing/site/MarketingShell";
import { getDefaultRouteForRole } from "@/src/lib/route-access";
import { getServerSession } from "@/src/lib/server-session";

export const metadata: Metadata = withMarketingSeo("/", {
  ...HOME_SEARCH_COPY,
  openGraph: {
    ...HOME_SEARCH_COPY,
    url: "https://getrenvani.com",
    siteName: "Renvani",
    type: "website"
  }
});

export default async function Home() {
  const result = await getServerSession();

  if (result.status === "ok") {
    redirect(getDefaultRouteForRole(result.session.role));
  }

  const website = websiteStructuredData(publicSiteUrl());
  return (
    <MarketingShell>
      <MarketingStructuredData />
      {website ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(website) }} /> : null}
      <HomePage />
    </MarketingShell>
  );
}
