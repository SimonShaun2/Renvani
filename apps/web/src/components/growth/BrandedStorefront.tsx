import Link from "next/link";

import { BrandedPriceWidget } from "@/src/components/growth/BrandedPriceWidget";
import { BrandedStorefrontNav } from "@/src/components/growth/BrandedStorefrontNav";
import {
  buildBookPath,
  buildInquirePath,
  type BrandedStorefrontViewModel
} from "@/src/components/growth/branded-storefront.utils";

interface BrandedStorefrontProps {
  model: BrandedStorefrontViewModel;
  previewBanner?: string | null;
}

const PRIMARY = "bg-[#2f7d4f] hover:bg-[#286b44]";

export function BrandedStorefront({ model, previewBanner }: BrandedStorefrontProps) {
  const bookHref = buildBookPath(model.bookingSlug);
  const inquireHref = buildInquirePath(model.bookingSlug);
  const showReviewsLink = model.reviewLinks.length > 0;
  const hasServices = model.intakeMode === "bookable" && model.serviceCards.length > 0;
  const primaryHref = hasServices ? bookHref : inquireHref;
  const primaryLabel = hasServices ? "Book a service" : "Send an inquiry";

  return (
    <div className="min-h-screen bg-[#f7faf8] text-[#0f1530]">
      {previewBanner ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-950">
          {previewBanner}
        </div>
      ) : null}

      <header className="relative flex flex-wrap items-center gap-4 px-6 py-5 md:gap-7 md:px-16">
        <div className="flex flex-1 items-center gap-2.5">
          {model.logoUrl ? (
            <img src={model.logoUrl} alt="" className="size-8 rounded-[9px] object-cover" />
          ) : (
            <div className="size-8 rounded-[9px] bg-[#2f7d4f]" aria-hidden />
          )}
          <p className="text-xl font-semibold">{model.companyName}</p>
        </div>

        <BrandedStorefrontNav
          primaryHref={primaryHref}
          primaryLabel={primaryLabel}
          inquireHref={inquireHref}
          showReviewsLink={showReviewsLink}
          showPricing={hasServices}
          primaryClassName={PRIMARY}
        />

        <Link
          href={primaryHref}
          className={`hidden h-11 items-center justify-center rounded-[10px] px-[18px] text-sm font-semibold text-white lg:inline-flex ${PRIMARY}`}
        >
          {primaryLabel}
        </Link>
      </header>

      <section className="flex flex-col gap-10 px-6 py-10 md:flex-row md:items-center md:gap-12 md:px-16 md:py-14">
        <div className="max-w-[620px] flex-1">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-[#2f7d4f]">
            {model.eyebrow}
          </p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight md:text-[56px] md:leading-[62px]">
            {model.headline}
          </h1>
          <p className="mt-5 max-w-[560px] text-lg leading-7 text-[#2a3360]">{model.tagline}</p>
        </div>
        <div id={hasServices ? "pricing" : undefined} className="flex w-full justify-center md:justify-end">
          {hasServices ? (
            <BrandedPriceWidget bookingSlug={model.bookingSlug} primaryClassName={PRIMARY} />
          ) : (
            <div className="w-full max-w-[460px] rounded-[14px] border border-[#e6dccb] bg-white p-7">
              <h2 className="text-[22px] font-semibold text-[#0f1530]">Tell us what you need</h2>
              <p className="mt-2 text-sm text-[#5e6684]">The team will confirm available services and the next step.</p>
              <Link href={inquireHref} className={`mt-5 inline-flex h-[52px] w-full items-center justify-center rounded-[10px] text-sm font-semibold text-white ${PRIMARY}`}>
                Send an inquiry
              </Link>
            </div>
          )}
        </div>
      </section>

      <section id="services" className="grid gap-4 px-6 pb-4 md:grid-cols-2 md:px-16 lg:grid-cols-4">
        {hasServices ? model.serviceCards.map((card) => (
          <article key={card.id} className="rounded-[14px] border border-[#e6dccb] bg-white p-5">
            <h3 className="text-[17px] font-semibold">{card.title}</h3>
            <p className="mt-1.5 text-sm text-[#5e6684]">{card.subtitle}</p>
          </article>
        )) : (
          <p className="text-sm text-[#5e6684]">Services are confirmed after you send an inquiry.</p>
        )}
      </section>

      <section id="areas" className="px-6 py-8 md:px-16">
        <h2 className="text-xl font-semibold text-[#0f1530]">Areas we serve</h2>
        <p className="mt-2 text-sm leading-6 text-[#5e6684]">{model.serviceAreaSummary}</p>
        <p className="mt-3 text-sm text-[#5e6684]">
          {hasServices ? "Available times and any confirmed price appear in the booking flow. Prefer a callback? " : "Need help with a service request? "}
          <Link href={inquireHref} className="font-medium text-[#2f7d4f] hover:underline">
            Send an inquiry
          </Link>
          .
        </p>
        <p className="mt-4 text-xs text-[#5e6684]">
          This Renvani-hosted page works alongside your existing website and domain — no incumbent sync or migration
          required.
        </p>
      </section>

      <section id="inquire" className="border-t border-[#e6dccb] bg-white px-6 py-10 md:px-16">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-[#0f1530]">Have a question about service?</h2>
            <p className="mt-2 max-w-xl text-sm text-[#5e6684]">
              Send an inquiry. The team will review it and confirm the next step before anything is scheduled.
            </p>
          </div>
          <Link
            href={inquireHref}
            className="inline-flex h-12 shrink-0 items-center justify-center rounded-[10px] border border-[#2f7d4f] px-6 text-sm font-semibold text-[#2f7d4f] hover:bg-[#e4f1e8]"
          >
            Send an inquiry
          </Link>
        </div>
      </section>

      {showReviewsLink ? (
        <section id="reviews" className="px-6 pb-10 md:px-16" aria-labelledby="reviews-heading">
          <h2 id="reviews-heading" className="text-xl font-semibold text-[#0f1530]">
            Reviews
          </h2>
          <p className="mt-2 text-sm text-[#5e6684]">
            Read what customers have shared on these verified profiles.
          </p>
          <ul className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
            {model.reviewLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[15px] font-medium text-[#2f7d4f] underline-offset-2 hover:underline"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="flex flex-col gap-2 px-6 py-7 text-[13px] text-[#5e6684] md:flex-row md:items-center md:justify-between md:px-16">
        <p>
          © {model.companyName}
          {model.phone ? ` · ${model.phone}` : ""}
        </p>
        <p className="font-mono text-[11px] tracking-wide">Powered by Renvani</p>
      </footer>
    </div>
  );
}
