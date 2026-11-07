import { describe, expect, it } from "vitest";
import { HOME_SERVICE_TRADES, HomeServiceTradeSchema } from "./home-services/trade.js";
import { MARKETING_TRADES, MARKETING_TRADE_LABELS, MarketingDemoRequestBodySchema, MarketingGrowthCheckBodySchema } from "./marketing-intake.types.js";
const demo={name:"Alex Rivera",email:"alex@example.com",company:"Service Shop",phone:"9185550100"};
const growth={websiteUrl:"https://example.com",zip:"74103",email:"alex@example.com"};
describe("public marketing trade classification",()=>{
  it.each(MARKETING_TRADES)("accepts %s on both intake contracts",trade=>{
    expect(MarketingDemoRequestBodySchema.parse({...demo,trade}).trade).toBe(trade);
    expect(MarketingGrowthCheckBodySchema.parse({...growth,trade}).trade).toBe(trade);
    expect(MARKETING_TRADE_LABELS[trade]).toBeTruthy();
  });
  it("retains the original tenant application trade policy",()=>{
    expect(HOME_SERVICE_TRADES).toEqual(["hvac","plumbing","electrical","other"]);
    expect(HomeServiceTradeSchema.safeParse("garage-doors").success).toBe(false);
  });
  it.each(["roofing","tree","pool","irrigation","remodeling","", "../admin"])("rejects unsupported intake trade %s",trade=>{
    expect(MarketingDemoRequestBodySchema.safeParse({...demo,trade}).success).toBe(false);
    expect(MarketingGrowthCheckBodySchema.safeParse({...growth,trade}).success).toBe(false);
  });
});
