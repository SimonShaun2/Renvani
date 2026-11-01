"use client";

import { useQuery } from "@tanstack/react-query";

import type { CommandCenterBrief, CommandCenterBriefQuery } from "@fsm/types";

import { ApiError, api } from "@/src/lib/api";

export const commandCenterKeys = {
  all: ["command-center"] as const,
  brief: (timeZone?: string) => [...commandCenterKeys.all, "brief", timeZone ?? "company"] as const
};

/** v1 supports `period=month` only (calendar month vs previous month). `last_30_days` returns 400: never sent. */
export const BRIEF_PERIOD: NonNullable<CommandCenterBriefQuery["period"]> = "month";

export function briefPath(timeZone?: string): string {
  const params = new URLSearchParams({ period: BRIEF_PERIOD });
  if (timeZone) params.set("timeZone", timeZone);
  return `/api/v1/command-center/brief?${params.toString()}`;
}

export const isForbidden = (err: unknown) => err instanceof ApiError && err.status === 403;

/** GET /api/v1/command-center/brief (owner/admin only; 403 for other roles, so callers pass `enabled: false`). */
export function useCommandCenterBrief(enabled: boolean, timeZone?: string) {
  return useQuery({
    queryKey: commandCenterKeys.brief(timeZone),
    enabled,
    queryFn: () => api.get<CommandCenterBrief>(briefPath(timeZone)),
    retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2
  });
}
