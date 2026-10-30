import { describe, expect, it } from "vitest";

import {
  INTEGRATION_OUTBOX_MAX_ATTEMPTS,
  INTEGRATION_OUTBOX_MAX_BACKOFF_MS,
  IntegrationOutboxRetryReceiptSchema,
  buildIntegrationOutboxRetryReceiptKey,
  integrationOutboxBackoffMs
} from "./audit.js";
import {
  AdapterOperationKindV1Schema,
  registerAdapterOperationKind
} from "./adapter-operation.js";

const operationId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const correlationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("integration outbox retry receipt keys", () => {
  it("builds a stable key per operation, correlation and attempt", () => {
    expect(buildIntegrationOutboxRetryReceiptKey(operationId, correlationId, 1)).toBe(
      `${operationId}:${correlationId}:retry:1`
    );
    expect(buildIntegrationOutboxRetryReceiptKey(operationId, correlationId, 2)).toBe(
      `${operationId}:${correlationId}:retry:2`
    );
  });

  it("differs per operation for the same correlation and attempt", () => {
    const other = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    expect(buildIntegrationOutboxRetryReceiptKey(other, correlationId, 1)).not.toBe(
      buildIntegrationOutboxRetryReceiptKey(operationId, correlationId, 1)
    );
  });
});

describe("integration outbox attempt cap and backoff", () => {
  const base = { schemaVersion: 1 as const, correlationId, idempotencyKey: "k", source: "worker" as const };

  it("rejects attempt numbers above the cap", () => {
    expect(IntegrationOutboxRetryReceiptSchema.safeParse({ ...base, attemptNumber: INTEGRATION_OUTBOX_MAX_ATTEMPTS }).success).toBe(true);
    expect(IntegrationOutboxRetryReceiptSchema.safeParse({ ...base, attemptNumber: INTEGRATION_OUTBOX_MAX_ATTEMPTS + 1 }).success).toBe(false);
  });

  it("backs off exponentially with a ceiling", () => {
    expect(integrationOutboxBackoffMs(2)).toBe(2 * integrationOutboxBackoffMs(1));
    expect(integrationOutboxBackoffMs(100)).toBe(INTEGRATION_OUTBOX_MAX_BACKOFF_MS);
  });
});

describe("adapter operation kind registry", () => {
  it("accepts built-in kinds and rejects unregistered ones", () => {
    expect(AdapterOperationKindV1Schema.safeParse("sms_outbound").success).toBe(true);
    expect(AdapterOperationKindV1Schema.safeParse("fax_outbound").success).toBe(false);
  });

  it("accepts a kind once an add-on registers it (no migration)", () => {
    registerAdapterOperationKind("fax_outbound");
    expect(AdapterOperationKindV1Schema.safeParse("fax_outbound").success).toBe(true);
    expect(() => registerAdapterOperationKind("Bad Kind")).toThrow();
  });
});
