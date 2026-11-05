import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./fonts", () => ({geist:{variable:"g"},inter:{variable:"i",className:"inter"},newsreader:{variable:"n"}}));
vi.mock("next/navigation", () => ({usePathname:()=>"/",notFound:()=>{throw new Error("404");}}));
afterEach(cleanup);

import { PRODUCT_PAGES } from "./flagship-registry";
import { INDUSTRY_PAGES } from "./industry-registry";
import { PRODUCT_STORIES } from "./subpage-content";
import { productArtwork } from "./ProductArtwork";
import { FlagshipPage } from "./FlagshipPage";
import { IndustryWorkflowPage, TRADE_PHOTOS } from "./IndustryWorkflowPage";
import { IndustriesMenuPanel } from "./IndustriesMenuPanel";
import { ProductsMenuPanel } from "./ProductsMenuPanel";
import { SubpageJourney } from "./SubpageJourney";
import { PricingFrames } from "./PricingPage";

const publicDir=join(__dirname,"../../../../public");

describe("unified responsive marketing subpages",()=>{
  it("covers every registered product with unique editorial content and isolated artwork",()=>{
    expect(Object.keys(PRODUCT_STORIES).sort()).toEqual(PRODUCT_PAGES.map(p=>p.slug).sort());
    for(const p of PRODUCT_PAGES){
      expect(PRODUCT_STORIES[p.slug]!.steps).toHaveLength(3);
      for(const variant of ["desktop","mobile"] as const){const art=productArtwork(p.slug,variant);expect(art.width).toBeGreaterThan(250);expect(art.node.n).toMatch(/view|visual|example|demonstration/i);}
    }
  });
  it.each(PRODUCT_PAGES)("$slug keeps native copy, working FAQ controls and five core products",page=>{
    const {container}=render(<FlagshipPage page={page}/>);
    expect(screen.getAllByRole("heading",{level:1})).toHaveLength(1);
    expect(within(screen.getByRole("navigation",{name:"Five flagship products"})).getAllByRole("link")).toHaveLength(5);
    expect(container.querySelector("[data-scale-to-frame] h1")).toBeNull();
    expect(container.querySelectorAll("details")).toHaveLength(3);
    expect(container.textContent).toContain("Illustrative");
    for(const href of [...container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')].map(a=>a.getAttribute("href")!))expect(container.querySelector(href)).toBeTruthy();
  });
  it.each(INDUSTRY_PAGES)("$slug retains its own trade workflow and explicit scope",industry=>{
    const {container}=render(<IndustryWorkflowPage industry={industry}/>);
    expect(screen.getByRole("heading",{level:1}).textContent).toBe(industry.headline);
    expect(container.textContent).toContain(industry.example.capture);
    expect(container.textContent).toContain(industry.example.estimate);
    expect(container.textContent).toContain(industry.example.nextVisit);
    expect(container.textContent).toContain("Confirm your required forms");
    const photo=TRADE_PHOTOS[industry.slug];if(photo)expect(existsSync(join(publicDir,photo))).toBe(true);
  });
  it("uses the same card primitives for both desktop menus and retains all fourteen trades",()=>{
    const {container}=render(<><ProductsMenuPanel variant="desktop"/><IndustriesMenuPanel/></>);
    const product=screen.getByRole("navigation",{name:"Renvani products"}).querySelector('a[aria-label="Growth"]')!;
    const industries=screen.getByRole("navigation",{name:"Renvani industries"});
    const hvac=within(industries).getByRole("link",{name:"HVAC & Refrigeration"});
    expect(hvac.className.trim()).toBe(product.className.trim());
    expect(industries.querySelectorAll("img")).toHaveLength(0);
    expect(within(industries).getAllByRole("link")).toHaveLength(14);
    expect(container.querySelector('[data-menu-design="shared-product-cards"]')).toBeTruthy();
  });
  it.each(PRODUCT_PAGES.filter(page=>page.template==="flagship"))("$slug uses its own animated workflow rather than the generic static canvas",page=>{
    const {container}=render(<FlagshipPage page={page}/>);
    const workflow=container.querySelector('[data-subpage-journey]');
    expect(workflow?.querySelector('[data-product="'+page.slug+'"]')).toBeTruthy();
    expect(workflow?.querySelector('[role="tablist"]')).toBeNull();
    expect(workflow?.querySelector('a[href="/product/'+page.slug+'"]')).toBeNull();
    expect(screen.getByRole("button",{name:"Pause "+page.name+" animation"})).toBeTruthy();
    expect(container.querySelectorAll('[data-product-artwork][inert]')).toHaveLength(1);
  });
  it("static demonstration artwork cannot capture keyboard focus",()=>{
    const {container}=render(<FlagshipPage page={PRODUCT_PAGES.find(page=>page.slug==="scheduling-dispatch")!}/>);
    for(const art of container.querySelectorAll('[data-product-artwork]'))expect(art.hasAttribute("inert")).toBe(true);
  });
  it("allows manual workflow selection without executing business actions",()=>{
    const steps=[{title:"Request",body:"Capture the need",record:{title:"A request",fields:["Electrical repair"],status:"Review request"}},{title:"Approved",body:"Confirm scope",record:{title:"Approved scope",fields:["Scope confirmed"],status:"Ready for scheduling"}}];
    const {container}=render(<SubpageJourney name="Test trade" steps={steps}/>);
    fireEvent.click(screen.getByRole("button",{name:/02 Approved/}));
    expect(container.querySelector('[data-subpage-journey]')?.getAttribute("data-step")).toBe("1");
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("Approved scope");
    expect(screen.getByRole("button",{name:"Play Test trade animation"})).toBeTruthy();
  });
  it("preserves pricing and presents checkout as an example, not a live payment",()=>{
    const {container}=render(<PricingFrames/>);
    for(const amount of ["$399","$999","$5.48","$279.48","$274.00"])expect(container.textContent).toContain(amount);
    expect(container.textContent).toContain("No payment is collected on this page");
    expect(container.querySelector('form[action*="pay"]')).toBeNull();
    expect(readFileSync(join(__dirname,"subpage.module.css"),"utf8")).toContain("prefers-reduced-motion:reduce");
  });
});
