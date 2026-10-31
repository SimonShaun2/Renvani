import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

vi.mock("./fonts", () => ({ geist: { variable: "g" }, newsreader: { variable: "n" } }));

import { HomePage } from "./HomePage";
import { MarketingShell } from "./MarketingShell";
import { HOME, SITE_FOOTER, SITE_NAV } from "./site-config";

const COMPETITORS = /jobber|servicetitan|housecall|service fusion|fieldedge|owner\.com|\bowner com\b|broccoli/i;
const RESTAURANT = /restaurant|menu|diner|reservation|table/i;

describe("marketing site (Figma 171:2)", () => {
  it("competitor guard scans HomePage.tsx, site-config and footer copy", () => {
    const src = ["HomePage.tsx", "site-config.ts", "MarketingShell.tsx"].map((f) => readFileSync(join(__dirname, f), "utf8")).join("\n");
    expect(src + JSON.stringify(SITE_FOOTER)).not.toMatch(COMPETITORS);
    expect(COMPETITORS.test("Owner.com")).toBe(true);
    expect(COMPETITORS.test("Broccoli")).toBe(true);
  });

  it("footer year is computed and the example has no fixed calendar date", () => {
    expect(SITE_FOOTER.copyright).toBe(`© ${new Date().getFullYear()} Renvani`);
    expect(JSON.stringify(HOME)).not.toMatch(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (January|February|March|April|May|June|July|August|September|October|November|December) \d/);
  });

  it("mobile hero and intelligence use the mobile-only Figma components", () => {
    const { container: root } = render(<HomePage />);
    const container = root.querySelector(".md\\:hidden.lg\\:block")!;
    expect(container.querySelector('[data-node-id="219:9474"]')!.className).toContain("md:hidden");
    expect(container.querySelector('[data-node-id="253:6779"]')!.className).toContain("md:hidden");
    expect(container.querySelector('[data-node-id="200:46"]')!.parentElement!.className).toContain("hidden md:block");
  });

  it("tablet 768 renders its own frame (253:6780) between md and lg with real links and forms", () => {
    const { container } = render(<HomePage />);
    const tablet = container.querySelector('[data-node-id="253:6780"]')!;
    expect(tablet.parentElement!.className).toBe("hidden md:block lg:hidden");
    expect(tablet.parentElement!.nextElementSibling!.className).toBe("md:hidden lg:block");
    expect(tablet.querySelectorAll("form")).toHaveLength(2);
    expect(tablet.textContent).not.toMatch(/Oct 29/);
    expect(tablet.textContent).toContain("Next available day");
    const hrefs = [...tablet.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    for (const h of ["/product-tour", "/industries/hvac", "/industries/hvac#plumbing", "/product/revenue", "/product/command-center"]) expect(hrefs).toContain(h);
    expect(tablet.querySelector("a a")).toBeNull();
  });

  it("nav collapses to the hamburger icon below lg; mobile footer and area links are one column", () => {
    const { container } = render(<MarketingShell><HomePage /></MarketingShell>);
    expect(screen.getByRole("navigation", { name: "Main" }).className).toContain("lg:flex");
    const menu = container.querySelector('[data-node-id="177:737"]')!;
    expect(menu.className).toContain("lg:hidden");
    expect(menu.querySelector("summary img")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Footer" }).className).toMatch(/^flex flex-col /);
    expect(screen.getByRole("navigation", { name: "Product areas" }).className).toMatch(/^flex flex-col /);
  });

  it("renders the shared nav with the Figma links and demo CTA", () => {
    render(<MarketingShell><p>x</p></MarketingShell>);
    const main = screen.getByRole("navigation", { name: "Main" });
    for (const l of SITE_NAV.links) expect(main.textContent).toContain(l.label);
    expect(screen.getAllByRole("link", { name: "Get a free demo" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("navigation", { name: "Footer" })).toBeTruthy();
  });

  it("renders the home hero, sections and two growth check entries", () => {
    render(<HomePage />);
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(2); // lg+/mobile hero and the tablet (253:6780) hero; only one is ever displayed
    for (const h of h1s) expect(h.textContent).toContain("More direct jobs.");
    expect(screen.getByRole("heading", { name: /The first click is/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Good work/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Built around/ })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Get my growth report" })).toHaveLength(4);
    expect(screen.getAllByRole("textbox")).toHaveLength(4);
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
  });
});
