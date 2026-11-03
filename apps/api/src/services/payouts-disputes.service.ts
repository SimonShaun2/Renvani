import { and, eq, isNull } from "drizzle-orm";

import { companies, db, getStripeDisputeById, listStripeDisputes } from "@fsm/db";
import {
  AppError,
  ErrorCode,
  PAYOUTS_DISPUTES_PAGE_DEFAULT,
  type DisputeSummary,
  type PayoutSummary
} from "@fsm/types";

import { listConnectedAccountPayouts, retrieveConnectedAccountPayout } from "../lib/stripe.js";

/**
 * FS-199 payouts & disputes read API.
 *
 * Payouts are read live from the tenant's payout provider (no mirror table: they live on the
 * Connect account, and platform webhooks don't carry them). Providers plug in through the
 * registry below; `stripe_connect` is the built-in. Disputes come from the `stripe_disputes`
 * mirror populated by apps/webhook. Everything here is read-only: nothing moves money.
 */
export type PayoutProviderCompany = { id: string; stripeAccountId: string | null };

export interface PayoutProvider {
  id: string;
  isConnected(company: PayoutProviderCompany): boolean;
  listPayouts(
    company: PayoutProviderCompany,
    query: { limit: number; startingAfter?: string }
  ): Promise<{ data: PayoutSummary[]; hasMore: boolean }>;
  getPayout(company: PayoutProviderCompany, payoutId: string): Promise<PayoutSummary | null>;
}

const payoutProviders = new Map<string, PayoutProvider>();

export function registerPayoutProvider(provider: PayoutProvider): void {
  payoutProviders.set(provider.id, provider);
}

export const DEFAULT_PAYOUT_PROVIDER_ID = "stripe_connect";

export function getPayoutProvider(id: string = DEFAULT_PAYOUT_PROVIDER_ID): PayoutProvider {
  const provider = payoutProviders.get(id);
  if (!provider) throw new AppError(ErrorCode.INTERNAL_ERROR, "Payout provider not configured");
  return provider;
}

registerPayoutProvider({
  id: DEFAULT_PAYOUT_PROVIDER_ID,
  isConnected: (company) => Boolean(company.stripeAccountId),
  listPayouts: (company, query) => listConnectedAccountPayouts(company.stripeAccountId!, query),
  getPayout: (company, payoutId) => retrieveConnectedAccountPayout(company.stripeAccountId!, payoutId)
});

async function loadCompany(companyId: string): Promise<PayoutProviderCompany> {
  const [company] = await db
    .select({ id: companies.id, stripeAccountId: companies.stripeAccountId })
    .from(companies)
    .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
    .limit(1);
  if (!company) throw new AppError(ErrorCode.NOT_FOUND, "Company not found");
  return company;
}

export async function listPayoutsForCompany(
  companyId: string,
  query: { limit?: number; startingAfter?: string }
): Promise<{ connected: boolean; data: PayoutSummary[]; hasMore: boolean }> {
  const company = await loadCompany(companyId);
  const provider = getPayoutProvider();
  if (!provider.isConnected(company)) return { connected: false, data: [], hasMore: false };
  const page = await provider.listPayouts(company, {
    limit: query.limit ?? PAYOUTS_DISPUTES_PAGE_DEFAULT,
    ...(query.startingAfter ? { startingAfter: query.startingAfter } : {})
  });
  return { connected: true, ...page };
}

export async function getPayoutForCompany(companyId: string, payoutId: string): Promise<PayoutSummary> {
  const company = await loadCompany(companyId);
  const provider = getPayoutProvider();
  const payout = provider.isConnected(company) ? await provider.getPayout(company, payoutId) : null;
  if (!payout) throw new AppError(ErrorCode.NOT_FOUND, "Payout not found");
  return payout;
}

export async function listDisputesForCompany(
  companyId: string,
  query: { status?: string; limit?: number; cursor?: string }
): Promise<{ data: DisputeSummary[]; nextCursor: string | null }> {
  try {
    return await listStripeDisputes(companyId, query);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "STRIPE_DISPUTE_INVALID_CURSOR") {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "Invalid cursor");
    }
    throw error;
  }
}

export async function getDisputeForCompany(companyId: string, disputeId: string): Promise<DisputeSummary> {
  const dispute = await getStripeDisputeById(companyId, disputeId);
  if (!dispute) throw new AppError(ErrorCode.NOT_FOUND, "Dispute not found");
  return dispute;
}
