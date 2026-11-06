import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
vi.mock("./fonts",()=>({geist:{variable:"g"},inter:{variable:"i",className:"inter"},newsreader:{variable:"n"}}));
vi.mock("next/navigation",()=>({usePathname:()=>"/",notFound:()=>{throw new Error("404");}}));
afterEach(cleanup);
import { IndustryDetailPage } from "./DetailPages";
import { INDUSTRY_PAGES } from "./industry-registry";
import { INDUSTRY_JOURNEYS } from "./industry-journeys";
import { PRODUCT_PAGE_BY_SLUG } from "./flagship-registry";
import { ReferencePricingPage } from "./ReferenceOverviewPages";
import { PLANS, pricingTokens, planInterestLine, demoPlanInterest } from "./pricing-config";

describe("retention handoff and founder-requested public pricing",()=>{
  it.each(INDUSTRY_PAGES)("$slug continues the third feature into a relevant FSM tool",industry=>{
    const journey=INDUSTRY_JOURNEYS[industry.slug];
    const tool=PRODUCT_PAGE_BY_SLUG[journey.retain.tool]!;
    expect(tool.template).not.toBe("flagship");
    expect(journey.tools[1].slug).toBe(journey.retain.tool);
    const {container}=render(<IndustryDetailPage industry={industry}/>);
    const feature=container.querySelectorAll<HTMLElement>("[data-detail-feature]")[2]!;
    expect(feature.textContent).toContain(`Retention + ${tool.name}`);
    expect(feature.textContent).not.toContain("Retention + Command Center");
    expect(feature.textContent).toContain(journey.retain.handoff);
    expect(feature.textContent).toContain(journey.retain.action);
    const link=within(feature).getByRole("link",{name:tool.name});
    expect(link.getAttribute("href")).toBe(`/product/${tool.slug}`);
    expect(container.querySelector("#features")!.textContent).toContain("Command Center");
    expect(container.querySelectorAll("[data-detail-feature]")).toHaveLength(3);
  });
  it("uses trade-specific tool choices rather than repeating a Command Center recap",()=>{
    const selections=Object.values(INDUSTRY_JOURNEYS).map(j=>j.retain.tool);
    expect(new Set(selections).size).toBeGreaterThanOrEqual(10);
    expect(INDUSTRY_JOURNEYS.hvac.retain.tool).toBe("scheduling-dispatch");
    expect(INDUSTRY_JOURNEYS["garage-doors"].retain.tool).toBe("technician-app");
    expect(INDUSTRY_JOURNEYS["pest-control"].retain.tool).toBe("service-agreements");
  });
  it("derives the 5% fee and arithmetic from public pricing configuration",()=>{
    const t=pricingTokens();
    expect(PLANS.find(p=>p.key==="flex")).toMatchObject({monthly:399,serviceFeePct:5});
    expect(PLANS.find(p=>p.key==="startup")).toMatchObject({monthly:99,serviceFeePct:5});
    expect(PLANS.find(p=>p.key==="flat")).toMatchObject({monthly:999,serviceFeePct:0});
    expect(t["ex.subtotal"]).toBe("$274.00");
    expect(t["ex.flexFeeLabel"]).toBe("Service Fee · 5%");
    expect(t["ex.flexFee"]).toBe("$13.70");
    expect(t["ex.flexTotal"]).toBe("$287.70");
    expect(t["ex.flatTotal"]).toBe("$274.00");
    expect(planInterestLine("flex")).toBe("Flex · $399/mo + 5% customer-paid Service Fee");
    expect(t["flex.annual"]).toBe("$3,990/year, billed annually");
  });
  it("removes Founding from public offers, the FAQ and demo plan choices",()=>{
    expect(PLANS.map(p=>p.key)).toEqual(["flex","flat","startup"]);
    expect(demoPlanInterest("founding")).toBeNull();
    expect(pricingTokens()["programs.title"]).toBe("Startup $99/mo");
    const {container}=render(<ReferencePricingPage/>);
    expect(container.textContent).not.toMatch(/founding|\$199|2%|\$5\.48|\$279\.48/i);
    expect(container.textContent).toContain("5% customer-paid Service Fee");
    expect(screen.getByText("Who qualifies for Startup pricing?")).toBeTruthy();
    const faq=screen.getByText("How does the customer-paid Service Fee work?").closest("details")!;
    expect(faq.textContent).toContain("5% customer-paid Service Fee");
    expect(screen.getByRole("link",{name:"Explore Flex"}).getAttribute("href")).toBe("/demo?plan=flex");
    expect(readFileSync(join(__dirname,"../../../../app/(marketing)/pricing/page.tsx"),"utf8")).toContain("5% customer-paid Service Fee");
  });
});
