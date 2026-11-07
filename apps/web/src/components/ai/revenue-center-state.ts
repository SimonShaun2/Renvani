/** A cached response is not safe to display as current after the query fails. */
export type RevenueDataState = "loading" | "unavailable" | "ready";

export function revenueDataState(query: {
  isLoading: boolean;
  isError: boolean;
  data: unknown;
}): RevenueDataState {
  if (query.isError) return "unavailable";
  if (query.isLoading) return "loading";
  return query.data === null || query.data === undefined ? "unavailable" : "ready";
}

/** Non-proposal actions only record handling; they do not send, book, or charge. */
export function revenueActionButtonLabel(requiresProposal: boolean): "Create proposal" | "Mark handled" {
  return requiresProposal ? "Create proposal" : "Mark handled";
}
