import Link from "next/link";

import { INDUSTRIES_OVERVIEW, INDUSTRY_WORKFLOW_TEMPLATE, type IndustryEntry } from "./industry-registry";
import styles from "./industry-pages.module.css";

/** The shared Appliance Repair reference is adapted for each new trade; all request details are illustrative. */
export function IndustryWorkflowPage({ industry }: { industry: IndustryEntry }) {
  const { example } = industry;
  const steps = [
    { title: "Capture the request", detail: example.capture },
    { title: "Estimate & approve", detail: example.estimate },
    { title: "Schedule & dispatch", detail: "Plan the visit and send the team the context they need." },
    { title: "Complete & collect", detail: example.fieldWork },
    { title: "Keep the history", detail: example.nextVisit }
  ];

  return (
    <div className={styles.page} data-node-id={INDUSTRY_WORKFLOW_TEMPLATE.desktop} data-industry={industry.slug}>
      <section className={styles.tradeHero} aria-labelledby="industry-heading">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>{industry.name}</p>
          <h1 id="industry-heading" className={styles.tradeTitle}>{industry.headline.split(/(?<=\.)\s+/).map((line, index) => <span key={line}>{index > 0 ? " " : null}{line}</span>)}</h1>
          <p className={styles.lead}>{industry.description}</p>
          <div className={styles.actions}>
            <Link href="/demo" className={styles.primaryButton}>See Renvani in action</Link>
            <Link href={INDUSTRIES_OVERVIEW.href} className={styles.secondaryButton}>All industries</Link>
          </div>
        </div>
        <article className={styles.requestCard} aria-labelledby="industry-request-title">
          <div className={styles.requestChrome}><p>Renvani · Service request</p><span>Example</span></div>
          <div className={styles.requestDetails}>
            <p className={styles.eyebrow}>{industry.name}</p>
            <h2 id="industry-request-title" className={styles.requestTitle}>{example.request}</h2>
            <div className={styles.requestContext}>{example.requestDetails.map((detail) => <p key={detail}>{detail}</p>)}</div>
            <div className={styles.nextStep}><span>Next step</span><p>Email estimate or onsite visit</p></div>
            <p className={styles.illustrationLabel}>Illustrative workflow · Example request</p>
          </div>
        </article>
      </section>
      <section className={styles.workflowSection} aria-labelledby="industry-workflow-heading">
        <h2 id="industry-workflow-heading" className={styles.workflowHeading}>One clear path from request to return visit.</h2>
        <ol className={styles.workflowGrid}>
          {steps.map((step, index) => (
            <li key={step.title} className={styles.workflowCard}>
              <span className={styles.workflowNumber} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
            </li>
          ))}
        </ol>
        <p className={styles.note}>Workflow illustration. Details, permissions and next actions depend on the business profile and the work.</p>
      </section>
      <section className={styles.closing} aria-label="Explore Renvani">
        <h2>Your next good job starts here.</h2>
        <Link href="/tour" className={styles.primaryButton}>Take the product tour</Link>
      </section>
    </div>
  );
}
