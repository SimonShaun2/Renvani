import type { RelationalEntityHistoryDepth, RelationalJoinIssue } from "@fsm/types";

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
export const MULTI_YEAR_HISTORY_THRESHOLD_YEARS = 2;

export function parseBusinessDateToIsoDate(value: string): string | null {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString().slice(0, 10);
}

export function computeEntityHistoryDepth(
  entity: RelationalEntityHistoryDepth["entity"],
  datedValues: string[],
  undatedRowCount: number
): RelationalEntityHistoryDepth {
  const datedRowCount = datedValues.length;

  if (datedRowCount === 0) {
    return {
      entity,
      datedRowCount: 0,
      undatedRowCount,
      earliestBusinessDate: null,
      latestBusinessDate: null,
      spanYears: null,
      meetsMultiYearThreshold: false
    };
  }

  const timestamps = datedValues
    .map((isoDate) => Date.parse(`${isoDate}T00:00:00.000Z`))
    .filter((ms) => !Number.isNaN(ms));

  const earliestMs = Math.min(...timestamps);
  const latestMs = Math.max(...timestamps);
  const spanYears = timestamps.length >= 2 ? (latestMs - earliestMs) / MS_PER_YEAR : 0;

  return {
    entity,
    datedRowCount,
    undatedRowCount,
    earliestBusinessDate: new Date(earliestMs).toISOString().slice(0, 10),
    latestBusinessDate: new Date(latestMs).toISOString().slice(0, 10),
    spanYears: timestamps.length >= 2 ? spanYears : null,
    meetsMultiYearThreshold: spanYears >= MULTI_YEAR_HISTORY_THRESHOLD_YEARS
  };
}

export function readBusinessDateField(
  fields: Record<string, string | null>,
  fieldKey: string | undefined,
  row: number,
  entityLabel: string,
  issues: RelationalJoinIssue[]
): string | null {
  if (!fieldKey) {
    return null;
  }

  const raw = fields[fieldKey];
  if (raw === null || raw === undefined || raw.trim().length === 0) {
    issues.push({
      code: "missing_business_date",
      message: `Missing ${entityLabel} business date on preview row`,
      sourceRow: row,
      field: fieldKey
    });
    return null;
  }

  const isoDate = parseBusinessDateToIsoDate(raw.trim());
  if (!isoDate) {
    issues.push({
      code: "missing_business_date",
      message: `Unparseable ${entityLabel} business date "${raw}"`,
      sourceRow: row,
      field: fieldKey
    });
    return null;
  }

  return isoDate;
}
