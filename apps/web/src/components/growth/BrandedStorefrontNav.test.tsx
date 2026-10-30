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
        bookHref="/book/demo"
        inquireHref="/site/demo/inquire"
        showReviewsLink={false}
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
        bookHref="/book/demo"
        inquireHref="/site/demo/inquire"
        showReviewsLink={false}
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
        bookHref="/book/demo"
        inquireHref="/site/demo/inquire"
        showReviewsLink={false}
        primaryClassName="bg-green"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

    const bookLink = screen.getByRole("link", { name: "Book a service" });
    bookLink.focus();

    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement?.textContent).toBe("Services");
  });
});
