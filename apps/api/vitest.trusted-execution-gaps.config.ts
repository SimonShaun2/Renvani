import { defineConfig, mergeConfig } from "vitest/config";

import base, { TRUSTED_EXECUTION_GAPS_GLOB } from "./vitest.config.js";

/** Runs ONLY the Ticket A trusted-execution gap tests (expected to fail until the gaps are fixed). */
export default mergeConfig(
  { ...base, test: { ...base.test, exclude: [] } },
  defineConfig({ test: { include: [TRUSTED_EXECUTION_GAPS_GLOB] } })
);
