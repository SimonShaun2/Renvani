// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ trade: null as string | null, mutate: vi.fn() }));
vi.mock("@/src/hooks/company-trade.hooks", () => ({
  useCompanyTrade: () => ({ data: { trade: { trade: m.trade, label: null, schemaType: null } } }),
  useUpdateCompanyTrade: () => ({ mutateAsync: m.mutate })
}));

import { resolveSiteTradeFromSettings } from "@/src/components/growth/site-trade.from-settings";

import { TradePicker } from "./TradePicker";
import { buildTradePayload, validateTradeSelection } from "./trade-picker.utils";

const status = () => screen.getByTestId("trade-picker").getAttribute("data-status");
const save = () => screen.getByTestId("trade-save") as HTMLButtonElement;
const radio = (name: RegExp) => screen.getByRole("radio", { name });

beforeEach(() => {
  m.trade = "hvac";
  m.mutate.mockReset();
});
afterEach(() => cleanup());

describe("TradePicker (309:3333)", () => {
  it("default (309:3334): saved trade preselected, Save disabled", () => {
    render(<TradePicker companyName="Summit Heating & Air" />);
    expect(status()).toBe("default");
    expect(radio(/HVAC/).getAttribute("aria-checked")).toBe("true");
    expect(save().disabled).toBe(true);
  });

  it("selected (309:3365) → saving (309:3396) → saved (309:3465), sends only {trade}", async () => {
    let resolve!: (v: unknown) => void;
    m.mutate.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    render(<TradePicker />);
    fireEvent.click(radio(/Plumbing/));
    expect(status()).toBe("selected");
    expect(save().disabled).toBe(false);
    await act(async () => fireEvent.click(save()));
    expect(status()).toBe("saving");
    expect(save().textContent).toContain("Saving…");
    expect(m.mutate).toHaveBeenCalledWith({ trade: "plumbing" });
    await act(async () => resolve({}));
    expect(status()).toBe("saved");
    expect(screen.getByRole("status").textContent).toBe("✓ Trade saved");
    expect(save().disabled).toBe(true);
  });

  it("error (309:3430): banner with Retry that re-saves", async () => {
    m.mutate.mockRejectedValueOnce(new Error("500")).mockResolvedValueOnce({});
    render(<TradePicker />);
    fireEvent.click(radio(/Electrical/));
    await act(async () => fireEvent.click(save()));
    expect(status()).toBe("error");
    expect(screen.getByRole("alert").textContent).toContain("We couldn't save your trade. Try again.");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Retry" })));
    expect(m.mutate).toHaveBeenCalledTimes(2);
    expect(status()).toBe("saved");
  });

  it("Other empty (309:3499) → error (309:3575) → filled (309:3537); describe text is not sent", async () => {
    m.mutate.mockResolvedValueOnce({});
    render(<TradePicker />);
    fireEvent.click(radio(/Other/));
    const input = screen.getByPlaceholderText("Example: Garage door service") as HTMLInputElement;
    expect(screen.getByText(/Required\. We use this/)).toBeTruthy();
    await act(async () => fireEvent.click(save()));
    expect(screen.getByText("Tell us your trade to continue.")).toBeTruthy();
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(m.mutate).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "Garage door service" } });
    await act(async () => fireEvent.click(save()));
    expect(m.mutate).toHaveBeenCalledWith({ trade: "other" });
  });
});

describe("payload + registry consumer", () => {
  it("validates and builds the strict #318 body", () => {
    expect(validateTradeSelection("other", " ")).toEqual({ describe: true });
    expect(validateTradeSelection("other", "Garage doors")).toEqual({});
    expect(validateTradeSelection("hvac", "")).toEqual({});
    expect(buildTradePayload("other")).toEqual({ trade: "other" });
  });

  it("uses the configured trade over service inference", () => {
    const services = [{ name: "Water heater repair", category: "Plumbing" }];
    expect(resolveSiteTradeFromSettings({ offeredServices: services, trade: "electrical" }).key).toBe("electrical");
    expect(resolveSiteTradeFromSettings({ offeredServices: services, trade: null }).key).toBe("plumbing");
    expect(["other", "default"]).toContain(resolveSiteTradeFromSettings({ offeredServices: services, trade: "other" }).key);
  });
});
