"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/src/lib/route-access";
import { isOwnerHomePath } from "@/src/lib/owner-home";
import { hasDedicatedOperatorHeading } from "./operator-screen-headings";
import { cn } from "@/src/lib/utils";
import { geist, newsreader } from "@/src/components/marketing/site/fonts";
import { Header } from "./Header";
import { MobileNav } from "./MobileNav";
import { Sidebar } from "./Sidebar";
import styles from "./workspace-shell.module.css";

interface AppShellProps { children: ReactNode; companyName: string; role: UserRole; userName: string }

export function AppShell({ children, companyName, role, userName }: AppShellProps) {
  const pathname = usePathname();
  const isMobileRoute = pathname === "/mobile" || pathname.startsWith("/mobile/");
  // Dedicated owner overview screens provide their own Renvani page heading.
  const usesOwnPageHeading = isOwnerHomePath(pathname) || hasDedicatedOperatorHeading(pathname);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  return (
    <div className={cn(isMobileRoute ? "min-h-screen bg-neutral-100 text-neutral-900" : `${styles.office} ${geist.variable} ${newsreader.variable}`)}>
      {!isMobileRoute ? <aside className={styles.rail}><Sidebar companyName={companyName} role={role} userName={userName} /></aside> : null}
      <div className={isMobileRoute ? "flex min-h-screen flex-col" : styles.body}>
        {/* The owner home supplies its own Figma header, avoiding the old duplicate Dashboard strip. */}
        {!usesOwnPageHeading || isMobileRoute ? <Header companyName={companyName} role={role} userName={userName} /> : null}
        {!isMobileRoute ? <div
          className={styles.mobileNavigation}
          onKeyDown={(event) => {
            if (menuOpen && event.key === "Escape") {
              event.preventDefault();
              setMenuOpen(false);
              menuButton.current?.focus();
            }
          }}
        >
          <div className={styles.mobileBar}><span>{companyName}</span><button ref={menuButton} type="button" aria-expanded={menuOpen} aria-controls="office-mobile-navigation" onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? "Close navigation" : "Navigation"}</button></div>
          {menuOpen ? <div id="office-mobile-navigation" className={styles.mobilePanel}><Sidebar companyName={companyName} role={role} userName={userName} onNavigate={() => setMenuOpen(false)} /></div> : null}
        </div> : null}
        <main className={isMobileRoute ? "flex-1 px-4 py-6 pb-24 md:px-8 md:py-8" : styles.main}>{children}</main>
      </div>
      {isMobileRoute ? <MobileNav /> : null}
    </div>
  );
}
