import { newsreader } from "@/src/components/marketing/site/fonts";
import { cn } from "@/src/lib/utils";
import styles from "./brand-mark.module.css";

interface BrandMarkProps {
  compact?: boolean;
  light?: boolean;
  showTagline?: boolean;
  variant?: "default" | "sidebar";
}

export function BrandMark({ compact = false, light = false, showTagline = true, variant = "default" }: BrandMarkProps) {
  return (
    <div className={cn(styles.brand, compact && styles.compact, light && styles.light)}>
      {variant === "sidebar" ? <span className={styles.sidebarMark} aria-hidden="true" /> : (
        <span className={styles.mark} aria-hidden="true">
          <span className={styles.petal} /><span className={cn(styles.petal, styles.accent)} />
          <span className={styles.petal} /><span className={styles.petal} />
        </span>
      )}
      <div className={styles.copy}>
        <p className={cn(newsreader.className, styles.wordmark)}>Renvani</p>
        {showTagline ? <p className={styles.tagline}>Grow your shop. Renvani runs the rest.</p> : null}
      </div>
    </div>
  );
}
