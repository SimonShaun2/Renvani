import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EstimateChecksPanel, EstimateFrequencyOptions } from "./EstimateFigmaPanels";
import { buildEstimateSubtitle, estimateApprovalPill, formatDiscountCheck, formatValidUntil } from "./estimate-builder.utils";

afterEach(() => cleanup());

describe("estimate builder utils (Figma 10:604)", () => {
  it("builds the header subtitle from real fields only", () => {
    expect(buildEstimateSubtitle({ estimateNumber: "EST-1043", customerName: "Dana Whitfield", address: "412 Pine St" })).toBe(
      "EST-1043 · Dana Whitfield · 412 Pine St"
    );
    expect(buildEstimateSubtitle({ estimateNumber: "EST-1", customerName: " ", address: null })).toBe("EST-1");
    expect(buildEstimateSubtitle({})).toBeNull();
  });

  it("maps status to the approval pill", () => {
    expect(estimateApprovalPill("draft").label).toBe("Needs approval");
    expect(estimateApprovalPill("approved").tone).toBe("green");
    expect(estimateApprovalPill("declined").tone).toBe("red");
  });

  it("formats valid-until and discount without inventing data", () => {
    expect(formatValidUntil(null)).toBe("—");
    expect(formatValidUntil("2026-10-28T17:00:00.000Z")).toBe("Oct 28");
    expect(formatDiscountCheck("0.00")).toBe("None");
    expect(formatDiscountCheck("21")).toBe("$21.00 off");
  });
});

describe("EstimateChecksPanel", () => {
  it("shows API-backed checks and neutral dashes for missing ones", () => {
    render(<EstimateChecksPanel status="draft" discountAmount="21.00" expiresAt="2026-10-28T17:00:00.000Z" />);
    expect(screen.getByText("Needs approval")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Checks before sending" })).toBeTruthy();
    expect(screen.getByText("$21.00 off")).toBeTruthy();
    expect(screen.getByText("Oct 28")).toBeTruthy();
    expect(screen.getAllByText(/— · Not available yet/)).toHaveLength(4);
    expect(screen.queryByText(/5%/)).toBeNull();
  });

  it("hides frequency options with neutral copy", () => {
    render(<EstimateFrequencyOptions />);
    expect(screen.getByText(/Visit frequency options aren't available yet/)).toBeTruthy();
    expect(screen.queryByText(/\/ visit/)).toBeNull();
  });
});
