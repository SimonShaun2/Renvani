"use client";

import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent } from "react";

import { HOME_WORKFLOWS, type HomeWorkflowId } from "./home-workflows";
import { LoopVideo } from "./LoopVideo";
import { workLoop } from "./media-loops";
import { useWorkflowPlayback } from "./useWorkflowPlayback";
import styles from "./workflow-showcase.module.css";

const SCENE_NODES: Record<HomeWorkflowId, string> = {
  growth: "584:5460",
  revenue: "584:5491",
  operations: "584:5522",
  retention: "584:5566",
  "command-center": "584:5594"
};

export function HomepageWorkflows() {
  const [activeId, setActiveId] = useState<HomeWorkflowId>("growth");
  const activeWorkflow = HOME_WORKFLOWS.find((workflow) => workflow.id === activeId)!;
  const playback = useWorkflowPlayback(activeId, activeWorkflow.steps.length);
  const instanceId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number;
    switch (event.key) {
      case "ArrowRight": nextIndex = (index + 1) % HOME_WORKFLOWS.length; break;
      case "ArrowLeft": nextIndex = (index - 1 + HOME_WORKFLOWS.length) % HOME_WORKFLOWS.length; break;
      case "Home": nextIndex = 0; break;
      case "End": nextIndex = HOME_WORKFLOWS.length - 1; break;
      default: return;
    }
    event.preventDefault();
    setActiveId(HOME_WORKFLOWS[nextIndex]!.id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <section id="product-workflows" className={styles.showcase} data-node-id="584:5654" aria-labelledby={`${instanceId}-title`}>
      <p className={styles.eyebrow}>Five products. One connected business.</p>
      <h2 id={`${instanceId}-title`} className={styles.heading}>See the work move forward.</h2>
      <div className={styles.tabs} role="tablist" aria-label="Explore Renvani products">
        {HOME_WORKFLOWS.map((workflow, index) => (
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
      </div>
      <div ref={playback.viewportRef} className={styles.panelViewport}>
        {HOME_WORKFLOWS.map((workflow) => (
          <div key={workflow.id} id={`${instanceId}-panel-${workflow.id}`} role="tabpanel" aria-labelledby={`${instanceId}-tab-${workflow.id}`} hidden={activeId !== workflow.id} tabIndex={0} className={styles.panel}>
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
                  <Link className={styles.exploreLink} href={workflow.href}>Explore {workflow.name}<ArrowRight size={17} aria-hidden="true" /></Link>
                </div>
                <div className={styles.scene} data-node-id={SCENE_NODES[workflow.id]} data-product={workflow.id}>
                  <div role="img" aria-label={`Illustrative ${workflow.name} product loop`} className={styles.loopStage}>
                    <LoopVideo key={workflow.id} {...workLoop(workflow.id)} alt="" objectFit="contain" frameClassName={styles.loopFrame} sizes="(min-width: 960px) 640px, 90vw" />
                  </div>
                  <p className={styles.illustrationLabel}>Illustrative workflow · Example data</p>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
