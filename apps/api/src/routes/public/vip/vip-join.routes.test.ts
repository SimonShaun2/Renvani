import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppError, ErrorCode } from "@fsm/types";

import {
  PUBLIC_VIP_JOIN_CHECKOUT_RATE_LIMIT,
  resetPublicBookingRateLimitStateForTests
} from "../../../lib/public-booking-rate-limit.js";
import errorHandlerPlugin from "../../../plugins/error-handler.js";

const getPublicVipJoinPreview = vi.fn();
const startPublicVipCheckout = vi.fn();
vi.mock("../../../services/vip-membership.service.js", () => ({
  getPublicVipJoinPreview: (...args: unknown[]) => getPublicVipJoinPreview(...args),
  startPublicVipCheckout: (...args: unknown[]) => startPublicVipCheckout(...args)
}));

const UUID = "11111111-2222-4333-8444-555555555555";
const SIG = "A".repeat(43);
const WELL_FORMED = `${UUID}:${UUID}:${UUID}:1893456000.${SIG}`;

async function buildApp() {
  const { default: routes } = await import("./index.js");
  // Mirrors buildApp (app.ts API_MAX_PARAM_LENGTH); real join tokens exceed Fastify's default of 100.
  const app = Fastify({ maxParamLength: 512 });
  await app.register(errorHandlerPlugin);
  await app.register(routes, { prefix: "/api/v1/public/vip" });
  await app.ready();
  return app;
}

const enc = encodeURIComponent;

describe("public VIP join routes (audit H3)", () => {
  beforeEach(() => {
    resetPublicBookingRateLimitStateForTests();
    getPublicVipJoinPreview.mockReset().mockResolvedValue({ companyName: "Acme" });
    startPublicVipCheckout.mockReset().mockResolvedValue({ url: "https://checkout.example/session" });
  });
  afterEach(() => vi.clearAllMocks());

  it("well-formed token reaches the service", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: `/api/v1/public/vip/join/${enc(WELL_FORMED)}` });
    expect(res.statusCode).toBe(200);
    expect(getPublicVipJoinPreview).toHaveBeenCalledWith(WELL_FORMED);
    await app.close();
  });

  it.each([
    ["garbage", "not-a-token"],
    ["no signature", `${UUID}:${UUID}:${UUID}`],
    ["short signature", `${UUID}:${UUID}:${UUID}.abc`],
    ["bad charset", `${UUID}:${UUID}:<script>.${SIG}`],
    ["oversized", `${"a".repeat(300)}:${UUID}:${UUID}.${SIG}`]
  ])("malformed token (%s) is rejected early with the same 404 as unknown", async (_label, token) => {
    const app = await buildApp();
    const res = await app.inject({ method: "POST", url: `/api/v1/public/vip/join/${enc(token)}/checkout` });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: ErrorCode.NOT_FOUND, message: "Link not found" });
    expect(startPublicVipCheckout).not.toHaveBeenCalled();
    await app.close();
  });

  it("unknown (bad signature) token gives an identical response", async () => {
    getPublicVipJoinPreview.mockRejectedValue(new AppError(ErrorCode.NOT_FOUND, "Link not found"));
    const app = await buildApp();
    const unknown = await app.inject({ method: "GET", url: `/api/v1/public/vip/join/${enc(WELL_FORMED)}` });
    const malformed = await app.inject({ method: "GET", url: "/api/v1/public/vip/join/nope" });
    expect(unknown.statusCode).toBe(404);
    const strip = (body: Record<string, unknown>) => ({ error: body.error, message: body.message });
    expect(strip(unknown.json())).toEqual(strip(malformed.json()));
    await app.close();
  });

  it("rate limits checkout per IP + token", async () => {
    const app = await buildApp();
    const url = `/api/v1/public/vip/join/${enc(WELL_FORMED)}/checkout`;
    for (let i = 0; i < PUBLIC_VIP_JOIN_CHECKOUT_RATE_LIMIT; i += 1) {
      expect((await app.inject({ method: "POST", url, remoteAddress: "203.0.113.7" })).statusCode).toBe(201);
    }
    const limited = await app.inject({ method: "POST", url, remoteAddress: "203.0.113.7" });
    expect(limited.statusCode).toBe(429);
    expect(startPublicVipCheckout).toHaveBeenCalledTimes(PUBLIC_VIP_JOIN_CHECKOUT_RATE_LIMIT);
    // A different IP with the same token, and the same IP with another token, have their own budgets.
    expect((await app.inject({ method: "POST", url, remoteAddress: "203.0.113.8" })).statusCode).toBe(201);
    const other = WELL_FORMED.replace(SIG, "B".repeat(43));
    const otherUrl = `/api/v1/public/vip/join/${enc(other)}/checkout`;
    expect((await app.inject({ method: "POST", url: otherUrl, remoteAddress: "203.0.113.7" })).statusCode).toBe(201);
    await app.close();
  });
});
