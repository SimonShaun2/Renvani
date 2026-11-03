// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearBookingIdempotencyKey,
  getOrCreateBookingIdempotencyKey
} from "@/src/lib/booking-idempotency";

describe("booking idempotency session storage (FS-38)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal("crypto", {
      randomUUID: () => "11111111-1111-4111-8111-111111111111"
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the same key for a slug within one confirm session", () => {
    const first = getOrCreateBookingIdempotencyKey("acme-hvac");
    const second = getOrCreateBookingIdempotencyKey("acme-hvac");

    expect(first).toBe(second);
    expect(sessionStorage.getItem("fsm:idempotency:acme-hvac")).toBe(first);
  });

  it("isolates keys per booking slug", () => {
    vi.stubGlobal("crypto", {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
        .mockReturnValueOnce("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
    });

    const acme = getOrCreateBookingIdempotencyKey("acme-hvac");
    const beta = getOrCreateBookingIdempotencyKey("beta-hvac");

    expect(acme).not.toBe(beta);
  });

  it("clears the stored key after a successful submit", () => {
    getOrCreateBookingIdempotencyKey("acme-hvac");
    clearBookingIdempotencyKey("acme-hvac");

    expect(sessionStorage.getItem("fsm:idempotency:acme-hvac")).toBeNull();
  });
});
