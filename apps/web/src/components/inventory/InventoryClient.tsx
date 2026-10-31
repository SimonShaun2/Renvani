"use client";

import "./inventory-motion.css";

import { Boxes, MapPin } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/src/components/ui/EmptyState";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import {
  useAdjustStock,
  useInventoryProductOptions,
  useCreateStockLocation,
  useStockLevels,
  useStockLocations,
  useTransferStock
} from "@/src/hooks/inventory.hooks";
import { ApiError } from "@/src/lib/api";
import type { StockLevel, StockLocationKind } from "@fsm/types";
import { useAuthStore } from "@/src/stores/auth.store";

type Tab = "stock" | "low" | "locations" | "adjust" | "transfer";

/** 409 body from inventory writes (route-level error shape, not part of the @fsm/types contract). */
interface InventoryConflictPayload {
  error: "CONFLICT";
  reason: "stale_record_version" | "insufficient_stock" | string;
  message: string;
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "stock", label: "Stock" },
  { id: "low", label: "Low stock" },
  { id: "locations", label: "Warehouse & trucks" },
  { id: "adjust", label: "Adjust" },
  { id: "transfer", label: "Transfer" }
];

const inputCls = "w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm";
const btnCls = "rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";

export function inventoryErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const payload = error.payload as unknown as Partial<InventoryConflictPayload>;
    if (error.status === 409 && payload.reason === "insufficient_stock") {
      return "Not enough stock at that location for this change.";
    }
    if (error.status === 409 && payload.reason === "stale_record_version") {
      return "This stock level changed since you loaded it. Refresh and try again.";
    }
    if (error.status === 403) return "Your role can't make this change.";
    return error.message || "Request failed.";
  }
  return "Request failed. Check your connection and try again.";
}

const MANAGE_ROLES = new Set(["owner", "admin", "dispatcher", "office"]);

/** Stock management is owner/admin/dispatcher/office; technicians get a read-only view. */
export function useCanManageStock() {
  const role = useAuthStore((state) => state.user?.role ?? null);
  return role !== null && MANAGE_ROLES.has(role);
}

/** Part label from the #345 productName/productSku fields; short id only if the product is missing. */
export function partLabel(row: { productId: string; productName: string | null; productSku: string | null }) {
  const name = row.productName ?? `Unknown part ${row.productId.slice(0, 8)}`;
  return row.productSku ? `${name} · ${row.productSku}` : name;
}

/**
 * Part picker options: the full catalog for owner/admin (/api/v1/products is owner/admin only),
 * plus every part already stocked (names come from the #345 inventory fields), so dispatcher/office pick by name too.
 */
function usePartOptions() {
  const role = useAuthStore((state) => state.user?.role ?? null);
  const canReadCatalog = role === "owner" || role === "admin";
  const catalog = useInventoryProductOptions(canReadCatalog);
  const levels = useStockLevels(null, false);
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const l of levels.data?.levels ?? []) map.set(l.productId, partLabel(l));
    if (canReadCatalog) for (const p of catalog.data?.data ?? []) if (!map.has(p.id)) map.set(p.id, p.name);
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [canReadCatalog, catalog.data, levels.data]);
}

export function InventoryClient() {
  const [tab, setTab] = useState<Tab>("stock");
  const locations = useStockLocations();
  const canManage = useCanManageStock();
  const tabs = canManage ? TABS : TABS.filter((t) => t.id !== "adjust" && t.id !== "transfer");
  const activeTab: Tab = tabs.some((t) => t.id === tab) ? tab : "stock";

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Inventory" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => setTab(t.id)}
            className={[
              "rounded-full px-4 py-2 text-sm font-semibold",
              activeTab === t.id ? "bg-neutral-900 text-white" : "border border-neutral-300 bg-white text-neutral-800"
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {canManage ? null : (
        <p data-testid="inventory-read-only" className="text-sm text-neutral-600">
          View only. Ask the office or dispatch to adjust or move parts.
        </p>
      )}

      {locations.isLoading ? (
        <SkeletonCard className="h-[320px]" />
      ) : locations.isError ? (
        <ErrorState title="Couldn't load stock locations" onRetry={() => void locations.refetch()} isRetrying={locations.isFetching} />
      ) : (
        <div data-inventory-reveal key={activeTab}>
          {activeTab === "stock" && <StockLevelsPanel lowStock={false} />}
          {activeTab === "low" && <StockLevelsPanel lowStock />}
          {activeTab === "locations" && <LocationsPanel canManage={canManage} />}
          {canManage && activeTab === "adjust" && <AdjustPanel />}
          {canManage && activeTab === "transfer" && <TransferPanel />}
        </div>
      )}
    </div>
  );
}

function LocationSelect({
  id,
  label,
  value,
  onChange,
  allowAll = false
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  allowAll?: boolean;
}) {
  const locations = useStockLocations();
  return (
    <label htmlFor={id} className="block text-sm font-medium text-neutral-800">
      {label}
      <select id={id} className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allowAll ? "All locations" : "Select a location"}</option>
        {(locations.data?.locations ?? []).map((l) => (
          <option key={l.id} value={l.id}>
            {l.name} ({l.kind === "van" ? "Truck" : "Warehouse"})
          </option>
        ))}
      </select>
    </label>
  );
}

export function StockLevelsPanel({ lowStock }: { lowStock: boolean }) {
  const [locationId, setLocationId] = useState("");
  const levels = useStockLevels(locationId || null, lowStock);
  const locations = useStockLocations();
  const locName = (id: string) => locations.data?.locations.find((l) => l.id === id)?.name ?? id.slice(0, 8);

  return (
    <section className="space-y-4">
      <div className="max-w-xs">
        <LocationSelect id={`levels-loc-${lowStock}`} label="Location" value={locationId} onChange={setLocationId} allowAll />
      </div>
      {levels.isLoading ? (
        <SkeletonCard className="h-[240px]" />
      ) : levels.isError ? (
        <ErrorState title="Couldn't load stock levels" onRetry={() => void levels.refetch()} isRetrying={levels.isFetching} />
      ) : (levels.data?.levels ?? []).length === 0 ? (
        <EmptyState
          icon={Boxes}
          title={lowStock ? "No parts running low" : "No parts on hand yet"}
          subtitle={
            lowStock ? "Parts at or under their reorder point show up here." : "Adjust stock to add parts to the warehouse or a truck."
          }
        />
      ) : (
        <div className="max-w-full overflow-x-auto" data-testid="stock-table-scroll">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="text-neutral-500">
                <th className="py-2">Part</th>
                <th>Location</th>
                <th className="text-right">On hand</th>
                <th className="text-right">Reorder at</th>
              </tr>
            </thead>
            <tbody>
              {(levels.data?.levels ?? []).map((lvl: StockLevel) => (
                <tr key={lvl.id} className="border-t border-neutral-200">
                  <td className="py-2 pr-3 [overflow-wrap:anywhere]">
                    <span data-testid="part-label">{partLabel(lvl)}</span>
                    {lvl.isLowStock ? (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Low</span>
                    ) : null}
                  </td>
                  <td>{locName(lvl.locationId)}</td>
                  <td className="text-right tabular-nums">{lvl.quantity}</td>
                  <td className="text-right tabular-nums">{lvl.lowStockThreshold ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function LocationsPanel({ canManage = true }: { canManage?: boolean }) {
  const locations = useStockLocations();
  const create = useCreateStockLocation();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<StockLocationKind>("warehouse");
  const [error, setError] = useState<string | null>(null);
  const list = locations.data?.locations ?? [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({ name: name.trim(), kind });
      setName("");
    } catch (err) {
      setError(inventoryErrorMessage(err));
    }
  }

  return (
    <section className="space-y-4">
      {list.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No warehouse or trucks yet"
          subtitle="Add your warehouse or a service truck to start tracking parts."
          compact
        />
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200">
          {list.map((l) => (
            <li key={l.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-medium text-neutral-900">{l.name}</span>
              <span className="text-neutral-500">
                {l.kind === "van" ? "Truck" : "Warehouse"}
                {l.isActive ? "" : " · Inactive"}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canManage ? (
        <form onSubmit={submit} className="grid max-w-md gap-3" aria-label="Add location">
          <label className="block text-sm font-medium text-neutral-800">
            Name
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={255} />
          </label>
          <label className="block text-sm font-medium text-neutral-800">
            Type
            <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as StockLocationKind)}>
              <option value="warehouse">Warehouse</option>
              <option value="van">Service truck</option>
            </select>
          </label>
          {error ? (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <button type="submit" className={btnCls} disabled={!name.trim() || create.isPending}>
            {create.isPending ? "Adding…" : "Add location"}
          </button>
        </form>
      ) : null}
    </section>
  );
}

function ProductField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const options = usePartOptions();
  return (
    <label className="block text-sm font-medium text-neutral-800">
      Part
      <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select a part</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function Feedback({ error, ok }: { error: string | null; ok: string | null }) {
  if (error)
    return (
      <p role="alert" className="text-sm text-red-700">
        {error}
      </p>
    );
  if (ok)
    return (
      <p role="status" className="text-sm text-emerald-700">
        {ok}
      </p>
    );
  return null;
}

/** recordVersion of the (location, part) stock level the operator is looking at, from the loaded levels. */
export function useLevelVersion() {
  const levels = useStockLevels(null, false);
  return (locationId: string, productId: string): string | undefined =>
    levels.data?.levels.find((l) => l.locationId === locationId && l.productId === productId)?.recordVersion;
}

export function AdjustPanel() {
  const adjust = useAdjustStock();
  const levelVersion = useLevelVersion();
  const [locationId, setLocationId] = useState("");
  const [productId, setProductId] = useState("");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const qty = Number(delta);
  const valid = Boolean(locationId && productId && reason.trim()) && Number.isInteger(qty) && qty !== 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    try {
      const recordVersion = levelVersion(locationId, productId);
      const res = await adjust.mutateAsync({
        locationId,
        productId,
        quantityDelta: qty,
        reason: reason.trim(),
        ...(recordVersion ? { recordVersion } : {})
      });
      setOk(`Saved. On hand now ${res.levels[0]?.quantity ?? "updated"}.`);
      setDelta("");
      setReason("");
    } catch (err) {
      setError(inventoryErrorMessage(err));
    }
  }

  return (
    <form onSubmit={submit} className="grid max-w-md gap-3" aria-label="Adjust stock">
      <LocationSelect id="adjust-loc" label="Location" value={locationId} onChange={setLocationId} />
      <ProductField value={productId} onChange={setProductId} />
      <label className="block text-sm font-medium text-neutral-800">
        Change (+ to add, − to remove)
        <input className={inputCls} inputMode="numeric" value={delta} onChange={(e) => setDelta(e.target.value)} />
      </label>
      <label className="block text-sm font-medium text-neutral-800">
        Reason
        <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      </label>
      <Feedback error={error} ok={ok} />
      <button type="submit" className={btnCls} disabled={!valid || adjust.isPending}>
        {adjust.isPending ? "Saving…" : "Save adjustment"}
      </button>
    </form>
  );
}

export function TransferPanel() {
  const transfer = useTransferStock();
  const levelVersion = useLevelVersion();
  const [fromLocationId, setFrom] = useState("");
  const [toLocationId, setTo] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const qty = Number(quantity);
  const same = Boolean(fromLocationId) && fromLocationId === toLocationId;
  const valid = Boolean(fromLocationId && toLocationId && productId) && !same && Number.isInteger(qty) && qty > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    try {
      const recordVersion = levelVersion(fromLocationId, productId);
      await transfer.mutateAsync({ fromLocationId, toLocationId, productId, quantity: qty, ...(recordVersion ? { recordVersion } : {}) });
      setOk("Transfer saved.");
      setQuantity("");
    } catch (err) {
      setError(inventoryErrorMessage(err));
    }
  }

  return (
    <form onSubmit={submit} className="grid max-w-md gap-3" aria-label="Transfer stock">
      <LocationSelect id="transfer-from" label="From" value={fromLocationId} onChange={setFrom} />
      <LocationSelect id="transfer-to" label="To" value={toLocationId} onChange={setTo} />
      {same ? <p className="text-sm text-amber-800">Pick two different locations.</p> : null}
      <ProductField value={productId} onChange={setProductId} />
      <label className="block text-sm font-medium text-neutral-800">
        Quantity
        <input className={inputCls} inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
      </label>
      <Feedback error={error} ok={ok} />
      <button type="submit" className={btnCls} disabled={!valid || transfer.isPending}>
        {transfer.isPending ? "Saving…" : "Save transfer"}
      </button>
    </form>
  );
}
