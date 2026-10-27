import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ role: "owner" as string }));
const apiGet = vi.fn();
const apiPost = vi.fn();

vi.mock("@/src/stores/auth.store", () => ({
  useAuthStore: (sel: (s: { user: { role: string } }) => unknown) => sel({ user: { role: state.role } })
}));
vi.mock("@/src/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/src/lib/api")>("@/src/lib/api");
  return {
    ...actual,
    api: { get: (p: string) => apiGet(p), post: (p: string, b: unknown) => apiPost(p, b) }
  };
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { buildLevelsPath } from "@/src/hooks/inventory.hooks";
import { ApiError } from "@/src/lib/api";
import { canRoleAccessPath } from "@/src/lib/route-access";

import { AdjustPanel, InventoryClient, StockLevelsPanel, TransferPanel, inventoryErrorMessage } from "./InventoryClient";

const L1 = "11111111-1111-4111-8111-111111111111";
const L2 = "22222222-2222-4222-8222-222222222222";
const P1 = "33333333-3333-4333-8333-333333333333";

const loc = (id: string, name: string, kind = "warehouse") => ({
  id, name, kind, technicianId: null, isActive: true, createdAt: "", updatedAt: "", recordVersion: "v"
});
const level = (over: Record<string, unknown> = {}) => ({
  id: "lv1", locationId: L1, productId: P1, quantity: 3, lowStockThreshold: 5, isLowStock: true,
  updatedAt: "", recordVersion: "v", ...over
});

function routeGet(levels: unknown[] = [level()]) {
  apiGet.mockImplementation(async (p: string) => {
    if (p.startsWith("/api/v1/inventory/locations")) return { locations: [loc(L1, "Main shop"), loc(L2, "Van 2", "van")] };
    if (p.startsWith("/api/v1/inventory/levels") || p.startsWith("/api/v1/inventory/low-stock")) return { levels };
    if (p.startsWith("/api/v1/products")) return { data: [{ id: P1, name: "Capacitor 45/5" }] };
    throw new Error(`unexpected ${p}`);
  });
}

function wrap(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

beforeEach(() => {
  state.role = "owner";
  apiGet.mockReset();
  apiPost.mockReset();
});
afterEach(() => cleanup());

describe("inventory helpers", () => {
  it("builds levels and low-stock paths", () => {
    expect(buildLevelsPath(null, false)).toBe("/api/v1/inventory/levels");
    expect(buildLevelsPath(L1, true)).toBe(`/api/v1/inventory/low-stock?locationId=${L1}`);
  });

  it("maps 409 reasons to plain messages", () => {
    const err = (reason: string) => new ApiError(409, { error: "CONFLICT", reason, message: "x" } as never);
    expect(inventoryErrorMessage(err("insufficient_stock"))).toMatch(/Not enough stock/);
    expect(inventoryErrorMessage(err("stale_record_version"))).toMatch(/changed since you loaded/);
  });

  it("gates /inventory to owner, admin, dispatcher, office (matches FS-170 manage roles)", () => {
    for (const r of ["owner", "admin", "dispatcher", "office"] as const) expect(canRoleAccessPath(r, "/inventory")).toBe(true);
    expect(canRoleAccessPath("technician", "/inventory")).toBe(false);
  });
});

describe("InventoryClient", () => {
  it("shows stock with product names and a Low badge for owners", async () => {
    routeGet();
    wrap(<InventoryClient />);
    expect(await screen.findByText("Capacitor 45/5")).toBeTruthy();
    expect(screen.getByText("Low")).toBeTruthy();
    expect(screen.getAllByText("Main shop").length).toBeGreaterThan(0);
  });

  it("shows a retryable error when locations fail to load", async () => {
    apiGet.mockRejectedValue(new Error("down"));
    wrap(<InventoryClient />);
    expect(await screen.findByText("Couldn't load stock locations")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("low-stock tab calls the low-stock route and shows an empty state", async () => {
    routeGet([]);
    wrap(<StockLevelsPanel lowStock />);
    expect(await screen.findByText("Nothing is low on stock")).toBeTruthy();
    expect(apiGet).toHaveBeenCalledWith("/api/v1/inventory/low-stock");
  });

  it("dispatcher never calls the owner/admin-only products route", async () => {
    state.role = "dispatcher";
    routeGet();
    wrap(<StockLevelsPanel lowStock={false} />);
    expect(await screen.findByText(`Item ${P1.slice(0, 8)}`)).toBeTruthy();
    expect(apiGet.mock.calls.some(([p]) => String(p).startsWith("/api/v1/products"))).toBe(false);
  });
});

describe("AdjustPanel / TransferPanel", () => {
  it("posts a signed adjustment and surfaces insufficient stock", async () => {
    routeGet();
    apiPost.mockRejectedValueOnce(new ApiError(409, { error: "CONFLICT", reason: "insufficient_stock", message: "x" } as never));
    wrap(<AdjustPanel />);
    await screen.findByRole("option", { name: "Capacitor 45/5" });
    fireEvent.change(screen.getByLabelText("Location"), { target: { value: L1 } });
    fireEvent.change(screen.getByLabelText("Item"), { target: { value: P1 } });
    fireEvent.change(screen.getByLabelText(/Change/), { target: { value: "-4" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Damaged" } });
    fireEvent.click(screen.getByRole("button", { name: "Save adjustment" }));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith("/api/v1/inventory/adjustments", {
        locationId: L1, productId: P1, quantityDelta: -4, reason: "Damaged"
      })
    );
    expect((await screen.findByRole("alert")).textContent).toMatch(/Not enough stock/);
  });

  it("blocks a transfer to the same location and posts a valid one", async () => {
    routeGet();
    apiPost.mockResolvedValue({ levels: [], movements: [] });
    wrap(<TransferPanel />);
    await screen.findByRole("option", { name: "Capacitor 45/5" });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: L1 } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: L1 } });
    fireEvent.change(screen.getByLabelText("Item"), { target: { value: P1 } });
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "2" } });
    expect(screen.getByText("Pick two different locations.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save transfer" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("To"), { target: { value: L2 } });
    fireEvent.click(screen.getByRole("button", { name: "Save transfer" }));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith("/api/v1/inventory/transfers", {
        fromLocationId: L1, toLocationId: L2, productId: P1, quantity: 2
      })
    );
    expect(await screen.findByText("Transfer saved.")).toBeTruthy();
  });
});
