import { describe, expect, it } from "vitest";
import { hasDedicatedOperatorHeading, OPERATOR_HEADING_ROUTES } from "./operator-screen-headings";

describe("operator landing page headings", () => {
  it("covers all ten approved screen updates and the existing AI Revenue Center", () => {
    expect(OPERATOR_HEADING_ROUTES.size).toBe(11);
    for (const path of OPERATOR_HEADING_ROUTES) expect(hasDedicatedOperatorHeading(path)).toBe(true);
  });
  it("shows the settings section heading instead of a duplicate shared strip for all nested settings", () => {
    expect(hasDedicatedOperatorHeading("/settings")).toBe(true);
    expect(hasDedicatedOperatorHeading("/settings/general")).toBe(true);
    expect(hasDedicatedOperatorHeading("/settings/company")).toBe(true);
    expect(hasDedicatedOperatorHeading("/settings/booking/general")).toBe(true);
    expect(hasDedicatedOperatorHeading("/settings/users")).toBe(true);
  });
  it("never hides headers for detail screens, technician or unknown routes", () => {
    for (const path of ["/jobs/123", "/estimates/new", "/invoices/abc", "/payments/transactions", "/inventory/stock", "/mobile/jobs", "/dashboard", "/"]) {
      expect(hasDedicatedOperatorHeading(path)).toBe(false);
    }
  });
});
