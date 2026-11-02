import { AppError, ErrorCode } from "@fsm/types";

/**
 * Growth: Google Business Profile (GBP) provider registry. Same plug-in pattern as the geo provider
 * registry: text ids, no pgEnum. The only built-in adapter is `disabled`, which makes no network
 * calls, reads no keys and returns a typed "not_configured" result. A real adapter is registered
 * later (see docs/integrations/google-business-profile.md) once Shaun adds credentials.
 */
export type GbpNotConfigured = { status: "not_configured"; provider: string; reason: "adapter_disabled" };
export type GbpOk<T> = { status: "ok"; provider: string; data: T };
export type GbpResult<T> = GbpOk<T> | GbpNotConfigured;

export type GbpProfile = { locationName: string; title: string; phone: string | null; websiteUri: string | null };
export type GbpHoursPeriod = { day: "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN"; open: string; close: string };
export type GbpHours = { periods: GbpHoursPeriod[] };
export type GbpService = { name: string; description: string | null };
export type GbpReview = { reviewId: string; rating: number; comment: string | null; createTime: string };

export interface GbpProvider {
  id: string;
  getProfile(companyId: string): Promise<GbpResult<GbpProfile>>;
  getHours(companyId: string): Promise<GbpResult<GbpHours>>;
  listServices(companyId: string): Promise<GbpResult<GbpService[]>>;
  listReviews(companyId: string): Promise<GbpResult<GbpReview[]>>;
}

export const DISABLED_GBP_PROVIDER_ID = "disabled";

const providers = new Map<string, GbpProvider>();

export function registerGbpProvider(provider: GbpProvider): void {
  if (!/^[a-z][a-z0-9_]{0,63}$/.test(provider.id)) throw new Error(`Invalid GBP provider id: ${provider.id}`);
  providers.set(provider.id, provider);
}

export function getGbpProvider(id: string): GbpProvider {
  const provider = providers.get(id);
  if (!provider) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, `GBP_PROVIDER_UNKNOWN: provider "${id}" is not registered`);
  }
  return provider;
}

export function listGbpProviderIds(): string[] {
  return [...providers.keys()];
}

const notConfigured = (): GbpNotConfigured => ({
  status: "not_configured",
  provider: DISABLED_GBP_PROVIDER_ID,
  reason: "adapter_disabled"
});

export const disabledGbpProvider: GbpProvider = {
  id: DISABLED_GBP_PROVIDER_ID,
  getProfile: async () => notConfigured(),
  getHours: async () => notConfigured(),
  listServices: async () => notConfigured(),
  listReviews: async () => notConfigured()
};

registerGbpProvider(disabledGbpProvider);

/** Active adapter id. Disabled until a real adapter is registered and selected here. */
export function activeGbpProviderId(): string {
  return DISABLED_GBP_PROVIDER_ID;
}
