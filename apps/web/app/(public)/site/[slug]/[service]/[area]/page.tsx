import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BrandedInquiryClient } from "@/src/components/growth/BrandedInquiryClient";
import { BrandedLocalSeo } from "@/src/components/growth/BrandedLocalSeo";
import {
  buildBookPath,
  buildBrandedStorefrontViewModel,
  buildLocalBusinessJsonLd
} from "@/src/components/growth/branded-storefront.utils";
import { generateServiceCopy } from "@/src/components/growth/service-pages/copy-providers";
import { resolveServiceAreaPage, serviceAreaPath } from "@/src/components/growth/service-pages/service-area-pages";
import { fetchPublicBookingSettingsBySlug } from "@/src/lib/public-booking-server";
import "@/src/components/growth/service-pages/service-pages-motion.css";

/** Cached: must match SERVICE_PAGE_REVALIDATE_SECONDS (Next needs a literal here). */
export const revalidate = 3600;

type Params = Promise<{ slug: string; service: string; area: string }>;

async function load(params: Params) {
  const { slug, service, area } = await params;
  const settings = await fetchPublicBookingSettingsBySlug(slug).catch(() => null);
  const ref = settings ? resolveServiceAreaPage(settings, service, area) : null;
  if (!settings || !ref) return null;
  const model = buildBrandedStorefrontViewModel(settings);
  const copy = await generateServiceCopy({
    companyName: model.companyName,
    service: ref.service.title,
    area: ref.area,
    priceHint: ref.service.subtitle
  });
  return { slug, settings, ref, model, copy };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const page = await load(params);
  if (!page) return { title: "Page not found" };
  const title = `${page.copy.headline} · ${page.model.companyName}`;
  return {
    title,
    description: page.copy.intro,
    alternates: { canonical: serviceAreaPath(page.slug, page.ref) },
    openGraph: { title, description: page.copy.intro, type: "website" },
    robots: { index: true, follow: true }
  };
}

export default async function ServiceAreaPage({ params }: { params: Params }) {
  const page = await load(params);
  if (!page) notFound();
  const { slug, ref, model, copy } = page;
  const bookHref = buildBookPath(model.bookingSlug, `service-page:${ref.serviceSlug}:${ref.area}`);
  const jsonLd = { ...buildLocalBusinessJsonLd(model, serviceAreaPath(slug, ref)), areaServed: [ref.area] };

  return (
    <div className="min-h-screen bg-[#f7faf8] text-[#0f1530]">
      <BrandedLocalSeo jsonLd={jsonLd} />
      <header className="border-b border-[#e6dccb] px-6 py-5 md:px-16">
        <Link href={`/site/${slug}`} className="text-sm font-semibold text-[#2f7d4f] hover:underline">
          ← {model.companyName}
        </Link>
      </header>
      <main className="mx-auto max-w-3xl space-y-10 px-6 py-10 md:px-0">
        <section data-service-page-reveal className="space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{copy.headline}</h1>
          <p className="text-base leading-7 text-[#5e6684]">{copy.intro}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-[#2a3360]">
            {copy.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
          <Link
            href={bookHref}
            className="inline-flex rounded-[10px] bg-[#2f7d4f] px-5 py-3 text-sm font-semibold text-white hover:bg-[#256641]"
          >
            Book {ref.service.title.toLowerCase()}
          </Link>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Have a question first?</h2>
          <BrandedInquiryClient
            model={model}
            acquisitionSource={`service-page:${ref.serviceSlug}:${ref.area}`}
            initialService={ref.service.title}
            initialZip={ref.area}
          />
        </section>
      </main>
    </div>
  );
}
