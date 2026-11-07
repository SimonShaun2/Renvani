import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("./fonts",()=>({geist:{variable:"g"},inter:{variable:"i",className:"inter"},newsreader:{variable:"n"}}));
vi.mock("next/navigation",()=>({usePathname:()=>"/"}));
import { HomePage } from "./HomePage";
import { MarketingShell } from "./MarketingShell";
import { LAUNCH_HOME } from "./launch-content";
import { isPublicRoute } from "@/src/lib/route-access";
import { MARKETING_SITEMAP_PATHS, buildPublicRobots } from "@/src/lib/seo/public-sitemap";

const PAST_COMPANY = /Service Fusion|ServiceGanja|STACS/i;

afterEach(cleanup);

describe("homepage Why video replaces the founder block",()=>{
  it("keeps launch copy free of past company names",()=>{
    expect(JSON.stringify(LAUNCH_HOME)).not.toMatch(PAST_COMPANY);
  });
  it("preserves the approved homepage hero, workflows, missions, gallery and Growth Check",()=>{
    const {container}=render(<HomePage/>);
    expect(screen.getByRole("heading",{level:1}).textContent?.replace(/\s+/g," ").trim()).toBe(LAUNCH_HOME.headline.join(" "));
    expect(container.querySelector("#product-workflows")).toBeTruthy();
    expect(container.querySelector("#home-missions")).toBeTruthy();
    expect(container.querySelector("#home-growth-check")).toBeTruthy();
  });
  it("renders a single Why video section and no founder block",()=>{
    const {container}=render(<HomePage/>);
    expect(container.querySelectorAll('[data-node-id="why-renvani-video"]')).toHaveLength(1);
    expect(screen.getAllByRole("heading",{name:"Why we built Renvani"})).toHaveLength(1);
    expect(container.querySelector("[data-founder-story]")).toBeNull();
    expect(container.textContent).not.toMatch(PAST_COMPANY);
  });
  it("removes About from the footer and founder CTA without modifying other navigation",()=>{
    render(<MarketingShell><HomePage/></MarketingShell>);
    const footer=screen.getByRole("contentinfo");
    expect(within(footer).queryByRole("link",{name:"About"})).toBeNull();
    expect(document.querySelectorAll('a[href="/about"]')).toHaveLength(0);
    expect(within(footer).getByRole("link",{name:"Pricing"})).toBeTruthy();
    expect(screen.getByRole("navigation",{name:"Main"})).toBeTruthy();
  });
  it("does not advertise the removed page to crawlers",()=>{
    expect(isPublicRoute("/about")).toBe(true);
    for (const p of ["/about/admin","/about-us","/dashboard","/settings"])expect(isPublicRoute(p)).toBe(false);
    expect(MARKETING_SITEMAP_PATHS.some(p=>p.path==="/about")).toBe(false);
    const robots=buildPublicRobots({NODE_ENV:"production",PUBLIC_SITE_URL:"https://getrenvani.com",VERCEL_ENV:"production"} as NodeJS.ProcessEnv);
    expect(JSON.stringify(robots)).not.toContain("/about$");
  });
});
