import { afterEach, describe, expect, it, vi } from "vitest";

const envState = vi.hoisted(() => ({ OPENAI_API_KEY: "" }));

vi.mock("@fsm/config", () => ({ env: envState }));

import { mapCsvColumns } from "./import-prompts.js";
import { assertOpenAiConfigured, OpenAiNotConfiguredError } from "./openai-config.js";

afterEach(() => {
  vi.unstubAllGlobals();
  envState.OPENAI_API_KEY = "";
});

describe("optional OpenAI", () => {
  it("fails fast with OPENAI_NOT_CONFIGURED and makes no network call when the key is unset", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(() => assertOpenAiConfigured()).toThrow(OpenAiNotConfiguredError);
    await expect(mapCsvColumns(["Name"], [{ Name: "Ava" }], "customers")).rejects.toThrow(/OPENAI_NOT_CONFIGURED/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes when the key is set", () => {
    envState.OPENAI_API_KEY = "openai_dummy";
    expect(() => assertOpenAiConfigured()).not.toThrow();
  });
});
