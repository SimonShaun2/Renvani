import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  deriveImportedInvoiceStatus,
  resolveInvoiceOpenBalanceAmounts,
} from "./import-invoice-balance-commit.logic.js";

describe("import-invoice-balance-commit.logic", () => {
  it("derives amount paid from open balance", () => {
    const amounts = resolveInvoiceOpenBalanceAmounts({
      total: "1000.00",
      balanceDue: "250.00",
    });

    expect(amounts).toEqual({
      total: "1000.00",
      amountPaid: "750.00",
      balanceDue: "250.00",
    });
  });

  it("marks invoice paid when balance is zero", () => {
    const status = deriveImportedInvoiceStatus(new Decimal("0.00"), new Decimal("500.00"));
    expect(status).toBe("paid");
  });

  it("marks invoice partially paid when balance remains", () => {
    const status = deriveImportedInvoiceStatus(new Decimal("100.00"), new Decimal("50.00"));
    expect(status).toBe("partially_paid");
  });
});
