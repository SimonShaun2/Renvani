import { existsSync } from "node:fs";
import { join } from "node:path";

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./fonts", () => ({ geist: { variable: "g" }, newsreader: { variable: "n" } }));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import { PRODUCT_PAGES } from "./flagship-registry";
import { INDUSTRY_PAGES } from "./industry-registry";
import { MarketingShell } from "./MarketingShell";
import { MOBILE_EXPLORE } from "./ProductsMenuPanel";
import { PRODUCTS_MENU } from "./site-config";

afterEach(cleanup);

const APP = join(__dirname, "../../../../app");
const ROUTES: Record<string, string> = { "/": "(marketing)/page.tsx", "/product": "(marketing)/product/page.tsx", "/how-it-works": "(marketing)/how-it-works/page.tsx", "/pricing": "(marketing)/pricing/page.tsx", "/industries": "(marketing)/industries/page.tsx", "/demo": "(marketing)/demo/page.tsx", "/growth-check": "(marketing)/growth-check/page.tsx", "/login": "(auth)/login/[[...rest]]/page.tsx" };
const resolves = (h: string) =>
  (ROUTES[h] ? existsSync(join(APP, ROUTES[h]!)) : false) ||
  PRODUCT_PAGES.some((p) => `/product/${p.slug}` === h) ||
  INDUSTRY_PAGES.some((p) => `/industries/${p.slug}` === h);
const PLAIN_OK = ["Local Search · Preview", "Owner App & Approval Rules", "Owner rules"];

const menus = (c: HTMLElement) => ({ product: c.querySelector<HTMLDetailsElement>('[data-node-id="177:640"]')!, industry: c.querySelector<HTMLDetailsElement>('[data-node-id="177:686"]')!, mobile: c.querySelector<HTMLDetailsElement>('[data-node-id="177:737"]')! });

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
    expect(p.querySelectorAll('img[src="/marketing/menu/arrow.svg"]')).toHaveLength(22);
    expect(p.querySelector('a[href="/demo"]')).not.toBeNull();
    expect(p.querySelector("button[data-menu-close]")!.textContent).toBe("Close menu");
  });

  it("mobile menu matches 177:737: heading, All products, explore rows, groups, CTA, Close menu", () => {
    const { container } = render(<MarketingShell><p>x</p></MarketingShell>);
    const mob = menus(container).mobile;
    expect(mob.className).toContain("lg:hidden");
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
