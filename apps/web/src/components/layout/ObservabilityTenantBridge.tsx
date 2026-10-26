"use client";

import { useEffect } from "react";

import type { AuthSessionSnapshot } from "@/src/lib/auth";
import { registerWebTenantContext } from "@/src/lib/observability/client";

export function ObservabilityTenantBridge({ session }: { session: AuthSessionSnapshot }) {
  useEffect(() => {
    registerWebTenantContext({
      companyId: session.company.id,
      userId: session.user.id
    });
  }, [session.company.id, session.user.id]);

  return null;
}
