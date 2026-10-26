import type { CompanySettings } from "@fsm/types";

export const VIP_MEMBERSHIP_POLICY_DEFAULTS = {
  maxPauseMonths: 3,
  pastDueGraceDays: 7
} as const;

export interface ResolvedVipMembershipPolicy {
  maxPauseMonths: number;
  pastDueGraceDays: number;
}

export function resolveVipMembershipPolicy(
  settings: CompanySettings | null | undefined
): ResolvedVipMembershipPolicy {
  const raw = settings?.vipMembership;
  const maxPauseMonths = raw?.maxPauseMonths ?? VIP_MEMBERSHIP_POLICY_DEFAULTS.maxPauseMonths;
  const pastDueGraceDays = raw?.pastDueGraceDays ?? VIP_MEMBERSHIP_POLICY_DEFAULTS.pastDueGraceDays;

  return {
    maxPauseMonths,
    pastDueGraceDays
  };
}
