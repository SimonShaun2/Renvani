import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.mock("@fsm/config/runtime-env", () => ({
  aiEnv: {
    OPENAI_API_KEY: "openai_test_key"
  }
}));

describe("campaign-prompts", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("generateCampaignMessage returns a string under 160 characters", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      async json() {
        return {
          model: "gpt-4o-mini",
          output_text:
            "\"Hi Chris, it’s been a while since your last service. Acme HVAC can help you book a spring tune-up whenever you're ready.\"",
          usage: {
            input_tokens: 48,
            output_tokens: 22,
            total_tokens: 70
          }
        };
      }
    });

    const module = await import("./campaign-prompts.js");
    const message = await module.generateCampaignMessage({
      customerFirstName: "Chris",
      recommendationType: "reactivation",
      companyName: "Acme HVAC",
      daysSinceLastService: 190,
      season: "spring"
    });

    expect(message.length).toBeLessThanOrEqual(160);
    expect(message).not.toContain("\"");
  });

  it("generateCampaignMessage throws when OpenAI returns an error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      async json() {
        return {
          error: {
            message: "OpenAI unavailable"
          }
        };
      }
    });

    const module = await import("./campaign-prompts.js");

    await expect(
      module.generateCampaignMessage({
        customerFirstName: "Chris",
        recommendationType: "estimate_follow_up",
        companyName: "Acme HVAC",
        estimateNumber: "EST-1001",
        estimateTotal: "425.00"
      })
    ).rejects.toThrow("OpenAI unavailable");
  });
});
