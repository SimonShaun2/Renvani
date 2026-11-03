import { describe, expect, it } from "vitest";

import {
  IMPORT_POLICY_V1,
  buildImportWorkflowAuditPayloadV1,
  parseImportWorkflowQueueEnvelopeV1,
} from "./import-workflow-runtime.js";
import { hashImportWorkflowStepFingerprint } from "./import-workflow-runtime-fingerprint.node.js";
import { buildImportChunkIdempotencyKey } from "./import-chunk-commit.js";
import {
  assertMapCsvColumnsIdempotencyKey,
  assertMigrateFileBatchIdempotencyKey,
} from "./import-workflow-runtime.js";
import { buildMapCsvColumnsIdempotencyKey, buildMigrateFileBatchIdempotencyKey } from "./import-queue-jobs.js";

describe("import workflow runtime (FS-MIGRATE agent parity)", () => {
  const companyId = "11111111-1111-4111-8111-111111111111";
  const importSessionId = "22222222-2222-4222-8222-222222222222";

  it("parses queue envelope with import-policy-v1", () => {
    const envelope = parseImportWorkflowQueueEnvelopeV1({
      contractVersion: "1.0.0",
      companyId,
      importSessionId,
      stepKind: "import-chunk-commit",
      idempotencyKey: buildImportChunkIdempotencyKey(importSessionId, "customers", 0),
      policyVersion: IMPORT_POLICY_V1,
    });

    expect(envelope.policyVersion).toBe(IMPORT_POLICY_V1);
    expect(envelope.stepKind).toBe("import-chunk-commit");
  });

  it("builds audit payload aligned with agent control-plane fields", () => {
    const audit = buildImportWorkflowAuditPayloadV1({
      stepKind: "import-chunk-commit",
      idempotencyKey: buildImportChunkIdempotencyKey(importSessionId, "customers", 1),
      state: "scheduled",
      importSessionId,
      chunkIndex: 1,
      jobId: `import-chunk-commit-${importSessionId}-1`,
    });

    expect(audit.contractVersion).toBe("1.0.0");
    expect(audit.policyVersion).toBe(IMPORT_POLICY_V1);
    expect(audit.state).toBe("scheduled");
  });

  it("validates map-csv-columns and migrate-file-batch idempotency keys", () => {
    const batchKey = buildMigrateFileBatchIdempotencyKey(importSessionId, 2);
    assertMigrateFileBatchIdempotencyKey(importSessionId, 2, batchKey);
    expect(() => assertMigrateFileBatchIdempotencyKey(importSessionId, 2, "wrong")).toThrow();

    const mapKey = buildMapCsvColumnsIdempotencyKey(importSessionId);
    assertMapCsvColumnsIdempotencyKey(importSessionId, mapKey);
    expect(() => assertMapCsvColumnsIdempotencyKey(importSessionId, "bad")).toThrow();
  });

  it("hashes step payloads deterministically", () => {
    const payload = { companyId, chunkIndex: 0, cursor: { rowOffset: 0 } };
    expect(hashImportWorkflowStepFingerprint(payload)).toBe(hashImportWorkflowStepFingerprint(payload));
    expect(hashImportWorkflowStepFingerprint({ ...payload, chunkIndex: 1 })).not.toBe(
      hashImportWorkflowStepFingerprint(payload),
    );
  });
});
