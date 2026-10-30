import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

vi.mock("./fonts", () => ({ geist: { variable: "g" }, newsreader: { variable: "n" } }));

import { HomePage } from "./HomePage";
import { MarketingShell } from "./MarketingShell";
import { HOME, SITE_NAV } from "./site-config";

const COMPETITORS = /jobber|servicetitan|housecall|service fusion|fieldedge/i;
const RESTAURANT = /restaurant|menu|diner|reservation|table/i;

describe("marketing site (Figma 171:2)", () => {
  it("renders the shared nav with the Figma links and demo CTA", () => {
    render(<MarketingShell><p>x</p></MarketingShell>);
    const main = screen.getByRole("navigation", { name: "Main" });
    for (const l of SITE_NAV.links) expect(main.textContent).toContain(l.label);
    expect(screen.getAllByRole("link", { name: "Get a free demo" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("navigation", { name: "Footer" })).toBeTruthy();
  });

  it("renders the home hero, sections and two growth check entries", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("More direct jobs.");
    expect(screen.getByRole("heading", { name: /The first click is/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Good work/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Built around/ })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Get my growth report" })).toHaveLength(2);
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
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
