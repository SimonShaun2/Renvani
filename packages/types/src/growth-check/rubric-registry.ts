import { HOME_SERVICES_RUBRIC_V1 } from "./rubric-home-services-v1.js";
import { RESIDENTIAL_CLEANING_RUBRIC_V1 } from "./rubric-residential-cleaning-v1.js";
import type { GrowthCheckRubricDefinition } from "./types.js";

/** Rubric registry (id -> definition). Append entries to extend; ids are stored on scans. */
export const GROWTH_CHECK_RUBRIC_REGISTRY: Readonly<Record<string, GrowthCheckRubricDefinition>> = {
  [RESIDENTIAL_CLEANING_RUBRIC_V1.id]: RESIDENTIAL_CLEANING_RUBRIC_V1,
  [HOME_SERVICES_RUBRIC_V1.id]: HOME_SERVICES_RUBRIC_V1
};

export function getGrowthCheckRubricById(rubricId: string): GrowthCheckRubricDefinition | null {
  return Object.prototype.hasOwnProperty.call(GROWTH_CHECK_RUBRIC_REGISTRY, rubricId)
    ? GROWTH_CHECK_RUBRIC_REGISTRY[rubricId]!
    : null;
}

export function getGrowthCheckRubricCheckLabel(rubricId: string, checkId: string): string | null {
  const rubric = getGrowthCheckRubricById(rubricId);
  for (const area of rubric?.areas ?? []) {
    const check = area.checks.find((candidate) => candidate.id === checkId);
    if (check) return check.label;
  }
  return null;
}

/** Default rubric for new scans: field/home services (HVAC, plumbing, electrical). Stored scans keep their own rubricId. */
export const GROWTH_CHECK_DEFAULT_RUBRIC_ID: string = HOME_SERVICES_RUBRIC_V1.id;

/**
 * Shop trade -> rubric id for new scans. Text-key registry; add a trade or point it at a trade-specific
 * rubric by appending here. Unknown or missing trades fall back to GROWTH_CHECK_DEFAULT_RUBRIC_ID.
 */
export const GROWTH_CHECK_TRADE_RUBRIC_REGISTRY: Readonly<Record<string, string>> = {
  hvac: HOME_SERVICES_RUBRIC_V1.id,
  plumbing: HOME_SERVICES_RUBRIC_V1.id,
  electrical: HOME_SERVICES_RUBRIC_V1.id,
  other: HOME_SERVICES_RUBRIC_V1.id
};

export function resolveGrowthCheckRubricIdForTrade(trade: string | null | undefined): string {
  if (trade && Object.prototype.hasOwnProperty.call(GROWTH_CHECK_TRADE_RUBRIC_REGISTRY, trade)) {
    const mapped = GROWTH_CHECK_TRADE_RUBRIC_REGISTRY[trade]!;
    if (getGrowthCheckRubricById(mapped)) return mapped;
  }
  return GROWTH_CHECK_DEFAULT_RUBRIC_ID;
}
