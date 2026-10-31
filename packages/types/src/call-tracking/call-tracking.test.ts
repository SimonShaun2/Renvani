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
      durationSeconds: 10,
      outcome: "missed"
    };
    expect(inboundCallEventSchema.safeParse(event).success).toBe(true);
    expect(inboundCallEventSchema.safeParse({ ...event, audio: "base64" }).success).toBe(false);
    expect(inboundCallEventSchema.safeParse({ ...event, durationSeconds: -1 }).success).toBe(false);
  });
});
