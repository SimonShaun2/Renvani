import { describe, expect, it } from "vitest";
import { answerPresentation, presentationForAnswer, type AnswerUiState } from "./presentation.js";
import { factualFallback } from "./claims.js";
import { assessEvidence } from "./quality.js";
import { NOW, packetFixture } from "../../../test-fixtures/connected-intelligence.js";

describe("RCI H14 headless state/accessibility contracts (not browser acceptance)", () => {
  it.each<AnswerUiState>(["idle", "loading", "complete", "empty", "partial", "unavailable", "error"])("defines accessible %s without a Reports detour", (state) => { const view = answerPresentation(state); expect(view.heading.length).toBeGreaterThan(0); expect(view.requiresReportsNavigation).toBe(false); expect(view.actionLabel === null).toBe(view.action === null); });
  it("loading is busy and cannot approve or execute", () => { const view = answerPresentation("loading"); expect(view.busy).toBe(true); expect(view.role).toBe("status"); expect(view.action).toBeNull(); });
  it("keeps errors, denied availability and verified emptiness distinct", () => { expect(answerPresentation("error").role).toBe("alert"); expect(answerPresentation("unavailable").showEvidence).toBe(false); expect(answerPresentation("empty").showEvidence).toBe(true); });
  it("only a complete scope can produce the verified-empty screen", () => { const p = packetFixture(); const answer = factualFallback(assessEvidence(p, p.scope, NOW, { jobs: 60000 })); expect(presentationForAnswer(answer, true).state).toBe("empty"); expect(presentationForAnswer({ ...answer, state: "partial" }, true).state).toBe("partial"); });
});
