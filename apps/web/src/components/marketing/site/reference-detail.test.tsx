import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("./fonts", () => ({ geist: {variable:"g"}, inter: {variable:"i",className:"inter"}, newsreader: {variable:"n"} }));
vi.mock("next/navigation", () => ({usePathname:()=>"/",notFound:()=>{throw new Error("404");}}));
afterEach(cleanup);
import { PRODUCT_PAGES } from "./flagship-registry";
import { INDUSTRY_PAGES, FEATURED_INDUSTRIES, ADDITIONAL_INDUSTRIES } from "./industry-registry";
import { ProductDetailPage, IndustryDetailPage, detailVisual } from "./DetailPages";
import { HowItWorksPage, ReferencePricingPage } from "./ReferenceOverviewPages";
import { DETAIL_FEATURES } from "./detail-content";
import { IndustriesMenuPanel } from "./IndustriesMenuPanel";
import { ProductsMenuPanel } from "./ProductsMenuPanel";

// Founder guard: design work must not redefine the offerings or the approved Products menu.
const FROZEN = {
  "ProductsMenuPanel.tsx":"4d4c6c2e2d8eadf6acd8245cb4fdf15546c51766452133e59717df4a6b3bf5de",
  "products-menu.module.css":"950d0ccf13a786da704874a29527bea28ec975d2cd0dc820251f6d99e34f705e",
  "site-config.ts":"29e69e270059b06b8a07f6c726bfc21451af21f01b9643f164d9bffe1acd6d9b",
  "flagship-registry.ts":"f1515ce921e22f2e57c3fa63e44c417f9a705a3bbd80dbe59f269eadf9f2e27a",
  "platform-config.ts":"4a6f3a7e41d750150def8404fd1231148baf5a36548d04f2e4e4532983f759dd",
  "pricing-config.ts":"67f4f92a1c12a32e12c81f275231d4c4b69a17a5f5772cabdf2a9f62b9a03ae6",
  "industry-registry.ts":"9bcc6dc13d1d55bad2e4ae35fc3a22a69a58f6062f0fd69d9a2e768a610156e8",
  "PlatformPages.tsx":"5cbb19b276bf98a28a8e7ae1768cb31657c2622419e72d4a32347b97f6de4154"
};
describe("reference-led detail pages, not a product reclassification",()=>{
  it.each(Object.entries(FROZEN))("preserves approved %s byte for byte",(file,expected)=>{expect(createHash("sha256").update(readFileSync(join(__dirname,file))).digest("hex")).toBe(expected);});
  it("covers exactly the existing product inventory",()=>{expect(Object.keys(DETAIL_FEATURES).sort()).toEqual(PRODUCT_PAGES.map(p=>p.slug).sort());});
  it.each(PRODUCT_PAGES)("$slug has distinct, illustrated capability sections",page=>{
    const {container}=render(<ProductDetailPage page={page}/>);
    expect(screen.getAllByRole("heading",{level:1})).toHaveLength(1);
    expect(screen.getByRole("heading",{level:1}).textContent).toBe(page.headline);
    const sections=container.querySelectorAll("[data-detail-feature]");
    expect(sections).toHaveLength(3);
    expect(new Set([...sections].map(s=>s.querySelector("h2")?.textContent)).size).toBe(3);
    for(const section of sections){expect(section.querySelector("figure")).toBeTruthy();expect(section.querySelectorAll("li")).toHaveLength(3);}
    expect(container.querySelector('[role="tablist"]')).toBeNull();
    for(const feature of DETAIL_FEATURES[page.slug]!){for(const variant of ["desktop","mobile"] as const)expect(detailVisual(feature.visual,feature.part,variant).width).toBeGreaterThan(250);}
    for(const art of container.querySelectorAll('[data-illustration]'))expect(art.querySelector('[inert]')||art.getAttribute('data-loop')).toBeTruthy();
    for(const a of container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'))expect(container.querySelector(a.getAttribute("href")!)).toBeTruthy();
  });
  it.each(INDUSTRY_PAGES)("$slug shows three different trade-specific records",industry=>{
    const {container}=render(<IndustryDetailPage industry={industry}/>);
    expect(screen.getAllByRole("heading",{level:1})).toHaveLength(1);
    expect(container.querySelectorAll("[data-detail-feature]")).toHaveLength(3);
    for(const scene of ["estimate","field","history"])expect(container.querySelector(`[data-detail-feature] [data-trade-scene="${scene}"]`)).toBeTruthy();
    expect(container.textContent).toContain(industry.example.capture);
    expect(container.textContent).toContain(industry.example.fieldWork);
    expect(container.textContent).toContain(industry.example.nextVisit);
    expect(container.querySelectorAll("details")).toHaveLength(4);
  });
  it("matches the Products card classes and keeps the original 3 + 11 trades",()=>{
    const {container}=render(<><ProductsMenuPanel variant="desktop"/><IndustriesMenuPanel/></>);
    const product=screen.getByRole("navigation",{name:"Renvani products"}).querySelector('a[aria-label="Growth"]')!;
    const industry=screen.getByRole("navigation",{name:"Renvani industries"});
    expect(within(industry).getByRole("link",{name:"HVAC & Refrigeration"}).className.trim()).toBe(product.className.trim());
    expect(industry.querySelectorAll("img")).toHaveLength(0);
    expect(within(industry).getAllByRole("link").map(a=>a.getAttribute("href"))).toEqual([...FEATURED_INDUSTRIES,...ADDITIONAL_INDUSTRIES].map(i=>i.href));
    expect(FEATURED_INDUSTRIES.map(i=>i.slug)).toEqual(["hvac","plumbing","electrical"]);
    expect(container.querySelector('[data-industry-style="products-menu"]')).toBeTruthy();
  });
  it("the actual How It Works route renders the revised journey",()=>{
    const route=readFileSync(join(__dirname,"../../../../app/(marketing)/how-it-works/page.tsx"),"utf8");expect(route).toContain("ReferenceOverviewPages");
    const {container}=render(<HowItWorksPage/>);
    expect(screen.getAllByRole("heading",{level:1})).toHaveLength(1);
    expect(container.textContent).toContain("Operating Mission");
    expect(container.textContent).toContain("onsite estimate");
    expect(container.textContent).toContain("mobile payment");
    expect(screen.getAllByRole("tab")).toHaveLength(5);
  });
  it("the pricing redesign preserves every amount and plan destination",()=>{
    const {container}=render(<ReferencePricingPage/>);
    for(const text of ["$399","$999","5% customer-paid Service Fee","Startup $99/mo","$287.70","$274.00"])expect(container.textContent).toContain(text);
    expect(screen.getByRole("link",{name:"Explore Flex"}).getAttribute("href")).toBe("/demo?plan=flex");
    expect(screen.getByRole("link",{name:"Explore Flat"}).getAttribute("href")).toBe("/demo?plan=flat");
    expect(container.querySelector("form")).toBeNull();
    expect(container.textContent).toContain("No payment is collected on this page");
  });
});
