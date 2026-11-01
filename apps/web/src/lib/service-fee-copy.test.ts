import { describe, expect, it } from "vitest";

import {
  LEGACY_BOOKING_FEE_LABEL,
  SETTINGS_FEE_COPY,
  payoutFeeNote,
  serviceFeeCheckoutLabel,
  serviceFeeLineLabel,
  serviceFeeNote,
  receiptFeeLabel,
  serviceFeePercentLabel,
  vipJoinFeeNote
} from "./service-fee-copy";

const ALL = [
  serviceFeeLineLabel(2), serviceFeeCheckoutLabel(2), serviceFeeNote(2), payoutFeeNote(2), serviceFeePercentLabel(2),
  ...Object.values(SETTINGS_FEE_COPY)
];

describe("service fee copy", () => {
  it("matches frames 53:36 / 53:38 / 52:227", () => {
    expect(serviceFeeLineLabel(2)).toBe("Service Fee (2%)");
    expect(serviceFeeLineLabel()).toBe("Service Fee (2%)");
    expect(serviceFeeNote(2)).toBe("A 2% Service Fee applies to payments made online through Renvani.");
    expect(serviceFeeCheckoutLabel(2)).toBe("Service Fee (2%) · paid by customer at checkout");
    expect(serviceFeePercentLabel(2)).toBe("2%");
  });
  it("never uses banned wording", () => {
    for (const text of ALL) {
      expect(text).not.toMatch(/platform fee|convenience|surcharge|processing fee|booking fee|1\.99|5%/i);
    }
    expect(LEGACY_BOOKING_FEE_LABEL).not.toMatch(/1\.99/);
  });
  it("says non-refundable on receipt, Flex hint and VIP join note", () => {
    expect(receiptFeeLabel("Service Fee (2%)")).toBe("Service Fee (2%) · non-refundable");
    expect(LEGACY_BOOKING_FEE_LABEL).toMatch(/non-refundable/);
    expect(SETTINGS_FEE_COPY.flexHint).toMatch(/non-refundable/);
    expect(vipJoinFeeNote(2)).toMatch(/non-refundable/);
    expect(vipJoinFeeNote(2)).toContain("Service Fee");
    expect(SETTINGS_FEE_COPY.flatHint).not.toMatch(/non-refundable/);
  });
  it("Flat copy has no fee", () => {
    expect(SETTINGS_FEE_COPY.flatHint).toContain("no Service Fee");
    expect(SETTINGS_FEE_COPY.flatValue).toBe("None");
  });
});
