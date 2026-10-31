import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const provisionClerkOrganization = vi.fn();
const provisionClerkMembership = vi.fn();

vi.mock("../../services/clerk-provisioning.service.js", () => ({
  provisionClerkOrganization,
  provisionClerkMembership
}));
const syncClerkUserRoleMetadata = vi.hoisted(() => vi.fn(async () => "synced"));
vi.mock("../../lib/clerk-role-metadata.js", () => ({ syncClerkUserRoleMetadata }));
const syncClerkUserUpdated = vi.fn();
const deactivateClerkUser = vi.fn();
const deactivateClerkMembership = vi.fn();
vi.mock("../../services/clerk-user-sync.service.js", async () => {
  const actual = await vi.importActual<typeof import("../../services/clerk-user-sync.service.js")>(
    "../../services/clerk-user-sync.service.js"
  );
  return {
    readVerifiedPrimaryEmail: actual.readVerifiedPrimaryEmail,
    syncClerkUserUpdated,
    deactivateClerkUser,
    deactivateClerkMembership
  };
});
const mockEnv = vi.hoisted(() => ({ CLERK_WEBHOOK_SECRET: "", NODE_ENV: "test" }));
vi.mock("@fsm/config", () => ({ env: mockEnv }));

const SECRET = `whsec_${Buffer.from("test-secret-0123456789").toString("base64")}`;

async function buildApp() {
  const { default: routes } = await import("./clerk.js");
  const app = Fastify();
  await app.register(routes, { prefix: "/api/v1/webhooks" });
  await app.ready();
  return app;
}

let msgCounter = 0;

async function send(body: unknown, opts: { secret?: string; timestamp?: number; id?: string } = {}) {
  msgCounter += 1;
  const id = opts.id ?? `msg_${msgCounter}`;
  const { signSvixPayload } = await import("../../lib/svix-verify.js");
  const payload = JSON.stringify(body);
  const ts = String(opts.timestamp ?? Math.floor(Date.now() / 1000));
  const sig = signSvixPayload(opts.secret ?? SECRET, id, ts, payload);
  const app = await buildApp();
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/webhooks/clerk",
    headers: { "content-type": "application/json", "svix-id": id, "svix-timestamp": ts, "svix-signature": `v1,${sig}` },
    payload
  });
  await app.close();
  return res;
}

describe("Clerk webhook", () => {
  beforeEach(() => {
    mockEnv.CLERK_WEBHOOK_SECRET = SECRET;
    provisionClerkOrganization.mockReset().mockResolvedValue({ id: "co_1" });
    provisionClerkMembership.mockReset().mockResolvedValue({ status: "created", companyId: "co_1" });
    syncClerkUserUpdated.mockReset().mockResolvedValue({ status: "updated" });
    deactivateClerkUser.mockReset().mockResolvedValue({ status: "deactivated" });
    deactivateClerkMembership.mockReset().mockResolvedValue({ status: "deactivated" });
  });

  it("FS-158: a failed delivery releases the claim and the retry is processed", async () => {
    const body = { type: "organization.created", data: { id: "org_f", name: "Acme" } };
    provisionClerkOrganization.mockRejectedValueOnce(new Error("boom"));
    const first = await send(body, { id: "msg_fail" });
    expect(first.statusCode).toBe(500);
    const retry = await send(body, { id: "msg_fail" });
    expect(retry.statusCode).toBe(200);
    expect(retry.json()).not.toMatchObject({ duplicate: true });
    expect(provisionClerkOrganization).toHaveBeenCalledTimes(2);
    const third = await send(body, { id: "msg_fail" });
    expect(third.json()).toMatchObject({ duplicate: true });
    expect(provisionClerkOrganization).toHaveBeenCalledTimes(2);
  });

  it("FS-158: a concurrent duplicate while processing gets 409 (sender retries), handler runs once", async () => {
    let finish!: () => void;
    provisionClerkOrganization.mockImplementationOnce(
      () => new Promise((resolve) => (finish = () => resolve({ id: "co_1" })))
    );
    const body = { type: "organization.created", data: { id: "org_c", name: "Acme" } };
    const firstP = send(body, { id: "msg_conc" });
    await vi.waitFor(() => expect(provisionClerkOrganization).toHaveBeenCalledTimes(1));
    const second = await send(body, { id: "msg_conc" });
    expect(second.statusCode).toBe(409);
    finish();
    expect((await firstP).statusCode).toBe(200);
    expect(provisionClerkOrganization).toHaveBeenCalledTimes(1);
  });

  it("FS-158: distinct svix-ids are processed independently", async () => {
    const body = { type: "organization.created", data: { id: "org_d", name: "Acme" } };
    await send(body, { id: "msg_d1" });
    await send(body, { id: "msg_d2" });
    expect(provisionClerkOrganization).toHaveBeenCalledTimes(2);
  });

  it("dedupes replays of the same svix-id", async () => {
    const body = { type: "organization.created", data: { id: "org_r", name: "Acme" } };
    const first = await send(body, { id: "msg_replay" });
    const second = await send(body, { id: "msg_replay" });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json()).toMatchObject({ duplicate: true });
    expect(provisionClerkOrganization).toHaveBeenCalledTimes(1);
  });

  it("rejects a bad signature", async () => {
    const other = `whsec_${Buffer.from("wrong").toString("base64")}`;
    const res = await send({ type: "organization.created", data: { id: "org_1", name: "Acme" } }, { secret: other });
    expect(res.statusCode).toBe(400);
    expect(provisionClerkOrganization).not.toHaveBeenCalled();
  });

  it("rejects a stale timestamp", async () => {
    const res = await send({ type: "organization.created", data: {} }, { timestamp: Math.floor(Date.now() / 1000) - 3600 });
    expect(res.statusCode).toBe(400);
  });

  it("provisions a company on organization.created", async () => {
    const res = await send({ type: "organization.created", data: { id: "org_1", name: "Acme" } });
    expect(res.statusCode).toBe(200);
    expect(provisionClerkOrganization).toHaveBeenCalledWith({ organizationId: "org_1", name: "Acme", createdBy: null });
  });

  it("provisions company + user on organizationMembership.created", async () => {
    const res = await send({
      type: "organizationMembership.created",
      data: {
        role: "org:admin",
        organization: { id: "org_1", name: "Acme" },
        public_user_data: { identifier: "owner@acme.com", first_name: "Ava", last_name: "Stone", user_id: "user_ava" }
      }
    });
    expect(res.statusCode).toBe(200);
    expect(provisionClerkMembership).toHaveBeenCalledWith({
      organizationId: "org_1",
      name: "Acme",
      email: "owner@acme.com",
      firstName: "Ava",
      lastName: "Stone",
      clerkOrgRole: "org:admin",
      clerkUserId: "user_ava",
      emailVerified: false
    });
  });

  it("publishes the provisioned DB role to Clerk public_metadata (fixes /no-access for new owners)", async () => {
    syncClerkUserRoleMetadata.mockClear();
    provisionClerkMembership.mockResolvedValueOnce({ status: "created", companyId: "c1", role: "owner" });
    const res = await send({
      type: "organizationMembership.created",
      data: {
        role: "org:admin",
        organization: { id: "org_1", name: "Acme" },
        public_user_data: { identifier: "owner@acme.com", user_id: "user_ava" }
      }
    });
    expect(res.statusCode).toBe(200);
    expect(syncClerkUserRoleMetadata).toHaveBeenCalledWith("user_ava", "owner");
    expect(res.json()).toMatchObject({ status: "created", role: "owner", roleSync: "synced" });
  });

  it("does not touch Clerk metadata when provisioning was skipped (tenant mismatch)", async () => {
    syncClerkUserRoleMetadata.mockClear();
    provisionClerkMembership.mockResolvedValueOnce({ status: "skipped", companyId: "c1" });
    const res = await send({
      type: "organizationMembership.created",
      data: { organization: { id: "org_1" }, public_user_data: { identifier: "x@y.com", user_id: "user_x" } }
    });
    expect(res.statusCode).toBe(200);
    expect(syncClerkUserRoleMetadata).not.toHaveBeenCalled();
    expect(res.json()).toMatchObject({ roleSync: "not_needed" });
  });

  it("passes the org creator (created_by) on organization.created", async () => {
    const res = await send({ type: "organization.created", data: { id: "org_9", name: "Nine", created_by: "user_c" } });
    expect(res.statusCode).toBe(200);
    expect(provisionClerkOrganization).toHaveBeenCalledWith({ organizationId: "org_9", name: "Nine", createdBy: "user_c" });
  });

  it("acks user.created without provisioning", async () => {
    const res = await send({ type: "user.created", data: { id: "user_1" } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ignored: "user.created" });
  });

  it("returns 503 when the secret is not configured", async () => {
    mockEnv.CLERK_WEBHOOK_SECRET = "";
    const res = await send({ type: "user.created" });
    expect(res.statusCode).toBe(503);
    expect(provisionClerkOrganization).not.toHaveBeenCalled();
  });

  it("ignores process.env and reads only validated config (fail closed)", async () => {
    mockEnv.CLERK_WEBHOOK_SECRET = "  ";
    process.env.CLERK_WEBHOOK_SECRET = SECRET;
    try {
      const res = await send({ type: "user.created" });
      expect(res.statusCode).toBe(503);
    } finally {
      delete process.env.CLERK_WEBHOOK_SECRET;
    }
  });

  it("has no direct process.env reads", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("./clerk.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/process\.env/);
  });

  const userUpdated = (status: string) => ({
    type: "user.updated",
    data: {
      id: "user_ava",
      primary_email_address_id: "idn_1",
      email_addresses: [
        { id: "idn_0", email_address: "old@acme.com", verification: { status: "verified" } },
        { id: "idn_1", email_address: "New@Acme.com", verification: { status } }
      ]
    }
  });

  it("FS-160: user.updated passes only a verified primary email", async () => {
    const ok = await send(userUpdated("verified"));
    expect(ok.statusCode).toBe(200);
    expect(syncClerkUserUpdated).toHaveBeenLastCalledWith({ clerkUserId: "user_ava", verifiedPrimaryEmail: "new@acme.com" });
    const unverified = await send(userUpdated("unverified"));
    expect(unverified.statusCode).toBe(200);
    expect(syncClerkUserUpdated).toHaveBeenLastCalledWith({ clerkUserId: "user_ava", verifiedPrimaryEmail: null });
  });

  it("FS-160: user.deleted deactivates; redelivery of the same svix-id is a duplicate", async () => {
    const body = { type: "user.deleted", data: { id: "user_ava", deleted: true } };
    const res = await send(body, { id: "msg_del" });
    expect(res.json()).toMatchObject({ received: true, status: "deactivated" });
    const again = await send(body, { id: "msg_del" });
    expect(again.json()).toMatchObject({ duplicate: true });
    expect(deactivateClerkUser).toHaveBeenCalledTimes(1);
    expect(deactivateClerkUser).toHaveBeenCalledWith("user_ava");
  });

  it("FS-160: a failed user.deleted releases the claim so the retry runs", async () => {
    const body = { type: "user.deleted", data: { id: "user_x" } };
    deactivateClerkUser.mockRejectedValueOnce(new Error("boom"));
    expect((await send(body, { id: "msg_del_fail" })).statusCode).toBe(500);
    expect((await send(body, { id: "msg_del_fail" })).json()).toMatchObject({ status: "deactivated" });
    expect(deactivateClerkUser).toHaveBeenCalledTimes(2);
  });

  it("FS-160: concurrent user.updated with the same svix-id gets 409 while processing", async () => {
    let finish!: () => void;
    syncClerkUserUpdated.mockImplementationOnce(
      () => new Promise((resolve) => (finish = () => resolve({ status: "updated" })))
    );
    const first = send(userUpdated("verified"), { id: "msg_upd_overlap" });
    await vi.waitFor(() => expect(syncClerkUserUpdated).toHaveBeenCalledTimes(1));
    const second = await send(userUpdated("verified"), { id: "msg_upd_overlap" });
    expect(second.statusCode).toBe(409);
    finish();
    expect((await first).statusCode).toBe(200);
  });

  it("FS-160: user.deleted with a bad signature is rejected and not processed", async () => {
    const res = await send({ type: "user.deleted", data: { id: "user_ava" } }, { secret: `whsec_${Buffer.from("wrong-secret-0123456789").toString("base64")}` });
    expect(res.statusCode).toBe(400);
    expect(deactivateClerkUser).not.toHaveBeenCalled();
  });

  it("FS-160: organizationMembership.deleted deactivates within that org only", async () => {
    const res = await send({
      type: "organizationMembership.deleted",
      data: { organization: { id: "org_1" }, public_user_data: { user_id: "user_ava" } }
    });
    expect(res.statusCode).toBe(200);
    expect(deactivateClerkMembership).toHaveBeenCalledWith("org_1", "user_ava");
  });
});
