import { describe, expect, it } from "vitest";

import {
  buildServiceJobBriefBuildJobId,
  buildServiceJobBriefIdempotencyKey
} from "./job-service-brief.js";

describe("job-service-brief helpers", () => {
  const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const jobId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const v1 = "2026-10-27T10:00:00.000Z";
  const v2 = "2026-10-27T11:30:00.000Z";

  it("builds stable idempotency keys per company, job and resource version", () => {
    expect(buildServiceJobBriefIdempotencyKey(companyId, jobId, v1)).toBe(
      `service-job-brief:${companyId}:${jobId}:${v1}`
    );
    expect(buildServiceJobBriefIdempotencyKey(companyId, jobId, v1)).toBe(
      buildServiceJobBriefIdempotencyKey(companyId, jobId, v1)
    );
  });

  it("changes the key when the resource version changes", () => {
    expect(buildServiceJobBriefIdempotencyKey(companyId, jobId, v2)).not.toBe(
      buildServiceJobBriefIdempotencyKey(companyId, jobId, v1)
    );
    expect(buildServiceJobBriefBuildJobId(companyId, jobId, v2)).not.toBe(
      buildServiceJobBriefBuildJobId(companyId, jobId, v1)
    );
  });

  it("builds BullMQ-safe job ids (no ':')", () => {
    const id = buildServiceJobBriefBuildJobId(companyId, jobId, v1);
    expect(id).toBe(`service-build-job-brief-${companyId}-${jobId}-2026-10-27T10-00-00-000Z`);
    expect(id).not.toContain(":");
  });
});
