// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CustomerEstimateView, tierPositionLabel } from "./CustomerEstimateView";

const tier = (n: string, label: string, total: string, recommended = false) => ({
  estimateNumber: n,
  title: `${label} plan`,
  tierLabel: label,
  recommended,
  subtotal: total,
  taxRate: null,
  taxAmount: null,
  discountAmount: null,
  total,
  items: [{ name: `${label} work`, description: null, quantity: "1", unitPrice: total, total }]
});
const estimate = {
  estimateNumber: "EST-1",
  title: "Furnace not heating",
  status: "sent",
  messageToCustomer: null,
  subtotal: "389.00",
  taxRate: null,
  taxAmount: null,
  discountAmount: null,
  total: "389.00",
  financingOffered: false,
  tierLabel: null,
  expiresAt: null,
  tiers: [tier("E1", "Good", "389.00"), tier("E2", "Better", "1240.00", true), tier("E3", "Best", "6850.00")],
  items: []
} as never;

afterEach(() => cleanup());

describe("customer option picker (Figma 363:121)", () => {
  it("labels options by position", () => {
    expect(tierPositionLabel({ tierLabel: "Better" }, 2)).toBe("Option 2 · Better");
    expect(tierPositionLabel({ tierLabel: null }, 1)).toBe("Option 1");
  });

  it("shows Choose one option, preselects the recommended option, no fees or financing", () => {
    render(<CustomerEstimateView estimate={estimate} onApprove={vi.fn()} onDecline={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Choose one option" })).toBeTruthy();
    expect(screen.getByTestId("tier-intro").textContent).toMatch(/Furnace not heating\. Each option is its own estimate\./);
    const radios = screen.getAllByRole("radio");
    expect(radios[1]!.getAttribute("aria-checked")).toBe("true");
    expect(radios[1]!.textContent).toMatch(/Selected option/);
    expect(screen.getByTestId("tier-approve-panel").textContent).toMatch(/Selected option\s*Option 2 · Better/);
    expect(screen.getByText("Powered by Renvani")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/1\.99|booking fee|financ/i);
  });

  it("approves the picked option with the typed name", () => {
    const onApprove = vi.fn().mockResolvedValue(undefined);
    render(<CustomerEstimateView estimate={estimate} onApprove={onApprove} />);
    fireEvent.click(screen.getAllByRole("radio")[2]!);
    fireEvent.change(screen.getByPlaceholderText("Enter your name"), { target: { value: "Dana" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve Estimate" }));
    expect(onApprove).toHaveBeenCalledWith({ approvedByName: "Dana", selectedEstimateNumber: "E3" });
  });
});
