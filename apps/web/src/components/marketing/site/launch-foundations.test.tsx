import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("./fonts",()=>({geist:{variable:"g"},inter:{variable:"i",className:"inter"},newsreader:{variable:"n"}}));
vi.mock("next/navigation",()=>({usePathname:()=>"/pricing"}));
import { MARKETING_TRADES, MARKETING_TRADE_LABELS } from "@fsm/types";
import { subscriptionSavings } from "./pricing-explainer";
import { INDUSTRY_PAGES } from "./industry-registry";
import { LeadContactFields } from "./LeadContactFields";
import { PricingFrames } from "./PricingPage";
import { PLANS } from "./pricing-config";
afterEach(cleanup);
describe("approved launch copy and intake scope",()=>{
 it("offers the fourteen advertised industries and an Other option in the shared form field",()=>{
   render(<form><LeadContactFields prefix="launch" /></form>);
   const trade=screen.getByLabelText("Trade");
   const options=within(trade).getAllByRole("option").slice(1);
   expect(options.map(x=>x.getAttribute("value"))).toEqual([...INDUSTRY_PAGES.map(x=>x.slug),"other"]);
   expect(MARKETING_TRADES).toHaveLength(15);
   for(const p of INDUSTRY_PAGES)expect(MARKETING_TRADE_LABELS[p.slug]).toBe(p.name);
   expect(document.querySelectorAll('[data-lead-contact-fields] label')).toHaveLength(7);
 });
 it("preserves plan amounts and explains subscription-only savings for consistent billing periods",()=>{
   const t=subscriptionSavings();expect(t["savings.monthly"]).toBe("$600");expect(t["savings.annual"]).toBe("$6,000");
   const {container}=render(<PricingFrames/>);const text=container.textContent??"";
   for(const copy of ["$600 less per month","$6,000","not guaranteed net business savings","5%","$13.70","$287.70"])expect(text).toContain(copy);
   expect(text).not.toMatch(/surcharge|founding/i);
   expect(PLANS.map(x=>[x.key,x.monthly,x.serviceFeePct])).toEqual([["flex",399,5],["flat",999,0],["startup",99,5]]);
 });
 it("removes prohibited fee wording from every active overview copy slot",()=>{
   const copy=readFileSync(join(__dirname,"ReferenceOverviewPages.tsx"),"utf8");
   expect(copy).not.toMatch(/surcharge/i);
 });
});
