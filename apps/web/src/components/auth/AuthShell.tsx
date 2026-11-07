import type { ReactNode } from "react";
import { BrandMark } from "@/src/components/layout/BrandMark";
import { geist, newsreader } from "@/src/components/marketing/site/fonts";
import { RENVANI_GROWTH_TAGLINE } from "@/src/lib/clerk/appearance";
import styles from "./sign-in.module.css";

interface AuthShellProps { children: ReactNode; variant?: "default" | "sign-in" }

export function AuthShell({ children, variant = "default" }: AuthShellProps) {
  if (variant === "sign-in") {
    return (
      <main className={`${geist.className} ${geist.variable} ${newsreader.variable} ${styles.shell}`} data-testid="renvani-sign-in-shell">
        <div className={styles.brand}>
          <BrandMark showTagline={false} />
          <p className={styles.tagline}>{RENVANI_GROWTH_TAGLINE}</p>
        </div>
        <section aria-label="Sign in to Renvani" className={styles.content}>{children}</section>
      </main>
    );
  }
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <BrandMark />
        <p className="text-lg font-semibold text-neutral-900">{RENVANI_GROWTH_TAGLINE}</p>
      </div>
      {children}
    </main>
  );
}
