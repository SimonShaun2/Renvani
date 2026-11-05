export type EstimateDecision = "approved" | "declined";
export type DecisionResult = "write-unconfirmed" | "saved" | "saved-refresh-unavailable";

/** A failed follow-up read must never turn an acknowledged write into a failed write. */
export async function settleEstimateDecision(input: {
  write: () => Promise<unknown>;
  acknowledge: () => void;
  refresh: () => Promise<unknown>;
}): Promise<DecisionResult> {
  try {
    await input.write();
  } catch {
    return "write-unconfirmed";
  }
  input.acknowledge();
  try {
    await input.refresh();
    return "saved";
  } catch {
    return "saved-refresh-unavailable";
  }
}

export function canSubmitEstimateDecision(status: string): boolean {
  return status === "sent" || status === "viewed";
}
