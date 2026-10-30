import Link from "next/link";

import { FigmaNode } from "./FigmaNode";
import { productLinkFor, type FlagshipEntry, type ProductPageEntry, type ToolEntry } from "./flagship-registry";
import { FLAGSHIP_VISUALS } from "./flagship-visuals";
import { MaybeLink } from "./MaybeLink";
import { SITE_NAV } from "./site-config";
import styles from "./site.module.css";

const ink = "var(--color-mkt-ink)";
const ink2 = "var(--color-mkt-ink2)";
const eyebrow = "text-[11px] font-medium leading-[1.38] tracking-[1.1px]";
const h1 = "text-[40px] font-semibold leading-[1.08] tracking-[-1px] md:text-[60px] md:tracking-[-1.5px]";
const pill = `${styles.press} inline-flex min-h-[44px] items-center justify-center rounded-full px-5 py-3 text-[15px] font-medium`;
const inter = "[font-family:Inter,system-ui,sans-serif]";

function Visual({ id, className = "" }: { id: string; className?: string }) {
  const node = FLAGSHIP_VISUALS[id];
  if (!node) return null;
  return (
    <div aria-hidden="true" className={`w-full ${className}`}>
      <FigmaNode node={node} />
    </div>
  );
}

function Hero({ p, pad }: { p: ProductPageEntry; pad: string }) {
  return (
    <section data-node-id={p.heroNode} aria-labelledby="flagship-h" style={{ background: "var(--color-mkt-cream)" }}>
      <div className={`mx-auto flex max-w-[1440px] flex-col items-center gap-10 px-6 py-12 lg:flex-row lg:gap-16 ${pad}`}>
        <div className="flex w-full flex-col items-start gap-5 lg:max-w-[528px]">
          <p className={eyebrow} style={{ color: ink2 }}>{p.eyebrow}</p>
          <h1 id="flagship-h" className={h1} style={{ color: ink }}>{p.headline}</h1>
          <p className="text-[18px] leading-[1.38]" style={{ color: ink2 }}>{p.body}</p>
          <Link href="#workflow" className={pill} style={{ background: ink, color: "var(--color-mkt-cream)" }}>{p.heroCta}</Link>
          {p.template === "tool" ? <p className={eyebrow} style={{ color: ink2 }}>{p.caption}</p> : null}
        </div>
        {FLAGSHIP_VISUALS[`${p.slug}/heroMobile`] ? (
          <>
            <Visual id={p.heroVisual} className="hidden min-w-0 flex-1 overflow-x-auto md:block" />
            {/* Mobile frames use a separate "Readable mobile product" component (e.g. 234:7510). */}
            <Visual id={`${p.slug}/heroMobile`} className="min-w-0 flex-1 md:hidden" />
          </>
        ) : (
          <Visual id={p.heroVisual} className="min-w-0 flex-1 overflow-x-auto" />
        )}
      </div>
    </section>
  );
}

function ToolPill({ label }: { label: string }) {
  const cls = "inline-flex min-h-[44px] items-center justify-center rounded-full border px-3 text-[12px] font-medium";
  return (
    <MaybeLink href={productLinkFor(label)} className={cls} style={{ borderColor: ink, color: ink }}>
      {label}
    </MaybeLink>
  );
}

function DemoCta({ node, lines }: { node: string; lines: string[] }) {
  return (
    <section data-node-id={node} style={{ background: ink }} aria-labelledby={`cta-${node}`}>
      <div className="mx-auto flex max-w-[1440px] flex-col items-start gap-6 px-6 py-12 md:flex-row md:items-center md:justify-between md:p-16">
        <h2 id={`cta-${node}`} className="text-[34px] font-semibold leading-[1.08] tracking-[-0.85px] text-white md:text-[48px] md:tracking-[-1.2px]">
          {lines.map((l) => <span key={l} className="block">{l}</span>)}
        </h2>
        <Link href={SITE_NAV.cta.href} className={pill} style={{ background: "var(--color-mkt-amber)", color: ink }}>{SITE_NAV.cta.label}</Link>
      </div>
    </section>
  );
}

function Flagship({ p }: { p: FlagshipEntry }) {
  return (
    <>
      <Hero p={p} pad="md:p-16" />
      <section id="workflow" data-node-id={p.flowNode} className="scroll-mt-24" aria-labelledby="flow-h" style={{ background: "var(--color-mkt-cream)" }}>
        <div className="mx-auto flex max-w-[1440px] flex-col gap-7 px-6 py-12 md:p-16">
          <h2 id="flow-h" className="text-[32px] font-semibold leading-[1.08] tracking-[-0.8px] md:text-[44px] md:tracking-[-1.1px]" style={{ color: ink }}>{p.flowHeadline}</h2>
          <ol className="grid gap-6 lg:grid-cols-3">
            {p.steps.map((s) => (
              <li key={s.node} data-node-id={s.node} className="flex min-w-0 flex-col gap-3">
                <h3 className="whitespace-pre-wrap text-[20px] font-semibold leading-[1.38]" style={{ color: ink }}>{s.title.replace(/^(\d\d) /, "$1  ")}</h3>
                <Visual id={s.card} />
                {s.tools.length ? <div className="flex flex-wrap gap-2">{s.tools.map((t) => <ToolPill key={t} label={t} />)}</div> : null}
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section data-node-id={p.fieldNode} aria-labelledby="field-h" style={{ background: "var(--color-mkt-sand)" }}>
        <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-8 px-6 py-12 lg:flex-row lg:gap-12 md:p-16">
          <div className="flex w-full flex-col gap-6 lg:flex-1">
            <h2 id="field-h" className="text-[32px] font-semibold leading-[1.08] tracking-[-0.8px] md:text-[42px] md:tracking-[-1.05px]" style={{ color: ink }}>{p.fieldHeadline}</h2>
            {p.fieldImage ? <img src={p.fieldImage} alt="" className="h-[240px] w-full rounded-2xl object-cover md:h-[360px]" /> : null}
          </div>
          <Visual id={p.fieldCard} className="lg:flex-1" />
        </div>
      </section>
      <DemoCta node={p.ctaNode} lines={["See your business", "in Renvani."]} />
    </>
  );
}

function Tool({ p }: { p: ToolEntry }) {
  return (
    <>
      <Hero p={p} pad="md:p-20" />
      <section id="workflow" data-node-id={p.flowNode} className="scroll-mt-24 bg-white" aria-labelledby="flow-h">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-8 px-6 py-12 md:p-20">
          <div className="flex flex-col gap-3">
            <p className={eyebrow} style={{ color: ink2 }}>{p.flowEyebrow}</p>
            <h2 id="flow-h" className="text-[32px] font-semibold leading-[1.08] tracking-[-0.8px] md:text-[44px] md:tracking-[-1.1px]" style={{ color: ink }}>{p.flowHeadline}</h2>
          </div>
          <ol className="grid gap-6 md:grid-cols-3 md:gap-10">
            {p.moments.map((m) => (
              <li key={m} className="min-w-0"><Visual id={m} /></li>
            ))}
          </ol>
        </div>
      </section>
      <section data-node-id={p.ctaNode} style={{ background: ink }} aria-labelledby="handoff-h">
        <div className="mx-auto flex max-w-[1440px] flex-col items-start gap-4 px-6 py-12 md:p-20">
          <p className={eyebrow} style={{ color: "var(--color-mkt-amber)" }}>{p.ctaEyebrow}</p>
          <h2 id="handoff-h" className="text-[28px] font-semibold leading-[1.08] tracking-[-0.7px] text-white md:text-[36px] md:tracking-[-0.9px]">{p.ctaHeadline}</h2>
          <ol data-node-id={p.handoffNode} className="flex w-full flex-col items-stretch gap-4 md:flex-row md:items-center">
            {p.handoff.map((h, i) => (
              <li key={h.node} className="flex flex-col items-center gap-4 md:flex-1 md:flex-row">
                <MaybeLink href={productLinkFor(h.title)} className={`flex w-full flex-col gap-[10px] rounded-xl bg-white p-4 ${inter}`} style={{ color: ink }}>
                  <span className="flex items-start gap-[10px] text-[10px]">
                    <span className="inline-flex h-[27px] w-[120px] items-center rounded-xl px-[10px] font-medium" style={{ background: "var(--color-mkt-cream)" }}>{h.suite}</span>
                    <span style={{ color: ink2 }}>{h.record}</span>
                  </span>
                  <span className="text-[20px] font-semibold leading-[1.38]">{h.title}</span>
                  <span className="flex items-center gap-[10px] text-[13px]" style={{ color: ink2 }}>
                    <img src="/marketing/flagship/icon-check.svg" alt="" width={18} height={18} />
                    {h.evidence}
                  </span>
                </MaybeLink>
                {i < p.handoff.length - 1 ? <img src="/marketing/platform/icon-arrow-amber.svg" alt="" width={22} height={22} className="rotate-90 md:rotate-0" /> : null}
              </li>
            ))}
          </ol>
          <Link href={SITE_NAV.cta.href} className={pill} style={{ background: "var(--color-mkt-amber)", color: ink }}>{SITE_NAV.cta.label}</Link>
        </div>
      </section>
    </>
  );
}

/** Flagship (175:3…175:1295) and product-detail (175:1436/1722/2008 + mobiles) pages, driven by flagship-registry.ts. */
export function FlagshipPage({ page }: { page: ProductPageEntry }) {
  return page.template === "flagship" ? <Flagship p={page} /> : <Tool p={page} />;
}
