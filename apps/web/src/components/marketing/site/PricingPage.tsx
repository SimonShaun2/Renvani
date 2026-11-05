import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { PLANS, pricingTokens } from "./pricing-config";
import { SUBPAGE_FRAMES } from "./subpage-content";
import { Benefits, FinalCta, FlagshipCards, SectionHeading, SubpageFaq, SubpageHero } from "./SubpageShared";
import styles from "./subpage.module.css";

/** The layout changed; pricing-config remains the only source of prices and service fee calculations. */
export function PricingFrames() {
  const t = pricingTokens();
  return <div className={styles.page} data-marketing-template="pricing" data-node-id={SUBPAGE_FRAMES.pricing.desktop}>
    <SubpageHero eyebrow="SIMPLE, CONNECTED PRICING" title="One business. Two ways to pay." description="Every feature. Unlimited users. Choose the billing model that fits your business." secondary={{label:"Compare the plans",href:"#plans"}} />
    <Benefits items={["Five flagship products", "Connected field service tools", "Unlimited users"]} />
    <section id="plans" className={`${styles.section} ${styles.white}`} aria-label="Renvani plans">
      <div className={styles.planGrid}>{PLANS.filter(plan => !plan.program).map(plan => <article key={plan.key} className={`${styles.plan} ${plan.key === "flat" ? styles.planDark : ""}`} aria-labelledby={`plan-${plan.key}`}>
        <p className={styles.eyebrow}>{plan.key === "flex" ? "A LOWER MONTHLY SUBSCRIPTION" : "NO CUSTOMER-PAID SERVICE FEE"}</p><h2 id={`plan-${plan.key}`}>{plan.name}</h2>
        <div className={styles.planPrice}><strong>{t[`${plan.key}.price`]}</strong><span>/month</span></div><p>{t[`${plan.key}.fee`]}</p><small>{t[`${plan.key}.annual`]}<br />{t.annualNote}</small>
        <ul className={styles.planFeatures}>{["Every feature. Unlimited users.","Growth, Revenue, Operations and Retention","Command Center and connected FSM tools"].map(feature => <li key={feature}><Check size={17} aria-hidden="true" /><span>{feature}</span></li>)}</ul>
        <Link href={`/demo?plan=${plan.key}`} className={styles.button}>Explore {plan.name}<ArrowRight size={17} aria-hidden="true" /></Link>
      </article>)}</div>
      <p className={styles.note}>{t.annualFeeNote} The customer-paid Service Fee is applied at checkout on Flex and is non-refundable. Payment processing fees are separate.</p>
      <div className={styles.programs}><div><p><strong>{t["programs.title"]}</strong></p><p>{t["programs.note"]} Both programs are Flex-based.</p></div><Link href="/demo" className={styles.link}>Ask about eligibility<ArrowRight size={17} aria-hidden="true" /></Link></div>
    </section>
    <section className={styles.section} id="checkout-example"><SectionHeading eyebrow="A CLEAR CHECKOUT EXAMPLE" title="See exactly what changes." description="The same service subtotal. A different customer-paid Service Fee. No hidden comparison." />
      <div className={styles.checkout}>{(["flex","flat"] as const).map(key => <div className={styles.receipt} key={key}><h3>{t[`${key}.name`]}</h3><dl><div><dt>Service subtotal</dt><dd>{t["ex.subtotal"]}</dd></div><div><dt>{key === "flex" ? t["ex.flexFeeLabel"] : "Service Fee"}</dt><dd>{t[key === "flex" ? "ex.flexFee" : "ex.flatFee"]}</dd></div><div className={styles.receiptTotal}><dt>Customer total</dt><dd>{t[key === "flex" ? "ex.flexTotal" : "ex.flatTotal"]}</dd></div></dl></div>)}</div>
      <p className={styles.note}>Illustrative checkout only. Tax and optional tip are not shown. The Service Fee is separate from card processing, your subscription and any legally permitted surcharge. No payment is collected on this page.</p>
    </section>
    <section className={`${styles.section} ${styles.white}`}><SectionHeading eyebrow="INCLUDED IN THE PLATFORM" title="Five products. One connected business." description="Choose how you pay, not which part of the customer journey stays disconnected." /><FlagshipCards /></section>
    <SubpageFaq items={[
      {question:"What is included in each plan?",answer:"Both Flex and Flat include every feature and unlimited users, with the five flagship products and supporting field service tools. Confirm the availability of any preview capability during your demo."},
      {question:"How does the customer-paid Service Fee work?",answer:`Flex adds a ${PLANS.find(plan=>plan.key==="flex")!.serviceFeePct}% customer-paid Service Fee to the service subtotal at checkout. It is non-refundable. Flat has no customer-paid Service Fee. Processing, tax, optional tips and legally permitted surcharges remain separate.`},
      {question:"What changes with annual billing?",answer:`${t["flex.annual"]} for Flex; ${t["flat.annual"]} for Flat. That is ${t.annualNote}. ${t.annualFeeNote}`},
      {question:"Can I use Startup or Founding pricing?",answer:`${t["programs.title"]}. These are Flex-based programs. ${t["programs.note"]}`}
    ]} />
    <FinalCta title="Pick the fit for your business." description="See your workflow, compare the plans and get clear on the total cost." />
  </div>;
}
