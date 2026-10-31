// @vitest-environment happy-dom
import { ErrorCode } from "@fsm/types";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/src/lib/api";

const m = vi.hoisted(() => ({
  role: "dispatcher" as string | null,
  data: null as unknown,
  refetch: vi.fn(),
  update: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
  send: vi.fn()
}));

vi.mock("@/src/stores/auth.store", () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: m.role ? { role: m.role } : null }) }));
vi.mock("@/src/hooks/estimate-option-sets.hooks", () => ({
  useEstimateOptionSet: (_id: string, enabled: boolean) => ({ data: enabled ? m.data : undefined, isLoading: false, isError: false, refetch: m.refetch }),
  useUpdateOptionSet: () => ({ mutateAsync: m.update, isPending: false }),
  useAddEstimateOption: () => ({ mutateAsync: m.add, isPending: false }),
  useRemoveEstimateOption: () => ({ mutateAsync: m.remove, isPending: false }),
  useSendOptionSet: () => ({ mutateAsync: m.send, isPending: false })
}));

import { EstimateOptionSetClient } from "./EstimateOptionSetClient";

const option = (id: string, tierLabel: string, rank: number, extra: Record<string, unknown> = {}) => ({
  estimateId: id,
  estimateNumber: `EST-${id}`,
  tierLabel,
  rank,
  recommended: false,
  title: null,
  status: "draft",
  isSelectedTier: false,
  subtotal: "100.00",
  taxRate: null,
  taxAmount: null,
  discountAmount: null,
  total: "100.00",
  items: [{ id: `${id}-i`, name: `${tierLabel} repair`, quantity: "1" }],
  ...extra
});
const set = (status = "draft", options = [option("b", "Better", 2, { recommended: true }), option("a", "Good", 1)]) => ({
  optionSet: { tierGroupId: "g1", title: "No-heat repair", status, version: 5, options, financingOffered: false, financing: { offered: false, provider: "disabled", providerReady: false, monthlyFrom: null } }
});
const conflict = (reason: string) => new ApiError(409, { error: ErrorCode.CONFLICT, message: "x", fields: { reason } } as never);
const mount = () => render(<EstimateOptionSetClient tierGroupId="g1" />);

beforeEach(() => {
  m.role = "dispatcher";
  m.data = set();
  for (const f of [m.refetch, m.update, m.add, m.remove, m.send]) f.mockReset();
});
afterEach(() => cleanup());

describe("EstimateOptionSetClient", () => {
  it("blocks roles the API rejects (office) without fetching", () => {
    m.role = "office";
    mount();
    expect(screen.getByTestId("option-set-no-access")).toBeTruthy();
  });

  it("shows options Good → Better with the recommended badge and no financing UI", () => {
    mount();
    const text = screen.getByTestId("option-set-options").textContent ?? "";
    expect(text.indexOf("Good")).toBeLessThan(text.indexOf("Better"));
    expect(screen.getAllByText("Recommended")).toHaveLength(1);
    expect(screen.queryByText(/financ/i)).toBeNull();
    // 2 options = minimum: no Remove
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  });

  it("mark recommended PATCHes with the loaded version and a fresh key", async () => {
    m.update.mockResolvedValue(set());
    mount();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Mark recommended" })));
    const arg = m.update.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg).toMatchObject({ expectedVersion: 5, recommendedEstimateId: "a" });
    expect(String(arg.idempotencyKey).length).toBeGreaterThanOrEqual(8);
  });

  it("stale_version shows Reload which refetches", async () => {
    m.send.mockRejectedValue(conflict("stale_version"));
    mount();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send options" })));
    expect(screen.getByTestId("option-set-error").textContent).toMatch(/someone else changed/i);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Reload" })));
    expect(m.refetch).toHaveBeenCalled();
  });

  it("option_minimum shows the limit with no Reload", async () => {
    m.data = set("draft", [option("a", "Good", 1), option("b", "Better", 2), option("c", "Best", 3)]);
    m.remove.mockRejectedValue(conflict("option_minimum"));
    mount();
    expect(screen.getByTestId("option-set-at-limit")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]!));
    expect(m.remove.mock.calls[0]![0]).toMatchObject({ estimateId: "a", expectedVersion: 5 });
    expect(screen.getByTestId("option-set-error").textContent).toMatch(/at least 2/);
    expect(screen.queryByRole("button", { name: "Reload" })).toBeNull();
  });

  it("adds an option with the suggested Best label", async () => {
    m.add.mockResolvedValue(set());
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Add option" }));
    const form = screen.getByTestId("add-option-form");
    const inputs = form.querySelectorAll("input");
    expect((inputs[0] as HTMLInputElement).value).toBe("Best");
    fireEvent.change(inputs[2]!, { target: { value: "Full system replacement" } });
    fireEvent.change(inputs[4]!, { target: { value: "4200" } });
    await act(async () => fireEvent.submit(form));
    expect(m.add.mock.calls[0]![0]).toMatchObject({
      expectedVersion: 5,
      option: { tierLabel: "Best", items: [{ name: "Full system replacement", quantity: 1, unitPrice: 4200 }] }
    });
  });

  it("a sent set is locked: no edit controls", () => {
    m.data = set("sent");
    mount();
    expect(screen.getByTestId("option-set-locked")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Send options" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mark recommended" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add option" })).toBeNull();
  });
});
