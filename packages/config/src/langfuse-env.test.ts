import { describe, expect, it } from "vitest";

import { isLangfuseConfigured, resolveLangfuseEnv } from "./langfuse-env.js";

describe("resolveLangfuseEnv", () => {
  it("is disabled when keys are absent", () => {
    expect(resolveLangfuseEnv({})).toEqual({ enabled: false, reason: "missing_credentials" });
    expect(isLangfuseConfigured({})).toBe(false);
  });

  it("is disabled when only one key is set", () => {
    expect(
      resolveLangfuseEnv({
        LANGFUSE_PUBLIC_KEY: "pk-lf-test"
      })
    ).toEqual({ enabled: false, reason: "invalid_configuration" });
  });

  it("enables when both keys are valid", () => {
    const result = resolveLangfuseEnv({
      LANGFUSE_PUBLIC_KEY: "pk-lf-test",
      LANGFUSE_SECRET_KEY: "sk-lf-test",
      LANGFUSE_BASE_URL: "https://langfuse.example.com"
    });

    expect(result.enabled).toBe(true);
    if (result.enabled) {
      expect(result.config.LANGFUSE_BASE_URL).toBe("https://langfuse.example.com");
    }
    expect(
      isLangfuseConfigured({
        LANGFUSE_PUBLIC_KEY: "pk-lf-test",
        LANGFUSE_SECRET_KEY: "sk-lf-test"
      })
    ).toBe(true);
  });

  it("rejects invalid base URL when keys are present", () => {
    expect(
      resolveLangfuseEnv({
        LANGFUSE_PUBLIC_KEY: "pk-lf-test",
        LANGFUSE_SECRET_KEY: "sk-lf-test",
        LANGFUSE_BASE_URL: "not-a-url"
      })
    ).toEqual({ enabled: false, reason: "invalid_configuration" });
  });
});
