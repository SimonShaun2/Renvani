"use client";

import { format } from "date-fns";
import { LogOut, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { completeClientLogout } from "@/src/lib/client-logout";
import { getPageMeta } from "@/src/lib/page-meta";
import type { UserRole } from "@/src/lib/route-access";
import { cn } from "@/src/lib/utils";
import { useAuthStore } from "@/src/stores/auth.store";

interface HeaderProps {
  companyName: string;
  role: UserRole;
  userName: string;
}

export function Header({ companyName, role, userName }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const pageMeta = getPageMeta(pathname);
  const isDispatchRoute = pathname === "/dispatch" || pathname.startsWith("/dispatch/");
  const isDashboardRoute = pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  async function handleLogout() {
    await completeClientLogout({ clearAuth, redirect: (path) => router.replace(path) });
  }

  return (
    <header className="sticky top-0 z-30 flex h-header items-center justify-between border-b border-neutral-200 bg-white/95 px-4 backdrop-blur md:px-8">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-[0.24em] text-neutral-500">{companyName}</p>
        <h1 className="truncate text-xl font-semibold tracking-tight text-neutral-900">{pageMeta.title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {isDispatchRoute ? (
          <label className="hidden items-center gap-2 rounded-full border border-neutral-200 bg-neutral-100 px-4 py-2 text-sm text-neutral-500 md:flex">
            <Search className="h-4 w-4" />
            <input
              type="search"
              aria-label="Search dispatch"
              placeholder="Search jobs, customers, techs"
              className="w-56 bg-transparent outline-none placeholder:text-neutral-500"
            />
          </label>
        ) : null}

        {isDashboardRoute ? (
          <div className="hidden rounded-full border border-neutral-200 bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-600 md:block">
            {format(new Date(), "EEEE, MMM d")}
          </div>
        ) : null}

        <div className="flex items-center gap-3 rounded-full border border-neutral-200 bg-white px-2 py-2 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary text-sm font-semibold text-white">
            {userName
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase() ?? "")
              .join("")}
          </div>
          <div className="hidden pr-2 md:block">
            <p className="text-sm font-semibold text-neutral-900">{userName}</p>
            <p className={cn("text-xs capitalize text-neutral-500", role === "office" && "normal-case")}>
              {role === "office" ? "Office" : role}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void handleLogout();
            }}
            className="rounded-full p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
