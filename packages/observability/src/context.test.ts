import { describe, expect, it } from "vitest";

import {
  extractJobObservabilityContext,
  getObservabilityContext,
  runWithObservabilityContext
} from "./context.js";

describe("observability context", () => {
  it("extracts companyId, importSessionId, and jobId from BullMQ job data", () => {
    expect(
      extractJobObservabilityContext(
        {
          companyId: "11111111-1111-4111-8111-111111111111",
          importSessionId: "22222222-2222-4222-8222-222222222222"
        },
        "job-42"
      )
    ).toEqual({
      companyId: "11111111-1111-4111-8111-111111111111",
      importSessionId: "22222222-2222-4222-8222-222222222222",
      jobId: "job-42"
    });
  });

  it("merges nested async context", () => {
    const snapshot = runWithObservabilityContext({ requestId: "req-1" }, () =>
      runWithObservabilityContext({ companyId: "co-1" }, () =>
        runWithObservabilityContext({ jobId: "job-1" }, () => getObservabilityContext())
      )
    );

    expect(snapshot).toEqual({
      requestId: "req-1",
      companyId: "co-1",
      jobId: "job-1",
      importSessionId: null
    });
  });
});
