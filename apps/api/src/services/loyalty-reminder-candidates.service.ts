import { evaluateLoyaltyReminderCandidatesForCompany } from "@fsm/db";
import { featureFlags } from "@fsm/config/feature-flags";
import type { LoyaltyReminderCandidateV1 } from "@fsm/types";

export type LoyaltyReminderCandidate = LoyaltyReminderCandidateV1;

export async function listLoyaltyReminderCandidates(
  companyId: string,
  input: { horizonDays: number; importSessionId?: string | null; lapsedDays?: number }
): Promise<{ candidates: LoyaltyReminderCandidate[]; dryRun: boolean }> {
  // FEATURE FLAG: loyalty-reminders-enabled — FS-72 (default false)
  if (!featureFlags.loyaltyRemindersEnabled) {
    return { candidates: [], dryRun: true };
  }

  const dryRun = featureFlags.loyaltyRemindersDryRun;

  const candidates = await evaluateLoyaltyReminderCandidatesForCompany(companyId, {
    horizonDays: input.horizonDays,
    importSessionId: input.importSessionId ?? null,
    ...(input.lapsedDays !== undefined ? { lapsedDays: input.lapsedDays } : {}),
    dryRun
  });

  return { candidates, dryRun };
}
