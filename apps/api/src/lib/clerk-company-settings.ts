import type { CompanySettings } from "@fsm/types";

export function readClerkOrganizationIdFromSettings(settings: unknown): string | null {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return null;
  }
  const clerk = (settings as CompanySettings).clerk;
  const orgId = clerk?.organizationId;
  return typeof orgId === "string" && orgId.length > 0 ? orgId : null;
}
