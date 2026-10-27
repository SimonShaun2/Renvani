import { describe, expect, it } from "vitest";

import { AGENT_EVAL_SCENARIO_FIXTURES } from "./scenarios.fixture.js";
import { replayAllAgentEvalScenarios, replayAgentEvalScenario } from "./replay-scenario.js";

describe("FS-16 agent evaluation harness", () => {
  it("ships five replayable scenario fixtures", () => {
    expect(AGENT_EVAL_SCENARIO_FIXTURES.map((s) => s.id)).toEqual([
      "intent",
      "quote",
      "handoff",
      "policy_deny",
      "failure_recovery"
    ]);
  });

  it("replays every fixture without failures (deterministic smoke)", () => {
    const results = replayAllAgentEvalScenarios(AGENT_EVAL_SCENARIO_FIXTURES);
    const failed = results.filter((r) => !r.passed);
    if (failed.length > 0) {
      const detail = failed
        .map((r) => `${r.scenarioId}: ${r.failures.join("; ")}`)
        .join("\n");
      expect.fail(`agent eval harness failures:\n${detail}`);
    }
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it("records red-case expectations for policy deny scenario", () => {
    const deny = AGENT_EVAL_SCENARIO_FIXTURES.find((s) => s.id === "policy_deny");
    expect(deny).toBeDefined();
    const result = replayAgentEvalScenario(deny!);
    expect(result.passed).toBe(true);
  });
});
