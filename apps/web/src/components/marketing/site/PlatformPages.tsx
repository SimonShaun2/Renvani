import Link from "next/link";

import { ConnectedPlatform } from "./ConnectedPlatform";
import { MaybeLink } from "./MaybeLink";
import { HOW_PAGE, PRODUCTS_PAGE } from "./platform-config";
import styles from "./site.module.css";
import { ToolDirectory } from "./ToolDirectory";

const ink = "var(--color-mkt-ink)";
const ink2 = "var(--color-mkt-ink2)";
const eyebrow = "text-[11px] font-medium leading-[1.38] tracking-[1.1px]";
const section = "mx-auto flex max-w-[1440px] flex-col gap-6 px-6 py-6 md:px-20 md:py-20";
const h1 = "text-[42px] font-semibold leading-[1.08] tracking-[-1.05px] md:text-[64px] md:tracking-[-1.6px]";
const h2 = "text-[34px] font-semibold leading-[1.08] tracking-[-0.85px] md:text-[48px] md:tracking-[-1.2px]";
const pill = `${styles.press} inline-flex min-h-[44px] items-center rounded-full px-5 py-3 text-[15px] font-medium leading-[1.5]`;

function Lines({ lines }: { lines: readonly string[] }) {
  return <>{lines.map((l) => <span key={l} className="block">{l}</span>)}</>;
}

function Cta({ cta, node }: { cta: typeof PRODUCTS_PAGE.cta; node: string }) {
  return (
    <section data-node-id={node} style={{ background: ink }} aria-labelledby={`${node}-h`}>
      <div className={section}>
        <h2 id={`${node}-h`} className="text-[34px] font-semibold leading-[1.08] text-white md:text-[48px]">{cta.headline}</h2>
        {/* 225:7776: button above the link on mobile, 24px apart. */}
        <div className="flex flex-col items-start gap-6 md:flex-row md:flex-wrap md:items-center md:gap-5">
          <Link href={cta.primary.href} className={pill} style={{ background: "var(--color-mkt-amber)", color: ink }}>{cta.primary.label}</Link>
          <MaybeLink href={cta.secondary.href} className="text-[14px] font-medium leading-[1.38] text-white">{cta.secondary.label}</MaybeLink>
        </div>
      </div>
    </section>
  );
}

/** products / Desktop 176:204, products / Mobile 176:313. */
export function ProductsPage() {
  const p = PRODUCTS_PAGE;
  return (
    <>
      <section data-node-id="225:7335" aria-labelledby="products-h">
        <div className={section}>
          <p className={eyebrow} style={{ color: ink2 }}>{p.eyebrow}</p>
          <h1 id="products-h" className={h1}><Lines lines={p.headline} /></h1>
          {/* 225:7568: button above the link on mobile, 20px apart. */}
          <div className="flex flex-col items-start gap-5 md:flex-row md:flex-wrap md:items-center">
            <Link href={p.primary.href} className={pill} style={{ background: "var(--color-mkt-amber)", color: ink }}>{p.primary.label}</Link>
            <Link href={p.secondary.href} className="text-[14px] font-medium leading-[1.38]" style={{ color: ink2 }}>{p.secondary.label}</Link>
          </div>
        </div>
      </section>
      <section data-node-id="225:7342" className="bg-white" aria-label="One job across Renvani">
        <div className={section}><ConnectedPlatform /></div>
      </section>
      <section id="tools" data-node-id="225:7464" className="scroll-mt-24 bg-white" aria-labelledby="tools-h">
        <div className={`${section} gap-8`}>
          <p className={eyebrow} style={{ color: ink2 }}>{p.toolsEyebrow}</p>
          <h2 id="tools-h" className={`${h2} max-md:text-[36px] max-md:tracking-[-0.9px]`}>{p.toolsHeadline}</h2>
          <ToolDirectory />
        </div>
      </section>
      <Cta cta={p.cta} node="225:7547" />
    </>
  );
}

/** how-it-works / Desktop 176:585, how-it-works / Mobile 176:664. */
export function HowItWorksPage() {
  const p = HOW_PAGE;
  return (
    <>
      <section data-node-id="219:9320" aria-labelledby="how-h">
        <div className={section}>
          <p className={eyebrow} style={{ color: ink2 }}>{p.eyebrow}</p>
          <h1 id="how-h" className={h1}><Lines lines={p.headline} /></h1>
          <p className="text-[17px]" style={{ color: ink2 }}>{p.body}</p>
          <div className="flex flex-wrap items-center gap-5">
            <Link href={p.primary.href} className={pill} style={{ background: "var(--color-mkt-amber)", color: ink }}>{p.primary.label}</Link>
            <Link href={p.secondary.href} className="text-[14px] font-medium" style={{ color: ink2 }}>{p.secondary.label}</Link>
          </div>
        </div>
      </section>
      <section data-node-id="219:9328" className="bg-white" aria-label="Five flagship products working together">
        <div className={section}><ConnectedPlatform /></div>
      </section>
      <section data-node-id="219:9447" aria-labelledby="how-trades-h">
        <div className={`${section} gap-8`}>
          <h2 id="how-trades-h" className={h2}><Lines lines={p.tradesHeadline} /></h2>
          <div className="grid gap-8 md:grid-cols-2">
            {p.trades.map((t) => (
              <div key={t.eyebrow} className="flex flex-col gap-4">
                <img src={t.image} alt="" width={1248} height={660} className="h-[200px] w-full rounded-2xl object-cover md:h-[280px]" />
                <p className={eyebrow} style={{ color: ink2 }}>{t.eyebrow}</p>
                <h3 className="text-[24px] font-semibold md:text-[30px] md:leading-[1.38]">{t.title}</h3>
                <MaybeLink href={t.link.href} className="text-[14px] font-medium md:leading-[1.38]" style={{ color: ink2 }}>{t.link.label}</MaybeLink>
              </div>
            ))}
          </div>
        </div>
      </section>
      <Cta cta={p.cta} node="219:9460" />
    </>
  );
}
