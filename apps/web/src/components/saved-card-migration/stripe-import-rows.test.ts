import { describe, expect, it } from "vitest";

import { parseStripeImportCsv, splitCsvLine, STRIPE_IMPORT_MAX_ROWS } from "./stripe-import-rows";

const H = "stripeCustomerId,stripePaymentMethodId,renvaniCustomerId,email";

describe("parseStripeImportCsv", () => {
  it("parses valid rows, any column order, quoted cells, optional columns omitted", () => {
    const r = parseStripeImportCsv('email,stripePaymentMethodId,stripeCustomerId\n"a@example.com",pm_1,cus_1\n,card_2,cus_2\n');
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      { stripeCustomerId: "cus_1", stripePaymentMethodId: "pm_1", email: "a@example.com" },
      { stripeCustomerId: "cus_2", stripePaymentMethodId: "card_2" }
    ]);
  });

  it("reports per-row errors with line numbers and duplicates", () => {
    const r = parseStripeImportCsv(`${H}\ncus_1,pm_1,,\nx,pm_2,,\ncus_3,pm_3,not-a-uuid,\ncus_4,pm_1,,`);
    expect(r.rows).toHaveLength(1);
    expect(r.errors).toEqual([
      { line: 3, message: "Invalid stripeCustomerId." },
      { line: 4, message: "Invalid renvaniCustomerId." },
      { line: 5, message: "Duplicate stripePaymentMethodId." }
    ]);
  });

  it("requires the id columns in the header", () => {
    expect(parseStripeImportCsv("email\na@example.com").errors[0]?.message).toMatch(/Header must include/);
  });

  it("rejects files containing Stripe secret keys", () => {
    const r = parseStripeImportCsv(`${H}\ncus_1,pm_1,,\n# sk_test_abc123`);
    expect(r.rows).toEqual([]);
    expect(r.errors[0]?.message).toMatch(/secret keys/);
  });

  it("caps rows at the API max", () => {
    const lines = Array.from({ length: STRIPE_IMPORT_MAX_ROWS + 1 }, (_, i) => `cus_${i},pm_${i},,`);
    expect(parseStripeImportCsv([H, ...lines].join("\n")).errors.at(-1)?.message).toMatch(/Up to 200 rows/);
  });

  it("splits RFC 4180-style quoted cells (commas, escaped quotes, empty quoted)", () => {
    expect(splitCsvLine('a,"b,c",d')).toEqual(["a", "b,c", "d"]);
    expect(splitCsvLine('"say ""hi""",x')).toEqual(['say "hi"', "x"]);
    expect(splitCsvLine('"",x,')).toEqual(["", "x", ""]);
    expect(splitCsvLine(' "a, b" , c')).toEqual(["a, b", "c"]);
  });

  it("parses rows whose quoted cells contain commas", () => {
    const r = parseStripeImportCsv('"stripeCustomerId","stripePaymentMethodId","note, extra","email"\n"cus_1","pm_1","x, y","a@example.com"');
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([{ stripeCustomerId: "cus_1", stripePaymentMethodId: "pm_1", email: "a@example.com" }]);
  });
});
