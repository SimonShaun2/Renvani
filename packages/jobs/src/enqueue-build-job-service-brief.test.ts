import { beforeEach, describe, expect, it, vi } from "vitest";

const { operatorQueueAdd } = vi.hoisted(() => ({ operatorQueueAdd: vi.fn() }));

vi.mock("./queues.js", () => ({ operatorQueue: { add: operatorQueueAdd } }));

describe("enqueueBuildJobServiceBriefJob (FS-25 follow-up)", () => {
  beforeEach(() => {
    operatorQueueAdd.mockReset();
  });

  it("keys the build job and idempotency key by job resource version", async () => {
    const { enqueueBuildJobServiceBriefJob } = await import("./enqueue-build-job-service-brief.js");
    const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const jobId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    const first = await enqueueBuildJobServiceBriefJob({ companyId, jobId, resourceVersion: "2026-10-27T10:00:00.000Z" });
    const second = await enqueueBuildJobServiceBriefJob({ companyId, jobId, resourceVersion: "2026-10-27T11:00:00.000Z" });

    expect(first).not.toBe(second);
    expect(first).not.toContain(":");
    const payloads = operatorQueueAdd.mock.calls.map((call) => call[1] as { idempotencyKey: string });
    expect(payloads[0]?.idempotencyKey).toBe(`service-job-brief:${companyId}:${jobId}:2026-10-27T10:00:00.000Z`);
    expect(payloads[1]?.idempotencyKey).not.toBe(payloads[0]?.idempotencyKey);
  });
});
