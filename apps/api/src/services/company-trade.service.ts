import { and, eq, isNull } from "drizzle-orm";
import { companies, db, emitEventWithExecutor } from "@fsm/db";
import {
  AppError,
  ErrorCode,
  HOME_SERVICE_TRADE_REGISTRY,
  getTradeServices,
  parseHomeServiceTrade,
  type HomeServiceTrade,
  type TradeServiceEntry
} from "@fsm/types";

import { runTenantAwareTransaction } from "../lib/company-scoped-transaction.js";

export interface CompanyTradeView {
  trade: HomeServiceTrade | null;
  label: string | null;
  schemaType: string | null;
}

function settingsObject(settings: unknown): Record<string, unknown> {
  return settings && typeof settings === "object" && !Array.isArray(settings) ? { ...(settings as Record<string, unknown>) } : {};
}

function toView(trade: HomeServiceTrade | null): CompanyTradeView {
  return trade
    ? { trade, label: HOME_SERVICE_TRADE_REGISTRY[trade].label, schemaType: HOME_SERVICE_TRADE_REGISTRY[trade].schemaType }
    : { trade: null, label: null, schemaType: null };
}

async function loadCompany(companyId: string) {
  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
    .limit(1);
  if (!company) throw new AppError(ErrorCode.NOT_FOUND, "Company not found");
  return company;
}

export async function getCompanyTrade(companyId: string): Promise<CompanyTradeView> {
  const company = await loadCompany(companyId);
  return toView(parseHomeServiceTrade(settingsObject(company.settings).trade));
}

/** Owner/admin sets the shop trade in `companies.settings.trade`; other settings are preserved. */
export async function setCompanyTrade(companyId: string, actorId: string, trade: HomeServiceTrade): Promise<CompanyTradeView> {
  const company = await loadCompany(companyId);
  const nextSettings = { ...settingsObject(company.settings), trade };
  await runTenantAwareTransaction(companyId, async (tx) => {
    await tx.update(companies).set({ settings: nextSettings, updatedAt: new Date() }).where(eq(companies.id, companyId));
    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "company.updated",
      actorId,
      entityType: "company",
      entityId: companyId,
      payload: { trade },
      summary: `${company.name} trade set to ${HOME_SERVICE_TRADE_REGISTRY[trade].label}`
    });
  });
  return toView(trade);
}

export async function listCompanyTradeServices(
  companyId: string,
  requested?: HomeServiceTrade
): Promise<{ trade: HomeServiceTrade | null; services: readonly TradeServiceEntry[] }> {
  const trade = requested ?? (await getCompanyTrade(companyId)).trade;
  return { trade, services: trade ? getTradeServices(trade) : [] };
}
