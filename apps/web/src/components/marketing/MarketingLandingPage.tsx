import Link from "next/link";

import {
  FEATURE_TILES,
  FOOTER_COLUMNS,
  HERO_COPY,
  MARKETING_BRAND,
  MARKETING_NAV_LINKS,
  PILLARS,
  SWITCHING_COPY
} from "./marketing-copy";

const DEMO_HREF = "mailto:hello@getrenvani.com?subject=Book%20a%20demo";

function SectionEyebrow({ children }: { children: string }) {
  return (
    <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-orange-500">
      <span className="inline-block h-2 w-2 rounded-full bg-orange-500" aria-hidden />
      {children}
    </p>
  );
}

export function MarketingLandingPage() {
  return (
    <div className="bg-white text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-3 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm text-white">R</span>
            <span>{MARKETING_BRAND.name}</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-slate-600 md:flex" aria-label="Primary">
            {MARKETING_NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-slate-900">
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm font-medium">
            <Link href="/login" className="hidden text-slate-600 hover:text-slate-900 sm:inline">
              Sign in
            </Link>
            <Link href="/signup" className="rounded-full bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-800">
              Get started
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center lg:px-10 lg:py-28">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            {HERO_COPY.headline}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">{HERO_COPY.subhead}</p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/30 transition hover:bg-orange-600"
            >
              {HERO_COPY.primaryCta} →
            </Link>
            <a
              href={DEMO_HREF}
              className="inline-flex items-center rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-400"
            >
              {HERO_COPY.secondaryCta}
            </a>
          </div>
        </div>
      </section>

      <section id="why" className="bg-slate-950 py-20 text-white lg:py-28">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <SectionEyebrow>WHY RENVANI</SectionEyebrow>
          <h2 className="text-3xl font-semibold sm:text-4xl">Growth up front. Ops underneath.</h2>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {PILLARS.map((pillar) => (
              <article key={pillar.title} className="rounded-3xl border border-white/10 bg-white/5 p-8">
                <p className="text-sm text-orange-300">{pillar.step}</p>
                <h3 className="mt-2 text-2xl font-semibold">{pillar.title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-slate-300">{pillar.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <SectionEyebrow>EVERY DETAIL</SectionEyebrow>
          <h2 className="text-3xl font-semibold text-slate-950 sm:text-4xl">The full toolbox.</h2>
          <p className="mt-3 text-slate-600">Designed for owners, dispatchers, and techs.</p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURE_TILES.map((feature) => (
              <article key={feature.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <div className="mb-4 h-9 w-9 rounded-xl bg-slate-900/90" aria-hidden />
                <h3 className="font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="switching" className="border-y border-slate-100 bg-slate-50 py-20 lg:py-24">
        <div className="mx-auto max-w-3xl px-6 text-center lg:px-10">
          <SectionEyebrow>SWITCHING</SectionEyebrow>
          <h2 className="text-3xl font-semibold text-slate-950 sm:text-4xl">{SWITCHING_COPY.headline}</h2>
          <p className="mt-4 text-slate-600">{SWITCHING_COPY.body}</p>
        </div>
      </section>

      <section id="get-started" className="bg-slate-950 py-20 text-center text-white">
        <h2 className="text-3xl font-semibold sm:text-5xl">{HERO_COPY.headline}</h2>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <a href={DEMO_HREF} className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold">
            {HERO_COPY.secondaryCta} →
          </a>
          <Link href="/signup" className="rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white">
            {HERO_COPY.primaryCta}
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="flex items-center gap-2 font-semibold">
                <span className="flex h-6 w-6 items-center justify-center rounded bg-slate-900 text-xs text-white">R</span>
                {MARKETING_BRAND.name}
              </p>
              <p className="mt-3 text-sm text-slate-600">{MARKETING_BRAND.tagline}</p>
            </div>
            {FOOTER_COLUMNS.map((column) => (
              <div key={column.title}>
                <p className="text-sm font-semibold text-slate-900">{column.title}</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  {column.links.map((link) => (
                    <li key={link}>{link}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-col gap-4 border-t border-slate-200 pt-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} {MARKETING_BRAND.name}, Inc.</p>
            <p>Privacy · Terms · Security</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
