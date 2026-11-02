import { TRADE_DESCRIPTION_MAX_LENGTH, type HomeServiceTrade } from "@fsm/types";

import type { UpdateCompanyTradeInput } from "@/src/hooks/company-trade.hooks";

export type TradePickerStatus = "default" | "selected" | "saving" | "error" | "saved";

export function validateTradeSelection(trade: HomeServiceTrade | null, describe: string): { describe?: true } {
  return trade === "other" && describe.trim().length === 0 ? { describe: true } : {};
}

export const TRADE_DESCRIBE_MAX = TRADE_DESCRIPTION_MAX_LENGTH;

/** `tradeDescription` is sent (trimmed) only for "other"; other trades send `trade` alone so the API clears it. */
export function buildTradePayload(trade: HomeServiceTrade, describe = ""): UpdateCompanyTradeInput {
  return trade === "other" ? { trade, tradeDescription: describe.trim() } : { trade };
}
