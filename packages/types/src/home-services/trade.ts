import { z } from "zod";

/** Home-services trade a shop selects for itself (company settings `trade`). Text-key registry, not a DB enum. */
export const HOME_SERVICE_TRADES = ["hvac", "plumbing", "electrical", "other"] as const;
export type HomeServiceTrade = (typeof HOME_SERVICE_TRADES)[number];
export const HomeServiceTradeSchema = z.enum(HOME_SERVICE_TRADES);

export interface HomeServiceTradeConfig {
  key: HomeServiceTrade;
  label: string;
  /** schema.org LocalBusiness subtype used for the public site JSON-LD. */
  schemaType: string;
}

export const HOME_SERVICE_TRADE_REGISTRY: Record<HomeServiceTrade, HomeServiceTradeConfig> = {
  hvac: { key: "hvac", label: "Heating & air conditioning", schemaType: "HVACBusiness" },
  plumbing: { key: "plumbing", label: "Plumbing", schemaType: "Plumber" },
  electrical: { key: "electrical", label: "Electrical", schemaType: "Electrician" },
  other: { key: "other", label: "Home services", schemaType: "HomeAndConstructionBusiness" }
};

export interface TradeServiceEntry {
  /** Stable text key, e.g. `hvac.ac_repair`. */
  key: string;
  label: string;
  category: string;
  emergency: boolean;
}

function svc(trade: HomeServiceTrade, slug: string, label: string, category: string, emergency = false): TradeServiceEntry {
  return { key: `${trade}.${slug}`, label, category, emergency };
}

/** Default service catalog per trade (seeds site/booking services when a shop has none). Add a service = add one row. */
export const TRADE_SERVICE_CATALOG: Record<HomeServiceTrade, readonly TradeServiceEntry[]> = {
  hvac: [
    svc("hvac", "ac_repair", "AC repair", "Cooling", true),
    svc("hvac", "ac_install", "AC installation", "Cooling"),
    svc("hvac", "furnace_repair", "Furnace repair", "Heating", true),
    svc("hvac", "furnace_tune_up", "Furnace tune-up", "Service and repair"),
    svc("hvac", "furnace_install", "Furnace installation", "Heating"),
    svc("hvac", "heat_pump", "Heat pump service", "Heating"),
    svc("hvac", "duct_cleaning", "Duct cleaning", "Air quality")
  ],
  plumbing: [
    svc("plumbing", "drain_cleaning", "Drain cleaning", "Drains", true),
    svc("plumbing", "water_heater_repair", "Water heater repair", "Water heaters", true),
    svc("plumbing", "water_heater_install", "Water heater installation", "Water heaters"),
    svc("plumbing", "leak_repair", "Leak repair", "Repairs", true),
    svc("plumbing", "sewer_line", "Sewer line service", "Drains"),
    svc("plumbing", "toilet_repair", "Toilet repair", "Repairs")
  ],
  electrical: [
    svc("electrical", "panel_upgrade", "Panel upgrade", "Panels"),
    svc("electrical", "ev_charger", "EV charger installation", "Installations"),
    svc("electrical", "outlet_repair", "Outlet & switch repair", "Repairs"),
    svc("electrical", "wiring", "Wiring & rewiring", "Wiring"),
    svc("electrical", "lighting", "Lighting installation", "Installations"),
    svc("electrical", "emergency", "Emergency electrical repair", "Repairs", true)
  ],
  other: [
    svc("other", "repair", "Repair visit", "General"),
    svc("other", "service_repair", "Service and repair visit", "General"),
    svc("other", "estimate", "Free estimate", "General")
  ]
};

export function getTradeServices(trade: HomeServiceTrade): readonly TradeServiceEntry[] {
  return TRADE_SERVICE_CATALOG[trade];
}

/** Reads a stored trade value; anything unknown is treated as unset. */
export function parseHomeServiceTrade(value: unknown): HomeServiceTrade | null {
  const parsed = HomeServiceTradeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export const TRADE_DESCRIPTION_MAX_LENGTH = 100;

/**
 * `tradeDescription` ("Describe your trade"): trimmed, max 100 chars. Required (non-empty) when trade is "other";
 * ignored and cleared for any other trade.
 */
export const UpdateCompanyTradeBodySchema = z
  .object({
    trade: HomeServiceTradeSchema,
    tradeDescription: z.string().trim().max(TRADE_DESCRIPTION_MAX_LENGTH).nullable().optional()
  })
  .strict()
  .superRefine((body, ctx) => {
    if (body.trade === "other" && !body.tradeDescription) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tradeDescription"], message: 'Describe your trade when trade is "other"' });
    }
  });

/** Stored description, only meaningful for trade "other"; null otherwise. */
export function parseTradeDescription(trade: HomeServiceTrade | null, value: unknown): string | null {
  if (trade !== "other" || typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, TRADE_DESCRIPTION_MAX_LENGTH);
  return trimmed.length > 0 ? trimmed : null;
}
export type UpdateCompanyTradeBody = z.infer<typeof UpdateCompanyTradeBodySchema>;

export const TradeServicesQuerySchema = z.object({ trade: HomeServiceTradeSchema.optional() }).strict();
