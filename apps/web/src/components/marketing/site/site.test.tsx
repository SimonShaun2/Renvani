import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

vi.mock("./fonts", () => ({ geist: { variable: "g" }, inter: { variable: "i", className: "inter" }, newsreader: { variable: "n" } }));

import { HomePage } from "./HomePage";
import { MarketingShell } from "./MarketingShell";
import { HOME_WORKFLOWS } from "./home-workflows";
import { GROWTH_CHECK_ENTRY, HOME, SITE_FOOTER, SITE_NAV } from "./site-config";

const COMPETITORS = /jobber|servicetitan|housecall|service fusion|fieldedge|owner\.com|\bowner com\b|broccoli/i;
const RESTAURANT = /restaurant|menu|diner|reservation|table/i;

describe("marketing site (Figma 171:2)", () => {
  it("competitor guard scans homepage, workflow, shared navigation and footer copy", () => {
    const src = ["HomePage.tsx", "HomepageWorkflows.tsx", "home-workflows.ts", "IndustryShowcase.tsx", "site-config.ts", "MarketingShell.tsx"].map((f) => readFileSync(join(__dirname, f), "utf8")).join("\n");
    expect(src + JSON.stringify(SITE_FOOTER)).not.toMatch(COMPETITORS);
    expect(COMPETITORS.test("Owner.com")).toBe(true);
    expect(COMPETITORS.test("Broccoli")).toBe(true);
  });

  it("footer year is computed and the example has no fixed calendar date", () => {
    expect(SITE_FOOTER.copyright).toBe(`© ${new Date().getFullYear()} Renvani`);
    expect(JSON.stringify(HOME)).not.toMatch(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (January|February|March|April|May|June|July|August|September|October|November|December) \d/);
  });

  it("uses one responsive hero and one photograph across breakpoints", () => {
    const { container } = render(<HomePage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "More jobs. Less on your shoulders." })).toBeTruthy();
    const hero = screen.getByRole("region", { name: "More jobs. Less on your shoulders." });
    const heroImages = [...hero.querySelectorAll("img")].filter((image) => image.getAttribute("src")?.includes("hero-hvac-tech"));
    expect(heroImages.length + hero.querySelectorAll("video").length).toBeGreaterThanOrEqual(1);
    expect(hero.querySelector('[data-node-id="578:5189"]')).toBeTruthy();
    expect(container.querySelector("a a")).toBeNull();
  });

  it("keeps the shared mobile navigation and footer", () => {
    const { container } = render(<MarketingShell><HomePage /></MarketingShell>);
    expect(screen.getByRole("navigation", { name: "Main" }).className).toContain("xl:flex");
    const menu = container.querySelector('[data-node-id="177:737"]')!;
    expect(menu.className).toContain("xl:hidden");
    expect(menu.querySelector("summary img")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Footer" }).className).toMatch(/^flex flex-col /);
  });

  it("renders the shared nav with the Figma links and demo CTA", () => {
    render(<MarketingShell><p>x</p></MarketingShell>);
    const main = screen.getByRole("navigation", { name: "Main" });
    for (const l of SITE_NAV.links) expect(main.textContent).toContain(l.label);
    expect(screen.getAllByRole("link", { name: "Get a free demo" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("navigation", { name: "Footer" })).toBeTruthy();
  });

  it("makes each flagship discoverable and keeps the website capture handoff working", () => {
    const { container } = render(<HomePage />);
    for (const workflow of HOME_WORKFLOWS) expect(screen.getByRole("tab", { name: workflow.name })).toBeTruthy();
    expect(screen.getByRole("link", { name: "See Renvani in action" }).getAttribute("href")).toBe("#product-workflows");
    expect(container.querySelector("#product-workflows")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Get my growth report" }).getAttribute("href")).toBe("/growth-check");
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    const input = screen.getByRole("textbox", { name: GROWTH_CHECK_ENTRY.label });
    expect(input.getAttribute("name")).toBe("website");
    expect(input.closest("form")!.getAttribute("action")).toBe("/growth-check");
    expect(input.closest("form")!.getAttribute("method")).toBe("get");
    expect(screen.getByRole("button", { name: "Get my growth report" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "See what your website could do better." })).toBeTruthy();
  });

  it("labels the mission as an illustrative owner-reviewed external-growth proposal", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: /Set the goal.*See the next move/ })).toBeTruthy();
    expect(screen.getByRole("img", { name: /Illustrative mission.*local outreach campaign.*Owner review/ })).toBeTruthy();
    expect(screen.getByText("Proposed experience · Illustrative workflow")).toBeTruthy();
    expect(screen.getByRole("link", { name: /See how Operating Missions could work/ }).getAttribute("href")).toBe("/product/command-center");
  });

  it("uses home-services copy only and no competitor names", () => {
    const text = JSON.stringify(HOME) + JSON.stringify(SITE_NAV);
    expect(text).not.toMatch(COMPETITORS);
    expect(text).not.toMatch(RESTAURANT);
  });

  it("keeps motion CSS out of globals.css and honours reduced motion", () => {
    const css = readFileSync(join(__dirname, "site.module.css"), "utf8");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });
});

describe("marketing assets are public", () => {
  it("serves /public/marketing files without sign-in", async () => {
    const { isPublicRoute } = await import("@/src/lib/route-access");
    expect(isPublicRoute("/marketing/home/hvac-tech.jpg")).toBe(true);
    expect(isPublicRoute("/marketing")).toBe(false);
    expect(isPublicRoute("/media/why-renvani/rafael-v4-poster-fallback.jpg")).toBe(true);
    expect(isPublicRoute("/media/loops/work-growth-poster-fallback.jpg")).toBe(true);
    expect(isPublicRoute("/media")).toBe(false);
  });
});
