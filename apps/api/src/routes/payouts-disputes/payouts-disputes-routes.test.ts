import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listPayoutsForCompany: vi.fn(),
  getPayoutForCompany: vi.fn(),
  listDisputesForCompany: vi.fn(),
  getDisputeForCompany: vi.fn()
}));
vi.mock("../../services/payouts-disputes.service.js", () => mocks);

import routes from "./index.js";

const companyId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const disputeId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
let app: ReturnType<typeof Fastify>;

beforeEach(async () => {
  vi.clearAllMocks();
  app = Fastify();
  app.decorate("authenticate", async (request: { headers: Record<string, string>; user?: unknown; company?: unknown }) => {
    request.user = { id: "u1", role: request.headers["x-role"] };
    request.company = { id: companyId };
  });
  app.setErrorHandler((error: Error & { code?: string; statusCode?: number }, _req: unknown, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) => {
    const status = error.code === "FORBIDDEN" ? 403 : error.code === "VALIDATION_ERROR" || error.name === "ZodError" ? 400 : 500;
    reply.code(status).send({ error: error.code ?? "ERR" });
  });
  await app.register(routes, { prefix: "/api/v1" });
  await app.ready();
  mocks.listPayoutsForCompany.mockResolvedValue({
    connected: true,
    hasMore: false,
    data: [{ id: "po_1", amount: "10.00", currency: "usd", status: "paid", arrivalDate: null, createdAt: "2026-10-01T00:00:00.000Z", method: "standard", type: "bank_account", description: null, failureCode: null, destination: "ba_secret" }]
  });
  mocks.getDisputeForCompany.mockResolvedValue({
    id: disputeId, stripeDisputeId: "dp_1", stripeChargeId: "ch_1", stripePaymentIntentId: "pi_1", paymentId: null, invoiceId: null,
    amount: "5.00", currency: "usd", status: "needs_response", open: true, reason: "fraudulent", evidenceDueBy: null,
    disputedAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z", evidence: { customer_name: "pii" }
  });
  mocks.listDisputesForCompany.mockResolvedValue({ data: [], nextCursor: null });
});
afterEach(async () => {
  await app.close();
});

describe("FS-199 payouts & disputes routes", () => {
  const urls = ["/api/v1/payments/payouts", "/api/v1/payments/payouts/po_1", "/api/v1/payments/disputes", `/api/v1/payments/disputes/${disputeId}`];

  it.each(urls.flatMap((url) => ["office", "dispatcher", "technician"].map((role) => ({ url, role }))))("rejects $role on $url", async ({ url, role }) => {
    const res = await app.inject({ method: "GET", url, headers: { "x-role": role } });
    expect(res.statusCode).toBe(403);
  });

  it("lets owner/admin list payouts and strips unknown fields", async () => {
    for (const role of ["owner", "admin"]) {
      const res = await app.inject({ method: "GET", url: "/api/v1/payments/payouts?limit=10", headers: { "x-role": role } });
      expect(res.statusCode).toBe(200);
      expect(res.json().data[0]).not.toHaveProperty("destination");
    }
    expect(mocks.listPayoutsForCompany).toHaveBeenCalledWith(companyId, { limit: 10 });
  });

  it("strips dispute evidence from the detail response", async () => {
    const res = await app.inject({ method: "GET", url: `/api/v1/payments/disputes/${disputeId}`, headers: { "x-role": "owner" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).not.toHaveProperty("evidence");
    expect(res.json().data.status).toBe("needs_response");
  });

  it.each([
    "/api/v1/payments/payouts?limit=1000",
    "/api/v1/payments/payouts?startingAfter=not-a-payout",
    "/api/v1/payments/payouts?extra=1",
    "/api/v1/payments/disputes?status=Not_Registered",
    `/api/v1/payments/disputes?cursor=${"a".repeat(300)}`,
    "/api/v1/payments/disputes/not-a-uuid"
  ])("rejects invalid input %s", async (url) => {
    const res = await app.inject({ method: "GET", url, headers: { "x-role": "owner" } });
    expect(res.statusCode).toBe(400);
  });
});
