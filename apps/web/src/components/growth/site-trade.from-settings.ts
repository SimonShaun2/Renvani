import type { PublicBookingSettingsRecord } from "@/src/hooks/booking.hooks";

import { resolveSiteTrade, SITE_TRADES, type SiteTradeConfig } from "./site-trade.registry";

/**
 * Registry consumer: picks the site trade from the company trade set in Settings (#318 `settings.trade`).
 * A set trade wins: a registry key (own property only) maps to its entry; any other non-empty value
 * falls back to `other` (no service inference). Unset trade keeps the registry's own inference.
 */
export function resolveSiteTradeFromSettings(
  settings: Pick<PublicBookingSettingsRecord, "offeredServices" | "trade">
): SiteTradeConfig {
  const trade = settings.trade;
  if (trade) {
    return Object.hasOwn(SITE_TRADES, trade) ? SITE_TRADES[trade as keyof typeof SITE_TRADES] : SITE_TRADES.other;
  }
  return resolveSiteTrade(settings);
}
