import { beforeEach, describe, expect, it, vi } from "vitest";

import { AI_QUEUE_JOB_NAMES, buildImportFileLinkJobId } from "@fsm/types";

const { aiQueueAdd } = vi.hoisted(() => ({
  aiQueueAdd: vi.fn()
}));

vi.mock("./queues.js", () => ({
  aiQueue: {
    add: aiQueueAdd
  }
}));

describe("enqueueImportFileLinkJob", () => {
  beforeEach(() => {
    aiQueueAdd.mockReset();
  });

  it("enqueues import-file-link on fsm:ai with stable job id", async () => {
    const { enqueueImportFileLinkJob } = await import("./enqueue-import-file-link.js");

    const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const importBundleId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    await enqueueImportFileLinkJob({
      companyId,
      importBundleId,
      sourceSystem: "qbo",
      targets: {
        customers: [{ sourceId: "C-1", displayName: "Jane Doe" }],
        jobs: [],
        assets: []
      },
      objects: [{ vendorFileId: "f-1", relativePath: "Customers/Jane_Doe/photo.jpg" }],
      idempotencyKey: `${importBundleId}:import-file-link:v1`
    });

    expect(aiQueueAdd).toHaveBeenCalledTimes(1);
    const [jobName, payload, options] = aiQueueAdd.mock.calls[0] as [
      string,
      Record<string, unknown>,
      { jobId: string }
    ];

    expect(jobName).toBe(AI_QUEUE_JOB_NAMES.importFileLink);
    expect(payload.importBundleId).toBe(importBundleId);
    expect(options.jobId).toBe(buildImportFileLinkJobId(importBundleId));
  });
});
