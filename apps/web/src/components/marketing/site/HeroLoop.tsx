"use client";

import { LoopPauseButton } from "./LoopPauseButton";
import { LoopVideo } from "./LoopVideo";
import { MEDIA } from "./media-loops";
import styles from "./homepage.module.css";

/** Homepage hero loop + WCAG pause control (outside any links). */
export function HeroLoop() {
  return (
    <div className="relative h-full w-full">
      <LoopVideo
        {...MEDIA.hero}
        alt=""
        priority
        sizes="(min-width: 1440px) 960px, (min-width: 960px) 67vw, 100vw"
        className={styles.heroImage}
        frameClassName="absolute inset-0 h-full w-full"
      />
      <div className="absolute bottom-4 right-4 z-[3]">
        <LoopPauseButton label="hero" className="bg-white/90" />
      </div>
    </div>
  );
}
