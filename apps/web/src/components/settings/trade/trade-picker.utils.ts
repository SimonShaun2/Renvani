import type { HomeServiceTrade } from "@fsm/types";

import type { UpdateCompanyTradeInput } from "@/src/hooks/company-trade.hooks";

export type TradePickerStatus = "default" | "selected" | "saving" | "error" | "saved";

export function validateTradeSelection(trade: HomeServiceTrade | null, describe: string): { describe?: true } {
  return trade === "other" && describe.trim().length === 0 ? { describe: true } : {};
}

/** The API has no field for the "Describe your trade" text, so it is validated in the UI and never sent. */
export function buildTradePayload(trade: HomeServiceTrade): UpdateCompanyTradeInput {
  return { trade };
}
