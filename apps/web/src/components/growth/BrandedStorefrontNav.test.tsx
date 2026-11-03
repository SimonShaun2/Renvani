// @vitest-environment happy-dom

import React, { type ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BrandedStorefrontNav } from "@/src/components/growth/BrandedStorefrontNav";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onClick,
    className
  }: {
    children: ReactNode;
    href: string;
    onClick?: () => void;
    className?: string;
  }) => (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  )
}));

describe("BrandedStorefrontNav mobile menu", () => {
  afterEach(() => {
    cleanup();
  });

  it("moves focus into the panel when opened", () => {
    render(
      <BrandedStorefrontNav
        primaryHref="/book/demo"
        primaryLabel="Book a service"
        inquireHref="/site/demo/inquire"
        showReviewsLink={false}
        showPricing
        primaryClassName="bg-green"
      />
    );

    const toggle = screen.getByRole("button", { name: "Open menu" });
    fireEvent.click(toggle);

    expect(screen.getByRole("navigation", { name: "Mobile" })).toBeTruthy();
    expect(document.activeElement?.textContent).toBe("Services");
  });

  it("closes on Escape and returns focus to the toggle", () => {
    render(
      <BrandedStorefrontNav
        primaryHref="/book/demo"
        primaryLabel="Book a service"
        inquireHref="/site/demo/inquire"
        showReviewsLink={false}
        showPricing
        primaryClassName="bg-green"
      />
    );

    const toggle = screen.getByRole("button", { name: "Open menu" });
    fireEvent.click(toggle);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("navigation", { name: "Mobile" })).toBeNull();
    expect(document.activeElement).toBe(toggle);
  });

  it("keeps focus inside the panel when tabbing from the last item", () => {
    render(
      <BrandedStorefrontNav
        primaryHref="/book/demo"
        primaryLabel="Book a service"
        inquireHref="/site/demo/inquire"
        showReviewsLink={false}
        showPricing
        primaryClassName="bg-green"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

    const bookLink = screen.getByRole("link", { name: "Book a service" });
    bookLink.focus();

    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement?.textContent).toBe("Services");
  });

  it("routes unconfigured services to inquiry and hides pricing", () => {
    render(<BrandedStorefrontNav primaryHref="/site/demo/inquire" primaryLabel="Send an inquiry" inquireHref="/site/demo/inquire" showReviewsLink={false} showPricing={false} primaryClassName="bg-green" />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.queryByRole("link", { name: "Pricing" })).toBeNull();
    expect(screen.getAllByRole("link", { name: "Send an inquiry" }).every((link) => link.getAttribute("href") === "/site/demo/inquire")).toBe(true);
  });
});
