import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const provisionClerkOrganization = vi.fn();
const provisionClerkMembership = vi.fn();

vi.mock("../../services/clerk-provisioning.service.js", () => ({
  provisionClerkOrganization,
  provisionClerkMembership
}));
vi.mock("@fsm/config", () => ({ env: { CLERK_WEBHOOK_SECRET: "", NODE_ENV: "test" } }));

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
    process.env.CLERK_WEBHOOK_SECRET = SECRET;
    provisionClerkOrganization.mockReset().mockResolvedValue({ id: "co_1" });
    provisionClerkMembership.mockReset().mockResolvedValue({ status: "created", companyId: "co_1" });
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
    expect(provisionClerkOrganization).toHaveBeenCalledWith({ organizationId: "org_1", name: "Acme" });
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

  it("acks user.created without provisioning", async () => {
    const res = await send({ type: "user.created", data: { id: "user_1" } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ignored: "user.created" });
  });

  it("returns 503 when the secret is not configured", async () => {
    process.env.CLERK_WEBHOOK_SECRET = "";
    const res = await send({ type: "user.created" });
    expect(res.statusCode).toBe(503);
  });
});
