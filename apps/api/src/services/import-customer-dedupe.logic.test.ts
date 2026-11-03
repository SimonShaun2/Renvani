import { describe, expect, it } from "vitest";

import {
  buildCustomerLookupMaps,
  findDuplicateCustomer,
  mapCustomerRow
} from "./import-customer-dedupe.logic.js";

describe("import-customer-dedupe.logic", () => {
  it("matches duplicate customers by normalized email", () => {
    const lookupMaps = buildCustomerLookupMaps([
      {
        id: "cust-1",
        firstName: "Ada",
        lastName: "Lovelace",
        displayName: null,
        email: "ada@example.com",
        phone: null
      }
    ]);

    const mappedRow = mapCustomerRow(
      { Email: "ADA@example.com", "First Name": "Ada", "Last Name": "Duplicate" },
      { Email: "email", "First Name": "firstName", "Last Name": "lastName" }
    );

    const match = findDuplicateCustomer(mappedRow, lookupMaps);
    expect(match?.reason).toBe("email");
    expect(match?.customer.id).toBe("cust-1");
  });
});
