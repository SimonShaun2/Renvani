import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.mock("@fsm/config/runtime-env", () => ({
  aiEnv: {
    OPENAI_API_KEY: "openai_test_key"
  }
}));

describe("import-prompts", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("mapCsvColumns returns the parsed mapping object", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      async json() {
        return {
          model: "gpt-4o-mini",
          output_text: "{\"First Name\":\"firstName\",\"Email Address\":\"email\"}",
          usage: {
            input_tokens: 50,
            output_tokens: 25,
            total_tokens: 75
          }
        };
      }
    });

    const module = await import("./import-prompts.js");
    const mapping = await module.mapCsvColumns(
      ["First Name", "Email Address"],
      [{ "First Name": "Chris", "Email Address": "chris@example.com" }],
      "customers"
    );

    expect(mapping).toEqual({
      "First Name": "firstName",
      "Email Address": "email"
    });
  });

  it("mapCsvColumns returns an empty mapping when JSON parsing fails", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      async json() {
        return {
          model: "gpt-4o-mini",
          output_text: "not valid json"
        };
      }
    });

    const module = await import("./import-prompts.js");
    const mapping = await module.mapCsvColumns(
      ["First Name", "Email Address"],
      [{ "First Name": "Chris", "Email Address": "chris@example.com" }],
      "customers"
    );

    expect(mapping).toEqual({
      "First Name": null,
      "Email Address": null
    });
  });
});
