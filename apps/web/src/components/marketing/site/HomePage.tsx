import Link from "next/link";

import { GROWTH_CHECK_ENTRY, HOME } from "./site-config";
import styles from "./site.module.css";

const ink = "var(--color-mkt-ink)";
const ink2 = "var(--color-mkt-ink2)";
const line = "var(--color-mkt-line)";
const eyebrow = "text-[11px] font-medium tracking-[1.1px]";
const h2 = "text-[34px] font-semibold leading-[1.08] tracking-[-0.85px] md:text-[48px] md:tracking-[-1.2px]";
const section = "mx-auto flex max-w-[1440px] flex-col gap-8 px-6 py-12 md:px-20 md:py-20";
const card = "flex flex-col gap-4 rounded-2xl border bg-white p-5";

function Lines({ lines }: { lines: readonly string[] }) {
  return (
    <>
      {lines.map((l, i) => (
        <span key={l} className="block">
          {l}
          {i < lines.length - 1 ? " " : ""}
        </span>
      ))}
    </>
  );
}

function Chip({ children, tone = "white" }: { children: React.ReactNode; tone?: "white" | "ink" | "cream" | "amber" | "ambersoft" | "green" }) {
  const bg = { white: "#fff", ink, cream: "var(--color-mkt-cream)", amber: "var(--color-mkt-amber)", ambersoft: "var(--color-mkt-amber-soft)", green: "var(--color-mkt-green-soft)" }[tone];
  return (
    <span className="inline-flex h-[27px] items-center rounded-xl px-[10px] text-[10px] font-medium" style={{ background: bg, color: tone === "ink" ? "#fff" : ink }}>
      {children}
    </span>
  );
}

function UiAction({ children, tone = "ink", wide = true }: { children: React.ReactNode; tone?: "ink" | "amber" | "cream"; wide?: boolean }) {
  const bg = { ink, amber: "var(--color-mkt-amber)", cream: "var(--color-mkt-cream)" }[tone];
  return (
    <span className={`flex h-[38px] items-center justify-center rounded-xl px-[14px] text-[12px] font-medium ${wide ? "w-full" : ""}`} style={{ background: bg, color: tone === "ink" ? "#fff" : ink }}>
      {children}
    </span>
  );
}

function ProductChrome({ title }: { title: string }) {
  return (
    <div className="flex h-[54px] items-center gap-4 px-4" style={{ background: ink, color: "#fff" }}>
      <span className="w-[120px] text-[17px] font-bold">Renvani</span>
      <span className="flex-1 text-[12px] font-medium">{title}</span>
      <Chip tone="amber">EXAMPLE</Chip>
    </div>
  );
}

/** Website input + Growth Check CTA (203:4410 / 203:4569). No intake endpoint yet; posts to sign-up. */
export function GrowthCheckEntry({ id }: { id: string }) {
  return (
    <form action={GROWTH_CHECK_ENTRY.action} method="get" className="flex w-full max-w-[480px] flex-col items-start gap-3" aria-labelledby={`${id}-label`}>
      <label id={`${id}-label`} htmlFor={id} className={eyebrow} style={{ color: ink2 }}>
        {GROWTH_CHECK_ENTRY.label}
      </label>
      <input
        id={id}
        name="website"
        type="text"
        inputMode="url"
        autoComplete="url"
        placeholder={GROWTH_CHECK_ENTRY.placeholder}
        className="h-14 w-full rounded-xl border bg-white px-4 text-[15px] outline-none focus-visible:ring-2"
        style={{ borderColor: line, color: ink }}
      />
      <button type="submit" className={`${styles.press} inline-flex min-h-[44px] items-center rounded-full px-5 text-[15px] font-medium`} style={{ background: "var(--color-mkt-amber)", color: ink }}>
        {GROWTH_CHECK_ENTRY.submit}
      </button>
      <Link href={GROWTH_CHECK_ENTRY.secondary.href} className="text-[13px] font-medium" style={{ color: ink2 }}>
        {GROWTH_CHECK_ENTRY.secondary.label}
      </Link>
    </form>
  );
}

function SiteVisual() {
  const s = HOME.site;
  return (
    <div data-node-id="200:46" className="overflow-hidden rounded-2xl border" style={{ background: "var(--color-mkt-panel)", borderColor: line }} aria-label="Example: website and booking" role="img">
      <ProductChrome title="Website + booking" />
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <p className="text-[23px] font-semibold">Website + booking</p>
          <Chip>Your business</Chip>
        </div>
        <div className="grid gap-5 sm:grid-cols-[286fr_366fr]">
          <div className="flex flex-col gap-3">
            <img src="/marketing/home/hvac-tech.jpg" alt="" width={572} height={336} className="h-[168px] w-full rounded-2xl object-cover" fetchPriority="high" />
            <p className="text-[26px] font-bold">{s.business}</p>
            <p className="text-[12px]" style={{ color: ink2 }}>{s.trade}</p>
            <p className="text-[20px] font-semibold">{s.tagline}</p>
            <Chip>{s.area}</Chip>
          </div>
          <div className="flex flex-col gap-[14px] rounded-2xl border bg-white p-5" style={{ borderColor: line }}>
            <p className="text-[21px] font-semibold">Book a visit</p>
            <p className="text-[12px]" style={{ color: ink2 }}>Choose your service</p>
            {s.services.map((svc) => (
              <div key={svc.name} className="flex justify-between rounded-xl p-3 text-[13px] font-medium" style={{ background: svc.selected ? "var(--color-mkt-amber-soft)" : "var(--color-mkt-panel)" }}>
                <span>{svc.name}</span>
                <span>{svc.price}</span>
              </div>
            ))}
            <p className="text-[12px] font-medium">{s.day}</p>
            <div className="grid grid-cols-2 gap-[10px]">
              <Chip tone="ink">{s.slots[0]}</Chip>
              <Chip tone="cream">{s.slots[1]}</Chip>
            </div>
            <UiAction tone="amber">{s.action}</UiAction>
          </div>
        </div>
      </div>
    </div>
  );
}

function IntelligenceVisual() {
  const v = HOME.intelligence;
  return (
    <div data-node-id="200:386" className="overflow-hidden rounded-2xl border" style={{ background: "var(--color-mkt-panel)", borderColor: line, color: ink }} aria-label="Example: revenue opportunities" role="img">
      <ProductChrome title="Revenue opportunities" />
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <p className="text-[25px] font-semibold">Revenue opportunities</p>
          <Chip>Your business</Chip>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {v.stats.map((st) => (
            <div key={st.label} className="flex flex-col gap-4 rounded-2xl border bg-white p-5" style={{ borderColor: line }}>
              <span className="text-[37px] font-bold leading-[1.08]">{st.value}</span>
              <span className="text-[12px]" style={{ color: ink2 }}>{st.label}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-4 rounded-2xl border bg-white p-5" style={{ borderColor: line }}>
          <div className="flex items-start justify-between gap-4">
            <p className="text-[19.6px] font-semibold">{v.decision.title}</p>
            <Chip tone="ambersoft">{v.decision.status}</Chip>
          </div>
          <p className="text-[13px]" style={{ color: ink2 }}>{v.decision.detail}</p>
          <div className="flex flex-wrap gap-3">
            {v.decision.actions.map((a, i) => (
              <UiAction key={a} tone={i === 0 ? "ink" : "cream"} wide={false}>
                <span className="px-4">{a}</span>
              </UiAction>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function JourneyCards() {
  return (
    <div data-node-id="203:4462" className="grid gap-6 lg:grid-cols-3">
      <div className={`${card} ${styles.lift}`} style={{ borderColor: line }}>
        <p className={eyebrow} style={{ color: ink2 }}>01 / WEBSITE BOOKING</p>
        <p className="text-[22px] font-semibold">A direct path to your next job.</p>
        <img src="/marketing/home/hvac-tech.jpg" alt="" width={740} height={264} className="h-[132px] w-full rounded-2xl object-cover" />
        <p className="text-[15px] font-semibold">AC tune-up · $89</p>
        <div className="grid grid-cols-2 gap-[10px]">
          <Chip tone="ambersoft">Thu 10–12</Chip>
          <Chip tone="cream">Fri 9–11</Chip>
        </div>
        <UiAction>Request visit</UiAction>
      </div>
      <div className={`${card} ${styles.lift}`} style={{ borderColor: line }}>
        <p className={eyebrow} style={{ color: ink2 }}>02 / THE WORK</p>
        <p className="text-[22px] font-semibold">The details travel with the job.</p>
        <img src="/marketing/home/tech-job-context.jpg" alt="" width={740} height={264} className="h-[132px] w-full rounded-2xl object-cover" />
        <div className="flex items-start gap-3">
          <Chip tone="ink">MR</Chip>
          <p className="text-[12px] font-medium leading-[1.38]">
            <span className="block">Maya R.</span>
            <span className="block">AC diagnostic · 10–12</span>
          </p>
        </div>
        <div className="flex items-start gap-2 rounded-xl p-3 text-[12px]" style={{ background: "var(--color-mkt-green-soft)" }}>
          <img src="/marketing/home/icon-check.svg" alt="" width={19} height={19} />
          <span>Checklist + photos saved</span>
        </div>
      </div>
      <div className={`${card} ${styles.lift}`} style={{ borderColor: line }}>
        <p className={eyebrow} style={{ color: ink2 }}>03 / THE NEXT VISIT</p>
        <p className="text-[22px] font-semibold">One good job. Another reason to return.</p>
        <div className="flex flex-col gap-3 rounded-2xl p-5 text-white" style={{ background: ink }}>
          <p className="text-[18px] font-semibold">Home Comfort Plan</p>
          <p className="text-[12px]">2 tune-ups each year</p>
          <div className="flex gap-5">
            <p className="w-20 text-[34px] font-bold leading-[1.08]" style={{ color: "var(--color-mkt-amber)" }}>
              <span className="block">NOV</span>
              <span className="block">12</span>
            </p>
            <p className="text-[15px] font-medium">Fall heating tune-up</p>
          </div>
        </div>
        <div>
          <Chip tone="green">Reminder email ready</Chip>
        </div>
        <UiAction>Review reminder</UiAction>
      </div>
    </div>
  );
}

/** Home / Desktop 171:3, Home / Mobile 171:197, Home / Tablet 253:6780. Server component. */
export function HomePage() {
  const { hero, trades, journey, intelligence, work, capture } = HOME;
  return (
    <>
      <section data-node-id="203:4403" className={section} aria-labelledby="home-hero">
        <div className="grid items-start gap-12 lg:grid-cols-[480px_1fr] lg:gap-16">
          <div className="flex flex-col gap-6">
            <p className={eyebrow} style={{ color: ink2 }}>{hero.eyebrow}</p>
            <h1 id="home-hero" className="flex flex-col gap-2">
              <span className="text-[44px] font-semibold leading-[1.08] tracking-[-1.1px] md:text-[61px] md:tracking-[-1.525px]">{hero.headline}</span>
              <span className="text-[46px] leading-[1.08] tracking-[-1.15px] md:text-[64px] md:tracking-[-1.6px]" style={{ fontFamily: "var(--font-mkt-serif), Georgia, serif", fontStyle: "italic", fontWeight: 400 }}>
                <Lines lines={hero.accent} />
              </span>
            </h1>
            <p className="text-[17px]" style={{ color: ink2 }}>{hero.body}</p>
            <GrowthCheckEntry id="growth-check-hero" />
          </div>
          <figure className="flex flex-col gap-3">
            <SiteVisual />
            <figcaption className="text-[11px]" style={{ color: ink2 }}>{hero.caption}</figcaption>
          </figure>
        </div>
      </section>

      <section data-node-id="203:4455" style={{ background: "var(--color-mkt-sand)" }} aria-label="Trades">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-6 py-10 md:flex-row md:gap-8 md:px-10">
          <p className={`${eyebrow} md:w-[300px]`} style={{ color: ink2 }}>{trades.eyebrow}</p>
          <div className="flex gap-6 text-[15px] font-medium">
            {trades.links.map((l) => (
              <Link key={l.label} href={l.href} className="md:w-[170px]">{l.label}</Link>
            ))}
          </div>
        </div>
      </section>

      <section data-node-id="203:4460" className="bg-white" aria-labelledby="home-journey">
        <div className={section}>
          <h2 id="home-journey" className={h2}><Lines lines={journey.headline} /></h2>
          <JourneyCards />
          <Link href={journey.more.href} className="text-[15px] font-medium">{journey.more.label}</Link>
        </div>
      </section>

      <section data-node-id="203:4501" style={{ background: ink }} aria-labelledby="home-intel">
        <div className={section}>
          <div className="grid items-start gap-12 lg:grid-cols-[448px_1fr]">
            <div className="flex flex-col items-start gap-6 text-white">
              <p className={eyebrow} style={{ color: "var(--color-mkt-amber)" }}>{intelligence.eyebrow}</p>
              <h2 id="home-intel" className={h2}><Lines lines={intelligence.headline} /></h2>
              <p className="text-[17px]">{intelligence.body}</p>
              <Link href={intelligence.cta.href} className={`${styles.press} inline-flex min-h-[44px] items-center rounded-full px-5 text-[15px] font-medium`} style={{ background: "var(--color-mkt-amber)", color: ink }}>
                {intelligence.cta.label}
              </Link>
            </div>
            <IntelligenceVisual />
          </div>
          <nav aria-label="Product areas" className="flex flex-wrap gap-x-4 gap-y-3 text-[14px] font-medium text-white">
            {intelligence.areas.map((a) => (
              <Link key={a.label} href={a.href} className="md:w-[220px]">{a.label}</Link>
            ))}
          </nav>
        </div>
      </section>

      <section data-node-id="203:4550" aria-labelledby="home-work">
        <div className={section}>
          <h2 id="home-work" className={h2}><Lines lines={work.headline} /></h2>
          <div className="grid gap-8 md:grid-cols-2">
            {work.trades.map((t) => (
              <div key={t.eyebrow} className="flex flex-col gap-4">
                <img src={t.image} alt="" width={1248} height={660} className="h-[240px] w-full rounded-2xl object-cover md:h-[330px]" />
                <p className={eyebrow} style={{ color: ink2 }}>{t.eyebrow}</p>
                <h3 className="text-[24px] font-semibold md:text-[30px]">{t.title}</h3>
                <Link href={t.href} className="text-[14px] font-medium" style={{ color: ink2 }}>See the workflow →</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section data-node-id="203:4563" style={{ background: "var(--color-mkt-amber-soft)" }} aria-labelledby="home-capture">
        <div className={section}>
          <div className="grid items-start gap-10 lg:grid-cols-[700px_480px] lg:gap-16">
            <div className="flex flex-col gap-4">
              <p className={eyebrow} style={{ color: ink2 }}>{capture.eyebrow}</p>
              <h2 id="home-capture" className={h2}><Lines lines={capture.headline} /></h2>
              <p className="text-[16px]" style={{ color: ink2 }}>{capture.body}</p>
            </div>
            <GrowthCheckEntry id="growth-check-footer" />
          </div>
        </div>
      </section>
    </>
  );
}
