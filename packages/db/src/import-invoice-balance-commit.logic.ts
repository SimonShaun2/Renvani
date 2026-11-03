import type { Decimal } from "decimal.js";

import { formatImportMoney, parseImportMoney } from "@fsm/import-normalize";
import type { InvoiceStatus } from "@fsm/types";

export { formatImportMoney, parseImportMoney };

export interface InvoiceOpenBalanceAmounts {
  total: string;
  amountPaid: string;
  balanceDue: string;
}

/**
 * Derives amount paid and open balance from vendor export fields.
 * Prefers explicit balanceDue; otherwise uses amountPaid when provided.
 */
export function resolveInvoiceOpenBalanceAmounts(input: {
  total: string;
  balanceDue?: string;
  amountPaid?: string;
}): InvoiceOpenBalanceAmounts | null {
  const total = parseImportMoney(input.total);
  if (!total) {
    return null;
  }

  if (input.balanceDue !== undefined && input.balanceDue.trim().length > 0) {
    const balanceDue = parseImportMoney(input.balanceDue);
    if (!balanceDue || balanceDue.gt(total)) {
      return null;
    }

    const amountPaid = total.minus(balanceDue);
    return {
      total: formatImportMoney(total),
      amountPaid: formatImportMoney(amountPaid),
      balanceDue: formatImportMoney(balanceDue),
    };
  }

  if (input.amountPaid !== undefined && input.amountPaid.trim().length > 0) {
    const amountPaid = parseImportMoney(input.amountPaid);
    if (!amountPaid || amountPaid.gt(total)) {
      return null;
    }

    const balanceDue = total.minus(amountPaid);
    return {
      total: formatImportMoney(total),
      amountPaid: formatImportMoney(amountPaid),
      balanceDue: formatImportMoney(balanceDue),
    };
  }

  return {
    total: formatImportMoney(total),
    amountPaid: "0.00",
    balanceDue: formatImportMoney(total),
  };
}

export function deriveImportedInvoiceStatus(
  balanceDue: Decimal,
  amountPaid: Decimal,
): InvoiceStatus {
  if (balanceDue.lte(0)) {
    return "paid";
  }

  if (amountPaid.gt(0)) {
    return "partially_paid";
  }

  return "sent";
}

export function normalizeImportedPaymentMethod(
  method: string | undefined,
): "card" | "ach" | "cash" | "check" | "financing" | "other" {
  if (!method) {
    return "other";
  }

  const normalized = method.trim().toLowerCase();
  if (normalized.includes("card") || normalized.includes("credit")) {
    return "card";
  }
  if (normalized.includes("ach") || normalized.includes("bank")) {
    return "ach";
  }
  if (normalized.includes("cash")) {
    return "cash";
  }
  if (normalized.includes("check") || normalized.includes("cheque")) {
    return "check";
  }
  if (normalized.includes("finance") || normalized.includes("financing")) {
    return "financing";
  }

  return "other";
}
