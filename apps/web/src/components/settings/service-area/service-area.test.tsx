// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  enabled: true,
  area: vi.fn(),
  emergency: vi.fn(),
  list: [] as Array<Record<string, unknown>>,
  detail: undefined as Record<string, unknown> | undefined
}));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: unknown; href: string }) => <a href={href}>{children as string}</a> }));
vi.mock("@/src/hooks/home-services.hooks", () => ({
  useServiceArea: () => ({ data: { serviceArea: { zips: ["78704", "78745"], radiusMiles: 25 } } }),
  useEmergencyService: () => ({ data: { emergencyService: { enabled: m.enabled, hoursText: null } } }),
  useUpdateServiceArea: () => ({ mutateAsync: m.area }),
  useUpdateEmergencyService: () => ({ mutateAsync: m.emergency })
}));
vi.mock("@/src/hooks/dispatch.hooks", () => ({
  useBookingRequests: () => ({ data: { data: m.list } }),
  useBookingRequest: () => ({ data: m.detail ? { bookingRequest: m.detail } : undefined })
}));

import { BookingRequestsInbox } from "@/src/components/booking-requests/BookingRequestsInbox";
import { sortInbox } from "@/src/components/booking-requests/booking-requests.utils";

import { ServiceAreaEmergencySettings } from "./ServiceAreaEmergencySettings";
import { buildEmergencyPayload, buildServiceAreaPayload, normalizeZipInput } from "./service-area.utils";

const save = () => screen.getByTestId("service-area-save") as HTMLButtonElement;
const zipInput = () => screen.getByLabelText("Add ZIP code") as HTMLInputElement;

beforeEach(() => {
  m.enabled = true;
  m.area.mockReset().mockResolvedValue({});
  m.emergency.mockReset().mockResolvedValue({});
  m.list = [];
  m.detail = undefined;
});
afterEach(() => cleanup());

describe("ServiceAreaEmergencySettings (309:3613)", () => {
  it("emergency on (309:3614): On label + help, ZIP chips, radius, Save disabled until changed", () => {
    render(<ServiceAreaEmergencySettings />);
    expect(screen.getByTestId("service-area-settings").dataset.emergency).toBe("on");
    expect(screen.getByText("Emergency requests are flagged and shown first to your team.")).toBeTruthy();
    expect(screen.getByText("78745")).toBeTruthy();
    expect(screen.getByText("Travel radius from 78704")).toBeTruthy();
    expect(screen.getByTestId("radius").textContent).toBe("25 miles");
    expect(save().disabled).toBe(true);
  });

  it("emergency off (309:3671): toggling off shows the off help and saves {enabled:false}", async () => {
    render(<ServiceAreaEmergencySettings />);
    fireEvent.click(screen.getByRole("switch"));
    expect(screen.getByText("Off: customers will not see the emergency option when booking.")).toBeTruthy();
    await act(async () => fireEvent.click(save()));
    expect(m.emergency).toHaveBeenCalledWith({ enabled: false });
    expect(m.area).not.toHaveBeenCalled();
  });

  it("invalid ZIP (309:3729): inline error, not added, Save blocked", () => {
    render(<ServiceAreaEmergencySettings />);
    fireEvent.change(zipInput(), { target: { value: "7870A" } });
    fireEvent.click(screen.getByRole("button", { name: "Add ZIP" }));
    expect(screen.getByText("Enter a 5-digit ZIP code.")).toBeTruthy();
    expect(zipInput().getAttribute("aria-invalid")).toBe("true");
    expect(screen.queryByText("7870A")).toBeNull();
    expect(save().disabled).toBe(true);
  });

  it("adds/removes ZIPs + radius and sends the #320 payload; failed save shows banner with Retry", async () => {
    m.area.mockRejectedValueOnce(new Error("400"));
    render(<ServiceAreaEmergencySettings />);
    fireEvent.change(zipInput(), { target: { value: "78731-1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Add ZIP" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove 78745" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase radius" }));
    await act(async () => fireEvent.click(save()));
    expect(m.area).toHaveBeenCalledWith({ zips: ["78704", "78731"], radiusMiles: 30 });
    expect(screen.getByRole("alert").textContent).toContain("We couldn't add that ZIP. Check it and try again.");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Retry" })));
    expect(m.area).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("utils", () => {
    expect(normalizeZipInput(" 787041234 ")).toBe("78704");
    expect(normalizeZipInput("7870")).toBeNull();
    expect(buildServiceAreaPayload(["78704"], null)).toEqual({ zips: ["78704"], radiusMiles: null });
    expect(buildEmergencyPayload(true, "24/7")).toEqual({ enabled: true, hoursText: "24/7" });
  });
});

describe("BookingRequestsInbox (309:3791 / 309:3792)", () => {
  const item = (id: string, urgency: string | undefined, createdAt: string, status = "pending") => ({
    id, referenceNumber: `REQ-${id}`, status, source: "direct", firstName: id, lastName: "X", phone: "", zip: "78704",
    serviceCategory: null, serviceType: `svc ${id}`, preferredDate: null, preferredWindow: null, assignedTechnicianId: null, createdAt,
    ...(urgency ? { urgency } : {})
  });

  it("sorts emergency first, shows EMERGENCY badge and the detail panel", () => {
    m.list = [item("Dana", undefined, "2026-10-30T14:00:00Z"), item("Jordan", "emergency", "2026-10-30T11:00:00Z")];
    m.detail = { ...m.list[1], urgency: "emergency", customerNotes: "Water is shut off at the main." };
    render(<BookingRequestsInbox />);
    const rows = screen.getByTestId("booking-requests-list").querySelectorAll("button");
    expect(rows[0]?.textContent).toContain("Jordan");
    expect(rows[0]?.dataset.emergency).toBe("true");
    expect(rows[1]?.textContent).toContain("New");
    const panel = screen.getByTestId("booking-request-panel");
    expect(panel.textContent).toContain("EMERGENCY");
    expect(panel.textContent).toContain("Water is shut off at the main.");
    expect(panel.textContent).toContain("Assign technician");
  });

  it("no badge when urgency is absent from the list item (missing API field)", () => {
    expect(sortInbox([item("a", undefined, "2026-10-29T00:00:00Z"), item("b", undefined, "2026-10-30T00:00:00Z")] as never).map((i: { id: string }) => i.id)).toEqual(["b", "a"]);
    m.list = [item("Chris", undefined, "2026-10-29T00:00:00Z")];
    render(<BookingRequestsInbox />);
    expect(screen.getByTestId("booking-requests-list").textContent).not.toContain("EMERGENCY");
  });
});
