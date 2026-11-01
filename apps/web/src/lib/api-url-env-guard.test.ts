import { describe, expect, it } from "vitest";

import { checkApiUrlEnv } from "./api-url-env-guard";

describe("checkApiUrlEnv", () => {
  it("fails a Vercel production build without NEXT_PUBLIC_API_URL, naming the var", () => {
    const result = checkApiUrlEnv({ VERCEL_ENV: "production" });
    expect(result.level).toBe("error");
    expect(result.level !== "ok" && result.message).toContain("NEXT_PUBLIC_API_URL");
  });

  it("fails a Vercel preview build without NEXT_PUBLIC_API_URL", () => {
    const result = checkApiUrlEnv({ VERCEL_ENV: "preview" });
    expect(result.level).toBe("error");
    expect(result.level !== "ok" && result.message).toContain("NEXT_PUBLIC_API_URL");
  });

  it("passes a Vercel preview build when NEXT_PUBLIC_API_URL is set", () => {
    expect(checkApiUrlEnv({ VERCEL_ENV: "preview", NEXT_PUBLIC_API_URL: "https://api-pr.example.com" }).level).toBe("ok");
  });

  it("still fails preview with only API_URL or a blank value", () => {
    expect(checkApiUrlEnv({ VERCEL_ENV: "preview", API_URL: "https://api.example.com" }).level).toBe("error");
    expect(checkApiUrlEnv({ VERCEL_ENV: "preview", NEXT_PUBLIC_API_URL: " " }).level).toBe("error");
  });

  it("passes when NEXT_PUBLIC_API_URL is set", () => {
    expect(checkApiUrlEnv({ VERCEL_ENV: "production", NEXT_PUBLIC_API_URL: "https://api.example.com" }).level).toBe("ok");
  });

  it("still fails with only server-side API_URL (client fetches need NEXT_PUBLIC_API_URL)", () => {
    expect(checkApiUrlEnv({ VERCEL_ENV: "production", API_URL: "https://api.example.com" }).level).toBe("error");
  });

  it("treats a blank value as unset", () => {
    expect(checkApiUrlEnv({ VERCEL_ENV: "production", NEXT_PUBLIC_API_URL: "  " }).level).toBe("error");
  });

  it("never blocks local dev, tests or CI (no VERCEL_ENV), even with NODE_ENV=production", () => {
    expect(checkApiUrlEnv({ NODE_ENV: "production" }).level).toBe("ok");
    expect(checkApiUrlEnv({ VERCEL_ENV: "development" }).level).toBe("ok");
  });

  it("SKIP_ENV_GUARD=1 bypasses the guard", () => {
    expect(checkApiUrlEnv({ VERCEL_ENV: "production", SKIP_ENV_GUARD: "1" }).level).toBe("ok");
    expect(checkApiUrlEnv({ VERCEL_ENV: "preview", SKIP_ENV_GUARD: "1" }).level).toBe("ok");
  });
});
