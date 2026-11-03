/** Missing, failed and loading responses are never empty business records. */
export interface OwnerRequest<T = unknown> {
  data?: T;
  isLoading?: boolean;
  isPending?: boolean;
  isFetching?: boolean;
  isError?: boolean;
}
export type OwnerPanelState = "loading" | "unavailable" | "ready";

export function ownerPanelState(query: OwnerRequest): OwnerPanelState {
  // A failed refresh must not expose stale rows or enable stale approval controls.
  if (query.isError) return "unavailable";
  if (query.data !== undefined && query.data !== null) return "ready";
  if (query.isLoading || query.isPending || query.isFetching) return "loading";
  return "unavailable";
}

/** Count/money zero is valid only when explicitly returned by a successful endpoint. */
export function isKnownMetric(value: unknown, unit: "money" | "count" | "percent"): boolean {
  if (value === null || value === undefined || value === "") return false;
  if (unit === "money") return typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value.trim());
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  return unit === "count" ? Number.isInteger(value) && value >= 0 : value >= 0 && value <= 100;
}

/** Never generate links to another host, control characters or backslash URL variants. */
export function ownerSourceHref(route: string): string | null {
  if (!route.startsWith("/") || route.startsWith("//")) return null;
  // Preserve the ASCII-control/space and backslash rejection without a control-character regex.
  for (let index = 0; index < route.length; index += 1) {
    const code = route.charCodeAt(index);
    if (code <= 0x20 || code === 0x5c) return null;
  }
  return route;
}

export function loopWidth(count: number | undefined, maximum: number): number {
  if (count === undefined || !Number.isFinite(count) || count < 0 || !Number.isFinite(maximum) || maximum <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(count / maximum * 100)));
}
