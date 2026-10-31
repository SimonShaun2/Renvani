import { z } from "zod";

/**
 * Growth (home services): service-area ZIP coverage + 24/7 emergency availability.
 * Stored in `companies.settings.serviceArea` / `companies.settings.emergencyService` (jsonb, no migration).
 */

/** US ZIP: 5 digits, or ZIP+4 (`12345-6789` / `123456789`) normalized to the 5-digit ZIP. */
export const UsZipSchema = z
  .string()
  .trim()
  .regex(/^\d{5}(?:-?\d{4})?$/u, "Must be a 5-digit US ZIP or ZIP+4")
  .transform((value) => value.slice(0, 5));

export const SERVICE_AREA_MAX_ZIPS = 500;
export const SERVICE_AREA_MAX_RADIUS_MILES = 250;

export const UpdateServiceAreaBodySchema = z
  .object({
    zips: z.array(UsZipSchema).max(SERVICE_AREA_MAX_ZIPS),
    /** Stored for later (no ZIP-centroid dataset yet); coverage today is the ZIP list only. */
    radiusMiles: z.number().int().min(1).max(SERVICE_AREA_MAX_RADIUS_MILES).nullable().optional()
  })
  .strict();
export type UpdateServiceAreaBody = z.infer<typeof UpdateServiceAreaBodySchema>;

export interface ServiceAreaSettings {
  zips: string[];
  radiusMiles: number | null;
}

export const PublicServesZipBodySchema = z.object({ zip: UsZipSchema }).strict();
export type PublicServesZipBody = z.infer<typeof PublicServesZipBodySchema>;

export const UpdateEmergencyServiceBodySchema = z
  .object({
    enabled: z.boolean(),
    /** Free text shown on the shop site, e.g. "24/7, nights and weekends". */
    hoursText: z.string().trim().min(1).max(200).nullable().optional()
  })
  .strict();
export type UpdateEmergencyServiceBody = z.infer<typeof UpdateEmergencyServiceBodySchema>;

export interface EmergencyServiceSettings {
  enabled: boolean;
  hoursText: string | null;
}

/** Plug-in registry: a new trade adds one entry. Keys match the home-services trade keys. */
export interface HomeServiceEmergencyProfile {
  key: string;
  emergencyCapable: boolean;
  /** Typical emergency jobs for copy / triage (text keys, not enums). */
  emergencyExamples: readonly string[];
}

export const HOME_SERVICE_EMERGENCY_REGISTRY: Record<string, HomeServiceEmergencyProfile> = {
  hvac: { key: "hvac", emergencyCapable: true, emergencyExamples: ["no_heat", "no_cooling", "gas_smell"] },
  plumbing: { key: "plumbing", emergencyCapable: true, emergencyExamples: ["burst_pipe", "sewer_backup", "no_hot_water"] },
  electrical: { key: "electrical", emergencyCapable: true, emergencyExamples: ["power_outage", "sparking_outlet", "burning_smell"] },
  other: { key: "other", emergencyCapable: false, emergencyExamples: [] }
};

export function isEmergencyCapableTrade(trade: string | null | undefined): boolean {
  if (!trade) return true; // trade not set: the shop's own emergency setting decides
  return HOME_SERVICE_EMERGENCY_REGISTRY[trade]?.emergencyCapable ?? false;
}

export interface EmergencyRequestResolution {
  requested: boolean;
  accepted: boolean;
  /** true when the customer asked for emergency service but the shop does not offer it; the lead is kept as a normal request. */
  downgraded: boolean;
}

/** Downgrade (never reject) an emergency request when the shop has emergency service off or its trade is not emergency-capable. */
export function resolveEmergencyRequest(
  requested: boolean,
  settings: EmergencyServiceSettings,
  trade?: string | null
): EmergencyRequestResolution {
  if (!requested) return { requested: false, accepted: false, downgraded: false };
  const accepted = settings.enabled && isEmergencyCapableTrade(trade);
  return { requested: true, accepted, downgraded: !accepted };
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function readServiceAreaSettings(companySettings: unknown): ServiceAreaSettings {
  const raw = asObject(asObject(companySettings).serviceArea);
  const zips = Array.isArray(raw.zips) ? raw.zips.filter((z): z is string => typeof z === "string" && /^\d{5}$/u.test(z)) : [];
  const radius = typeof raw.radiusMiles === "number" && Number.isInteger(raw.radiusMiles) ? raw.radiusMiles : null;
  return { zips, radiusMiles: radius };
}

export function readEmergencyServiceSettings(companySettings: unknown): EmergencyServiceSettings {
  const raw = asObject(asObject(companySettings).emergencyService);
  return {
    enabled: raw.enabled === true,
    hoursText: typeof raw.hoursText === "string" && raw.hoursText.trim().length > 0 ? raw.hoursText : null
  };
}
