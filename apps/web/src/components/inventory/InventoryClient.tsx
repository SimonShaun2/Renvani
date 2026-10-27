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
import type { InventoryConflictPayload, StockLevel, StockLocationKind } from "@/src/lib/inventory.types";
import { useAuthStore } from "@/src/stores/auth.store";

type Tab = "stock" | "low" | "locations" | "adjust" | "transfer";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "stock", label: "Stock" },
  { id: "low", label: "Low stock" },
  { id: "locations", label: "Locations & vans" },
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

/** Product names come from /api/v1/products, which only owner/admin can read; others see a short id. */
function useProductNames() {
  const role = useAuthStore((state) => state.user?.role ?? null);
  const canReadCatalog = role === "owner" || role === "admin";
  const query = useInventoryProductOptions(canReadCatalog);
  const names = useMemo(() => {
    const map = new Map<string, string>();
    if (canReadCatalog) for (const p of query.data?.data ?? []) map.set(p.id, p.name);
    return map;
  }, [canReadCatalog, query.data]);
  return {
    canReadCatalog,
    products: canReadCatalog ? query.data?.data ?? [] : [],
    nameOf: (id: string) => names.get(id) ?? `Item ${id.slice(0, 8)}`
  };
}

export function InventoryClient() {
  const [tab, setTab] = useState<Tab>("stock");
  const locations = useStockLocations();

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Inventory" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={[
              "rounded-full px-4 py-2 text-sm font-semibold",
              tab === t.id ? "bg-neutral-900 text-white" : "border border-neutral-300 bg-white text-neutral-800"
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {locations.isLoading ? (
        <SkeletonCard className="h-[320px]" />
      ) : locations.isError ? (
        <ErrorState
          title="Couldn't load stock locations"
          onRetry={() => void locations.refetch()}
          isRetrying={locations.isFetching}
        />
      ) : (
        <div data-inventory-reveal key={tab}>
          {tab === "stock" && <StockLevelsPanel lowStock={false} />}
          {tab === "low" && <StockLevelsPanel lowStock />}
          {tab === "locations" && <LocationsPanel />}
          {tab === "adjust" && <AdjustPanel />}
          {tab === "transfer" && <TransferPanel />}
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
            {l.name} ({l.kind === "van" ? "Van" : "Warehouse"})
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
  const { nameOf } = useProductNames();
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
          title={lowStock ? "Nothing is low on stock" : "No stock recorded yet"}
          subtitle={lowStock ? "Items at or under their threshold show up here." : "Adjust stock to add items to a location."}
        />
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-neutral-500">
              <th className="py-2">Item</th>
              <th>Location</th>
              <th className="text-right">On hand</th>
              <th className="text-right">Low at</th>
            </tr>
          </thead>
          <tbody>
            {(levels.data?.levels ?? []).map((lvl: StockLevel) => (
              <tr key={lvl.id} className="border-t border-neutral-200">
                <td className="py-2">
                  {nameOf(lvl.productId)}
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
      )}
    </section>
  );
}

export function LocationsPanel() {
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
        <EmptyState icon={MapPin} title="No locations yet" subtitle="Add a warehouse or a van to start tracking stock." compact />
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200">
          {list.map((l) => (
            <li key={l.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-medium text-neutral-900">{l.name}</span>
              <span className="text-neutral-500">
                {l.kind === "van" ? "Van" : "Warehouse"}
                {l.isActive ? "" : " · Inactive"}
              </span>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="grid max-w-md gap-3" aria-label="Add location">
        <label className="block text-sm font-medium text-neutral-800">
          Name
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={255} />
        </label>
        <label className="block text-sm font-medium text-neutral-800">
          Type
          <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as StockLocationKind)}>
            <option value="warehouse">Warehouse</option>
            <option value="van">Van</option>
          </select>
        </label>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <button type="submit" className={btnCls} disabled={!name.trim() || create.isPending}>
          {create.isPending ? "Adding…" : "Add location"}
        </button>
      </form>
    </section>
  );
}

function ProductField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { canReadCatalog, products } = useProductNames();
  if (canReadCatalog) {
    return (
      <label className="block text-sm font-medium text-neutral-800">
        Item
        <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select an item</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label className="block text-sm font-medium text-neutral-800">
      Item ID
      <input className={inputCls} value={value} onChange={(e) => onChange(e.target.value.trim())} />
    </label>
  );
}

function Feedback({ error, ok }: { error: string | null; ok: string | null }) {
  if (error) return <p role="alert" className="text-sm text-red-700">{error}</p>;
  if (ok) return <p role="status" className="text-sm text-emerald-700">{ok}</p>;
  return null;
}

export function AdjustPanel() {
  const adjust = useAdjustStock();
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
      const res = await adjust.mutateAsync({ locationId, productId, quantityDelta: qty, reason: reason.trim() });
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
      await transfer.mutateAsync({ fromLocationId, toLocationId, productId, quantity: qty });
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
