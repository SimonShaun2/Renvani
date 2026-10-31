import {
  ESTIMATE_OPTION_SET_MAX_OPTIONS,
  ESTIMATE_OPTION_SET_MIN_OPTIONS,
  type EstimateOption,
  type EstimateOptionSet
} from "@fsm/types";

import { ApiError } from "@/src/lib/api";

/** Same roles as the API (estimates option-set routes: owner/admin/dispatcher). */
const MANAGER_ROLES = new Set(["owner", "admin", "dispatcher"]);
export const canManageOptionSets = (role: string | null | undefined) => Boolean(role && MANAGER_ROLES.has(role));

/** The API only changes draft sets (409 not_draft otherwise). */
export const isDraftSet = (set: Pick<EstimateOptionSet, "status">) => set.status === "draft";
export const canAddOption = (set: Pick<EstimateOptionSet, "status" | "options">) =>
  isDraftSet(set) && set.options.length < ESTIMATE_OPTION_SET_MAX_OPTIONS;
export const canRemoveOption = (set: Pick<EstimateOptionSet, "status" | "options">) =>
  isDraftSet(set) && set.options.length > ESTIMATE_OPTION_SET_MIN_OPTIONS;

/** Good → Better → Best, custom labels after (API rank), then estimate number. */
export const sortOptions = (options: EstimateOption[]) =>
  [...options].sort((a, b) => a.rank - b.rank || a.estimateNumber.localeCompare(b.estimateNumber));

/** Registry labels the set does not use yet, for the add-option form. */
export function suggestedTierLabel(options: Pick<EstimateOption, "tierLabel">[]): string {
  const used = new Set(options.map((o) => (o.tierLabel ?? "").trim().toLowerCase()));
  return ["Good", "Better", "Best"].find((label) => !used.has(label.toLowerCase())) ?? "";
}

export const SET_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  approved: "Approved",
  declined: "Declined",
  expired: "Expired",
  mixed: "Mixed"
};
export const setStatusLabel = (status: string) => SET_STATUS_LABELS[status] ?? status;

export const newIdempotencyKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export interface OptionSetErrorView {
  kind: string;
  message: string;
  /** stale_version / not_draft / idempotency_conflict: the set changed under us, so offer Reload. */
  reload: boolean;
}

export function describeOptionSetError(error: unknown): OptionSetErrorView {
  if (!(error instanceof ApiError)) return { kind: "unknown", message: "Something went wrong. Try again.", reload: false };
  const fields = (error.payload.fields ?? {}) as Record<string, string>;
  switch (fields.reason) {
    case "stale_version":
      return { kind: "stale_version", message: "Someone else changed these options. Reload to see the latest before trying again.", reload: true };
    case "not_draft":
      return { kind: "not_draft", message: "These options were already sent, so they can't be changed here.", reload: true };
    case "idempotency_conflict":
      return { kind: "idempotency_conflict", message: "That change conflicts with an earlier request. Reload and try again.", reload: true };
    case "option_limit":
      return { kind: "option_limit", message: `An estimate can show at most ${ESTIMATE_OPTION_SET_MAX_OPTIONS} options.`, reload: false };
    case "option_minimum":
      return { kind: "option_minimum", message: `An estimate needs at least ${ESTIMATE_OPTION_SET_MIN_OPTIONS} options.`, reload: false };
    default:
      break;
  }
  if (error.status === 403) return { kind: "forbidden", message: "Your role can't change estimate options.", reload: false };
  if (error.status === 404) return { kind: "not_found", message: "These estimate options weren't found.", reload: false };
  return { kind: "error", message: error.payload.message || "Something went wrong. Try again.", reload: false };
}
