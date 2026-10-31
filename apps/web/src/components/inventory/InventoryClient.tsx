"use client";

import "./inventory-motion.css";

import { useMemo, useState } from "react";

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

// Figma 367:4647 / 367:4839 / 367:5013 (Operator / 11 Inventory · Stock & low stock) styles.
const ring = "outline-none focus-visible:ring-2 focus-visible:ring-[#0f1530] focus-visible:ring-offset-2";
const inputCls = "mt-1.5 block h-11 w-full rounded-[8px] border border-[#e6dccb] bg-white px-3 text-sm text-[#0f1530] outline-none focus:border-[#0f1530]";
const labelCls = "block text-[13px] font-medium text-[#2a3360]";
const cardCls = "space-y-3.5 rounded-[14px] border border-[#e6dccb] bg-white p-5";
const btnCls = `inline-flex h-11 w-full items-center justify-center rounded-[10px] bg-[#0f1530] px-[18px] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 md:h-12 lg:h-11 ${ring}`;
const PILL = {
  error: "bg-[#fbe3dc] text-[#b42318]",
  success: "bg-[#e4f1e8] text-[#2f7d4f]",
  info: "bg-[#e5eafb] text-[#2b4acb]",
  neutral: "bg-[#eef0f5] text-[#2a3360]"
} as const;
function Pill({ tone, children }: { tone: keyof typeof PILL; children: React.ReactNode }) {
  return (
    <span className={`inline-flex h-[22px] w-fit shrink-0 items-center rounded-full px-2.5 text-[10.5px] font-medium uppercase tracking-[0.06em] ${PILL[tone]}`}>
      {children}
    </span>
  );
}
/** Figma state alert: semibold title, 13px detail (gray empty states 367:4793 / 367:4828). */
function NoticeAlert({ title, detail, testId }: { title: string; detail: string; testId?: string }) {
  return (
    <div className="space-y-1.5 rounded-[10px] bg-[#eef0f5] p-3.5" data-testid={testId}>
      <p className="text-sm font-semibold text-[#0f1530]">{title}</p>
      <p className="text-[13px] text-[#2a3360]">{detail}</p>
    </div>
  );
}

export function inventoryErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const payload = error.payload as unknown as Partial<InventoryConflictPayload>;
    if (error.status === 409 && payload.reason === "insufficient_stock") {
      return "Not enough stock at that location for this change.";
    }
    if (error.status === 409 && payload.reason === "stale_record_version") {
      return "This stock level changed since you loaded it. Refresh and try again.";
    }
    if (error.status === 403) return "Your role can’t make this change.";
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
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#2b4acb]">Inventory</p>
        <h2 className="text-2xl font-semibold tracking-tight text-[#0f1530] md:text-[28px] lg:text-[30px]">Inventory</h2>
        <p className="text-[15px] text-[#5e6684]">
          Track parts in your warehouse and service trucks. Low stock shows parts at or under their reorder point.
        </p>
      </header>
      <div className="border-t border-[#e6dccb]" />
      <div role="tablist" aria-label="Inventory" className="inline-flex max-w-full flex-wrap gap-1 rounded-[10px] bg-[#f3eadc] p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => setTab(t.id)}
            className={[
              `h-11 rounded-[10px] px-3.5 text-sm text-[#0f1530] ${ring}`,
              activeTab === t.id ? "bg-white font-semibold" : "font-normal"
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {canManage ? null : (
        <p data-testid="inventory-read-only" className="text-[13px] text-[#5e6684]">
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
    <label htmlFor={id} className={labelCls}>
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

  const rows = levels.data?.levels ?? [];
  const cell = "flex items-center justify-between gap-4 lg:table-cell lg:px-3 lg:align-middle";
  const cellLabel = "text-[13.5px] text-[#2a3360] lg:hidden";

  return (
    <section className={cardCls}>
      <div className="lg:max-w-[148px]">
        <LocationSelect id={`levels-loc-${lowStock}`} label="Location" value={locationId} onChange={setLocationId} allowAll />
      </div>
      {levels.isLoading ? (
        <SkeletonCard className="h-[240px]" />
      ) : levels.isError ? (
        <ErrorState title="Couldn't load stock levels" onRetry={() => void levels.refetch()} isRetrying={levels.isFetching} />
      ) : rows.length === 0 ? (
        <NoticeAlert
          testId="stock-empty"
          title={lowStock ? "No parts running low" : "No parts on hand yet"}
          detail={lowStock ? "Parts at or under their reorder point show up here." : "Adjust stock to add parts to the warehouse or a truck."}
        />
      ) : (
        <div className="max-w-full overflow-x-auto" data-testid="stock-table-scroll">
          <table className="block w-full border-separate border-spacing-y-0 text-left text-sm lg:table lg:min-w-[520px]">
            <thead className="hidden lg:table-header-group">
              <tr className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#5e6684]">
                <th className="h-9 rounded-l-[8px] bg-[#f3eadc] px-3 font-medium">Part</th>
                <th className="bg-[#f3eadc] px-3 font-medium">Location</th>
                <th className="bg-[#f3eadc] px-3 font-medium">On hand</th>
                <th className="bg-[#f3eadc] px-3 font-medium">Reorder at</th>
                <th className="rounded-r-[8px] bg-[#f3eadc] px-3 font-medium">
                  <span className="sr-only">Status</span>
                </th>
              </tr>
            </thead>
            <tbody className="block space-y-3 lg:table-row-group lg:space-y-0">
              {rows.map((lvl: StockLevel) => (
                <tr
                  key={lvl.id}
                  data-testid="stock-row"
                  data-low={lvl.isLowStock || undefined}
                  className={[
                    "block space-y-2 rounded-[14px] border p-4 lg:table-row lg:h-[52px] lg:space-y-0 lg:border-0 lg:p-0 [&>td:first-child]:lg:rounded-l-[8px] [&>td:last-child]:lg:rounded-r-[8px]",
                    lvl.isLowStock ? "border-[#fbe3dc] bg-[#fbe3dc]" : "border-[#e6dccb] bg-white lg:bg-transparent"
                  ].join(" ")}
                >
                  <td className="flex items-start justify-between gap-3 text-[15px] font-semibold text-[#0f1530] [overflow-wrap:anywhere] lg:table-cell lg:px-3 lg:align-middle lg:text-sm lg:font-medium">
                    <span data-testid="part-label">{partLabel(lvl)}</span>
                    {lvl.isLowStock ? (
                      <span className="lg:hidden">
                        <Pill tone="error">Low</Pill>
                      </span>
                    ) : null}
                  </td>
                  <td className={cell}>
                    <span className={cellLabel}>Location</span>
                    <span className="text-[13.5px] text-[#0f1530]">{locName(lvl.locationId)}</span>
                  </td>
                  <td className={cell}>
                    <span className={cellLabel}>On hand</span>
                    <span className="font-semibold tabular-nums text-[#0f1530]">{lvl.quantity}</span>
                  </td>
                  <td className={cell}>
                    <span className={cellLabel}>Reorder at</span>
                    <span className="text-[13.5px] tabular-nums text-[#0f1530]">{lvl.lowStockThreshold ?? "—"}</span>
                  </td>
                  <td className="hidden lg:table-cell lg:px-3 lg:align-middle">
                    {lvl.isLowStock ? <Pill tone="error">Low</Pill> : null}
                  </td>
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
    <section className={cardCls}>
      {list.length === 0 ? (
        <NoticeAlert title="No warehouse or trucks yet" detail="Add your warehouse or a service truck to start tracking parts." />
      ) : (
        <ul className="divide-y divide-[#e6dccb] rounded-[10px] border border-[#e6dccb]">
          {list.map((l) => (
            <li key={l.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-medium text-[#0f1530]">{l.name}</span>
              <span className="text-[#5e6684]">
                {l.kind === "van" ? "Truck" : "Warehouse"}
                {l.isActive ? "" : " · Inactive"}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canManage ? (
        <form onSubmit={submit} className="grid gap-3.5 lg:max-w-md" aria-label="Add location">
          <label className={labelCls}>
            Name
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={255} />
          </label>
          <label className={labelCls}>
            Type
            <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as StockLocationKind)}>
              <option value="warehouse">Warehouse</option>
              <option value="van">Service truck</option>
            </select>
          </label>
          <Feedback error={error} ok={null} />
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
    <label className={labelCls}>
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

/** Figma state alerts 367:4796 (ERROR), 367:4801 (CONFLICT), 367:4834 (ACCESS), 367:4823 (saved). */
function errorPill(message: string) {
  if (message.startsWith("This stock level changed")) return { label: "Conflict", tone: "error" as const };
  if (message.startsWith("Your role")) return { label: "Access", tone: "neutral" as const };
  return { label: "Error", tone: "error" as const };
}
function Feedback({ error, ok }: { error: string | null; ok: string | null }) {
  if (error) {
    const pill = errorPill(error);
    const i = error.indexOf(". ");
    const [title, detail] = i === -1 ? [error, null] : [error.slice(0, i + 1), error.slice(i + 2)];
    return (
      <div className="space-y-2">
        <Pill tone={pill.tone}>{pill.label}</Pill>
        <div role="alert" className={`space-y-1.5 rounded-[10px] p-3.5 ${pill.tone === "neutral" ? "bg-[#eef0f5] text-[#0f1530]" : "bg-[#fbe3dc] text-[#b42318]"}`}>
          <p className="text-sm font-semibold">{title}</p>
          {detail ? <p className="text-[13px]">{detail}</p> : null}
        </div>
      </div>
    );
  }
  if (ok)
    return (
      <p role="status" className="rounded-[10px] bg-[#e4f1e8] p-3.5 text-sm font-semibold text-[#0f1530]">
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
    <form onSubmit={submit} className={`${cardCls} lg:max-w-[360px]`} aria-label="Adjust stock">
      <h3 className="text-[17px] font-semibold text-[#0f1530]">Adjust stock</h3>
      <ProductField value={productId} onChange={setProductId} />
      <LocationSelect id="adjust-loc" label="Location" value={locationId} onChange={setLocationId} />
      <div>
        <label className={labelCls}>
          Quantity
          <input className={inputCls} inputMode="numeric" value={delta} onChange={(e) => setDelta(e.target.value)} aria-describedby="adjust-qty-help" />
        </label>
        <p id="adjust-qty-help" className="mt-1.5 text-[12.5px] text-[#5e6684]">
          Use a negative number to remove parts.
        </p>
      </div>
      <label className={labelCls}>
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
    <form onSubmit={submit} className={`${cardCls} lg:max-w-[360px]`} aria-label="Transfer stock">
      <Pill tone="info">Transfer</Pill>
      <div className="grid grid-cols-2 gap-3">
        <LocationSelect id="transfer-from" label="From" value={fromLocationId} onChange={setFrom} />
        <LocationSelect id="transfer-to" label="To" value={toLocationId} onChange={setTo} />
      </div>
      {same ? <p className="text-[12.5px] text-[#b42318]">Pick two different locations.</p> : null}
      <ProductField value={productId} onChange={setProductId} />
      <label className={labelCls}>
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
