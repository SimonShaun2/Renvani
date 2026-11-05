import { existsSync } from "node:fs";
import { join } from "node:path";

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("./fonts", () => ({ geist: { variable: "g" }, newsreader: { variable: "n" }, inter: { variable: "i", className: "inter" } }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

import { PRODUCT_PAGES } from "./flagship-registry";
import { HeaderDisclosure } from "./HeaderDisclosure";
import { INDUSTRY_PAGES } from "./industry-registry";
import { MarketingShell } from "./MarketingShell";
import { MOBILE_EXPLORE } from "./ProductsMenuPanel";
import { PRODUCTS_MENU } from "./site-config";

beforeEach(() => { navigation.pathname = "/"; });
afterEach(cleanup);

const APP = join(__dirname, "../../../../app");
const ROUTES: Record<string, string> = { "/": "(marketing)/page.tsx", "/product": "(marketing)/product/page.tsx", "/how-it-works": "(marketing)/how-it-works/page.tsx", "/pricing": "(marketing)/pricing/page.tsx", "/industries": "(marketing)/industries/page.tsx", "/demo": "(marketing)/demo/page.tsx", "/growth-check": "(marketing)/growth-check/page.tsx", "/login": "(auth)/login/[[...rest]]/page.tsx" };
const resolves = (h: string) =>
  (ROUTES[h] ? existsSync(join(APP, ROUTES[h]!)) : false) ||
  PRODUCT_PAGES.some((p) => `/product/${p.slug}` === h) ||
  INDUSTRY_PAGES.some((p) => `/industries/${p.slug}` === h);
const PLAIN_OK = ["Local Search · Preview", "Owner App & Approval Rules", "Owner rules"];
const INDUSTRY_LINKS = [
  { label: "HVAC", href: "/industries/hvac" },
  { label: "Plumbing", href: "/industries/plumbing" },
  { label: "Electrical", href: "/industries/electrical" }
];

const menus = (c: HTMLElement) => ({ product: c.querySelector<HTMLDetailsElement>('[data-node-id="177:640"]')!, industry: c.querySelector<HTMLDetailsElement>('[data-node-id="177:686"]')!, mobile: c.querySelector<HTMLDetailsElement>('[data-node-id="177:737"]')! });
const openMenu = (details: HTMLDetailsElement) => {
  details.open = true;
  fireEvent(details, new Event("toggle"));
};
const expectProductInventory = (menu: HTMLElement) => {
  const products = menu.querySelector<HTMLElement>('nav[aria-label="Renvani products"]');
  const tools = menu.querySelector<HTMLElement>('nav[aria-label="Product tools"]');
  expect(products).not.toBeNull();
  expect(tools).not.toBeNull();
  const productLinks = [...products!.querySelectorAll("a")];
  const toolLinks = [...tools!.querySelectorAll("a")];
  const expectedTools = PRODUCTS_MENU.groups.flatMap((group) => group.items);

  expect(productLinks).toHaveLength(5);
  expect(toolLinks).toHaveLength(17);
  expect(productLinks.map((link) => link.getAttribute("href")).sort()).toEqual(PRODUCTS_MENU.groups.map((group) => group.href).sort());
  expect(toolLinks.map((link) => link.getAttribute("href")).sort()).toEqual(expectedTools.map((tool) => tool.href).sort());
  for (const group of PRODUCTS_MENU.groups) {
    expect(productLinks.find((link) => link.getAttribute("href") === group.href)?.textContent, group.title).toContain(group.title);
  }
  for (const tool of expectedTools) {
    expect(toolLinks.find((link) => link.getAttribute("href") === tool.href)?.textContent, tool.label).toContain(tool.label);
  }
  expect(menu.querySelector("a a")).toBeNull();
};
const expectIndustryInventory = (menu: HTMLElement) => {
  const industries = menu.querySelector<HTMLElement>('nav[aria-label="Renvani industries"]');
  expect(industries).not.toBeNull();
  const links = [...industries!.querySelectorAll("a")];
  expect(links).toHaveLength(3);
  expect(links.map((link) => link.getAttribute("href")).sort()).toEqual(INDUSTRY_LINKS.map((industry) => industry.href).sort());
  for (const industry of INDUSTRY_LINKS) {
    const link = links.find((item) => item.getAttribute("href") === industry.href)!;
    expect(link.getAttribute("aria-label")).toBe(industry.label);
    expect(link.textContent).toContain(industry.label);
  }
  expect(industries!.querySelector("a a")).toBeNull();
  expect(menu.querySelector('a[href="/industries"]')!.textContent).toContain("All industries");
};

describe("header menus (177:640, 177:686, 177:737)", () => {
  it("every menu link resolves to a real page; only agreed items are plain text", () => {
    const { container } = render(<MarketingShell><p>x</p></MarketingShell>);
    const m = menus(container);
    for (const el of [m.product, m.industry, m.mobile]) {
      for (const a of el.querySelectorAll("a")) expect(resolves(a.getAttribute("href")!), a.getAttribute("href")!).toBe(true);
      for (const s of el.querySelectorAll("[data-pending-route]")) expect(PLAIN_OK.some((p) => s.textContent!.includes(p)), s.textContent!).toBe(true);
    }
    for (const g of PRODUCTS_MENU.groups) for (const i of g.items) expect(i.href, i.label).toBeTruthy();
  });

  it("desktop menu offers five direct product links, all 17 tools, the directory and next-step links", () => {
    const { container } = render(<MarketingShell><p>x</p></MarketingShell>);
    const p = menus(container).product;
    expectProductInventory(p);
    expect(p.querySelector('a[href="/product"]')!.textContent).toContain("All products");
    expect(p.querySelector('a[href="/growth-check"]')).not.toBeNull();
    expect(p.querySelector('a[href="/demo"]')).not.toBeNull();
    expect(p.querySelector("button[data-menu-close]")!.textContent).toBe("Close menu");
  });

  it("desktop Industries offers the three active trades, their directory and demo access", () => {
    const { container } = render(<MarketingShell><p>x</p></MarketingShell>);
    const industry = menus(container).industry;
    expectIndustryInventory(industry);
    expect(industry.querySelector('a[href="/demo"]')).not.toBeNull();
    expect(industry.querySelector("button[data-menu-close]")!.textContent).toBe("Close menu");
  });

  it("mobile menu preserves the full product inventory, website navigation, sign-in and demo access", () => {
    const { container } = render(<MarketingShell><p>x</p></MarketingShell>);
    const mob = menus(container).mobile;
    expect(mob.textContent).toContain("Explore Renvani.");
    expectProductInventory(mob);
    expectIndustryInventory(mob);
    expect(mob.querySelector('a[href="/product"]')!.textContent).toContain("All products");
    for (const e of MOBILE_EXPLORE) expect(mob.querySelector(`a[href="${e.href}"]`)).not.toBeNull();
    expect(mob.querySelector('a[href="/login"]')).not.toBeNull();
    expect(mob.querySelector('a[href="/demo"]')).not.toBeNull();
    expect(mob.querySelector("button[data-menu-close]")).not.toBeNull();
  });

  it("mobile tools expand without closing the header menu, then following a tool closes the header", () => {
    const { container } = render(<MarketingShell><p>x</p></MarketingShell>);
    const mobile = menus(container).mobile;
    const outerSummary = mobile.querySelector("summary")!;
    const tools = mobile.querySelector<HTMLDetailsElement>("details[data-product-tools]")!;
    expect(tools).not.toBeNull();
    expect(tools.hasAttribute("name")).toBe(false);
    const toolSummary = tools.querySelector("summary")!;
    expect(toolSummary.textContent).toContain("Explore all tools");
    openMenu(mobile);
    expect(tools.open).toBe(false);

    fireEvent.click(toolSummary);
    fireEvent(tools, new Event("toggle"));
    expect(tools.open).toBe(true);
    expect(mobile.open).toBe(true);
    expect(outerSummary.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(toolSummary);
    fireEvent(tools, new Event("toggle"));
    expect(tools.open).toBe(false);
    expect(mobile.open).toBe(true);
    expect(outerSummary.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(toolSummary);
    fireEvent(tools, new Event("toggle"));
    expect(tools.open).toBe(true);
    const link = tools.querySelector<HTMLAnchorElement>('a[href="/product/websites"]')!;
    link.addEventListener("click", (event) => event.preventDefault());
    act(() => link.focus());
    expect(mobile.open).toBe(true);
    fireEvent.click(link);
    expect(mobile.open).toBe(false);
    expect(outerSummary.getAttribute("aria-expanded")).toBe("false");
  });

  it("mobile Industries expands without closing the header, and its trade links dismiss the header without stealing focus", () => {
    const { container } = render(<MarketingShell><p>x</p></MarketingShell>);
    const mobile = menus(container).mobile;
    const outerSummary = mobile.querySelector("summary")!;
    const industries = mobile.querySelector<HTMLDetailsElement>("details[data-industry-menu]")!;
    expect(industries).not.toBeNull();
    expect(industries.hasAttribute("name")).toBe(false);
    const summary = industries.querySelector("summary")!;
    expect(summary.textContent).toContain("Industries");
    openMenu(mobile);
    expect(industries.open).toBe(false);

    fireEvent.click(summary);
    fireEvent(industries, new Event("toggle"));
    expect(industries.open).toBe(true);
    expect(mobile.open).toBe(true);
    expect(outerSummary.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(summary);
    fireEvent(industries, new Event("toggle"));
    expect(industries.open).toBe(false);
    expect(mobile.open).toBe(true);

    fireEvent.click(summary);
    fireEvent(industries, new Event("toggle"));
    const link = industries.querySelector<HTMLAnchorElement>('a[href="/industries/electrical"]')!;
    link.addEventListener("click", (event) => event.preventDefault());
    act(() => link.focus());
    expect(mobile.open).toBe(true);
    fireEvent.click(link);
    expect(mobile.open).toBe(false);
    expect(outerSummary.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).not.toBe(outerSummary);
  });

  it("Tab can leave the nested Industries links and dismiss the mobile menu without returning focus to the header", () => {
    const { container, getByRole } = render(<MarketingShell><button type="button">Outside action</button></MarketingShell>);
    const mobile = menus(container).mobile;
    const industries = mobile.querySelector<HTMLDetailsElement>("details[data-industry-menu]")!;
    const outside = getByRole("button", { name: "Outside action" });
    openMenu(mobile);
    openMenu(industries);
    const link = industries.querySelector<HTMLAnchorElement>('a[href="/industries/electrical"]')!;
    act(() => link.focus());
    const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    fireEvent(link, tab);
    expect(tab.defaultPrevented).toBe(false);
    // Supply the browser's native focus movement; this DOM environment does not perform Tab traversal.
    act(() => outside.focus());
    expect(mobile.open).toBe(false);
    expect(mobile.querySelector("summary")!.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(outside);
  });

  it.each(["product", "industry", "mobile"] as const)("%s menu: aria-expanded tracks open state; Escape and Close menu close it and return focus", (k) => {
    const { container } = render(<MarketingShell><p>x</p></MarketingShell>);
    const d = menus(container)[k];
    const s = d.querySelector("summary")!;
    expect(s.getAttribute("aria-expanded")).toBe("false");
    expect(d.querySelector(`#${CSS.escape(s.getAttribute("aria-controls")!)}`)).not.toBeNull();
    d.open = true;
    fireEvent(d, new Event("toggle"));
    expect(s.getAttribute("aria-expanded")).toBe("true");
    if (k === "mobile") expect(s.getAttribute("aria-label")).toBe("Close menu");
    if (k === "mobile") openMenu(d.querySelector<HTMLDetailsElement>("details[data-industry-menu]")!);
    const link = k === "mobile" ? d.querySelector<HTMLAnchorElement>('[data-industry-menu] a[href="/industries/hvac"]')! : d.querySelector("a")!;
    act(() => link.focus());
    fireEvent.keyDown(link, { key: "Escape" });
    expect(d.open).toBe(false);
    expect(s.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(s);
    const close = d.querySelector<HTMLButtonElement>("button[data-menu-close]")!;
    expect(close).not.toBeNull();
    openMenu(d);
    act(() => close.focus());
    fireEvent.click(close);
    expect(d.open).toBe(false);
    expect(s.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(s);
  });

  it("opening a sibling menu closes the previous menu and updates both toggles without moving focus", () => {
    const { container } = render(<MarketingShell><p>x</p></MarketingShell>);
    const m = menus(container);
    const disclosures = [m.product, m.industry, m.mobile];
    const focusedSummary = m.product.querySelector("summary")!;
    focusedSummary.focus();
    for (const current of [...disclosures, m.product]) {
      openMenu(current);
      for (const menu of disclosures) {
        expect(menu.open).toBe(menu === current);
        expect(menu.querySelector("summary")!.getAttribute("aria-expanded")).toBe(String(menu === current));
      }
      expect(document.activeElement).toBe(focusedSummary);
    }
  });

  it("clicking another summary closes the previous panel and opens the requested menu", () => {
    const { container } = render(<MarketingShell><p>x</p></MarketingShell>);
    const { product, industry } = menus(container);
    const nextSummary = industry.querySelector("summary")!;
    openMenu(product);
    product.querySelector("a")!.focus();

    fireEvent.pointerDown(nextSummary);
    act(() => nextSummary.focus());
    fireEvent.click(nextSummary);
    expect(product.open).toBe(false);
    expect(product.querySelector("summary")!.getAttribute("aria-expanded")).toBe("false");
    expect(industry.open).toBe(true);
    expect(nextSummary.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(nextSummary);

    fireEvent.click(nextSummary);
    expect(industry.open).toBe(false);
    expect(document.activeElement).toBe(nextSummary);
  });
});

describe("header disclosure dismissal", () => {
  const renderDisclosure = () => render(
    <>
      <HeaderDisclosure nodeId="test-menu" summary="Products" panelClassName="">
        <p>Explore products</p>
        <a href="/product">All products</a>
      </HeaderDisclosure>
      <button type="button">Outside action</button>
    </>
  );

  it("an outside pointer click closes the panel without taking focus from the clicked control", () => {
    const { container, getByRole } = renderDisclosure();
    const details = container.querySelector("details")!;
    const summary = details.querySelector("summary")!;
    const outside = getByRole("button", { name: "Outside action" });
    outside.addEventListener("pointerdown", (event) => event.stopPropagation());
    openMenu(details);
    details.querySelector("a")!.focus();

    fireEvent.pointerDown(outside);
    expect(details.open).toBe(false);
    expect(summary.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).not.toBe(summary);
    // Browsers move focus after pointerdown; fireEvent needs that default action supplied explicitly.
    outside.focus();
    fireEvent.click(outside);
    expect(document.activeElement).toBe(outside);
  });

  it("an outside click without a pointer event also closes the panel and preserves focus", () => {
    const { container, getByRole } = renderDisclosure();
    const details = container.querySelector("details")!;
    const outside = getByRole("button", { name: "Outside action" });
    outside.addEventListener("click", (event) => event.stopPropagation());
    outside.focus();
    openMenu(details);
    expect(details.open).toBe(true);

    fireEvent.click(outside);
    expect(details.open).toBe(false);
    expect(details.querySelector("summary")!.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(outside);
  });

  it("Tab moving focus outside closes the panel and leaves focus on the destination control", () => {
    const { container, getByRole, getByText } = renderDisclosure();
    const details = container.querySelector("details")!;
    const outside = getByRole("button", { name: "Outside action" });
    const link = details.querySelector("a")!;
    outside.addEventListener("focusin", (event) => event.stopPropagation());
    openMenu(details);
    link.focus();

    fireEvent.pointerDown(getByText("Explore products"));
    fireEvent.click(getByText("Explore products"));
    expect(details.open).toBe(true);
    const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    fireEvent(link, tab);
    expect(tab.defaultPrevented).toBe(false);
    // fireEvent does not perform Tab's native focus movement.
    act(() => outside.focus());
    expect(document.activeElement).toBe(outside);
    expect(details.open).toBe(false);
    expect(details.querySelector("summary")!.getAttribute("aria-expanded")).toBe("false");

    fireEvent.keyDown(outside, { key: "Escape" });
    expect(document.activeElement).toBe(outside);
  });

  it("Escape while focus is inside the open panel closes it and restores its toggle", () => {
    const { container } = renderDisclosure();
    const details = container.querySelector("details")!;
    const link = details.querySelector("a")!;
    openMenu(details);
    link.focus();
    expect(details.open).toBe(true);

    fireEvent.keyDown(link, { key: "Escape" });
    expect(details.open).toBe(false);
    expect(details.querySelector("summary")!.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(details.querySelector("summary"));
  });

  it("a route change closes the panel without moving focus back to the header", () => {
    const { container, rerender, getByRole } = renderDisclosure();
    const details = container.querySelector("details")!;
    const outside = getByRole("button", { name: "Outside action" });
    outside.focus();
    openMenu(details);
    expect(details.open).toBe(true);
    navigation.pathname = "/pricing";

    rerender(
      <>
        <HeaderDisclosure nodeId="test-menu" summary="Products" panelClassName="">
          <p>Explore products</p>
          <a href="/product">All products</a>
        </HeaderDisclosure>
        <button type="button">Outside action</button>
      </>
    );
    expect(details.open).toBe(false);
    expect(details.querySelector("summary")!.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(outside);
  });
});

describe("header menus close when a link is followed", () => {
  it.each([
    { menu: "industry" as const, href: "/industries/hvac" },
    { menu: "mobile" as const, href: "/growth-check" }
  ])("$menu menu closes on link click", ({ menu, href }) => {
    const { container } = render(<MarketingShell><p>x</p></MarketingShell>);
    const d = menus(container)[menu];
    d.open = true;
    fireEvent(d, new Event("toggle"));
    const a = d.querySelector<HTMLAnchorElement>(`a[href="${href}"]`)!;
    a.addEventListener("click", (e) => e.preventDefault());
    fireEvent.click(a);
    expect(d.open).toBe(false);
  });
});
