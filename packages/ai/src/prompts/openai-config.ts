import { env } from "@fsm/config";

export class OpenAiNotConfiguredError extends Error {
  constructor() {
    super("OPENAI_NOT_CONFIGURED: OPENAI_API_KEY is unset; AI features are disabled");
    this.name = "OpenAiNotConfiguredError";
  }
}

/** Fail fast before any network call when the optional OpenAI key is absent. Callers already fall back on errors. */
export function assertOpenAiConfigured(): void {
  if (!(env.OPENAI_API_KEY ?? "").trim()) {
    throw new OpenAiNotConfiguredError();
  }
}
