import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Never send real email from tests, even if RESEND_API_KEY is set in the shell.
    env: { RESEND_API_KEY: "" },
    hookTimeout: 30000,
    testTimeout: 30000
  }
});
