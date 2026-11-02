import { describe, expect, it } from "vitest";

import {
  CALL_RECORDING_CONSENT_MODE_REGISTRY,
  callTrackingNumberCreateSchema,
  callTrackingSettingsUpdateSchema,
  inboundCallEventSchema
} from "./index.js";

describe("FS-200 call tracking types", () => {
  it("uses registries for consent modes", () => {
    expect(Object.keys(CALL_RECORDING_CONSENT_MODE_REGISTRY)).toEqual(["all_party", "one_party"]);
    expect(callTrackingSettingsUpdateSchema.safeParse({ expectedVersion: 0, consentMode: "one_party" }).success).toBe(true);
    expect(callTrackingSettingsUpdateSchema.safeParse({ expectedVersion: 0, consentMode: "none" }).success).toBe(false);
  });

  it("normalizes the notice state and rejects free text", () => {
    const parsed = callTrackingSettingsUpdateSchema.parse({ expectedVersion: 1, recordingNoticeState: "ca" });
    expect(parsed.recordingNoticeState).toBe("CA");
    expect(callTrackingSettingsUpdateSchema.safeParse({ expectedVersion: 1, recordingNoticeState: "Calif" }).success).toBe(false);
  });

  it("requires E.164 numbers and a token-only marketing source", () => {
    const base = { trackingNumber: "+15125550111", label: "Van wrap", marketingSource: "van wrap", forwardingNumber: "+15125550100" };
    expect(callTrackingNumberCreateSchema.safeParse(base).success).toBe(true);
    expect(callTrackingNumberCreateSchema.safeParse({ ...base, trackingNumber: "5125550111" }).success).toBe(false);
    expect(callTrackingNumberCreateSchema.safeParse({ ...base, marketingSource: "a@b.test" }).success).toBe(false);
  });

  it("validates the normalized inbound call event strictly", () => {
    const event = {
      providerCallId: "CA1",
      trackingNumber: "+15125550111",
      callerNumber: "+15125559876",
      startedAt: "2026-10-30T15:00:00Z",
      occurredAt: "2026-10-30T15:03:04Z",
      durationSeconds: 10,
      outcome: "missed"
    };
    expect(inboundCallEventSchema.safeParse(event).success).toBe(true);
    expect(inboundCallEventSchema.safeParse({ ...event, audio: "base64" }).success).toBe(false);
    expect(inboundCallEventSchema.safeParse({ ...event, durationSeconds: -1 }).success).toBe(false);
  });
});

describe("FS-200 security follow-up helpers", () => {
  it("only `verified` numbers can receive calls; unknown statuses fail closed", async () => {
    const { callTrackingNumberCanReceiveCalls, CALL_TRACKING_NUMBER_VERIFICATION_STATUS_REGISTRY } = await import("./index.js");
    expect(Object.keys(CALL_TRACKING_NUMBER_VERIFICATION_STATUS_REGISTRY).sort()).toEqual(["failed", "pending", "unverified", "verified"]);
    expect(callTrackingNumberCanReceiveCalls("verified")).toBe(true);
    for (const s of ["unverified", "pending", "failed", "VERIFIED", "__proto__", "toString"]) expect(callTrackingNumberCanReceiveCalls(s)).toBe(false);
  });

  it("gates recording refs on disclosure plus consent mode", async () => {
    const { callRecordingRefAllowed: allowed } = await import("./index.js");
    expect(allowed({ consentMode: "all_party", recordingDisclosurePlayed: true, callerConsent: "granted" })).toBe(true);
    expect(allowed({ consentMode: "all_party", recordingDisclosurePlayed: true, callerConsent: "unknown" })).toBe(false);
    expect(allowed({ consentMode: "all_party", recordingDisclosurePlayed: false, callerConsent: "granted" })).toBe(false);
    expect(allowed({ consentMode: "one_party", recordingDisclosurePlayed: true, callerConsent: "unknown" })).toBe(true);
    expect(allowed({ consentMode: "one_party", recordingDisclosurePlayed: true, callerConsent: "declined" })).toBe(false);
    expect(allowed({ consentMode: "made_up", recordingDisclosurePlayed: true, callerConsent: "unknown" })).toBe(false);
  });

  it("requires an event timestamp for the replay window", async () => {
    const { inboundCallEventSchema } = await import("./index.js");
    const base = { providerCallId: "CA-1", trackingNumber: "+15125550111", callerNumber: "+15125559876", startedAt: "2026-10-30T15:00:00.000Z", durationSeconds: 1, outcome: "answered" };
    expect(inboundCallEventSchema.safeParse(base).success).toBe(false);
    expect(inboundCallEventSchema.safeParse({ ...base, occurredAt: "2026-10-30T15:00:05.000Z" }).success).toBe(true);
  });
});
