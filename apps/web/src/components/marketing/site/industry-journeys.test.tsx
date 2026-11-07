import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("./fonts", () => ({ geist: { variable: "g" }, inter: { variable: "i", className: "inter" }, newsreader: { variable: "n" } }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", notFound: () => { throw new Error("404"); } }));
afterEach(cleanup);
import { INDUSTRY_PAGES } from "./industry-registry";
import { PRODUCT_PAGE_BY_SLUG } from "./flagship-registry";
import { INDUSTRY_JOURNEYS } from "./industry-journeys";
import { IndustryDetailPage } from "./DetailPages";

const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

describe("industry value stories within the approved design", () => {
  it("has a distinct story for every existing industry, without adding industry options", () => {
    expect(Object.keys(INDUSTRY_JOURNEYS).sort()).toEqual(INDUSTRY_PAGES.map(i => i.slug).sort());
    for (const part of ["discover", "deliver", "retain"] as const) {
      expect(new Set(Object.values(INDUSTRY_JOURNEYS).map(j => j[part].title)).size).toBe(14);
      expect(new Set(Object.values(INDUSTRY_JOURNEYS).map(j => j[part].body)).size).toBe(14);
    }
  });
  it("preserves the accepted stylesheet and all shared/product-page components", () => {
    expect(digest(readFileSync(join(__dirname, "detail-pages.module.css")))).toBe("e5bbf6035baccee66dd094ac03f43703d8ec41cff2b4d117b08835705c810619");
    const source = readFileSync(join(__dirname, "DetailPages.tsx"), "utf8");
    const shared = source.slice(source.indexOf("type Layer ="), source.indexOf("function TradeScene("));
    expect(digest(shared)).toBe("78ce3a67b3e7d7675d0b7963095e7c76d0c195133966f6a9ca04d8d0b1b3e640");
  });
  it.each(INDUSTRY_PAGES)("$slug connects the mission, five flagships and two supporting tools", industry => {
    const journey = INDUSTRY_JOURNEYS[industry.slug];
    const { container } = render(<IndustryDetailPage industry={industry} />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(industry.headline);
    const features = container.querySelector("#features")!;
    for (const name of ["Operating Missions", "Growth", "Revenue", "Operations", "Retention", "Command Center"]) expect(features.textContent).toContain(name);
    expect(features.textContent).toContain("Get more bookings");
    expect(features.textContent).toContain(journey.focus);
    expect(container.textContent).toContain(journey.ownerOutcome);
    expect(features.querySelectorAll("[data-detail-feature]")).toHaveLength(3);
    for (const section of features.querySelectorAll("[data-detail-feature]")) {
      expect(section.querySelectorAll("li")).toHaveLength(3);
      expect(section.querySelector("figure")).toBeTruthy();
    }
    expect(features.textContent).toContain("mobile payment");
    expect(features.textContent).toContain("approved");
    const tools = container.querySelector("#tools")!;
    const links = within(tools as HTMLElement).getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(new Set(journey.tools.map(t => t.slug)).size).toBe(2);
    for (const [index, tool] of journey.tools.entries()) {
      const page = PRODUCT_PAGE_BY_SLUG[tool.slug]!;
      expect(page).toBeTruthy();
      expect(page.template).not.toBe("flagship");
      expect(links[index]!.getAttribute("href")).toBe(`/product/${tool.slug}`);
      expect(links[index]!.textContent).toContain(page.name);
      expect(links[index]!.textContent).toContain(tool.value);
    }
    expect(container.querySelectorAll("details")).toHaveLength(4);
    expect(container.textContent).toContain("consent");
    expect(container.textContent).toContain("Illustrative workflow");
    for (const a of container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) expect(container.querySelector(a.getAttribute("href")!)).toBeTruthy();
  });
  it("keeps the HVAC and garage door examples focused on their own business value", () => {
    const hvac = INDUSTRY_JOURNEYS.hvac;
    const door = INDUSTRY_JOURNEYS["garage-doors"];
    expect(hvac.retain.body).toContain("maintenance");
    expect(hvac.tools.map(t => t.slug)).toEqual(["technician-app", "scheduling-dispatch"]);
    expect(door.discover.body).toContain("opener");
    expect(door.deliver.body).toContain("mobile payment");
    expect(door.tools.map(t => t.slug)).toEqual(["estimates-approvals", "technician-app"]);
  });
});
