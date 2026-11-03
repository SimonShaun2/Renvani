import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BrandedInquiryClient } from "@/src/components/growth/BrandedInquiryClient";
import { BrandedLocalSeo } from "@/src/components/growth/BrandedLocalSeo";
import {
  BRANDED_ACQUISITION_SOURCE,
  buildBrandedStorefrontViewModel,
  buildLocalBusinessJsonLd
} from "@/src/components/growth/branded-storefront.utils";
import { resolveSiteTradeFromSettings } from "@/src/components/growth/site-trade.from-settings";
import { fetchPublicBookingSettingsBySlug } from "@/src/lib/public-booking-server";
import { isWebAssistantEnabled } from "@fsm/config/feature-flags";

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

  const title = `Tell us what you need · ${settings.companyName}`;
  const description = `Send a direct ${resolveSiteTradeFromSettings(settings).label.toLowerCase()} inquiry to ${settings.companyName}. Local service, transparent consent, no account required.`;

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    robots: { index: true, follow: true }
  };
}

export default async function BrandedInquiryPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ src?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const settings = await fetchPublicBookingSettingsBySlug(slug).catch(() => null);

  if (!settings) {
    notFound();
  }

  const model = buildBrandedStorefrontViewModel(settings);
  const acquisitionSource = query.src?.trim() || BRANDED_ACQUISITION_SOURCE;
  const sitePath = `/site/${slug}`;
  const jsonLd = buildLocalBusinessJsonLd(model, sitePath, {
    trade: resolveSiteTradeFromSettings(settings)
  });

  return (
    <div className="min-h-screen bg-[#fbf6ef] text-[#0f1530]">
      <BrandedLocalSeo jsonLd={jsonLd} />
      <header className="mx-auto w-full max-w-[592px] px-4 pt-6 md:pt-14">
        <Link href={sitePath} className="text-sm font-semibold text-[#0f1530] underline">
          ← Back to {model.companyName}
        </Link>
        <h1 className="mt-4 text-[32px] font-semibold leading-[1.45]">Tell us what you need</h1>
      </header>
      <main className="px-4 pb-12 pt-5">
        <BrandedInquiryClient
          model={model}
          acquisitionSource={acquisitionSource}
          serviceCategory={resolveSiteTradeFromSettings(settings).label}
          assistantEnabled={isWebAssistantEnabled()}
        />
      </main>
    </div>
  );
}
