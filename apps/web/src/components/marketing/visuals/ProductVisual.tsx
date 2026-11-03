"use client";

import { useEffect, useRef, useState } from "react";

import {
  CHIP_LABELS,
  formatCounter,
  type ChipKind,
  type ProductVisualContent,
  type VisualCard
} from "@/src/content/marketing-content";

import {
  COUNTER_EASE,
  EASE,
  TIMING,
  layerStyle,
  useInViewOnce,
  useIsCoarsePointer,
  usePrefersReducedMotion
} from "./motion";

const CHIP_STYLE: Record<ChipKind, { bg: string; fg: string; dot: string }> = {
  agent: { bg: "var(--color-mkt-blue-soft)", fg: "var(--color-mkt-blue)", dot: "var(--color-mkt-blue)" },
  team: { bg: "var(--color-mkt-green-soft)", fg: "var(--color-mkt-green)", dot: "var(--color-mkt-green)" },
  owner: { bg: "var(--color-mkt-amber-soft)", fg: "var(--color-mkt-ink)", dot: "var(--color-mkt-ink)" }
};

function Chip({ kind, style }: { kind: ChipKind; style?: React.CSSProperties }) {
  const c = CHIP_STYLE[kind];
  return (
    <span
      data-chip={kind}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[5px] text-xs font-semibold"
      style={{ background: c.bg, color: c.fg, ...style }}
    >
      <span aria-hidden className="size-[7px] rounded-full" style={{ background: c.dot }} />
      {CHIP_LABELS[kind]}
    </span>
  );
}

function ExampleBadge() {
  return (
    <span
      className="rounded-full px-2 py-[3px] text-[11px] font-semibold"
      style={{ background: "var(--color-mkt-amber)", color: "var(--color-mkt-ink)" }}
    >
      Example
    </span>
  );
}

export function useCounter(target: number, run: boolean, reduced: boolean): number {
  const [value, setValue] = useState(reduced ? target : 0);
  useEffect(() => {
    if (reduced) {
      setValue(target);
      return;
    }
    if (!run) return;
    let raf = 0;
    const start = performance.now() + TIMING.tick.delay;
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / TIMING.tick.duration));
      setValue(Math.round(target * COUNTER_EASE(t)));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, run, reduced]);
  return value;
}

type ClickPhase = "idle" | "glide" | "press" | "done";

function FloatCard({
  card,
  style,
  className,
  phase,
  reduced
}: {
  card: VisualCard;
  style: React.CSSProperties;
  className?: string;
  phase: ClickPhase;
  reduced: boolean;
}) {
  const swapped = card.actionLabel && phase === "done";
  return (
    <div
      data-layer={card.actionLabel ? "cardA" : "card"}
      className={`flex flex-col items-start gap-2 rounded-2xl border bg-white p-[18px] shadow-[0_2px_6px_rgba(15,20,48,0.06),0_18px_40px_rgba(15,20,48,0.18)] ${className ?? ""}`}
      style={{ borderColor: "var(--color-mkt-line)", ...style }}
    >
      <div className="flex items-center gap-2">
        <ExampleBadge />
        <span className="relative inline-grid">
          <Chip
            kind={card.chip}
            style={{ gridArea: "1/1", opacity: swapped ? 0 : 1, transition: `opacity ${TIMING.chip.duration}ms ${EASE}` }}
          />
          {card.actionLabel ? (
            <Chip
              kind="team"
              style={{ gridArea: "1/1", opacity: swapped ? 1 : 0, transition: `opacity ${TIMING.chip.duration}ms ${EASE}` }}
            />
          ) : null}
        </span>
      </div>
      <p className="text-[17px] font-semibold" style={{ color: "var(--color-mkt-ink)" }}>
        {card.title}
      </p>
      <p className="text-sm" style={{ color: "var(--color-mkt-muted)" }}>
        {card.detail}
      </p>
      {card.actionLabel ? (
        <span
          data-approve
          className="inline-flex min-h-[44px] items-center justify-center rounded-full px-5 py-3 text-[15px] font-medium"
          style={{
            background: "var(--color-mkt-amber)",
            color: "var(--color-mkt-ink)",
            transform: phase === "press" && !reduced ? "scale(0.96)" : "none",
            transition: `transform ${TIMING.press.duration / 2}ms ${EASE}`
          }}
        >
          {card.actionLabel}
        </span>
      ) : null}
    </div>
  );
}

export function ProductVisual({ content }: { content: ProductVisualContent }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const coarse = useIsCoarsePointer();
  const inView = useInViewOnce(ref);
  const shown = inView || reduced;
  const [animating, setAnimating] = useState(false);
  const [phase, setPhase] = useState<ClickPhase>("idle");
  const count = useCounter(content.counter.value, inView, reduced);

  useEffect(() => {
    if (!inView || reduced) return;
    setAnimating(true);
    const end = window.setTimeout(() => setAnimating(false), 1500);
    return () => window.clearTimeout(end);
  }, [inView, reduced]);

  useEffect(() => {
    if (!content.clickThrough) return;
    if (reduced) {
      setPhase("done");
      return;
    }
    if (!inView) return;
    const glide = coarse ? 0 : TIMING.cursor.duration;
    const timers = [
      coarse ? 0 : window.setTimeout(() => setPhase("glide"), TIMING.cursor.delay),
      window.setTimeout(() => setPhase("press"), TIMING.cursor.delay + glide),
      window.setTimeout(() => setPhase("done"), TIMING.cursor.delay + glide + TIMING.press.duration)
    ];
    return () => timers.forEach((t) => t && window.clearTimeout(t));
  }, [inView, reduced, coarse, content.clickThrough]);

  const s = (layer: Parameters<typeof layerStyle>[0]) => layerStyle(layer, { shown, reduced, animating });
  const showCursor = content.clickThrough && !reduced && !coarse && phase !== "idle" && phase !== "done";

  return (
    <div
      ref={ref}
      data-testid={`visual-${content.slug}`}
      data-reduced-motion={reduced ? "true" : "false"}
      className="relative w-full overflow-hidden rounded-3xl md:aspect-[1200/720]"
      style={{ background: "var(--color-mkt-cream)" }}
    >
      {/* Accent glow: static, does not animate */}
      <img
        src="/marketing/accent-glow.svg"
        alt=""
        aria-hidden
        width={380}
        height={380}
        className="pointer-events-none absolute right-[-60px] top-[-40px] w-[260px] md:left-[63.3%] md:right-auto md:top-[5.5%] md:w-[31.7%]"
      />
      <div className="relative flex flex-col gap-4 p-4 md:absolute md:inset-0 md:block md:p-0">
        {/* App panel */}
        <div
          data-layer="panel"
          className="relative overflow-hidden rounded-[18px] bg-white shadow-[0_4px_10px_rgba(15,20,48,0.06),0_30px_60px_rgba(15,20,48,0.16)] md:absolute md:left-[9.2%] md:top-[20.8%] md:w-[58.3%]"
          style={s("panel")}
        >
          <div className="flex items-center gap-2 px-5 py-3.5" style={{ background: "var(--color-mkt-ink)" }}>
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: "var(--color-mkt-amber)" }} />
            {content.panelTitle ? <p className="text-sm font-semibold text-white">{content.panelTitle}</p> : null}
          </div>
          <div className="flex flex-col gap-2 p-4">
            {content.rows.map((row, i) => (
              <div
                key={row.title}
                className={`relative flex flex-wrap items-center gap-3 rounded-[10px] px-4 py-3.5 ${i === 2 ? "max-md:hidden" : ""}`}
                style={{ background: i === 0 ? "var(--color-mkt-amber-soft)" : "white" }}
              >
                <p className="min-w-0 flex-1 text-[15px] font-semibold" style={{ color: "var(--color-mkt-ink)" }}>
                  {row.title}
                </p>
                <p className="text-sm md:text-[13px]" style={{ color: "var(--color-mkt-muted)" }}>
                  {row.meta}
                </p>
                {row.chip ? <Chip kind={row.chip} /> : null}
                {i === 0 ? (
                  <span
                    data-layer="ring"
                    aria-hidden
                    className="pointer-events-none absolute -inset-1 rounded-[14px] border-[3px] shadow-[0_0_16px_2px_rgba(245,178,0,0.35)]"
                    style={{ borderColor: "var(--color-mkt-amber)", ...s("ring") }}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <FloatCard
          card={content.cardA}
          phase={phase}
          reduced={reduced}
          className="relative md:absolute md:left-[69.2%] md:top-[5.5%] md:w-[27.5%]"
          style={s("cardA")}
        />
        <FloatCard
          card={content.cardB}
          phase={phase}
          reduced={reduced}
          className="relative md:absolute md:left-[5%] md:top-[72.2%] md:w-[27.5%]"
          style={s("cardB")}
        />

        <div
          data-layer="counter"
          className="relative flex flex-col items-start gap-0.5 rounded-2xl p-[18px] shadow-[0_18px_40px_rgba(15,20,48,0.25)] md:absolute md:left-[70%] md:top-[65.3%] md:w-[21.7%]"
          style={{ background: "var(--color-mkt-ink)", ...s("counter") }}
        >
          <ExampleBadge />
          <p data-testid="counter-value" className="text-[34px] font-semibold" style={{ color: "var(--color-mkt-amber)" }}>
            {formatCounter(count, content.counter.format)}
          </p>
          <p className="text-sm text-white md:text-[13px]">{content.counter.label}</p>
        </div>

        {showCursor ? (
          <svg
            data-testid="cursor"
            aria-hidden
            width="24"
            height="24"
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-[76%] top-[30%] hidden md:block"
            style={{
              animation: `mkt-cursor-glide ${TIMING.cursor.duration}ms ${EASE} both`
            }}
          >
            <path d="M4 2l16 9-7 2-3 7z" fill="var(--color-mkt-ink)" stroke="white" strokeWidth="1.5" />
          </svg>
        ) : null}
      </div>
    </div>
  );
}
