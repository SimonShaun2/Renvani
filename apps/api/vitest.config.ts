import { configDefaults, defineConfig } from "vitest/config";

/** Ticket A: intentionally failing gap tests run only via `test:trusted-execution-gaps`. */
export const TRUSTED_EXECUTION_GAPS_GLOB = "src/**/trusted-execution-gaps.test.ts";

export default defineConfig({
  test: {
    environment: "node",
    // Never send real email from tests, even if RESEND_API_KEY is set in the shell.
    env: { RESEND_API_KEY: "" },
    exclude: [...configDefaults.exclude, TRUSTED_EXECUTION_GAPS_GLOB],
    hookTimeout: 30000,
    testTimeout: 30000
  }
});
