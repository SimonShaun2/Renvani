import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("./fonts",()=>({geist:{variable:"g"},inter:{variable:"i",className:"inter"},newsreader:{variable:"n"}}));
vi.mock("next/navigation",()=>({usePathname:()=>"/about"}));
import { FounderStory } from "./FounderStory";
import { AboutPage } from "./AboutPage";
import { HomePage } from "./HomePage";
import { MarketingShell } from "./MarketingShell";
import { FOUNDER_STORY, LAUNCH_HOME } from "./launch-content";
import { isPublicRoute } from "@/src/lib/route-access";
import { MARKETING_SITEMAP_PATHS, buildPublicRobots } from "@/src/lib/seo/public-sitemap";
afterEach(cleanup);

describe("founder credibility and direct-jobs positioning",()=>{
  it("leads with the exact founder-provided early-team-through-exit account",()=>{
    const {container}=render(<FounderStory/>);
    expect(container.textContent).toContain(FOUNDER_STORY.lead);
    expect(FOUNDER_STORY.lead).toContain("Service Fusion’s early team");
    expect(FOUNDER_STORY.lead).toContain("through its exit");
    expect(screen.getByRole("link",{name:"Why we built Renvani"}).getAttribute("href")).toBe("/about");
    expect(container.querySelectorAll("img,blockquote")).toHaveLength(0);
    expect(container.textContent).not.toMatch(/endorsed by|founder of Service Fusion|acquired for|customer results/i);
  });
  it("keeps other ventures generic and ties About to all five flagships",()=>{
    const {container}=render(<AboutPage/>);
    expect(screen.getAllByRole("heading",{level:1})).toHaveLength(1);
    expect(container.textContent).toContain("A repeat founder");
    for(const name of ["Operating Missions","Growth","Revenue","Operations","Retention","Command Center"])expect(container.textContent).toContain(name);
    expect(screen.getByRole("link",{name:"See the product tour"}).getAttribute("href")).toBe("/tour");
  });
  it("changes positioning without removing the existing workflows, industry gallery or Growth Check",()=>{
    const {container}=render(<HomePage/>);
    expect(screen.getByRole("heading",{level:1}).textContent?.replace(/\s+/g," ").trim()).toBe(LAUNCH_HOME.headline.join(" "));
    expect(container.textContent).toContain(LAUNCH_HOME.description);
    expect(container.querySelector("#product-workflows")).toBeTruthy();
    expect(container.querySelector("#home-missions")).toBeTruthy();
    expect(container.querySelector("#home-growth-check")).toBeTruthy();
    expect(container.querySelectorAll("[data-founder-story]")).toHaveLength(1);
  });
  it("adds About to the footer, not to the Products or Industries options",()=>{
    render(<MarketingShell><AboutPage/></MarketingShell>);
    const footer=screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link",{name:"About"}).getAttribute("href")).toBe("/about");
  });
  it("makes only the exact About route public and indexable in configured production",()=>{
    expect(isPublicRoute("/about")).toBe(true);
    for(const path of ["/about/admin","/about-us","/dashboard","/settings"])expect(isPublicRoute(path)).toBe(false);
    expect(MARKETING_SITEMAP_PATHS.some(p=>p.path==="/about")).toBe(true);
    const robots=buildPublicRobots({NODE_ENV:"production",PUBLIC_SITE_URL:"https://getrenvani.com",VERCEL_ENV:"production"} as NodeJS.ProcessEnv);
    expect(JSON.stringify(robots)).toContain("/about$");
  });
});
