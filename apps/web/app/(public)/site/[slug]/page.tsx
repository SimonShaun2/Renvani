import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BrandedLocalSeo } from "@/src/components/growth/BrandedLocalSeo";
import { BrandedStorefront } from "@/src/components/growth/BrandedStorefront";
import {
  buildBrandedStorefrontViewModel,
  buildLocalBusinessJsonLd
} from "@/src/components/growth/branded-storefront.utils";
import { buildOpeningHours, buildSiteMetadataCopy } from "@/src/components/growth/site-trade.registry";
import { resolveSiteTradeFromSettings } from "@/src/components/growth/site-trade.from-settings";
import { fetchPublicBookingSettingsBySlug } from "@/src/lib/public-booking-server";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const settings = await fetchPublicBookingSettingsBySlug(slug).catch(() => null);

  if (!settings) {
    return { title: "Business not found" };
  }

  const { title, description, keywords } = buildSiteMetadataCopy(settings);

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    robots: { index: true, follow: true },
    keywords
  };
}

export default async function BrandedWebsitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const settings = await fetchPublicBookingSettingsBySlug(slug).catch(() => null);

  if (!settings) {
    notFound();
  }

  const model = buildBrandedStorefrontViewModel(settings);
  const sitePath = `/site/${slug}`;
  const jsonLd = buildLocalBusinessJsonLd(model, sitePath, {
    trade: resolveSiteTradeFromSettings(settings),
    openingHours: buildOpeningHours(settings)
  });

  return (
    <>
      <BrandedLocalSeo jsonLd={jsonLd} />
      <BrandedStorefront model={model} />
    </>
  );
}
