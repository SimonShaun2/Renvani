import type { ReactNode } from "react";

import { BrandMark } from "@/src/components/layout/BrandMark";
import { RENVANI_GROWTH_TAGLINE } from "@/src/lib/clerk/appearance";

export function AuthShell({ children }: { children: ReactNode }) {
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
