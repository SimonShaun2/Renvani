"use client";

import { usePathname } from "next/navigation";

import type { AuthSessionSnapshot } from "@/src/lib/auth";
import { cn } from "@/src/lib/utils";
import { useBreakpoint } from "@/src/hooks/useBreakpoint";

import { MobileBottomNav } from "./MobileBottomNav";
import { TechSidebar } from "./tablet/TechSidebar";

interface MobileAppShellProps {
  session: AuthSessionSnapshot;
  children: React.ReactNode;
}

function shouldHideNavigation(pathname: string) {
  return pathname.includes("/complete") || pathname.includes("/signature");
}

export function MobileAppShell({ session, children }: MobileAppShellProps) {
  const pathname = usePathname();
  const { isTablet } = useBreakpoint();
  const hideNavigation = shouldHideNavigation(pathname);

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      {isTablet && !hideNavigation ? (
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[280px] border-r border-white/5 md:block">
          <TechSidebar session={session} />
        </aside>
      ) : null}

      <div
        className={cn(
          "mx-auto min-h-screen w-full max-w-[100vw] overflow-x-hidden",
          isTablet && !hideNavigation ? "md:pl-[280px]" : ""
        )}
      >
        <main
          className={cn(
            "min-h-[100svh] w-full",
            !isTablet && !hideNavigation ? "pb-[72px]" : "",
            hideNavigation ? "pb-0" : ""
          )}
        >
          {children}
        </main>
      </div>

      {!isTablet && !hideNavigation ? <MobileBottomNav /> : null}
    </div>
  );
}
