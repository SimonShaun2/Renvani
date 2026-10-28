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
import { buildOpeningHours, resolveSiteTrade } from "@/src/components/growth/site-trade.registry";
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

  const title = `Request a quote · ${settings.companyName}`;
  const description = `Send a direct ${resolveSiteTrade(settings).label.toLowerCase()} inquiry to ${settings.companyName}. Local service, transparent consent, no account required.`;

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
    trade: resolveSiteTrade(settings),
    openingHours: buildOpeningHours(settings)
  });

  return (
    <div className="min-h-screen bg-[#f7faf8] text-[#0f1530]">
      <BrandedLocalSeo jsonLd={jsonLd} />
      <header className="border-b border-[#e6dccb] px-6 py-5 md:px-16">
        <Link href={sitePath} className="text-sm font-semibold text-[#2f7d4f] hover:underline">
          ← Back to {model.companyName}
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Request a quote</h1>
      </header>
      <main className="px-6 py-10 md:px-16">
        <BrandedInquiryClient model={model} acquisitionSource={acquisitionSource} />
      </main>
    </div>
  );
}
