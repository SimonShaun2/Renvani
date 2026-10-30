import type { PublicBookingSettingsRecord } from "@/src/hooks/booking.hooks";

import { resolveSiteTrade, SITE_TRADES, type SiteTradeConfig } from "./site-trade.registry";

/**
 * Registry consumer: picks the site trade from the company trade set in Settings (#318 `settings.trade`).
 * The registry itself is owned by #319 (adds an `other` entry); until it lands, `other` falls back to the
 * registry's generic entry. Unset trade keeps the registry's own inference.
 */
export function resolveSiteTradeFromSettings(
  settings: Pick<PublicBookingSettingsRecord, "offeredServices" | "trade">
): SiteTradeConfig {
  const registry = SITE_TRADES as Record<string, SiteTradeConfig>;
  const trade = settings.trade;
  if (trade && registry[trade]) return registry[trade];
  if (trade === "other") return registry.other ?? registry.default ?? resolveSiteTrade(settings);
  return resolveSiteTrade(settings);
}
