import { describe, expect, it } from "vitest";

import { buildIntegrationOutboxRetryReceiptKey } from "./audit.js";

describe("integration outbox retry receipt keys", () => {
  it("builds a stable key per correlation and attempt", () => {
    const correlationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    expect(buildIntegrationOutboxRetryReceiptKey(correlationId, 1)).toBe(
      `${correlationId}:retry:1`
    );
    expect(buildIntegrationOutboxRetryReceiptKey(correlationId, 2)).toBe(
      `${correlationId}:retry:2`
    );
  });
});
