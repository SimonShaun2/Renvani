import type { MigrateRelationalPreviewResponse } from "@fsm/types";

export function formatHistoryDepthSummary(
  historyDepth: MigrateRelationalPreviewResponse["graph"]["historyDepth"]
): string {
  if (historyDepth.length === 0) {
    return "No job or estimate history files linked yet.";
  }

  return historyDepth
    .map((depth) => {
      const span =
        depth.spanYears !== null ? `${depth.spanYears} year span` : "date span unknown";
      const threshold = depth.meetsMultiYearThreshold ? "meets multi-year threshold" : "under 2-year threshold";
      return `${depth.entity}: ${depth.datedRowCount} dated rows (${span}, ${threshold})`;
    })
    .join(" · ");
}
