import { ErrorCode } from "@fsm/types";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { publicApi, resolvePublicApiBase } from "@/src/lib/public-api";
import { resolvePublicApiServerBase } from "@/src/lib/public-api-server";

describe("resolvePublicApiBase", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns empty string in the browser for same-origin rewrite", () => {
    vi.stubGlobal("window", {} as Window);

    expect(resolvePublicApiBase()).toBe("");
  });

  it("keeps client-reachable API calls same-origin even during server rendering", () => {
    vi.stubGlobal("window", undefined);
    vi.stubEnv("API_URL", "http://api.internal:3001/");

    expect(resolvePublicApiBase()).toBe("");
    expect(resolvePublicApiServerBase()).toBe("http://api.internal:3001");
  });
});

describe("publicApi path security", () => {
  it("rejects traversal segments before fetch", async () => {
    await expect(publicApi.get("/api/v1/public/booking/../secrets")).rejects.toMatchObject({
      status: 400,
      payload: { error: ErrorCode.VALIDATION_ERROR }
    });
  });

  it("rejects double-encoded traversal before fetch", async () => {
    await expect(publicApi.get("/api/v1/public/booking/%252e%252e/secrets")).rejects.toMatchObject({
      status: 400,
      payload: { error: ErrorCode.VALIDATION_ERROR }
    });
  });
});
