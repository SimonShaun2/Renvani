"use client";

import Link from "next/link";
import { ArrowRight, Camera, Check, CheckCircle2, ChevronRight, ClipboardCheck, CreditCard, MapPin, Pause, Play, RotateCcw, Search, ShieldCheck, Star } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { HOME_WORKFLOWS, type HomeWorkflowId } from "./home-workflows";
import { useWorkflowPlayback } from "./useWorkflowPlayback";
import styles from "./workflow-showcase.module.css";

const SCENE_NODES: Record<HomeWorkflowId, string> = {
  growth: "584:5460",
  revenue: "584:5491",
  operations: "584:5522",
  retention: "584:5566",
  "command-center": "584:5594"
};

function Field({ label, children, ready = true }: { label: string; children: ReactNode; ready?: boolean }) {
  return (
    <div className={styles.field}>
      <span className={styles.sceneLabel}>{label}</span>
      <span className={styles.fieldValue} data-ready={ready}>{children}</span>
      {!ready && <span className={styles.fieldPlaceholder} />}
    </div>
  );
}

function Reveal({ ready, className = "", children }: { ready: boolean; className?: string | undefined; children: ReactNode }) {
  return <div className={`${styles.reveal} ${className}`} data-ready={ready}>{children}</div>;
}

function GrowthScene({ step }: { step: number }) {
  return (
    <div className={styles.sceneBody}>
      <div className={`${styles.goalCard} ${styles.softCard}`}>
        <span className={styles.sceneLabel}>Business goal</span>
        <strong className={styles.sceneTitle}>Get more bookings</strong>
        <CheckCircle2 size={22} className={styles.goalCheck} />
      </div>
      <div className={styles.equalColumns}>
        <div className={styles.sceneCard}>
          <span className={styles.sceneLabel}>Local discovery</span>
          <div className={`${styles.field} ${styles.searchField}`}>
            <span className={styles.sceneLabel}>Search</span>
            <div className={styles.searchLine}><Search size={16} /><span className={styles.fieldValue} data-ready={step >= 1}>A service near me</span></div>
          </div>
          <Reveal ready={step >= 1} className={styles.businessCard}>
            <strong className={styles.sceneTitle}>Your business</strong>
            <p>Your services · Your service area</p>
            <span className={styles.amberLabel}>A clear next step <ArrowRight size={14} /></span>
          </Reveal>
        </div>
        <div className={styles.sceneCard}>
          <strong className={styles.sceneTitle}>Request service</strong>
          <Field label="Service" ready={step >= 2}>Electrical repair</Field>
          <Field label="Location" ready={step >= 2}>Your service area</Field>
          <span className={`${styles.mockAction} ${styles.amberAction}`} data-complete={step >= 3}>
            {step >= 3 ? <><Check size={17} /> Request received</> : "Send work request"}
          </span>
        </div>
      </div>
      <Reveal ready={step >= 3} className={styles.resultCard}>
        <strong className={styles.sceneTitle}>New inbound request <ArrowRight size={18} /> Ready for an estimate</strong>
        <p>Source, service and customer details stay together.</p>
      </Reveal>
    </div>
  );
}

function RevenueScene({ step }: { step: number }) {
  return (
    <div className={styles.sceneBody}>
      <div className={styles.revenueColumns}>
        <div className={`${styles.sceneCard} ${styles.estimateCard}`}>
          <span className={styles.sceneLabel}>Service estimate</span>
          <strong className={styles.sceneTitle}>A clear scope of work</strong>
          <Field label="Request">Customer issue &amp; service details</Field>
          <Field label="Estimate path" ready={step >= 1}>Email estimate or onsite visit</Field>
          <Field label="Scope" ready={step >= 1}>Work, products and next steps</Field>
        </div>
        <div className={`${styles.sceneCard} ${styles.softCard} ${styles.reviewCard}`}>
          <span className={styles.sceneLabel}>Owner review</span>
          <strong className={styles.sceneTitle}>Ready to follow up?</strong>
          <p>Review the estimate message and choose the right next step.</p>
          <Field label="Message" ready={step >= 2}>Your estimate is ready to review.</Field>
          <span className={`${styles.mockAction} ${styles.darkAction}`} data-complete={step >= 3}>
            {step >= 3 ? <><Check size={17} /> Follow-up reviewed</> : "Review follow-up"}
          </span>
          <span className={styles.sceneNote}>Nothing sent before review.</span>
        </div>
      </div>
      <Reveal ready={step >= 3} className={`${styles.resultCard} ${styles.darkCard}`}>
        <span className={styles.amberLabel}>Customer approval</span>
        <strong className={styles.sceneTitle}><CheckCircle2 size={21} /> Estimate approved <ArrowRight size={18} /> Ready to schedule</strong>
      </Reveal>
    </div>
  );
}

function OperationsScene({ step }: { step: number }) {
  const fieldStatus = ["Visit assigned", "On site", "Work order created", "Work documented", "Visit complete"][step];
  return (
    <div className={styles.sceneBody}>
      <div className={styles.operationsColumns}>
        <div className={styles.sceneCard}>
          <span className={styles.sceneLabel}>Today’s dispatch</span>
          <strong className={styles.sceneTitle}>The office and field, connected.</strong>
          <div className={styles.schedule}>
            <div className={styles.scheduleSlot}><span>8:00</span><span>Assigned</span></div>
            <div className={`${styles.scheduleSlot} ${styles.activeVisit}`}><span>10:00</span><span>{step >= 4 ? "Complete" : step >= 1 ? "On site" : "Scheduled"}</span><span className={styles.visitProgress} data-phase={step} /></div>
            <div className={styles.scheduleSlot}><span>1:00</span><span>Next visit</span></div>
          </div>
          <Field label="Approved scope" ready={step >= 2}>Confirm estimate <ArrowRight size={14} /> Create work order</Field>
          <div className={styles.jobEvidence}>
            <div className={styles.evidenceItem} data-complete={step >= 3}><span>Job photos</span><span>{step >= 3 ? <Check size={20} /> : <Camera size={20} />}</span></div>
            <div className={styles.evidenceItem} data-complete={step >= 3}><span>Products</span><span>{step >= 3 ? <Check size={20} /> : <span className={styles.pendingMark} />}</span></div>
            <div className={styles.evidenceItem} data-complete={step >= 3}><span>Tasks</span><span>{step >= 3 ? <Check size={20} /> : <ClipboardCheck size={20} />}</span></div>
          </div>
        </div>
        <div className={styles.fieldDevice}>
          <span className={styles.amberLabel}>In the field</span>
          <strong className={styles.sceneTitle} key={fieldStatus}>{fieldStatus}</strong>
          <div className={styles.mobileWorkOrder}>
            <span className={styles.sceneLabel}>Work order</span>
            <strong className={styles.sceneTitle}>{step >= 2 ? "Estimate confirmed" : "Review the visit"}</strong>
            <p>{step >= 3 ? "Photos, products and tasks recorded." : step >= 2 ? "Approved scope is ready for the team." : "Customer details travel with the visit."}</p>
          </div>
          <div className={`${styles.mobilePayment} ${styles.softCard}`} data-complete={step >= 4}>
            <span className={styles.sceneLabel}>Mobile payment</span>
            <strong className={styles.sceneTitle}>{step >= 4 ? "Payment recorded" : "Ready to collect"}</strong>
            <span className={`${styles.mockAction} ${styles.darkAction}`}>
              {step >= 4 ? <><CheckCircle2 size={18} /> Example receipt</> : <><CreditCard size={18} /> Take payment</>}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function RetentionScene({ step }: { step: number }) {
  return (
    <div className={styles.sceneBody}>
      <div className={`${styles.resultCard} ${styles.darkCard}`}>
        <span className={styles.amberLabel}>Job complete · Payment recorded</span>
        <strong className={styles.sceneTitle}>A good job becomes a lasting relationship.</strong>
      </div>
      <div className={styles.equalColumns}>
        <div className={styles.sceneCard}>
          <span className={styles.sceneLabel}>Follow-up</span>
          <strong className={styles.sceneTitle}>Ask for a review</strong>
          <div className={styles.reviewStars} data-ready={step >= 1}>{Array.from({ length: 5 }, (_, index) => <Star key={index} size={26} strokeWidth={1.4} />)}</div>
          <p>Use the customer’s preferences and the completed job context.</p>
          <span className={`${styles.mockAction} ${styles.outlineAction}`} data-complete={step >= 1}>{step >= 1 ? <><Check size={17} /> Review invitation prepared</> : "Review request"}</span>
        </div>
        <div className={styles.sceneCard}>
          <span className={styles.sceneLabel}>Ongoing care</span>
          <strong className={styles.sceneTitle}>Keep the next visit in view.</strong>
          <Field label="Relationship" ready={step >= 2}>Membership or maintenance</Field>
          <Field label="Timing" ready={step >= 2}>An appropriate service interval</Field>
        </div>
      </div>
      <Reveal ready={step >= 3} className={`${styles.resultCard} ${styles.softCard}`}>
        <span className={styles.sceneLabel}>Return visit</span>
        <strong className={styles.sceneTitle}><CheckCircle2 size={21} /> The service history comes with them.</strong>
      </Reveal>
    </div>
  );
}

function CommandCenterScene({ step }: { step: number }) {
  return (
    <div className={styles.sceneBody}>
      <div className={styles.commandColumns}>
        <div className={styles.operatingProfile}>
          <span className={styles.amberLabel}>Operating profile</span>
          <strong className={styles.sceneTitle}>Built around your business.</strong>
          <span className={styles.profileSetting}><MapPin size={16} /> Service area</span>
          <span className={styles.profileSetting}><Check size={16} /> Team capacity</span>
          <span className={styles.profileSetting}><ShieldCheck size={16} /> Business rules</span>
        </div>
        <div className={styles.missionWorkspace}>
          <Reveal ready={step >= 1} className={`${styles.resultCard} ${styles.softCard}`}>
            <span className={styles.sceneLabel}>Mission</span>
            <strong className={styles.sceneTitle}>Get more bookings</strong>
          </Reveal>
          <div className={styles.sceneCard}>
            <span className={styles.sceneLabel}>{step >= 3 ? "Owner review" : "Suggested next move"}</span>
            <Reveal ready={step >= 2} className={styles.suggestedAction}>
              <strong className={styles.sceneTitle}>Prepare a local outreach campaign</strong>
              <p>Review the message, audience and service area.</p>
            </Reveal>
            <span className={`${styles.mockAction} ${styles.darkAction} ${styles.reviewPlan}`} data-complete={step >= 3}>
              {step >= 3 ? <><ShieldCheck size={17} /> Owner approved this example</> : "Review the plan"}
            </span>
          </div>
          <Reveal ready={step >= 4} className={styles.resultCard}>
            <span className={styles.sceneLabel}>Mission progress</span>
            <strong className={styles.sceneTitle}>Next request <ArrowRight size={18} /> Connected workflow</strong>
            <span className={styles.missionProgress}><span data-ready={step >= 4} /></span>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

function WorkflowScene({ product, step }: { product: HomeWorkflowId; step: number }) {
  switch (product) {
    case "growth": return <GrowthScene step={step} />;
    case "revenue": return <RevenueScene step={step} />;
    case "operations": return <OperationsScene step={step} />;
    case "retention": return <RetentionScene step={step} />;
    case "command-center": return <CommandCenterScene step={step} />;
  }
}

export function HomepageWorkflows({ product, embedded = false }: { product?: HomeWorkflowId; embedded?: boolean } = {}) {
  const workflows = product ? HOME_WORKFLOWS.filter((workflow) => workflow.id === product) : HOME_WORKFLOWS;
  const [selectedId, setActiveId] = useState<HomeWorkflowId>(product ?? "growth");
  const activeId = product ?? selectedId;
  const activeWorkflow = HOME_WORKFLOWS.find((workflow) => workflow.id === activeId)!;
  const playback = useWorkflowPlayback(activeId, activeWorkflow.steps.length);
  const instanceId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeStep = activeWorkflow.steps[playback.step]!;

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number;
    switch (event.key) {
      case "ArrowRight": nextIndex = (index + 1) % workflows.length; break;
      case "ArrowLeft": nextIndex = (index - 1 + workflows.length) % workflows.length; break;
      case "Home": nextIndex = 0; break;
      case "End": nextIndex = workflows.length - 1; break;
      default: return;
    }
    event.preventDefault();
    setActiveId(workflows[nextIndex]!.id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <section id={product ? `${product}-workflow-player` : "product-workflows"} className={styles.showcase} style={embedded ? { padding: 0, background: "transparent" } : undefined} data-node-id="584:5654" data-subpage-journey={product ? activeWorkflow.name : undefined} aria-labelledby={`${instanceId}-title`}>
      {!embedded && <p className={styles.eyebrow}>Five products. One connected business.</p>}
      <h2 id={`${instanceId}-title`} className={embedded ? styles.srOnly : styles.heading}>{product ? `${activeWorkflow.name} workflow` : "See the work move forward."}</h2>
      {!product && <div className={styles.tabs} role="tablist" aria-label="Explore Renvani products">
        {workflows.map((workflow, index) => (
          <button
            key={workflow.id}
            ref={(element) => { tabRefs.current[index] = element; }}
            type="button"
            role="tab"
            id={`${instanceId}-tab-${workflow.id}`}
            aria-controls={`${instanceId}-panel-${workflow.id}`}
            aria-selected={activeId === workflow.id}
            tabIndex={activeId === workflow.id ? 0 : -1}
            onClick={() => setActiveId(workflow.id)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
            className={styles.tab}
          >
            {workflow.name}
          </button>
        ))}
      </div>}
      <div ref={playback.viewportRef} className={styles.panelViewport}>
        {workflows.map((workflow) => (
          <div key={workflow.id} id={`${instanceId}-panel-${workflow.id}`} role={product ? "region" : "tabpanel"} aria-labelledby={product ? `${instanceId}-title` : `${instanceId}-tab-${workflow.id}`} hidden={activeId !== workflow.id} tabIndex={0} className={styles.panel}>
            {activeId === workflow.id && (
              <>
                <div className={styles.introduction}>
                  <h3>{workflow.headline}</h3>
                  <p className={styles.description}>{workflow.description}</p>
                  <ol className={styles.steps} aria-label={`${workflow.name} workflow steps`}>
                    {workflow.steps.map((workflowStep, index) => (
                      <li key={workflowStep.label}>
                        <button type="button" onClick={() => playback.selectStep(index)} className={styles.stepButton} aria-current={playback.step === index ? "step" : undefined} aria-describedby={`${instanceId}-${workflow.id}-step-${index}`}>
                          <span className={styles.stepNumber} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                          <span>{workflowStep.label}</span>
                          {playback.step === index && <ChevronRight className={styles.stepChevron} size={16} aria-hidden="true" />}
                        </button>
                        <p id={`${instanceId}-${workflow.id}-step-${index}`} className={styles.srOnly}>{workflowStep.title}. {workflowStep.description}</p>
                      </li>
                    ))}
                  </ol>
                  {!product && <Link className={styles.exploreLink} href={workflow.href}>Explore {workflow.name}<ArrowRight size={17} aria-hidden="true" /></Link>}
                </div>
                <div className={styles.scene} data-node-id={SCENE_NODES[workflow.id]} data-product={workflow.id} data-step={playback.step} data-playing={playback.playing} data-reduced-motion={playback.reducedMotion}>
                  <div role="img" aria-label={`Illustrative ${workflow.name} workflow. Step ${playback.step + 1} of ${workflow.steps.length}: ${activeStep.title}. ${activeStep.description}`}>
                    <div aria-hidden="true">
                      <div className={styles.sceneChrome}><strong>Renvani {workflow.name}</strong><span>Example</span></div>
                      <WorkflowScene product={workflow.id} step={playback.step} />
                    </div>
                  </div>
                  <div className={styles.motionControls}>
                    <span className={styles.illustrationLabel}>Illustrative workflow{playback.reducedMotion && <span>Reduced motion · Choose any step</span>}</span>
                    <div className={styles.controlButtons}>
                      {!playback.reducedMotion && <button type="button" className={styles.motionButton} onClick={playback.togglePaused} aria-label={`${playback.paused ? "Play" : "Pause"} ${workflow.name} animation`}>{playback.paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}{playback.paused ? "Play" : "Pause"}</button>}
                      <button type="button" className={styles.motionButton} onClick={playback.replay} aria-label={playback.reducedMotion ? `Show complete ${workflow.name} workflow` : `Replay ${workflow.name} animation`}><RotateCcw size={15} aria-hidden="true" />{playback.reducedMotion ? "Complete view" : "Replay"}</button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
