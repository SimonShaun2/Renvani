import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
import {
  hoursChip,
  nearbyServicePages,
  resolveServiceAreaPage,
  serviceAreaPath,
  serviceEyebrow
} from "@/src/components/growth/service-pages/service-area-pages";
import { ServiceInquiryCard } from "@/src/components/growth/service-pages/ServiceInquiryCard";
import { resolveSiteInquiryMode } from "@/src/components/growth/service-pages/site-inquiry";
import { resolveSiteTrade } from "@/src/components/growth/site-trade.registry";
import { fetchPublicBookingSettingsBySlug } from "@/src/lib/public-booking-server";
import "@/src/components/growth/service-pages/service-pages-motion.css";

/** Cached: must match SERVICE_PAGE_REVALIDATE_SECONDS (Next needs a literal here). */
export const revalidate = 3600;

/** Figma 155:79 type: Geist + Geist Mono (scoped to this page; the app shell stays on Inter). */
const GeistSans = Geist({ subsets: ["latin"], display: "swap" });
const GeistMono = Geist_Mono({ subsets: ["latin"], display: "swap" });

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

const NAV = [
  { hash: "#services", label: "Services" },
  { hash: "#pricing", label: "Pricing" },
  { hash: "#areas", label: "Areas we serve" }
] as const;

/** Figma 155:79 "Customer / 03 Service by ZIP – Desktop"; header/footer from 10:2023. Stacks below lg (no mobile frame). */
export default async function ServiceAreaPage({ params }: { params: Params }) {
  const page = await load(params);
  if (!page) notFound();
  const { slug, settings, ref, model, copy } = page;
  const source = `service-page:${ref.serviceSlug}:${ref.area}`;
  const bookHref = buildBookPath(model.bookingSlug, source);
  const sitePath = `/site/${slug}`;
  const jsonLd = { ...buildLocalBusinessJsonLd(model, serviceAreaPath(slug, ref)), areaServed: [ref.area] };
  const hours = hoursChip(settings);
  const nearby = nearbyServicePages(settings, ref);
  const trade = resolveSiteTrade(settings);
  const inquiryMode = resolveSiteInquiryMode();

  return (
    <div className={`${GeistSans.className} min-h-screen bg-[#f7faf8] text-[#0f1530]`}>
      <BrandedLocalSeo jsonLd={jsonLd} />
      <header className="flex flex-wrap items-center gap-4 px-6 py-5 md:gap-7 md:px-16">
        <Link href={sitePath} className="flex flex-1 items-center gap-2.5">
          {model.logoUrl ? (
            <img src={model.logoUrl} alt="" className="size-8 rounded-[9px] object-cover" />
          ) : (
            <span className="size-8 rounded-[9px] bg-[#2f7d4f]" aria-hidden />
          )}
          <span className="text-xl font-semibold">{model.companyName}</span>
        </Link>
        <nav aria-label="Site" className="flex flex-wrap items-center gap-5 text-sm text-[#2a3360]">
          {NAV.map((item) => (
            <Link key={item.hash} href={`${sitePath}${item.hash}`} className="hover:text-[#0f1530]">
              {item.label}
            </Link>
          ))}
          <Link href={`/book/${encodeURIComponent(model.bookingSlug)}/manage`} className="hover:text-[#0f1530]">
            My account
          </Link>
        </nav>
        <Link
          href={bookHref}
          className="inline-flex h-11 items-center rounded-[10px] bg-[#2f7d4f] px-[18px] text-sm font-semibold text-white hover:bg-[#286b44]"
        >
          Book a service
        </Link>
      </header>

      <main className="grid gap-10 px-6 py-10 md:px-16 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-16 lg:py-14">
        <section data-service-page-reveal className="max-w-[640px]">
          <p className={`${GeistMono.className} text-[12px] font-medium uppercase tracking-[0.08em] text-[#2f7d4f]`}>
            {serviceEyebrow(model.companyName, settings)}
          </p>
          <h1 className="mt-4 text-[40px] font-semibold leading-[1.1] tracking-tight md:text-[56px]">{copy.headline}</h1>
          <p className="mt-6 text-[20px] font-semibold text-[#2a3360]">{model.companyName}</p>
          <p className="mt-4 text-[18px] leading-[1.5] text-[#2a3360]">{copy.intro}</p>
          {hours || model.phone ? (
            <div className="mt-4 flex flex-wrap gap-2 text-[12px] text-[#2f7d4f]">
              {hours ? <span className="rounded-[6px] bg-[#e4f1e8] px-2.5 py-1.5">{hours}</span> : null}
              {model.phone ? (
                <a href={`tel:${model.phone.replace(/[^\d+]/g, "")}`} className="rounded-[6px] bg-[#e4f1e8] px-2.5 py-1.5">
                  {model.phone}
                </a>
              ) : null}
            </div>
          ) : null}
          <Link
            href={bookHref}
            className="mt-6 inline-flex h-12 items-center rounded-[10px] bg-[#2f7d4f] px-6 text-[15px] font-semibold text-white hover:bg-[#286b44]"
          >
            Book
          </Link>
          {nearby.length ? (
            <div className="mt-10">
              <h2 className="text-[18px] font-semibold">Nearby services</h2>
              <ul className="mt-3 flex flex-wrap gap-2.5">
                {nearby.map((p) => (
                  <li key={p.serviceSlug}>
                    <Link
                      href={serviceAreaPath(slug, p)}
                      className="inline-flex rounded-[8px] border border-[#dfe6e1] bg-white px-3 py-2 text-[13px] text-[#0f1530] hover:border-[#2f7d4f]"
                    >
                      {p.service.title} in {p.area} →
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <aside aria-label="Ask a question" className="lg:w-[360px]">
          {inquiryMode === "inquiry-api" ? (
            <ServiceInquiryCard slug={model.bookingSlug} service={ref.service.title} zip={ref.area} />
          ) : (
            <div className="rounded-[14px] border border-[#dfe6e1] bg-white p-4">
              <h2 className="mb-3 text-[18px] font-semibold">Ask a question</h2>
              <BrandedInquiryClient
                model={model}
                acquisitionSource={source}
                initialService={ref.service.title}
                initialZip={ref.area}
                serviceCategory={trade.label}
              />
            </div>
          )}
        </aside>
      </main>

      <footer className="flex flex-col gap-2 px-6 py-7 text-[13px] text-[#5e6684] md:flex-row md:items-center md:justify-between md:px-16">
        <p>© {model.companyName}</p>
        <p className={`${GeistMono.className} text-[11px] tracking-wide`}>Powered by Renvani</p>
      </footer>
    </div>
  );
}
