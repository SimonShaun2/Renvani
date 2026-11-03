import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";

import { env } from "@fsm/config";
import { ErrorCode } from "@fsm/types";

import { setupTestEnv } from "../test-support/env-setup.js";
import { resetBookingHoldTokenJtiStateForTests } from "./booking-hold-token-store.js";
import {
  generateBookingHoldToken,
  inspectBookingHoldToken,
  verifyAndClaimBookingHoldToken,
  verifyBookingHoldToken
} from "./booking-hold-token.js";

setupTestEnv();

describe("booking-hold-token", () => {
  it("round-trips hold token claims with jti", () => {
    const payload = {
      companyId: "550e8400-e29b-41d4-a716-446655440000",
      bookingRequestId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      referenceNumber: "BK-20260512-aB3xY9zQ"
    };

    const token = generateBookingHoldToken(payload);
    const verified = verifyBookingHoldToken(token);

    expect(verified).toMatchObject(payload);
    expect(verified.jti).toMatch(/^[0-9a-f-]{36}$/u);
  });

  it("rejects tokens signed with JWT_SECRET instead of BOOKING_HOLD_TOKEN_SECRET", () => {
    const token = jwt.sign(
      {
        companyId: "550e8400-e29b-41d4-a716-446655440000",
        bookingRequestId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        referenceNumber: "BK-20260512-aB3xY9zQ",
        jti: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        tokenType: "booking_hold"
      },
      env.JWT_SECRET,
      { expiresIn: 3600 }
    );

    expect(() => verifyBookingHoldToken(token)).toThrow();
  });

  it("inspect returns valid claims without consuming jti", () => {
    const payload = {
      companyId: "550e8400-e29b-41d4-a716-446655440000",
      bookingRequestId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      referenceNumber: "BK-20260512-aB3xY9zQ"
    };

    const token = generateBookingHoldToken(payload);
    const inspection = inspectBookingHoldToken(token);

    expect(inspection).toMatchObject({
      status: "valid",
      referenceNumber: payload.referenceNumber,
      bookingRequestId: payload.bookingRequestId,
      companyId: payload.companyId,
      expiresAt: null
    });
  });

  it("inspect returns expired status with decoded claims", () => {
    const payload = {
      companyId: "550e8400-e29b-41d4-a716-446655440000",
      bookingRequestId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      referenceNumber: "BK-20260512-aB3xY9zQ",
      jti: "6ba7b810-9dad-11d1-80b4-00c04fd430c9",
      tokenType: "booking_hold" as const
    };
    const token = jwt.sign(payload, env.BOOKING_HOLD_TOKEN_SECRET, { expiresIn: -60 });

    const inspection = inspectBookingHoldToken(token);

    expect(inspection.status).toBe("expired");
    expect(inspection.referenceNumber).toBe(payload.referenceNumber);
    expect(inspection.bookingRequestId).toBe(payload.bookingRequestId);
    expect(inspection.companyId).toBe(payload.companyId);
    expect(inspection.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/u);
  });

  it("inspect returns invalid for tampered tokens", () => {
    const token = generateBookingHoldToken({
      companyId: "550e8400-e29b-41d4-a716-446655440000",
      bookingRequestId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      referenceNumber: "BK-20260512-aB3xY9zQ"
    });
    const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");

    expect(inspectBookingHoldToken(tampered)).toMatchObject({
      status: "invalid",
      referenceNumber: null,
      bookingRequestId: null,
      companyId: null,
      expiresAt: null
    });
  });

  it("rejects replayed jti on second claim", async () => {
    resetBookingHoldTokenJtiStateForTests();
    const token = generateBookingHoldToken({
      companyId: "550e8400-e29b-41d4-a716-446655440000",
      bookingRequestId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      referenceNumber: "BK-20260512-aB3xY9zQ"
    });

    await verifyAndClaimBookingHoldToken(token);

    await expect(verifyAndClaimBookingHoldToken(token)).rejects.toMatchObject({
      code: ErrorCode.CONFLICT
    });
  });
});
