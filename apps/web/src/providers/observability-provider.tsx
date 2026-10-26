"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

import { initWebObservability } from "@/src/lib/observability/client";

export function ObservabilityProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    initWebObservability();
  }, []);

  return children;
}
