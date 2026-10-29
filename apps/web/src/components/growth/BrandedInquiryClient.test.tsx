// @vitest-environment happy-dom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BrandedInquiryClient } from "./BrandedInquiryClient";
import { buildBrandedStorefrontViewModel } from "./branded-storefront.utils";
import { resolveSiteTrade } from "./site-trade.registry";

const mocks = vi.hoisted(() => ({
  submit: vi.fn(),
  checkZip: vi.fn(),
  pending: false
}));

vi.mock("@/src/hooks/booking.hooks", () => ({
  useSubmitBookingRequest: () => ({ mutateAsync: mocks.submit, isPending: mocks.pending }),
  useCheckZipCoverage: () => ({ mutateAsync: mocks.checkZip, isPending: false })
}));

vi.mock("@/src/lib/api", () => ({ ApiError: class ApiError extends Error {} }));

const baseSettings = {
  companyName: "Summit Service",
  companySlug: "summit",
  bookingSlug: "summit",
  offeredServices: [] as Array<Record<string, unknown>>,
  availableHoursStart: 8,
  availableHoursEnd: 17,
  availableDays: ["mon"],
  slotDuration: 60,
  maxAdvanceDays: 30,
  googleReviewUrl: null,
  yelpReviewUrl: null,
  facebookReviewUrl: null
};

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Pat" } });
  fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Lee" } });
  fireEvent.change(screen.getByLabelText("Mobile phone"), { target: { value: "5550100" } });
  fireEvent.change(screen.getByLabelText("Service address"), { target: { value: "1 Main St" } });
  fireEvent.change(screen.getByLabelText("City"), { target: { value: "Chicago" } });
  fireEvent.change(screen.getByLabelText("State"), { target: { value: "IL" } });
  fireEvent.change(screen.getByLabelText("ZIP code"), { target: { value: "60601" } });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  mocks.pending = false;
});

describe("BrandedInquiryClient", () => {
  it("stops an empty request before network calls and identifies fields to correct", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<BrandedInquiryClient model={buildBrandedStorefrontViewModel(baseSettings)} acquisitionSource="website" />);

    fireEvent.click(screen.getByRole("button", { name: "Send inquiry" }));

    const firstName = screen.getByRole("textbox", { name: /First name/ });
    expect(screen.getByRole("alert").textContent).toContain("Please correct the highlighted fields.");
    expect(screen.getByText("First name is required.")).toBeTruthy();
    expect(screen.getByText("ZIP code is required.")).toBeTruthy();
    expect(firstName.getAttribute("aria-invalid")).toBe("true");
    expect(firstName.getAttribute("aria-describedby")).toBeTruthy();
    expect(document.activeElement).toBe(firstName);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.checkZip).not.toHaveBeenCalled();
    expect(mocks.submit).not.toHaveBeenCalled();

    fireEvent.change(firstName, { target: { value: "Pat" } });
    expect(screen.queryByText("First name is required.")).toBeNull();
  });

  it("identifies an invalid optional email before submission", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<BrandedInquiryClient model={buildBrandedStorefrontViewModel(baseSettings)} acquisitionSource="website" />);
    fillRequiredFields();
    fireEvent.change(screen.getByRole("textbox", { name: /Email/ }), { target: { value: "invalid-address" } });

    fireEvent.click(screen.getByRole("button", { name: "Send inquiry" }));

    expect(screen.getByText("Enter a valid email address.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps a spoken submit label and busy state while sending", () => {
    mocks.pending = true;
    const { container } = render(<BrandedInquiryClient model={buildBrandedStorefrontViewModel(baseSettings)} acquisitionSource="website" />);

    const button = screen.getByRole("button", { name: "Sending inquiry" });
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(container.textContent).not.toContain("Renvani-powered");
    expect(container.textContent).not.toContain("no migration required");
    expect(container.textContent).not.toContain("FS-17");
    expect(container.textContent).toContain("An inquiry is not a confirmed appointment.");
  });

  it.each([
    ["hvac", "Heating & air conditioning", "Heating & air conditioning inquiry"],
    ["plumbing", "Plumbing", "Plumbing inquiry"],
    ["unknown", "Home services", "Service inquiry"]
  ])("submits %s inquiry without implied SMS consent", async (trade, category, serviceType) => {
    const settings = { ...baseSettings, trade };
    const model = buildBrandedStorefrontViewModel(settings);
    mocks.checkZip.mockResolvedValue({ covered: true });
    mocks.submit.mockResolvedValue({ confirmation: { referenceNumber: "REF-1" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ accepted: true }) }));

    render(<BrandedInquiryClient model={model} acquisitionSource="website" serviceCategory={resolveSiteTrade(settings).label} />);
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Send inquiry" }));

    await waitFor(() => expect(mocks.submit).toHaveBeenCalledOnce());
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({
        serviceCategory: category,
        serviceType,
        smsConsentAppointments: false,
        smsConsentMarketing: false
      })
    }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sends SMS consent only when each checkbox is selected", async () => {
    const settings = { ...baseSettings, trade: "hvac" };
    mocks.checkZip.mockResolvedValue({ covered: true });
    mocks.submit.mockResolvedValue({ confirmation: { referenceNumber: "REF-2" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ accepted: true }) }));

    render(<BrandedInquiryClient model={buildBrandedStorefrontViewModel(settings)} acquisitionSource="website" />);
    fillRequiredFields();
    fireEvent.click(screen.getByLabelText(/Optional: I agree to receive appointment-related texts/));
    fireEvent.click(screen.getByRole("button", { name: "Send inquiry" }));

    await waitFor(() => expect(mocks.submit).toHaveBeenCalledOnce());
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({ smsConsentAppointments: true, smsConsentMarketing: false })
    }));
  });
});
