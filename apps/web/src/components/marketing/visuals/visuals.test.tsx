import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PLACEHOLDER_CONTENT, getVisual } from "@/src/content/marketing-content";

import { FALLBACK_HOME_PRICING, STATIC_PRODUCT_SECTIONS, mapSection, pricingFromSection } from "@/src/content/page-sections";

import { layerStyle } from "./motion";
import { PricingSection } from "./PricingSection";
import { ProductVisual } from "./ProductVisual";
import { SectionBlock } from "./SectionBlock";

function mockMedia(matching: string[]) {
  window.matchMedia = ((query: string) => ({
    matches: matching.some((m) => query.includes(m)),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {}
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  // Never intersects: proves reduced motion does not depend on scroll.
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  };
});
afterEach(() => cleanup());

describe("motion styles", () => {
  it("slides 8px (panel) and 10px (cards) when not reduced", () => {
    expect(layerStyle("panel", { shown: false, reduced: false, animating: false }).transform).toContain("translateY(8px)");
    expect(layerStyle("cardA", { shown: false, reduced: false, animating: false }).transform).toBe("translateY(10px)");
    expect(layerStyle("cardA", { shown: true, reduced: false, animating: false }).transform).toBe("none");
  });

  it("uses opacity only under reduced motion", () => {
    for (const layer of ["panel", "ring", "cardA", "cardB", "counter"] as const) {
      const style = layerStyle(layer, { shown: true, reduced: true, animating: false });
      expect(style.transform).toBeUndefined();
      expect(style.opacity).toBe(1);
      expect(style.transition).toMatch(/^opacity 200ms/);
    }
  });
});

describe("ProductVisual with prefers-reduced-motion", () => {
  it("shows final state, final counter and no cursor immediately", () => {
    mockMedia(["prefers-reduced-motion"]);
    render(<ProductVisual content={getVisual(PLACEHOLDER_CONTENT, "revenue")} />);
    const root = screen.getByTestId("visual-revenue");
    expect(root.dataset.reducedMotion).toBe("true");
    expect(screen.getByTestId("counter-value").textContent).toBe("$8,400");
    expect(screen.queryByTestId("cursor")).toBeNull();
    for (const el of root.querySelectorAll<HTMLElement>("[data-layer]")) {
      expect(el.style.opacity).toBe("1");
      expect(el.style.transform).toBe("");
    }
  });

  it("starts hidden with counter at 0 when motion is allowed and not yet in view", () => {
    mockMedia([]);
    render(<ProductVisual content={getVisual(PLACEHOLDER_CONTENT, "command-center")} />);
    expect(screen.getByTestId("counter-value").textContent).toBe("$0");
  });

  it("skips the cursor glide on touch but still swaps the chip", () => {
    vi.useFakeTimers();
    mockMedia(["pointer: coarse"]);
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
      cb: IntersectionObserverCallback;
      constructor(cb: IntersectionObserverCallback) { this.cb = cb; }
      observe() { this.cb([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
      disconnect() {}
    };
    render(<ProductVisual content={getVisual(PLACEHOLDER_CONTENT, "revenue")} />);
    act(() => { vi.advanceTimersByTime(950); });
    expect(screen.queryByTestId("cursor")).toBeNull();
    act(() => { vi.advanceTimersByTime(300); });
    const cardA = screen.getByTestId("visual-revenue").querySelector('[data-layer="cardA"]')!;
    const team = cardA.querySelector<HTMLElement>('[data-chip="team"]')!;
    expect(team.style.opacity).toBe("1");
    vi.useRealTimers();
  });
});

describe("PricingSection", () => {
  it("defaults to annual and toggles to monthly", () => {
    const pricing = pricingFromSection(FALLBACK_HOME_PRICING.find((s) => s.page === "pricing" && s.sectionKey === "plans"))!;
    render(<PricingSection pricing={pricing} />);
    expect(screen.getByTestId("price-flex").textContent).toBe("$3,990/yr");
    expect(screen.getByTestId("price-flat").textContent).toBe("$9,990/yr");
    expect(screen.getByTestId("price-founding").textContent).toBe("$1,990/yr");
    expect(screen.getByTestId("price-startup").textContent).toBe("$990/yr");
    fireEvent.click(screen.getByRole("radio", { name: "Monthly" }));
    expect(screen.getByTestId("price-flex").textContent).toBe("$399/mo");
    expect(screen.getByTestId("price-flat").textContent).toBe("$999/mo");
    expect(screen.getByTestId("price-founding").textContent).toBe("$199/mo");
    expect(screen.getByTestId("price-startup").textContent).toBe("$99/mo");
  });
});

describe("booking fee", () => {
  it("shows the $1.99 online-booking checkout fee on pricing", () => {
    const pricing = pricingFromSection(FALLBACK_HOME_PRICING.find((s) => s.page === "pricing" && s.sectionKey === "plans"))!;
    render(<PricingSection pricing={pricing} />);
    expect(screen.getByTestId("booking-fee").textContent).toMatch(/\$1\.99 booking fee on online bookings, paid at checkout/);
  });

  it("falls back to the default $1.99 booking fee when the CMS omits it", () => {
    const pricing = pricingFromSection(FALLBACK_HOME_PRICING.find((s) => s.page === "home" && s.sectionKey === "pricing"))!;
    render(<PricingSection pricing={{ ...pricing, bookingFee: undefined }} />);
    expect(screen.getByTestId("booking-fee").textContent).toContain("$1.99");
  });
});

describe("SectionBlock", () => {
  it("never renders review-notes and flags [Copy: …] with a TODO", () => {
    const section = mapSection({
      fieldData: {
        page: "industries/hvac", "section-key": "hero", headline: "[Copy: HVAC headline]",
        subhead: "Platform fee (5%) on agreements", "review-notes": "SECRET EDITOR NOTE",
        items: "Tune-ups — Emailed [Copy: value]"
      }
    })!;
    const { container } = render(<SectionBlock section={section} />);
    expect(container.textContent).not.toContain("SECRET EDITOR NOTE");
    expect(container.textContent).toContain("Service Fee (2%, paid by customer)");
    expect(container.textContent).not.toContain("Platform fee");
    expect(container.querySelectorAll('[data-todo="copy"]').length).toBeGreaterThanOrEqual(2);
    expect(container.textContent).toContain("TODO");
  });

  it("renders no review-notes text for any bundled section", () => {
    for (const section of [...FALLBACK_HOME_PRICING, ...STATIC_PRODUCT_SECTIONS]) {
      const { container, unmount } = render(<SectionBlock section={section} />);
      expect(container.textContent).not.toMatch(/Items = remaining Figma text/);
      expect(container.textContent).not.toMatch(/Platform fee \(5%/);
      expect(container.textContent).not.toMatch(/service fusion|servicetitan|housecall/i);
      unmount();
    }
  });
});
