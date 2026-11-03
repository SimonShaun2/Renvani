import { describe, expect, it } from "vitest";

import {
  normalizeImportedMessageChannel,
  normalizeImportedMessageDirection,
  resolveImportedMessageToAddress,
} from "./import-communications-commit.logic.js";

describe("import-communications-commit.logic", () => {
  it("normalizes vendor channel labels", () => {
    expect(normalizeImportedMessageChannel("SMS Text")).toBe("sms");
    expect(normalizeImportedMessageChannel("Email")).toBe("email");
    expect(normalizeImportedMessageChannel("In-App Chat")).toBe("in_app");
  });

  it("normalizes direction from status columns", () => {
    expect(normalizeImportedMessageDirection("Received")).toBe("inbound");
    expect(normalizeImportedMessageDirection("sent")).toBe("outbound");
  });

  it("resolves destination from email or phone when to is missing", () => {
    expect(
      resolveImportedMessageToAddress({
        channel: "email",
        email: "owner@example.com",
      }),
    ).toBe("owner@example.com");

    expect(
      resolveImportedMessageToAddress({
        channel: "sms",
        phone: "+15551234567",
      }),
    ).toBe("+15551234567");
  });
});
