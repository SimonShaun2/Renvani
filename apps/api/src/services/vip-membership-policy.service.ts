import type { VipMembershipPolicyInput } from "@fsm/types";
import { resolveVipMembershipPolicy } from "@fsm/config/vip-membership-policy";

import { getCompany, updateCompany } from "./company.service.js";
import type { CompanySettings } from "@fsm/types";

export function getVipMembershipPolicyForCompany(settings: CompanySettings | null | undefined) {
  return resolveVipMembershipPolicy(settings ?? undefined);
}

export async function updateVipMembershipPolicy(
  companyId: string,
  actorId: string,
  input: VipMembershipPolicyInput
) {
  const company = await updateCompany(companyId, actorId, {
    settings: {
      vipMembership: {
        ...(input.maxPauseMonths !== undefined ? { maxPauseMonths: input.maxPauseMonths } : {}),
        ...(input.pastDueGraceDays !== undefined ? { pastDueGraceDays: input.pastDueGraceDays } : {})
      }
    }
  });

  return getVipMembershipPolicyForCompany(company.settings as CompanySettings | null | undefined);
}

export async function loadVipMembershipPolicy(companyId: string) {
  const company = await getCompany(companyId);
  return getVipMembershipPolicyForCompany(company.settings as CompanySettings | null | undefined);
}
