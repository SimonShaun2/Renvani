"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/src/lib/route-access";
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
  return (
    <div className={cn(isMobileRoute ? "min-h-screen bg-neutral-100 text-neutral-900" : `${styles.office} ${geist.variable} ${newsreader.variable}`)}>
      {!isMobileRoute ? <aside className={styles.rail}><Sidebar companyName={companyName} role={role} userName={userName} /></aside> : null}
      <div className={isMobileRoute ? "flex min-h-screen flex-col" : styles.body}>
        <Header companyName={companyName} role={role} userName={userName} />
        <main className={isMobileRoute ? "flex-1 px-4 py-6 pb-24 md:px-8 md:py-8" : styles.main}>{children}</main>
      </div>
      {isMobileRoute ? <MobileNav /> : null}
    </div>
  );
}
