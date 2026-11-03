/** Growth marketing intake persistence (platform-level tables; Drizzle bindings only). */
import { db, marketingDemoRequests, marketingGrowthChecks } from "@fsm/db";

export interface MarketingDemoRequestRow {
  name: string;
  email: string;
  phone: string | null;
  company: string;
  trade: string;
  message: string | null;
  ipHash: string | null;
}

export interface MarketingGrowthCheckRow {
  websiteUrl: string;
  trade: string;
  zip: string | null;
  city: string | null;
  email: string;
  ipHash: string | null;
}

export async function insertMarketingDemoRequest(row: MarketingDemoRequestRow): Promise<string> {
  const [created] = await db.insert(marketingDemoRequests).values(row).returning({ id: marketingDemoRequests.id });
  return created!.id;
}

export async function insertMarketingGrowthCheck(row: MarketingGrowthCheckRow): Promise<string> {
  const [created] = await db.insert(marketingGrowthChecks).values(row).returning({ id: marketingGrowthChecks.id });
  return created!.id;
}
