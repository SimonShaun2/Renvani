import { describe, expect, it } from "vitest";

import { webAssistantRequestSchema, webAssistantResponseSchema } from "./web-assistant.types.js";

const contact = {
  firstName: "Ana", lastName: "Lopez", phone: "9185550142", email: "ana@example.com",
  addressLine1: "12 Oak St", city: "Tulsa", state: "OK", zip: "74103-1234"
};

describe("FS-197 public web assistant contract", () => {
  it("requires an explicit contact consent and normalizes the handoff ZIP", () => {
    const base = { action: "handoff", topic: "human", message: "Please call me", contact };
    expect(webAssistantRequestSchema.safeParse(base).success).toBe(false);
    const parsed = webAssistantRequestSchema.parse({ ...base, contactConsent: true });
    expect(parsed.action).toBe("handoff");
    if (parsed.action === "handoff") expect(parsed.contact.zip).toBe("74103");
  });

  it("rejects client-selected tenant, unknown action and unsafe contact shape", () => {
    expect(webAssistantRequestSchema.safeParse({ action: "answer", topic: "services", companyId: "other" }).success).toBe(false);
    expect(webAssistantRequestSchema.safeParse({ action: "confirm", topic: "services" }).success).toBe(false);
    expect(webAssistantRequestSchema.safeParse({ action: "handoff", topic: "human", message: "Help", contactConsent: true,
      contact: { ...contact, zip: "javascript:1" } }).success).toBe(false);
  });

  it("does not allow a handoff to claim an appointment confirmation", () => {
    expect(webAssistantResponseSchema.safeParse({ kind: "handoff", status: "confirmed", referenceNumber: "BK-1",
      reason: "human_requested", message: "Your request is pending staff review. No appointment has been confirmed." }).success).toBe(false);
  });
});
