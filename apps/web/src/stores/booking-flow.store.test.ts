// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";

import { useBookingFlowStore } from "@/src/stores/booking-flow.store";

describe("booking flow store consent defaults (FS-38)", () => {
  beforeEach(() => {
    localStorage.clear();
    useBookingFlowStore.getState().reset();
  });

  it("defaults appointment and marketing SMS consent to unchecked", () => {
    const state = useBookingFlowStore.getState();

    expect(state.smsConsent).toBe(false);
    expect(state.smsConsentMarketing).toBe(false);
  });
});
