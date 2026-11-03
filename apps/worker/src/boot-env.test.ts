import { describe, expect, it } from "vitest";

import { assertWorkerBootEnvironment } from "./boot-env.js";

const core = {
  DATABASE_URL: "postgresql://synthetic:private@localhost:5432/fsm_test",
  REDIS_URL: "redis://:synthetic-private@localhost:6379"
};

describe("worker boot environment", () => {
  it("rejects a missing APP_URL before schedules can register without disclosing credentials", () => {
    expect(() => assertWorkerBootEnvironment(core)).toThrow("APP_URL");
    try {
      assertWorkerBootEnvironment(core);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain(core.DATABASE_URL);
      expect(message).not.toContain(core.REDIS_URL);
    }
  });

  it("accepts the required core and app URL without unrelated provider keys", () => {
    expect(() => assertWorkerBootEnvironment({ ...core, APP_URL: "https://staging.example.test" })).not.toThrow();
  });
});
