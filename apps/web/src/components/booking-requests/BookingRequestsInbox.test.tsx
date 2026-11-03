// @vitest-environment happy-dom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BookingRequestsInbox } from "./BookingRequestsInbox";

vi.mock("@/src/hooks/dispatch.hooks", () => ({
  useBookingRequests: () => ({ data: { data: [{
    id: "request-1", referenceNumber: "INQ-1", status: "pending", source: "google",
    firstName: "Ana", lastName: "Lopez", phone: "9185550142", zip: "74103",
    serviceCategory: null, serviceType: "AC Repair", urgency: null, downgraded: false,
    preferredDate: null, preferredWindow: "first_available", assignedTechnicianId: null,
    createdAt: "2026-11-02T12:00:00.000Z"
  }] } }),
  useBookingRequest: () => ({ data: { bookingRequest: {
    id: "request-1", referenceNumber: "INQ-1", status: "pending", source: "google",
    firstName: "Ana", lastName: "Lopez", phone: "9185550142", zip: "74103",
    serviceCategory: null, serviceType: "AC Repair", urgency: null,
    smsConsentAppointments: false, smsConsentMarketing: false,
    customerNotes: "Assistant handoff (human_requested)\nContact details: consented for staff review\nPlease call",
    createdAt: "2026-11-02T12:00:00.000Z"
  } } })
}));

afterEach(cleanup);

describe("BookingRequestsInbox", () => {
  it("shows a pending assistant handoff with recorded service, source, ZIP, consent and linked request ID", () => {
    render(<BookingRequestsInbox />);
    expect(screen.getByTestId("booking-requests-list").textContent).toContain("AC Repair");
    const panel = screen.getByTestId("booking-request-panel");
    expect(panel.textContent).toContain("Assistant handoff (human_requested)");
    expect(panel.textContent).toContain("Contact details: consented for staff review");
    expect(panel.textContent).toContain("Service ZIP: 74103");
    expect(panel.textContent).toContain("Recorded source: Google");
    expect(panel.textContent).toContain("Appointment texts: Not consented");
    expect(panel.textContent).toContain("Marketing texts: Not consented");
    expect(panel.textContent).toContain("Request ID: request-1");
  });
});
