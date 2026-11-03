"use client";

import { useQuery } from "@tanstack/react-query";
import type { LoyaltyReminderCandidateV1 } from "@fsm/types";

import { api } from "@/src/lib/api";

/** Shape returned by GET /api/v1/loyalty/reminder-candidates (apps/api loyalty-reminder-candidates.service.ts). */
export interface LoyaltyReminderCandidatesResponse {
  candidates: LoyaltyReminderCandidateV1[];
  dryRun: boolean;
}

export interface LoyaltyReminderCandidatesQuery {
  horizonDays: number;
  lapsedDays?: number;
  importSessionId?: string;
}

export const loyaltyKeys = {
  all: ["loyalty"] as const,
  reminderCandidates: (q: LoyaltyReminderCandidatesQuery) => ["loyalty", "reminder-candidates", q] as const
};

export function reminderCandidatesPath(q: LoyaltyReminderCandidatesQuery): string {
  const params = new URLSearchParams({ horizonDays: String(q.horizonDays) });
  if (q.lapsedDays !== undefined) params.set("lapsedDays", String(q.lapsedDays));
  if (q.importSessionId) params.set("importSessionId", q.importSessionId);
  return `/api/v1/loyalty/reminder-candidates?${params.toString()}`;
}

export function useLoyaltyReminderCandidates(q: LoyaltyReminderCandidatesQuery, enabled = true) {
  return useQuery({
    queryKey: loyaltyKeys.reminderCandidates(q),
    queryFn: () => api.get<LoyaltyReminderCandidatesResponse>(reminderCandidatesPath(q)),
    enabled
  });
}
