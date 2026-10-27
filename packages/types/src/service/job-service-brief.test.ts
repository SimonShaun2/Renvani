import { describe, expect, it } from "vitest";

import {
  buildServiceJobBriefBuildJobId,
  buildServiceJobBriefIdempotencyKey
} from "./job-service-brief.js";

describe("job-service-brief helpers", () => {
  it("builds stable idempotency keys per company and job", () => {
    const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const jobId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    expect(buildServiceJobBriefIdempotencyKey(companyId, jobId)).toBe(
      `service-job-brief:${companyId}:${jobId}`
    );
    expect(buildServiceJobBriefBuildJobId(companyId, jobId)).toBe(
      `service-build-job-brief-${companyId}-${jobId}`
    );
  });
});
