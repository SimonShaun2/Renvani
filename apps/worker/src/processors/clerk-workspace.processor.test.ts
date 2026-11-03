import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ClerkWorkspaceJobPayload } from "@fsm/jobs";

const enqueueClerkWorkspaceReconcileJob = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@fsm/jobs", () => ({
  CLERK_WORKSPACE_CREATE_JOB_NAME: "clerk-workspace-create",
  CLERK_WORKSPACE_RECONCILE_JOB_NAME: "clerk-workspace-reconcile",
  ClerkWorkspaceJobPayloadSchema: { parse: (value: unknown) => value },
  enqueueClerkWorkspaceReconcileJob
}));

import {
  processClerkWorkspaceCreate,
  processClerkWorkspaceReconcile,
  type ClaimedClerkWorkspaceIntent,
  type ClerkWorkspaceIntentRepository,
  type ClerkWorkspaceIntentSnapshot,
  type ClerkWorkspaceOrganizationObservation,
  type ClerkWorkspaceProcessorDependencies,
  type ClerkWorkspaceProvider
} from "./clerk-workspace.processor.js";

const payload: ClerkWorkspaceJobPayload = {
  intentId: "11111111-1111-4111-8111-111111111111",
  clerkUserId: "user_1"
};

const claimed: ClaimedClerkWorkspaceIntent = {
  id: payload.intentId,
  clerkUserId: payload.clerkUserId,
  requestedName: "Acme Plumbing",
  status: "claimed",
  attemptId: "22222222-2222-4222-8222-222222222222",
  clerkOrganizationId: null
};

function observation(
  id: string,
  overrides: Partial<ClerkWorkspaceOrganizationObservation> = {}
): ClerkWorkspaceOrganizationObservation {
  return {
    id,
    createdBy: claimed.clerkUserId,
    privateMetadata: {
      renvaniIntentId: claimed.id,
      renvaniAttemptId: claimed.attemptId
    },
    ...overrides
  };
}

function dependencies(input: {
  claim?: ClaimedClerkWorkspaceIntent | null;
  current?: ClerkWorkspaceIntentSnapshot | null;
  created?: ClerkWorkspaceOrganizationObservation;
} = {}): ClerkWorkspaceProcessorDependencies & {
  provider: ClerkWorkspaceProvider & Record<keyof ClerkWorkspaceProvider, ReturnType<typeof vi.fn>>;
  repository: ClerkWorkspaceIntentRepository & Record<keyof ClerkWorkspaceIntentRepository, ReturnType<typeof vi.fn>>;
} {
  const provider = {
    createOrganization: vi.fn(async () => input.created ?? observation("org_1")),
    listUserMembershipOrganizationIds: vi.fn(async () => ({ organizationIds: [], totalCount: 0 })),
    getOrganization: vi.fn(async (organizationId: string) => observation(organizationId))
  };
  const repository = {
    claim: vi.fn(async () => input.claim === undefined ? claimed : input.claim),
    get: vi.fn(async () => input.current === undefined ? claimed : input.current),
    markUncertain: vi.fn(async () => undefined),
    reconcile: vi.fn(async () => undefined)
  };
  return { provider, repository } as ClerkWorkspaceProcessorDependencies & {
    provider: ClerkWorkspaceProvider & Record<keyof ClerkWorkspaceProvider, ReturnType<typeof vi.fn>>;
    repository: ClerkWorkspaceIntentRepository & Record<keyof ClerkWorkspaceIntentRepository, ReturnType<typeof vi.fn>>;
  };
}

describe("FS-235 Clerk workspace worker", () => {
  beforeEach(() => enqueueClerkWorkspaceReconcileJob.mockClear());

  it("claims once, creates with immutable markers, and reconciles the verified response", async () => {
    const deps = dependencies();

    await processClerkWorkspaceCreate(payload, deps);

    expect(deps.provider.createOrganization).toHaveBeenCalledWith({
      name: "Acme Plumbing",
      createdBy: "user_1",
      privateMetadata: {
        renvaniIntentId: payload.intentId,
        renvaniAttemptId: claimed.attemptId
      }
    });
    expect(deps.repository.reconcile).toHaveBeenCalledWith(
      payload.intentId,
      payload.clerkUserId,
      claimed.attemptId,
      "org_1"
    );
    expect(deps.repository.markUncertain).not.toHaveBeenCalled();
  });

  it("does not issue a second provider create when the durable claim already exists", async () => {
    const deps = dependencies({ claim: null });

    await processClerkWorkspaceCreate(payload, deps);

    expect(deps.provider.createOrganization).not.toHaveBeenCalled();
    expect(deps.repository.reconcile).not.toHaveBeenCalled();
  });

  it("marks an unknown provider outcome uncertain and never rearms it", async () => {
    const deps = dependencies();
    deps.provider.createOrganization.mockRejectedValueOnce(new Error("timeout"));

    await expect(processClerkWorkspaceCreate(payload, deps)).rejects.toThrow("timeout");

    expect(deps.repository.markUncertain).toHaveBeenCalledWith(
      payload.intentId,
      payload.clerkUserId,
      claimed.attemptId,
      "provider_outcome_unknown"
    );
    expect(enqueueClerkWorkspaceReconcileJob).toHaveBeenCalledWith(payload);
    expect(deps.repository.reconcile).not.toHaveBeenCalled();
  });

  it("fails closed when the provider response markers do not match the claim", async () => {
    const deps = dependencies({
      created: observation("org_foreign", { privateMetadata: { renvaniIntentId: "other" } })
    });

    await expect(processClerkWorkspaceCreate(payload, deps)).rejects.toThrow("did not match");
    expect(deps.repository.markUncertain).toHaveBeenCalledWith(
      payload.intentId,
      payload.clerkUserId,
      claimed.attemptId,
      "provider_observation_mismatch"
    );
    expect(deps.repository.reconcile).not.toHaveBeenCalled();
  });

  it("paginates every membership and reconciles exactly one marked organization", async () => {
    const deps = dependencies();
    deps.provider.listUserMembershipOrganizationIds
      .mockResolvedValueOnce({ organizationIds: ["org_other", "org_target"], totalCount: 3 })
      .mockResolvedValueOnce({ organizationIds: ["org_last"], totalCount: 3 });
    deps.provider.getOrganization.mockImplementation(async (organizationId: string) =>
      organizationId === "org_target"
        ? observation(organizationId)
        : observation(organizationId, { createdBy: "user_other", privateMetadata: {} })
    );

    await processClerkWorkspaceReconcile(payload, deps);

    expect(deps.provider.listUserMembershipOrganizationIds).toHaveBeenNthCalledWith(1, {
      clerkUserId: payload.clerkUserId,
      limit: 100,
      offset: 0
    });
    expect(deps.provider.listUserMembershipOrganizationIds).toHaveBeenNthCalledWith(2, {
      clerkUserId: payload.clerkUserId,
      limit: 100,
      offset: 2
    });
    expect(deps.repository.reconcile).toHaveBeenCalledWith(
      payload.intentId,
      payload.clerkUserId,
      claimed.attemptId,
      "org_target"
    );
  });

  it("rejects ambiguous provider evidence instead of choosing a tenant", async () => {
    const deps = dependencies();
    deps.provider.listUserMembershipOrganizationIds.mockResolvedValueOnce({
      organizationIds: ["org_1", "org_2"],
      totalCount: 2
    });

    await expect(processClerkWorkspaceReconcile(payload, deps)).rejects.toThrow("Multiple Clerk organizations");
    expect(deps.repository.reconcile).not.toHaveBeenCalled();
  });

  it("does not reconcile a pending intent before the create claim is durable", async () => {
    const deps = dependencies({ current: { ...claimed, status: "pending", attemptId: null } });

    await expect(processClerkWorkspaceReconcile(payload, deps)).rejects.toThrow("not ready");
    expect(deps.provider.listUserMembershipOrganizationIds).not.toHaveBeenCalled();
  });

  it("converges after a partial failure (org created, then membership/metadata or the DB write fails) without duplicates", async () => {
    // Stateful fakes: the intent row and the provider's organizations persist across reruns.
    let row: ClerkWorkspaceIntentSnapshot = { ...claimed, status: "pending", attemptId: null };
    const organizations = new Map<string, ClerkWorkspaceOrganizationObservation>();
    const memberships: string[] = [];
    let membershipVisible = false;
    let metadataVisible = false;
    let failNextReconcileWrite = true;
    const reconcileWrites: string[] = [];
    const repository: ClerkWorkspaceIntentRepository = {
      claim: async () => {
        if (row.status !== "pending") return null;
        row = { ...row, status: "claimed", attemptId: claimed.attemptId };
        return row as ClaimedClerkWorkspaceIntent;
      },
      get: async () => row,
      markUncertain: async () => {
        if (row.status !== "reconciled") row = { ...row, status: "uncertain" };
      },
      reconcile: async (_intentId, _userId, attemptId, organizationId) => {
        if (failNextReconcileWrite) {
          failNextReconcileWrite = false;
          throw new Error("database unavailable");
        }
        if (row.attemptId !== attemptId) throw new Error("attempt mismatch");
        reconcileWrites.push(organizationId);
        row = { ...row, status: "reconciled", clerkOrganizationId: organizationId };
      }
    };
    const provider: ClerkWorkspaceProvider = {
      createOrganization: async (input) => {
        const created: ClerkWorkspaceOrganizationObservation = {
          id: `org_${organizations.size + 1}`,
          createdBy: input.createdBy,
          privateMetadata: { ...input.privateMetadata }
        };
        organizations.set(created.id, created);
        memberships.push(created.id);
        return created;
      },
      listUserMembershipOrganizationIds: async ({ offset }) => {
        const visible = membershipVisible ? memberships : [];
        return { organizationIds: visible.slice(offset), totalCount: visible.length };
      },
      getOrganization: async (organizationId) => {
        const organization = organizations.get(organizationId);
        if (!organization) throw new Error("not found");
        return metadataVisible ? organization : { ...organization, privateMetadata: {} };
      }
    };
    const deps = { provider, repository };

    // 1) Clerk created the org, then the local reconcile write failed: uncertain + reconcile queued.
    await expect(processClerkWorkspaceCreate(payload, deps)).rejects.toThrow("database unavailable");
    expect(row.status).toBe("uncertain");
    expect(enqueueClerkWorkspaceReconcileJob).toHaveBeenCalledWith(payload);
    // A redelivered create job must not create a second organization.
    await processClerkWorkspaceCreate(payload, deps);
    expect(organizations.size).toBe(1);

    // 2) Membership not visible yet, then metadata not visible yet: reconcile fails closed.
    await expect(processClerkWorkspaceReconcile(payload, deps)).rejects.toThrow("No Clerk organization");
    membershipVisible = true;
    await expect(processClerkWorkspaceReconcile(payload, deps)).rejects.toThrow("No Clerk organization");
    expect(row.status).toBe("uncertain");

    // 3) Once Clerk is consistent, a rerun converges on the one org; further reruns are no-ops.
    metadataVisible = true;
    await processClerkWorkspaceReconcile(payload, deps);
    await processClerkWorkspaceReconcile(payload, deps);
    await processClerkWorkspaceCreate(payload, deps);
    expect(row).toMatchObject({ status: "reconciled", clerkOrganizationId: "org_1" });
    expect(reconcileWrites).toEqual(["org_1"]);
    expect(organizations.size).toBe(1);
  });
});
