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

import { AdjustPanel, InventoryClient, StockLevelsPanel, TransferPanel, inventoryErrorMessage, partLabel } from "./InventoryClient";

const L1 = "11111111-1111-4111-8111-111111111111";
const L2 = "22222222-2222-4222-8222-222222222222";
const P1 = "33333333-3333-4333-8333-333333333333";

const loc = (id: string, name: string, kind = "warehouse") => ({
  id,
  name,
  kind,
  technicianId: null,
  isActive: true,
  createdAt: "",
  updatedAt: "",
  recordVersion: "v"
});
const level = (over: Record<string, unknown> = {}) => ({
  id: "lv1",
  locationId: L1,
  productId: P1,
  productName: "Capacitor 45/5",
  productSku: "CAP-455",
  quantity: 3,
  lowStockThreshold: 5,
  isLowStock: true,
  updatedAt: "",
  recordVersion: "v",
  ...over
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

  it("opens /inventory to every staff role (technicians get the read-only view)", () => {
    for (const r of ["owner", "admin", "dispatcher", "office", "technician"] as const)
      expect(canRoleAccessPath(r, "/inventory")).toBe(true);
  });

  it("labels parts with name and SKU, falling back when the product is missing", () => {
    expect(partLabel({ productId: P1, productName: "Capacitor 45/5", productSku: "CAP-455" })).toBe("Capacitor 45/5 · CAP-455");
    expect(partLabel({ productId: P1, productName: "PEX elbow", productSku: null })).toBe("PEX elbow");
    expect(partLabel({ productId: P1, productName: null, productSku: null })).toBe(`Unknown part ${P1.slice(0, 8)}`);
  });
});

describe("InventoryClient", () => {
  it("shows stock with product names and a Low badge for owners", async () => {
    routeGet();
    wrap(<InventoryClient />);
    expect(await screen.findByText("Capacitor 45/5 · CAP-455")).toBeTruthy();
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
    expect(await screen.findByText("No parts running low")).toBeTruthy();
    expect(apiGet).toHaveBeenCalledWith("/api/v1/inventory/low-stock");
  });

  it("shows a skeleton while loading", () => {
    apiGet.mockImplementation(() => new Promise(() => {}));
    const { container } = wrap(<InventoryClient />);
    expect(container.querySelector(".animate-pulse, [data-skeleton], [aria-busy='true']")).toBeTruthy();
  });

  it("retries stock levels after an error", async () => {
    let fail = true;
    apiGet.mockImplementation(async (p: string) => {
      if (p.startsWith("/api/v1/inventory/locations")) return { locations: [loc(L1, "Main shop")] };
      if (fail) throw new Error("down");
      return { levels: [level()] };
    });
    wrap(<StockLevelsPanel lowStock={false} />);
    expect(await screen.findByText("Couldn't load stock levels")).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Capacitor 45/5 · CAP-455")).toBeTruthy();
  });

  it("technician sees a read-only view: no Adjust/Transfer tabs, no add-location form", async () => {
    state.role = "technician";
    routeGet();
    wrap(<InventoryClient />);
    expect(await screen.findByText("Capacitor 45/5 · CAP-455")).toBeTruthy();
    expect(screen.getByTestId("inventory-read-only")).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Adjust" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Transfer" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Warehouse & trucks" }));
    expect(await screen.findByText("Van 2")).toBeTruthy();
    expect(screen.queryByRole("form", { name: "Add location" })).toBeNull();
    expect(screen.getByText("Truck")).toBeTruthy();
  });

  it("dispatcher sees part names from the inventory response and never calls the owner/admin-only products route", async () => {
    state.role = "dispatcher";
    routeGet();
    wrap(<StockLevelsPanel lowStock={false} />);
    expect(await screen.findByText("Capacitor 45/5 · CAP-455")).toBeTruthy();
    expect(apiGet.mock.calls.some(([p]) => String(p).startsWith("/api/v1/products"))).toBe(false);
  });
});

describe("AdjustPanel / TransferPanel", () => {
  it("posts a signed adjustment and surfaces insufficient stock", async () => {
    routeGet();
    apiPost.mockRejectedValueOnce(new ApiError(409, { error: "CONFLICT", reason: "insufficient_stock", message: "x" } as never));
    wrap(<AdjustPanel />);
    await screen.findByRole("option", { name: "Capacitor 45/5 · CAP-455" });
    fireEvent.change(screen.getByLabelText("Location"), { target: { value: L1 } });
    fireEvent.change(screen.getByLabelText("Part"), { target: { value: P1 } });
    fireEvent.change(screen.getByLabelText(/Change/), { target: { value: "-4" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Damaged" } });
    fireEvent.click(screen.getByRole("button", { name: "Save adjustment" }));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith("/api/v1/inventory/adjustments", {
        locationId: L1,
        productId: P1,
        quantityDelta: -4,
        reason: "Damaged",
        recordVersion: "v"
      })
    );
    expect((await screen.findByRole("alert")).textContent).toMatch(/Not enough stock/);
  });

  it("blocks a transfer to the same location and posts a valid one", async () => {
    routeGet();
    apiPost.mockResolvedValue({ levels: [], movements: [] });
    wrap(<TransferPanel />);
    await screen.findByRole("option", { name: "Capacitor 45/5 · CAP-455" });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: L1 } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: L1 } });
    fireEvent.change(screen.getByLabelText("Part"), { target: { value: P1 } });
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "2" } });
    expect(screen.getByText("Pick two different locations.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save transfer" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("To"), { target: { value: L2 } });
    fireEvent.click(screen.getByRole("button", { name: "Save transfer" }));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith("/api/v1/inventory/transfers", {
        fromLocationId: L1,
        toLocationId: L2,
        productId: P1,
        quantity: 2,
        recordVersion: "v"
      })
    );
    expect(await screen.findByText("Transfer saved.")).toBeTruthy();
  });

  it("omits recordVersion when the location has no stock level for that part yet", async () => {
    routeGet();
    apiPost.mockResolvedValue({ levels: [{ quantity: 5 }], movements: [] });
    wrap(<AdjustPanel />);
    await screen.findByRole("option", { name: "Capacitor 45/5 · CAP-455" });
    fireEvent.change(screen.getByLabelText("Location"), { target: { value: L2 } });
    fireEvent.change(screen.getByLabelText("Part"), { target: { value: P1 } });
    fireEvent.change(screen.getByLabelText(/Change/), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Restock" } });
    fireEvent.click(screen.getByRole("button", { name: "Save adjustment" }));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith("/api/v1/inventory/adjustments", {
        locationId: L2,
        productId: P1,
        quantityDelta: 5,
        reason: "Restock"
      })
    );
  });

  it("on a stale recordVersion 409 shows the refresh message and refetches stock levels (no auto-retry)", async () => {
    routeGet();
    apiPost.mockRejectedValueOnce(new ApiError(409, { error: "CONFLICT", reason: "stale_record_version", message: "x" } as never));
    wrap(<TransferPanel />);
    await screen.findByRole("option", { name: "Capacitor 45/5 · CAP-455" });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: L1 } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: L2 } });
    fireEvent.change(screen.getByLabelText("Part"), { target: { value: P1 } });
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "1" } });
    const levelCalls = () => apiGet.mock.calls.filter(([p]) => String(p).startsWith("/api/v1/inventory/levels")).length;
    const before = levelCalls();
    fireEvent.click(screen.getByRole("button", { name: "Save transfer" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/changed since you loaded it/);
    await waitFor(() => expect(levelCalls()).toBeGreaterThan(before));
    expect(apiPost).toHaveBeenCalledTimes(1);
  });
});

describe("stock table", () => {
  it("sits in its own horizontal scroll container", async () => {
    routeGet();
    wrap(<StockLevelsPanel lowStock={false} />);
    await screen.findByText("Capacitor 45/5 · CAP-455");
    const scroller = screen.getByTestId("stock-table-scroll");
    expect(scroller.className).toMatch(/overflow-x-auto/);
    expect(scroller.querySelector("table")).toBeTruthy();
  });
});
