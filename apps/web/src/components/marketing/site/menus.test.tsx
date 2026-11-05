import { existsSync } from "node:fs";
import { join } from "node:path";

import { cleanup, fireEvent, render } from "@testing-library/react";
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

const menus = (c: HTMLElement) => ({ product: c.querySelector<HTMLDetailsElement>('[data-node-id="177:640"]')!, industry: c.querySelector<HTMLDetailsElement>('[data-node-id="177:686"]')!, mobile: c.querySelector<HTMLDetailsElement>('[data-node-id="177:737"]')! });
const openMenu = (details: HTMLDetailsElement) => {
  details.open = true;
  fireEvent(details, new Event("toggle"));
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

  it("product menu matches the frame: heading, All products, 5 groups / 17 tool rows with arrows, demo CTA + Close menu", () => {
    const { container } = render(<MarketingShell><p>x</p></MarketingShell>);
    const p = menus(container).product;
    expect(p.textContent).toContain("Five products. One connected business.");
    expect(PRODUCTS_MENU.groups.map((g) => g.title)).toEqual(["Growth", "Revenue", "Operations", "Retention", "Command Center"]);
    expect(PRODUCTS_MENU.groups.flatMap((g) => g.items)).toHaveLength(17);
    expect(p.querySelectorAll('img[src="/marketing/menu/arrow-16.svg"]')).toHaveLength(17);
    expect(p.querySelectorAll('img[src="/marketing/menu/arrow-20.svg"]')).toHaveLength(5);
    expect(p.querySelector('a[href="/demo"]')).not.toBeNull();
    expect(p.querySelector("button[data-menu-close]")!.textContent).toBe("Close menu");
  });

  it("mobile menu matches 177:737: heading, All products, explore rows, groups, CTA, Close menu", () => {
    const { container } = render(<MarketingShell><p>x</p></MarketingShell>);
    const mob = menus(container).mobile;
    expect(mob.className).toContain("xl:hidden");
    expect(mob.textContent).toContain("Find your next step.");
    for (const e of MOBILE_EXPLORE) expect(mob.querySelector(`a[href="${e.href}"]`)).not.toBeNull();
    for (const g of PRODUCTS_MENU.groups) expect(mob.querySelector(`a[href="${g.href}"]`)).not.toBeNull();
    expect(mob.querySelector("button[data-menu-close]")).not.toBeNull();
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
    fireEvent.keyDown(d.querySelector("a")!, { key: "Escape" });
    expect(d.open).toBe(false);
    expect(s.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(s);
    const close = d.querySelector<HTMLButtonElement>("button[data-menu-close]");
    if (close) {
      d.open = true;
      fireEvent(d, new Event("toggle"));
      fireEvent.click(close);
      expect(d.open).toBe(false);
    }
  });

  it("opening a sibling menu closes the previous menu and updates both toggles without moving focus", () => {
    const { container } = render(<MarketingShell><p>x</p></MarketingShell>);
    const m = menus(container);
    const disclosures = [m.product, m.industry, m.mobile];
    for (const current of [...disclosures, m.product]) {
      const summary = current.querySelector("summary")!;
      summary.focus();
      openMenu(current);
      for (const menu of disclosures) {
        expect(menu.open).toBe(menu === current);
        expect(menu.querySelector("summary")!.getAttribute("aria-expanded")).toBe(String(menu === current));
      }
      expect(document.activeElement).toBe(summary);
    }
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
    openMenu(details);
    outside.focus();

    fireEvent.click(outside);
    expect(details.open).toBe(false);
    expect(details.querySelector("summary")!.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(outside);
  });

  it("interacting with panel content keeps it open, and focus can leave without being trapped", () => {
    const { container, getByRole, getByText } = renderDisclosure();
    const details = container.querySelector("details")!;
    const outside = getByRole("button", { name: "Outside action" });
    openMenu(details);

    fireEvent.pointerDown(getByText("Explore products"));
    fireEvent.click(getByText("Explore products"));
    expect(details.open).toBe(true);
    const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    fireEvent(details.querySelector("a")!, tab);
    expect(tab.defaultPrevented).toBe(false);
    outside.focus();
    expect(document.activeElement).toBe(outside);
    expect(details.open).toBe(true);
  });

  it("Escape after focus leaves the panel closes it and restores its toggle", () => {
    const { container, getByRole } = renderDisclosure();
    const details = container.querySelector("details")!;
    const outside = getByRole("button", { name: "Outside action" });
    openMenu(details);
    outside.focus();

    fireEvent.keyDown(outside, { key: "Escape" });
    expect(details.open).toBe(false);
    expect(details.querySelector("summary")!.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(details.querySelector("summary"));
  });

  it("a route change closes the panel without moving focus back to the header", () => {
    const { container, rerender, getByRole } = renderDisclosure();
    const details = container.querySelector("details")!;
    const outside = getByRole("button", { name: "Outside action" });
    openMenu(details);
    outside.focus();
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
  it("mobile menu closes on link click", () => {
    const { container } = render(<MarketingShell><p>x</p></MarketingShell>);
    const d = menus(container).mobile;
    d.open = true;
    fireEvent(d, new Event("toggle"));
    const a = d.querySelector<HTMLAnchorElement>('a[href="/growth-check"]')!;
    a.addEventListener("click", (e) => e.preventDefault());
    fireEvent.click(a);
    expect(d.open).toBe(false);
  });
});
