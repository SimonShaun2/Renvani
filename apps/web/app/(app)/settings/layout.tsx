"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { settingsNavigation } from "@/src/lib/navigation";
import { cn } from "@/src/lib/utils";
import { isSettingsNavigationActive } from "@/src/lib/settings-navigation-state";

/** Renvani operator design: ink #0f1530, cream #fbf6ef, amber #f6b400.
 * The main AppShell hides its generic heading on /settings/* so these screens
 * have one settings section header and a separate section content heading.
 * Existing settings routes and permissions remain unchanged.
 */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-w-0 space-y-6 text-[#0f1530]">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#e6dccb] pb-5">
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[#5e6684]">Renvani / Manage</p>
          <h1 className="mt-2 text-[32px] font-semibold leading-tight tracking-[-0.03em] text-[#0f1530]">Settings</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5e6684]">
            Manage your business information, team and operating preferences.
          </p>
        </div>
      </header>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[220px_minmax(0,1fr)] xl:items-start">
        <aside className="min-w-0 rounded-[14px] border border-[#e6dccb] bg-white p-3 xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto">
          <p className="px-3 pb-3 pt-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[#5e6684]">Workspace settings</p>
          <nav aria-label="Settings sections" className="flex min-w-0 gap-1 overflow-x-auto pb-1 xl:flex-col xl:overflow-visible xl:pb-0">
            {settingsNavigation.map((item) => {
              const isActive = isSettingsNavigationActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 shrink-0 items-center gap-3 whitespace-nowrap rounded-[10px] px-3 py-2.5 text-[13px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1530] xl:w-full",
                    isActive
                      ? "bg-[#f6b400] text-[#0f1530]"
                      : "text-[#2a3360] hover:bg-[#f3eadc] hover:text-[#0f1530]"
                  )}
                >
                  <item.icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
