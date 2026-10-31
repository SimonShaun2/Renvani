import { GROWTH_CHECK_OWNER_VALIDATION_REGISTRY, GROWTH_CHECK_REVIEW_STATE_REGISTRY } from "@fsm/types";

export const reviewStateLabel = (key: string) => GROWTH_CHECK_REVIEW_STATE_REGISTRY[key] ?? key;
export const ownerValidationLabel = (key: string) => GROWTH_CHECK_OWNER_VALIDATION_REGISTRY[key] ?? key;
export const STATUS_LABEL: Record<string, string> = { pass: "Pass", fail: "Needs work", warning: "Warning", unknown: "Unknown" };
export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
