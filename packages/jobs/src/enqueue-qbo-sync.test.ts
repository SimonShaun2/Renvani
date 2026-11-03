import { describe, expect, it, vi } from "vitest";

import { OPERATOR_QUEUE_JOB_NAMES } from "@fsm/types";

import { enqueueQboSyncPushJob } from "./enqueue-qbo-sync.js";
import { operatorQueue } from "./queues.js";

describe("enqueueQboSyncPushJob", () => {
  it("uses stable job id from idempotency key", async () => {
    const add = vi.spyOn(operatorQueue, "add").mockResolvedValue({} as never);
    await enqueueQboSyncPushJob({
      companyId: "00000000-0000-4000-8000-000000000001",
      entityType: "customer",
      entityId: "00000000-0000-4000-8000-000000000002",
      idempotencyKey: "customer:abc"
    });
    expect(add).toHaveBeenCalledWith(
      OPERATOR_QUEUE_JOB_NAMES.qboSyncPush,
      expect.objectContaining({ idempotencyKey: "customer:abc" }),
      expect.objectContaining({ jobId: "qbo-sync-push-customer:abc" })
    );
  });
});
