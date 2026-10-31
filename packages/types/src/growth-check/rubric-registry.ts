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
