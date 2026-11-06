import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { BenefitStrip, DemoBand, DetailAction, DetailFaq, DetailHero, DetailIllustration, FeatureSection } from "./DetailPages";
import { HomepageWorkflows } from "./HomepageWorkflows";
import { PLANS, pricingTokens } from "./pricing-config";
import styles from "./detail-pages.module.css";

/** The approved homepage's visual language, with the founder's actual service journey. */
export function HowItWorksPage() {
  return <div className={styles.page} data-overview-page="how-it-works">
    <DetailHero category="HOW RENVANI WORKS" title="From the first request to the next good job." body="Set the business goal. Keep every handoff connected. Give your team a clear path from getting found to getting paid and bringing customers back."><DetailIllustration slug="command-center" /></DetailHero>
    <BenefitStrip items={["You set the direction", "The context stays connected", "Your team keeps moving"]} />
    <section className={styles.demoBand}><div><p className={styles.eyebrow}>START WITH YOUR OPERATING MISSION</p><h2>Tell Renvani where you want to go.</h2><p>Set your business profile and choose an outcome, such as getting more bookings. Your services, service area and operating rules give proposed actions a useful starting point. You review the moves that need a decision.</p><div className={styles.missionLine}><span>Business profile</span><span>Operating Mission</span><span>Owner review</span></div></div><DetailAction href="/product/command-center">Explore Command Center</DetailAction></section>
    <div id="features"><header className={styles.sectionHeading}><p className={styles.eyebrow}>FOLLOW ONE CUSTOMER THROUGH THE BUSINESS</p><h2>One job. No disconnected handoffs.</h2><p>Three connected phases, from the customer finding you to the next visit.</p></header>
      <FeatureSection index={0} feature={{label:"01 / Get found and receive the request",title:"Turn interest into a conversation.",body:"Growth gives prospective customers a clear next step. When a service request arrives, keep its source, customer details and requested work together so the office can respond with context.",points:["Start with your business profile and goal","Connect your website to the service request","Carry the inquiry into Revenue"],visual:"online-booking",part:0}} />
      <FeatureSection index={1} feature={{label:"02 / Estimate, confirm and schedule",title:"Keep the approved scope with the job.",body:"Prepare an estimate by email or arrange an onsite estimate. Confirm the work with the customer, then convert the accepted scope into the work order and assign the visit.",points:["Choose the email or onsite estimate path","Confirm the estimate before creating the job","Give the technician the approved work and property details"],visual:"estimates-approvals",part:0}} />
      <FeatureSection index={2} feature={{label:"03 / Complete the visit and build the relationship",title:"Finish the work. Keep the customer.",body:"The technician tracks the job, looks up products and records notes and photos in the field. Complete the invoice and configured mobile payment workflow, then use the service record for the next relevant follow-up.",points:["Keep tasks, products, time and photos with the visit","Confirm completed work and record payment","Review follow-up for reviews, maintenance or membership"],visual:"technician-app",part:0}} />
    </div>
    <HomepageWorkflows />
    <DetailFaq items={[
      {question:"Do we have to change what we sell?",answer:"No. Your services, prices and team are the starting point. Renvani connects the work across Growth, Revenue, Operations, Retention and Command Center; the supporting FSM tools carry out and record the service journey."},
      {question:"Can the estimate happen onsite?",answer:"Yes, the illustrated journey includes either an email estimate or an onsite estimate. Confirm and approve the scope before converting the estimate to the work order."},
      {question:"Is everything automatic?",answer:"No. Business policies, owner review and approval requirements govern the next move. Customer messages, permissions and financial actions keep their separate controls."},
      {question:"Where do we start?",answer:"Bring your services and current process to a demo. Review your business profile, supported import options and first useful workflow before choosing a plan."}
    ]} />
    <div className={styles.moreLinks}><Link href="/product#tools">Explore the tools<ArrowRight size={16} aria-hidden="true" /></Link><Link href="/industries">Find your industry<ArrowRight size={16} aria-hidden="true" /></Link></div>
    <DemoBand title="See your own customer journey come together." />
  </div>;
}

/** Presentation only. All prices and example totals come from the unchanged pricing configuration. */
export function ReferencePricingPage() {
  const t = pricingTokens();
  return <div className={styles.page} data-overview-page="pricing">
    <DetailHero category="RENVANI PRICING" title="One platform. Two ways to pay." body="Every feature. Unlimited users. Choose the billing model that fits your business, without breaking up the customer journey." overview />
    <BenefitStrip items={["Every feature", "Unlimited users", "One connected business"]} />
    <section className={styles.pricingIntro} id="plans" aria-label="Compare Renvani plans"><div className={styles.plans}>{PLANS.filter(plan => !plan.program).map(plan => <article className={styles.plan} data-accent={plan.key === "flat"} key={plan.key} aria-labelledby={`plan-${plan.key}`}>
      <p className={styles.eyebrow}>{plan.key === "flex" ? "LOWER MONTHLY SUBSCRIPTION" : "NO CUSTOMER-PAID SERVICE FEE"}</p><h2 id={`plan-${plan.key}`}>{plan.name}</h2><p className={styles.price}>{t[`${plan.key}.price`]}<span> / month</span></p><p>{t[`${plan.key}.fee`]}</p><small>{t[`${plan.key}.annual`]}<br />{t.annualNote}</small>
      <ul>{[t.features!,"Growth, Revenue, Operations and Retention","Command Center and supporting field service tools"].map(item => <li key={item}><Check size={17} aria-hidden="true" /><span>{item}</span></li>)}</ul><DetailAction href={`/demo?plan=${plan.key}`}>Explore {plan.name}</DetailAction>
    </article>)}</div><p className={styles.pricingNote}>{t.annualFeeNote} The customer-paid Service Fee is disclosed at checkout and is non-refundable. Payment processing fees are separate.</p>
      <div className={styles.programs}><div><strong>{t["programs.title"]}</strong><p>{t["programs.note"]} Both are Flex-based programs.</p></div><Link href="/demo" className={styles.textLink}>Ask about programs<ArrowRight size={17} aria-hidden="true" /></Link></div>
    </section>
    <section className={styles.feature}><div className={styles.featureCopy}><p className={styles.eyebrow}>A LITERAL CHECKOUT EXAMPLE</p><h2>See exactly what changes.</h2><p>The same service subtotal, with the customer-paid Service Fee shown separately. The examples below are illustrations, not payment forms.</p><p className={styles.pricingNote}>Tax and optional tips are not shown. Subscription charges, processing costs and any legally permitted surcharge remain separate.</p></div><div className={styles.featureMedia}><div className={styles.receipts}>{(["flex","flat"] as const).map(key => <div className={styles.receipt} key={key}><h3>{t[`${key}.name`]}</h3><dl><div><dt>Service subtotal</dt><dd>{t["ex.subtotal"]}</dd></div><div><dt>{key === "flex" ? t["ex.flexFeeLabel"] : "Service Fee"}</dt><dd>{t[key === "flex" ? "ex.flexFee" : "ex.flatFee"]}</dd></div><div><dt>Customer total</dt><dd>{t[key === "flex" ? "ex.flexTotal" : "ex.flatTotal"]}</dd></div></dl></div>)}</div><p className={styles.pricingNote}>Illustrative checkout only. No payment is collected on this page.</p></div></section>
    <DemoBand title="Choose a plan. Keep the whole platform." body="The five flagship products and their supporting field service tools stay connected. The billing model changes, not the parts of your business you can see." />
    <DetailFaq items={[
      {question:"What is included in each plan?",answer:"Both Flex and Flat include every feature and unlimited users. The five flagship products and supporting FSM tools remain part of the connected platform. Ask about the availability of preview capabilities during your demo."},
      {question:"How does the customer-paid Service Fee work?",answer:`${t["flex.fee"]} applies to the service subtotal on Flex and is non-refundable. Flat has no customer-paid Service Fee. Payment processing, taxes, optional tips and legally permitted surcharges remain separate.`},
      {question:"What changes with annual billing?",answer:`Flex is ${t["flex.annual"]}; Flat is ${t["flat.annual"]}. ${t.annualNote}. ${t.annualFeeNote}`},
      {question:"Who qualifies for the Startup and Founding programs?",answer:`${t["programs.title"]}. ${t["programs.note"]} Both programs use Flex-based billing.`}
    ]} />
    <DemoBand title="Find the right fit for your business." body="See your workflow, compare the plans and get clear on the details before you decide." />
  </div>;
}
