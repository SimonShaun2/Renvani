import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

const featureFlagsMock = vi.hoisted(() => ({
  serviceJobBriefWorkerEnabled: true
}));

const createProposalMock = vi.hoisted(() => vi.fn(async () => ({ created: true, actionId: "action-1" })));

vi.mock("@fsm/config/feature-flags", () => ({
  featureFlags: featureFlagsMock
}));

vi.mock("@fsm/db", () => ({
  createServiceJobBriefAgentProposal: createProposalMock
}));

import { processServiceBuildJobBrief } from "./service-job-brief.processor.js";

describe("service-job-brief.processor", () => {
  beforeEach(() => {
    createProposalMock.mockClear();
    featureFlagsMock.serviceJobBriefWorkerEnabled = true;
  });

  it("skips when feature flag is disabled", async () => {
    featureFlagsMock.serviceJobBriefWorkerEnabled = false;
    await processServiceBuildJobBrief({
      id: "job-1",
      name: "service.build-job-brief",
      data: {
        companyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        jobId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        idempotencyKey: "key",
        sourceEventIds: []
      }
    } as Job<Record<string, unknown>>);

    expect(createProposalMock).not.toHaveBeenCalled();
  });

  it("creates agent proposal when enabled", async () => {
    await processServiceBuildJobBrief({
      id: "job-1",
      name: "service.build-job-brief",
      data: {
        companyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        jobId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        idempotencyKey: "key",
        sourceEventIds: []
      }
    } as Job<Record<string, unknown>>);

    expect(createProposalMock).toHaveBeenCalledOnce();
  });
});
