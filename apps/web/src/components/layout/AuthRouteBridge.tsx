"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { getAuthToken, type AuthSessionSnapshot } from "@/src/lib/auth";
import { getDefaultRouteForRole } from "@/src/lib/route-access";
import { useAuthStore } from "@/src/stores/auth.store";

interface AuthRouteBridgeProps {
  session: AuthSessionSnapshot;
  children: ReactNode;
}

export function AuthRouteBridge({ session, children }: AuthRouteBridgeProps) {
  const pathname = usePathname();
  const router = useRouter();
  const role = useAuthStore((state) => state.user?.role ?? session.role);
  const hydrateSession = useAuthStore((state) => state.hydrateSession);
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    hydrateSession(session.user, session.company);

    const legacyToken = getAuthToken();

    if (!legacyToken) {
      return;
    }

    setAuth(session.user, session.company, legacyToken);
  }, [hydrateSession, session, setAuth]);

  useEffect(() => {
    const isOwnerSurface =
      pathname === "/dashboard" ||
      pathname.startsWith("/dashboard/") ||
      pathname === "/ai-revenue-center" ||
      pathname.startsWith("/ai-revenue-center/");

    if (!isOwnerSurface) {
      return;
    }

    if (role === "technician") {
      router.replace("/mobile/jobs");
      return;
    }

    if (role === "dispatcher" || role === "office") {
      router.replace("/dispatch");
      return;
    }

    const defaultRoute = getDefaultRouteForRole(role);

    if (defaultRoute !== "/dashboard" && defaultRoute !== "/ai-revenue-center") {
      router.replace(defaultRoute);
    }
  }, [pathname, role, router]);

  return children;
}
