"use client";

import { useEffect, useState } from "react";

import { useCompany } from "@/src/hooks/company.hooks";

import { EMPTY, NEUTRAL_GREETING, greetingFor } from "./command-center.config";

/** Hour in `timeZone` (shop tz when known), else the viewer's local hour. */
export function hourIn(date: Date, timeZone?: string): number {
  if (!timeZone) return date.getHours();
  try {
    return Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone }).format(date));
  } catch {
    return date.getHours();
  }
}

function useViewerNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  return now;
}

function useShopTimeZone(): string | undefined {
  return useCompany().data?.company.timezone || undefined;
}

/** Server renders a neutral greeting; the browser swaps in the time-of-day greeting after mount. */
export function LocalGreeting() {
  const now = useViewerNow();
  const tz = useShopTimeZone();
  return <>{now ? greetingFor(hourIn(now, tz)) : NEUTRAL_GREETING}</>;
}

function fmt(now: Date | null, tz: string | undefined, options: Intl.DateTimeFormatOptions) {
  if (!now) return EMPTY;
  try {
    return now.toLocaleDateString("en-US", { ...options, ...(tz ? { timeZone: tz } : {}) });
  } catch {
    return now.toLocaleDateString("en-US", options);
  }
}

export function LocalDate({ month = false }: { month?: boolean }) {
  const now = useViewerNow();
  const tz = useShopTimeZone();
  return <>{fmt(now, tz, month ? { month: "short" } : { weekday: "long", month: "short", day: "numeric" })}</>;
}
