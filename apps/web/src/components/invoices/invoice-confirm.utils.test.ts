import { describe, expect, it } from "vitest";

import { invoiceConfirmDescription } from "./invoice-confirm.utils";

describe("invoiceConfirmDescription", () => {
  it("names the customer and amount for send", () => {
    expect(invoiceConfirmDescription("send", { firstName: "Dana", lastName: "Whitfield" }, "1240.5")).toBe(
      "Dana Whitfield gets this invoice and a secure payment link for $1,240.50."
    );
  });

  it("names the customer and amount for reminders", () => {
    expect(invoiceConfirmDescription("remind", { firstName: "Dana", lastName: "Whitfield" }, "186.00")).toBe(
      "Dana Whitfield gets a reminder to pay $186.00 with their payment link."
    );
  });

  it("falls back when the name is blank", () => {
    expect(invoiceConfirmDescription("send", { firstName: "", lastName: null }, 0)).toContain("The customer");
  });
});
