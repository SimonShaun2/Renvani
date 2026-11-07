import type { InsightAnswer } from "./contracts.js";

/** H14 headless UI contract only. No React screen, auth flow or approved Figma parity is claimed. */
export type AnswerUiState = "idle" | "loading" | "complete" | "empty" | "partial" | "unavailable" | "error";
export interface AnswerPresentation { state: AnswerUiState; heading: string; role: "region" | "status" | "alert";
  busy: boolean; action: "ask" | "inspect_sources" | "refresh" | "verify_access" | "retry" | null; actionLabel: string | null;
  focus: "question" | "answer_heading" | "retry_control"; showEvidence: boolean; requiresReportsNavigation: false; }
const CONTRACT: Readonly<Record<AnswerUiState, Omit<AnswerPresentation, "state" | "requiresReportsNavigation">>> = {
  idle: { heading: "Ask about your business", role: "region", busy: false, action: "ask", actionLabel: "Ask", focus: "question", showEvidence: false },
  loading: { heading: "Collecting the permitted evidence", role: "status", busy: true, action: null, actionLabel: null, focus: "question", showEvidence: false },
  complete: { heading: "Answer with supporting evidence", role: "region", busy: false, action: "inspect_sources", actionLabel: "View supporting records", focus: "answer_heading", showEvidence: true },
  empty: { heading: "No matching activity in the verified scope", role: "region", busy: false, action: "inspect_sources", actionLabel: "View scope and definitions", focus: "answer_heading", showEvidence: true },
  partial: { heading: "Some evidence is missing or needs verification", role: "status", busy: false, action: "refresh", actionLabel: "Refresh or review evidence", focus: "answer_heading", showEvidence: true },
  unavailable: { heading: "An answer is not available from the permitted evidence", role: "status", busy: false, action: "verify_access", actionLabel: "Check access or sources", focus: "answer_heading", showEvidence: false },
  error: { heading: "The answer could not be loaded", role: "alert", busy: false, action: "retry", actionLabel: "Retry", focus: "retry_control", showEvidence: false }
};
export function answerPresentation(state: AnswerUiState): AnswerPresentation { return { state, ...CONTRACT[state], requiresReportsNavigation: false }; }
export function presentationForAnswer(answer: InsightAnswer, verifiedEmptyScope: boolean): AnswerPresentation {
  return answerPresentation(answer.state === "complete" && verifiedEmptyScope ? "empty" : answer.state);
}
