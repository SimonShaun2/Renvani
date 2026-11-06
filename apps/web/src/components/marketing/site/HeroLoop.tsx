"use client";

import { LoopVideo } from "./LoopVideo";
import { MEDIA } from "./media-loops";
import styles from "./homepage.module.css";

/** Homepage hero loop: autoplays at window load; poster stays LCP. */
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
    </div>
  );
}
