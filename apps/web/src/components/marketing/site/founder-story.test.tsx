import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("./fonts",()=>({geist:{variable:"g"},inter:{variable:"i",className:"inter"},newsreader:{variable:"n"}}));
vi.mock("next/navigation",()=>({usePathname:()=>"/"}));
import { FounderStory } from "./FounderStory";
import { HomePage } from "./HomePage";
import { MarketingShell } from "./MarketingShell";
import { FOUNDER_STORY, LAUNCH_HOME } from "./launch-content";
import { isPublicRoute } from "@/src/lib/route-access";
import { MARKETING_SITEMAP_PATHS, buildPublicRobots } from "@/src/lib/seo/public-sitemap";

const PAST_COMPANY = /Service Fusion|ServiceGanja|STACS/i;

afterEach(cleanup);

describe("homepage founder credibility without a separate About page",()=>{
  it("renders compliant repeat-founder copy with no past company names",()=>{
    const {container}=render(<FounderStory/>);
    expect(container.textContent).toContain(FOUNDER_STORY.lead);
    expect(FOUNDER_STORY.lead).toContain("A repeat founder");
    expect(FOUNDER_STORY.lead).toContain("one connected platform");
    expect(container.textContent).toContain(FOUNDER_STORY.cardEyebrow);
    expect(container.textContent).toContain(FOUNDER_STORY.cardTitle[0]);
    expect(container.textContent).toContain(FOUNDER_STORY.cardTitle[1]);
    expect(container.querySelector('[data-founder-story]')).toBeTruthy();
    expect(container.querySelectorAll('a[href="/about"],img,blockquote')).toHaveLength(0);
    expect(container.textContent).not.toMatch(PAST_COMPANY);
    expect(JSON.stringify(FOUNDER_STORY)).not.toMatch(PAST_COMPANY);
    expect(FOUNDER_STORY.lead).not.toMatch(/early team|through (its )?exit/i);
  });
  it("preserves the approved homepage hero, workflows, missions, gallery and Growth Check",()=>{
    const {container}=render(<HomePage/>);
    expect(screen.getByRole("heading",{level:1}).textContent?.replace(/\s+/g," ").trim()).toBe(LAUNCH_HOME.headline.join(" "));
    expect(container.querySelector("#product-workflows")).toBeTruthy();
    expect(container.querySelector("#home-missions")).toBeTruthy();
    expect(container.querySelector("#home-growth-check")).toBeTruthy();
    expect(container.querySelectorAll("[data-founder-story]")).toHaveLength(1);
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
