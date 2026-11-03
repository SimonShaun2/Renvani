// @vitest-environment happy-dom

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BrandedInquiryClient } from "./BrandedInquiryClient";
import { buildBrandedStorefrontViewModel } from "./branded-storefront.utils";
import { resolveSiteTradeFromSettings } from "./site-trade.from-settings";
import { ApiError } from "@/src/lib/api";

const mocks = vi.hoisted(() => ({
  submit: vi.fn(),
  checkZip: vi.fn(),
  assistantPost: vi.fn(),
  pending: false
}));

vi.mock("@/src/lib/public-api", () => ({ publicApi: { post: mocks.assistantPost } }));

vi.mock("@/src/hooks/booking.hooks", () => ({
  useSubmitBookingRequest: () => ({ mutateAsync: mocks.submit, isPending: mocks.pending }),
  useCheckZipCoverage: () => ({ mutateAsync: mocks.checkZip, isPending: false })
}));

vi.mock("@/src/lib/api", () => ({
  ApiError: class ApiError extends Error {
    constructor(_status: number, payload: { message: string }) { super(payload.message); }
  }
}));

const baseSettings = {
  companyName: "Summit Service",
  companySlug: "summit",
  bookingSlug: "summit",
  intakeMode: "inquiry_only" as const,
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
  const freeformService = screen.queryByRole("textbox", { name: "Service interest" });
  if (freeformService) fireEvent.change(freeformService, { target: { value: "Drain inspection" } });
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
  it("keeps the assistant hidden until its default-off flag is enabled", () => {
    render(<BrandedInquiryClient model={buildBrandedStorefrontViewModel(baseSettings)} acquisitionSource="website" />);
    expect(screen.queryByRole("region", { name: "Ask about this business" })).toBeNull();
  });

  it("speaks the server-owned verified answer without implying a booking", async () => {
    mocks.assistantPost.mockResolvedValue({ kind: "answer", verified: true, answer: "Summit Service lists AC repair.", source: "public_booking_settings" });
    render(<BrandedInquiryClient model={buildBrandedStorefrontViewModel(baseSettings)} acquisitionSource="website" assistantEnabled />);
    fireEvent.click(screen.getByRole("button", { name: "Check published details" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Summit Service lists AC repair."));
    expect(mocks.assistantPost).toHaveBeenCalledWith("/api/v1/public/site/summit/assistant", { action: "answer", topic: "services" });
    expect(screen.getByText(/An inquiry is not a confirmed appointment/)).toBeTruthy();
  });

  it("ignores an obsolete answer after the question or form ZIP changes", async () => {
    let resolveAnswer: (value: unknown) => void = () => undefined;
    mocks.assistantPost.mockImplementationOnce(() => new Promise((resolve) => { resolveAnswer = resolve; }));
    render(<BrandedInquiryClient model={buildBrandedStorefrontViewModel(baseSettings)} acquisitionSource="website" assistantEnabled />);
    fireEvent.change(screen.getByRole("combobox", { name: "Question topic" }), { target: { value: "service_area" } });
    fireEvent.change(screen.getByRole("textbox", { name: "ZIP to check" }), { target: { value: "60601" } });
    fireEvent.click(screen.getByRole("button", { name: "Check published details" }));
    fireEvent.change(screen.getByRole("textbox", { name: "ZIP code" }), { target: { value: "60602" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Question topic" }), { target: { value: "pricing" } });
    await act(async () => { resolveAnswer({ kind: "handoff_required", reason: "unknown_serviceability", message: "Staff must check this ZIP." }); });
    expect(screen.getByRole("textbox", { name: "ZIP code" })).toHaveProperty("value", "60602");
    expect(screen.queryByText(/Staff must check this ZIP/)).toBeNull();
    expect(screen.getByRole("button", { name: "Check published details" }).hasAttribute("disabled")).toBe(false);
  });

  it("preserves an unsupported requested service and approved acquisition source in staff handoff", async () => {
    mocks.assistantPost
      .mockResolvedValueOnce({ kind: "handoff_required", reason: "unsupported_service", message: "Staff must review this request." })
      .mockResolvedValueOnce({ kind: "handoff", status: "pending", reason: "unsupported_service", referenceNumber: "ASSIST-2", message: "Your request is pending staff review. No appointment has been confirmed." });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ accepted: true }) }));
    const model = buildBrandedStorefrontViewModel({ ...baseSettings, trade: "hvac", intakeMode: "bookable", offeredServices: [{ label: "AC Repair" }] });
    render(<BrandedInquiryClient model={model} acquisitionSource="google" assistantEnabled />);
    fireEvent.change(screen.getByRole("textbox", { name: "Service (optional)" }), { target: { value: "Roof repair" } });
    fireEvent.click(screen.getByRole("button", { name: "Check published details" }));
    await waitFor(() => expect(screen.getByText(/Requested service for staff review:/).textContent).toContain("Roof repair"));
    expect(screen.queryByRole("combobox", { name: "Service interest" })).toBeNull();
    fillRequiredFields();
    fireEvent.click(screen.getByLabelText(/I agree to send these contact details/));
    fireEvent.click(screen.getByRole("button", { name: "Request staff review" }));
    await waitFor(() => expect(mocks.assistantPost).toHaveBeenCalledTimes(2));
    expect(mocks.assistantPost.mock.calls[1]?.[1]).toMatchObject({ action: "handoff", service: "Roof repair", source: "google" });
    expect(await screen.findByText("ASSIST-2")).toBeTruthy();
  });

  it("keeps an unknown service-area request in the consented staff handoff path", async () => {
    mocks.assistantPost
      .mockResolvedValueOnce({ kind: "handoff_required", reason: "unknown_serviceability", message: "Staff must verify this ZIP." })
      .mockResolvedValueOnce({ kind: "handoff", status: "pending", reason: "unknown_serviceability", referenceNumber: "ASSIST-3", message: "Your request is pending staff review. No appointment has been confirmed." });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ accepted: true }) }));
    render(<BrandedInquiryClient model={buildBrandedStorefrontViewModel(baseSettings)} acquisitionSource="website" assistantEnabled />);
    fillRequiredFields();
    fireEvent.change(screen.getByRole("combobox", { name: "Question topic" }), { target: { value: "service_area" } });
    fireEvent.change(screen.getByRole("textbox", { name: "ZIP to check" }), { target: { value: "10001" } });
    fireEvent.click(screen.getByRole("button", { name: "Check published details" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "ZIP code" })).toHaveProperty("value", "10001"));
    expect(screen.getByLabelText(/I agree to send these contact details/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/I agree to send these contact details/));
    fireEvent.click(screen.getByRole("button", { name: "Request staff review" }));
    expect(await screen.findByText("ASSIST-3")).toBeTruthy();
    expect(mocks.assistantPost.mock.calls[1]?.[1]).toMatchObject({ action: "handoff", topic: "service_area", contact: { zip: "10001" } });
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("requires fresh contact consent after an assistant question changes", async () => {
    mocks.assistantPost.mockResolvedValue({ kind: "handoff_required", reason: "pricing_review", message: "Staff must review pricing." });
    render(<BrandedInquiryClient model={buildBrandedStorefrontViewModel(baseSettings)} acquisitionSource="website" assistantEnabled />);
    fireEvent.change(screen.getByRole("combobox", { name: "Question topic" }), { target: { value: "pricing" } });
    fireEvent.click(screen.getByRole("button", { name: "Check published details" }));
    await waitFor(() => expect(screen.getByLabelText(/I agree to send these contact details/)).toBeTruthy());
    fireEvent.click(screen.getByLabelText(/I agree to send these contact details/));
    fireEvent.change(screen.getByRole("combobox", { name: "Question topic" }), { target: { value: "availability" } });
    fireEvent.click(screen.getByRole("button", { name: "Check published details" }));
    await waitFor(() => expect(screen.getByLabelText(/I agree to send these contact details/)).toHaveProperty("checked", false));
  });

  it("uses the existing consented inquiry form for a pending server handoff, with retry key", async () => {
    mocks.assistantPost
      .mockResolvedValueOnce({ kind: "handoff_required", reason: "pricing_review", message: "Staff must review pricing. No price is confirmed." })
      .mockRejectedValueOnce(new ApiError(503, { error: "NOT_IMPLEMENTED", message: "Try again" }))
      .mockResolvedValueOnce({ kind: "handoff", status: "pending", reason: "pricing_review", referenceNumber: "ASSIST-1", message: "Your request is pending staff review. No appointment has been confirmed." });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ accepted: true }) }));
    render(<BrandedInquiryClient model={buildBrandedStorefrontViewModel(baseSettings)} acquisitionSource="website" assistantEnabled />);
    fireEvent.change(screen.getByRole("combobox", { name: "Question topic" }), { target: { value: "pricing" } });
    fireEvent.click(screen.getByRole("button", { name: "Check published details" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("No price is confirmed"));
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Request staff review" }));
    expect(screen.getByRole("alert").textContent).toContain("Agree to send your contact details");
    expect(mocks.assistantPost).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByLabelText(/I agree to send these contact details/));
    fireEvent.click(screen.getByRole("button", { name: "Request staff review" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Try again"));
    const firstKey = mocks.assistantPost.mock.calls[1]?.[2]?.headers?.["Idempotency-Key"];
    fireEvent.click(screen.getByRole("button", { name: "Request staff review" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("No appointment has been confirmed"));
    expect(screen.getByText("ASSIST-1")).toBeTruthy();
    expect(mocks.assistantPost.mock.calls[2]?.[2]?.headers?.["Idempotency-Key"]).toBe(firstKey);
    expect(mocks.assistantPost.mock.calls[2]?.[1]).toMatchObject({ action: "handoff", topic: "pricing", contactConsent: true, smsConsentAppointments: false, smsConsentMarketing: false });
    expect(mocks.submit).not.toHaveBeenCalled();
  });
  it("stops an empty request before network calls and identifies fields to correct", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<BrandedInquiryClient model={buildBrandedStorefrontViewModel(baseSettings)} acquisitionSource="website" />);

    fireEvent.click(screen.getByRole("button", { name: "Send inquiry" }));

    const firstName = screen.getByRole("textbox", { name: /First name/ });
    expect(screen.getByRole("alert").textContent).toContain("Please correct the highlighted fields.");
    expect(screen.getByText("First name is required.")).toBeTruthy();
    expect(screen.getByText("Service interest is required.")).toBeTruthy();
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

  it("reports a server-rejected out-of-area inquiry without claiming receipt", async () => {
    mocks.submit.mockRejectedValue(new ApiError(409, { error: "CONFLICT", message: "We don't currently serve this ZIP code" }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ accepted: true }) }));
    render(<BrandedInquiryClient model={buildBrandedStorefrontViewModel(baseSettings)} acquisitionSource="website" />);
    fillRequiredFields();

    fireEvent.click(screen.getByRole("button", { name: "Send inquiry" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("We don't currently serve this ZIP code"));
    expect(mocks.checkZip).not.toHaveBeenCalled();
    expect(mocks.submit).toHaveBeenCalledOnce();
    expect(screen.queryByText("Inquiry received")).toBeNull();
  });

  it("submits an unknown-coverage inquiry for a new shop without claiming a booking", async () => {
    mocks.submit.mockResolvedValue({
      kind: "inquiry_only",
      bookingRequest: { id: "request-1", referenceNumber: "REF-UNKNOWN", status: "pending" },
      serviceability: "unknown"
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ accepted: true }) }));
    render(<BrandedInquiryClient model={buildBrandedStorefrontViewModel(baseSettings)} acquisitionSource="website" />);
    fillRequiredFields();

    fireEvent.click(screen.getByRole("button", { name: "Send inquiry" }));

    await waitFor(() => expect(screen.getByText(/We received your inquiry/)).toBeTruthy());
    expect(screen.getByText(/Service availability has not been confirmed/)).toBeTruthy();
    expect(screen.getByText(/No appointment has been booked/)).toBeTruthy();
    expect(screen.getByText("REF-UNKNOWN")).toBeTruthy();
    expect(mocks.checkZip).not.toHaveBeenCalled();
    expect(mocks.submit).toHaveBeenCalledOnce();
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({ serviceType: "Drain inspection", smsConsentAppointments: false, smsConsentMarketing: false })
    }));
    expect(screen.queryByRole("link", { name: "Review booking options" })).toBeNull();
  });

  it("keeps configured-service unknown coverage behind the existing positive ZIP gate", async () => {
    mocks.checkZip.mockResolvedValue({ covered: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ accepted: true }) }));
    const model = buildBrandedStorefrontViewModel({ ...baseSettings, trade: "hvac", intakeMode: "bookable", offeredServices: [{ label: "AC repair" }] });
    render(<BrandedInquiryClient model={model} acquisitionSource="website" />);
    fillRequiredFields();

    fireEvent.click(screen.getByRole("button", { name: "Send inquiry" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Your inquiry was not sent."));
    expect(mocks.checkZip).toHaveBeenCalledOnce();
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it.each(["hvac", "plumbing"] as const)("submits a zero-service %s inquiry without a positive ZIP gate", async (trade) => {
    mocks.submit.mockResolvedValue({
      kind: "inquiry_only",
      bookingRequest: { id: "request-2", referenceNumber: "REF-NEW", status: "pending" },
      serviceability: "unknown"
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ accepted: true }) }));
    const model = buildBrandedStorefrontViewModel({
      ...baseSettings,
      trade,
      offeredServices: [{ label: "Suggested repair", source: "trade_default" }]
    });
    render(<BrandedInquiryClient model={model} acquisitionSource="website" />);
    fillRequiredFields();

    fireEvent.click(screen.getByRole("button", { name: "Send inquiry" }));

    await waitFor(() => expect(screen.getByText("REF-NEW")).toBeTruthy());
    expect(mocks.checkZip).not.toHaveBeenCalled();
    expect(mocks.submit).toHaveBeenCalledOnce();
    expect(screen.queryByRole("link", { name: "Review booking options" })).toBeNull();
  });

  it("keeps a spoken submit label and busy state while sending", () => {
    mocks.pending = true;
    const { container } = render(<BrandedInquiryClient model={buildBrandedStorefrontViewModel(baseSettings)} acquisitionSource="website" />);

    const button = screen.getByRole("button", { name: "Sending inquiry" });
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText("Sending inquiry").classList.contains("sr-only")).toBe(false);
    expect(container.textContent).not.toContain("Renvani-powered");
    expect(container.textContent).not.toContain("no migration required");
    expect(container.textContent).not.toContain("FS-17");
    expect(container.textContent).toContain("An inquiry is not a confirmed appointment.");
  });

  it.each([
    ["hvac", "Heating & air conditioning", "AC repair"],
    ["plumbing", "Plumbing", "Drain cleaning"],
    [undefined, "Drain inspection", "Drain inspection"]
  ] as const)("submits %s inquiry without implied SMS consent", async (trade, category, serviceType) => {
    const settings = { ...baseSettings, ...(trade ? { trade, intakeMode: "bookable" as const, offeredServices: [{ label: serviceType }] } : {}) };
    const model = buildBrandedStorefrontViewModel(settings);
    mocks.checkZip.mockResolvedValue({ covered: true });
    mocks.submit.mockResolvedValue({ confirmation: { referenceNumber: "REF-1" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ accepted: true }) }));

    render(<BrandedInquiryClient model={model} acquisitionSource="website" serviceCategory={resolveSiteTradeFromSettings(settings).label} />);
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

  it.each([
    [true, false],
    [false, true],
    [true, true]
  ])("sends independent SMS consent: appointments=%s marketing=%s", async (appointments, marketing) => {
    const settings = { ...baseSettings, trade: "hvac" as const };
    mocks.checkZip.mockResolvedValue({ covered: true });
    mocks.submit.mockResolvedValue({ confirmation: { referenceNumber: "REF-2" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ accepted: true }) }));

    render(<BrandedInquiryClient model={buildBrandedStorefrontViewModel(settings)} acquisitionSource="website" />);
    fillRequiredFields();
    if (appointments) fireEvent.click(screen.getByLabelText(/Optional: I agree to receive appointment-related texts/));
    if (marketing) fireEvent.click(screen.getByLabelText(/Optional: I agree to receive occasional offers/));
    fireEvent.click(screen.getByRole("button", { name: "Send inquiry" }));

    await waitFor(() => expect(mocks.submit).toHaveBeenCalledOnce());
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({ smsConsentAppointments: appointments, smsConsentMarketing: marketing })
    }));
  });
});
