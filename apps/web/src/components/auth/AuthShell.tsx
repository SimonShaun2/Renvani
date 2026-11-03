import type { ReactNode } from "react";

import { BrandMark } from "@/src/components/layout/BrandMark";
import { geist, newsreader } from "@/src/components/marketing/site/fonts";
import { RENVANI_GROWTH_TAGLINE } from "@/src/lib/clerk/appearance";

interface AuthShellProps {
  children: ReactNode;
  variant?: "default" | "sign-in";
}

/**
 * Sign-in styling follows the canonical desktop/tablet/mobile frames:
 * Figma 388:4218, 388:4269, and 388:4320.
 * The authentication UI and actions remain owned by Clerk.
 */
export function AuthShell({ children, variant = "default" }: AuthShellProps) {
  if (variant === "sign-in") {
    return (
      <main
        className={`${geist.className} flex min-h-dvh flex-col items-center gap-6 bg-[#fbf6ef] px-4 py-10 text-[#0f1530] sm:py-20`}
        data-testid="renvani-sign-in-shell"
      >
        <div className="flex w-full flex-col items-center gap-[10px] text-center">
          <div className="flex items-center gap-2">
            <div className="grid size-6 grid-cols-2 gap-[2px]" aria-hidden="true">
              <span className="rounded-tr-[11px] bg-[#0f1530]" />
              <span className="rounded-tr-[11px] bg-[#f6b400]" />
              <span className="rounded-tr-[11px] bg-[#0f1530]" />
              <span className="rounded-tr-[11px] bg-[#0f1530]" />
            </div>
            <span className={`${newsreader.className} text-[22px] italic leading-none`}>Renvani</span>
          </div>
          <p className="max-w-full text-center text-base font-semibold leading-[1.4] sm:text-xl">
            {RENVANI_GROWTH_TAGLINE}
          </p>
        </div>
        <section aria-label="Sign in to Renvani" className="w-full max-w-[440px]">
          {children}
        </section>
      </main>
    );
  }

  // Keep the existing sign-up and workspace-auth presentation unchanged.
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
