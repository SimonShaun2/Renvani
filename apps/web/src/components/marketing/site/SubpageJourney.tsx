"use client";

import { CheckCircle2, Pause, Play, RotateCcw } from "lucide-react";
import { useId, type ReactNode } from "react";
import { useWorkflowPlayback } from "./useWorkflowPlayback";
import styles from "./subpage.module.css";

export type JourneyStep = { title: string; body: string; record?: { title: string; fields: readonly string[]; status: string } };

/** An illustrative marketing sequence. No messaging, bookings, job state or money is changed. */
export function SubpageJourney({ name, steps, artwork }: { name: string; steps: readonly JourneyStep[]; artwork?: ReactNode }) {
  const playback = useWorkflowPlayback(name, steps.length, 0.08);
  const id = useId();
  const active = steps[playback.step];
  if (!active) return null;
  return <div className={styles.journey} ref={playback.viewportRef} data-subpage-journey={name} data-step={playback.step} data-playing={playback.playing} data-reduced-motion={playback.reducedMotion}>
    <div className={styles.steps} role="group" aria-label={`${name} workflow steps`}>{steps.map((step, index) => <button key={step.title} type="button" className={styles.step} aria-current={playback.step === index ? "step" : undefined} aria-controls={`${id}-visual`} onClick={() => playback.selectStep(index)}><span className={styles.stepNumber}>{String(index+1).padStart(2,"0")}</span><span><span className={styles.stepTitle}>{step.title}</span><span className={styles.stepBody}>{step.body}</span></span></button>)}</div>
    <div className={styles.journeyVisual} id={`${id}-visual`}>
      {artwork ?? <div className={styles.tradePanel} role="img" aria-label={`Illustrative ${name} workflow: ${active.record?.title ?? active.title}. ${active.record?.status ?? active.body}`}><div aria-hidden="true"><div className={styles.tradePanelHead}><span>Renvani · {name}</span><span className={styles.example}>Example</span></div><p className={styles.tradeTitle}>{active.record?.title ?? active.title}</p><div className={styles.tradeFields}>{active.record?.fields.map(field => <div className={styles.tradeField} key={field}>{field}</div>)}</div><div className={styles.tradeState}><CheckCircle2 size={18} /><span>{active.record?.status ?? active.title}</span></div></div></div>}
      {artwork ? <p className={styles.journeyStatus}>{active.title}</p> : null}
      <div className={styles.progress} aria-hidden="true" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>{steps.map((step,index) => <span key={step.title} data-active={index <= playback.step} />)}</div>
      <div className={styles.playback}><span>Illustrative workflow{playback.reducedMotion ? " · Reduced motion" : ""}</span><div className={styles.playbackButtons}>{!playback.reducedMotion ? <button type="button" onClick={playback.togglePaused} aria-label={`${playback.paused ? "Play" : "Pause"} ${name} animation`}>{playback.paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}{playback.paused ? "Play" : "Pause"}</button> : null}<button type="button" onClick={playback.replay} aria-label={playback.reducedMotion ? `Show complete ${name} workflow` : `Replay ${name} animation`}><RotateCcw size={14} aria-hidden="true" />{playback.reducedMotion ? "Complete view" : "Replay"}</button></div></div>
    </div>
  </div>;
}
