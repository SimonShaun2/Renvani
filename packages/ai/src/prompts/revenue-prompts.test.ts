import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.mock("@fsm/config/runtime-env", () => ({
  aiEnv: {
    OPENAI_API_KEY: "openai_test_key"
  }
}));

describe("revenue-prompts", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("generateAgingAssetMessage returns a string under 160 characters", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      async json() {
        return {
          model: "gpt-4o-mini",
          output_text:
            "\"Hi Chris, your 12-year-old AC may be nearing replacement age. Reply if you'd like Acme HVAC to inspect it or quote a replacement.\"",
          usage: {
            input_tokens: 42,
            output_tokens: 24,
            total_tokens: 66
          }
        };
      }
    });

    const module = await import("./revenue-prompts.js");
    const message = await module.generateAgingAssetMessage({
      customerFirstName: "Chris",
      assetType: "AC",
      assetAge: 12,
      brand: "Carrier",
      companyName: "Acme HVAC"
    });

    expect(message.length).toBeLessThanOrEqual(160);
    expect(message).not.toContain("\"");
  });

  it("generateEstimateFollowUpMessage truncates oversized output at a word boundary", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      async json() {
        return {
          model: "gpt-4o-mini",
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text:
                    "Hi Chris, just checking in on estimate EST-1001 for $325.00. We can answer questions, adjust scope, and help you book the work when you're ready to move forward this week with Acme HVAC."
                }
              ]
            }
          ],
          usage: {
            input_tokens: 51,
            output_tokens: 38,
            total_tokens: 89
          }
        };
      }
    });

    const module = await import("./revenue-prompts.js");
    const message = await module.generateEstimateFollowUpMessage({
      customerFirstName: "Chris",
      estimateNumber: "EST-1001",
      estimateTotal: "325.00",
      companyName: "Acme HVAC"
    });

    expect(message.length).toBeLessThanOrEqual(160);
    expect(message.endsWith("...")).toBe(true);
  });

  it("generateInvoiceRecoveryMessage throws when OpenAI returns an error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      async json() {
        return {
          error: {
            message: "Upstream failure"
          }
        };
      }
    });

    const module = await import("./revenue-prompts.js");

    await expect(
      module.generateInvoiceRecoveryMessage({
        customerFirstName: "Chris",
        invoiceNumber: "INV-1001",
        balanceDue: "125.00",
        daysOverdue: 12,
        paymentLinkUrl: "https://example.com/pay",
        companyName: "Acme HVAC"
      })
    ).rejects.toThrow("Upstream failure");
  });

  it("generateReactivationMessage returns a short message", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      async json() {
        return {
          output_text:
            "Hi Chris, it’s been 180 days since your last visit. Acme HVAC can help with a seasonal tune-up whenever you’re ready to book.",
          usage: {
            input_tokens: 40,
            output_tokens: 22,
            total_tokens: 62
          }
        };
      }
    });

    const module = await import("./revenue-prompts.js");
    const message = await module.generateReactivationMessage({
      customerFirstName: "Chris",
      daysSinceLastService: 180,
      companyName: "Acme HVAC",
      serviceType: "tune-up"
    });

    expect(message.length).toBeLessThanOrEqual(160);
  });
});
