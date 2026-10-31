import { createHmac } from "node:crypto";

import type { FastifyReply, FastifyRequest } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetEnvCacheForTests } from "@fsm/config";

import { setupTestEnv } from "../test-support/env-setup.js";
import { twilioVerify } from "./twilio-verify.js";

function reply() {
  const r = {
    statusCode: null as number | null,
    payload: null as unknown,
    code(c: number) {
      r.statusCode = c;
      return r;
    },
    send(p: unknown) {
      r.payload = p;
      return r;
    }
  };
  return r;
}

function request(signature: string | undefined, body = "From=%2B15550001111&To=%2B15555555555"): FastifyRequest {
  return {
    headers: { host: "hooks.example.test", ...(signature ? { "x-twilio-signature": signature } : {}) },
    protocol: "https",
    url: "/twilio",
    body: Buffer.from(body)
  } as unknown as FastifyRequest;
}

function sign(token: string): string {
  // Twilio: URL + sorted key/value pairs concatenated.
  const payload = "https://hooks.example.test/twilio" + "From+15550001111" + "To+15555555555";
  return createHmac("sha1", token).update(payload).digest("base64");
}

beforeEach(() => {
  setupTestEnv();
  resetEnvCacheForTests();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("twilioVerify with optional Twilio", () => {
  it("returns 503 TWILIO_NOT_CONFIGURED when Twilio is unset, even with an empty-key signature", async () => {
    for (const name of ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"]) {
      vi.stubEnv(name, "");
    }
    resetEnvCacheForTests();
    const r = reply();

    await twilioVerify(request(sign("")), r as unknown as FastifyReply);

    expect(r.statusCode).toBe(503);
    expect(r.payload).toEqual({ error: "TWILIO_NOT_CONFIGURED", message: "Twilio webhooks are disabled" });
  });

  it("accepts a valid signature and rejects a bad one when configured", async () => {
    const ok = reply();
    const req = request(sign("twilio_token"));
    await twilioVerify(req, ok as unknown as FastifyReply);
    expect(ok.statusCode).toBeNull();
    expect((req as unknown as { twilioParams?: unknown }).twilioParams).toBeDefined();

    const bad = reply();
    await twilioVerify(request(sign("wrong")), bad as unknown as FastifyReply);
    expect(bad.statusCode).toBe(403);
  });
});
