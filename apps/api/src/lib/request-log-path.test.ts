import { describe, expect, it } from "vitest";

import { redactAccessTokenInUrl, requestPathForLog } from "./request-log-path.js";

describe("request-log-path", () => {
  it("requestPathForLog strips query string including access_token", () => {
    expect(
      requestPathForLog("/api/v1/dispatch/stream?date=2026-10-22&access_token=eyJhbGciOiJIUzI1NiJ9.secret")
    ).toBe("/api/v1/dispatch/stream");
  });

  it("requestPathForLog leaves path-only URLs unchanged", () => {
    expect(requestPathForLog("/api/v1/dispatch?date=2026-10-15")).toBe("/api/v1/dispatch");
  });

  it("redactAccessTokenInUrl preserves other query params", () => {
    expect(
      redactAccessTokenInUrl("/api/v1/dispatch/stream?date=2026-10-22&access_token=secret-jwt")
    ).toBe("/api/v1/dispatch/stream?date=2026-10-22&access_token=%5BREDACTED%5D");
  });

  it("redacts booking manage token path segments", () => {
    expect(redactAccessTokenInUrl("/api/v1/public/booking/manage/eyJ.abc.def/cancel?x=1")).toBe(
      "/api/v1/public/booking/manage/[REDACTED]/cancel?x=1"
    );
    expect(redactAccessTokenInUrl("/api/v1/public/booking/manage/eyJ.abc.def")).toBe(
      "/api/v1/public/booking/manage/[REDACTED]"
    );
  });
});
