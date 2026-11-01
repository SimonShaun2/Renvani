import type { CompanySettings } from "@fsm/types";

import { getCompany, updateCompany } from "../company.service.js";
import { activeGbpProviderId, getGbpProvider } from "./gbp-provider.registry.js";

export type GbpResource = "profile" | "hours" | "services" | "reviews";

export type GbpStatus = { optIn: boolean; provider: string; configured: boolean; updatedAt: string | null };

function readSettings(settings: unknown): CompanySettings["googleBusinessProfile"] {
  return ((settings ?? {}) as CompanySettings).googleBusinessProfile ?? null;
}

export async function getGbpStatus(companyId: string): Promise<GbpStatus> {
  const company = await getCompany(companyId);
  const gbp = readSettings(company.settings);
  const provider = activeGbpProviderId();
  return { optIn: gbp?.optIn === true, provider, configured: provider !== "disabled", updatedAt: gbp?.updatedAt ?? null };
}

export async function setGbpOptIn(companyId: string, actorId: string, optIn: boolean, now = new Date()): Promise<GbpStatus> {
  await updateCompany(companyId, actorId, { settings: { googleBusinessProfile: { optIn, updatedAt: now.toISOString() } } });
  return getGbpStatus(companyId);
}

/** Reads go through the active adapter. Shops that have not opted in never reach the adapter. */
export async function readGbp(companyId: string, resource: GbpResource) {
  const status = await getGbpStatus(companyId);
  if (!status.optIn) return { status: "not_opted_in" as const, provider: status.provider };
  const provider = getGbpProvider(status.provider);
  switch (resource) {
    case "profile":
      return provider.getProfile(companyId);
    case "hours":
      return provider.getHours(companyId);
    case "services":
      return provider.listServices(companyId);
    case "reviews":
      return provider.listReviews(companyId);
  }
}
