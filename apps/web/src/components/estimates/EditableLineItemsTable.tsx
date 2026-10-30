"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { PriceBookItemPickerSeed } from "@fsm/types";

import { ProductCatalogPicker } from "@/src/components/jobs/ProductCatalogPicker";
import { Sheet } from "@/src/components/ui/Sheet";
import {
  createLineItemDraft,
  formatMoneyInput,
  formatQuantityInput,
  parseMoneyValue,
  type RevenueLineItemDraft
} from "./estimates.utils";

interface EditableLineItemsTableProps {
  title: string;
  subtitle?: string;
  items: RevenueLineItemDraft[];
  readOnly?: boolean;
  onChange: (items: RevenueLineItemDraft[]) => void;
  /** "frame" = Figma 10:676 Line item / Detail / Qty / Price layout (estimate builder). */
  variant?: "default" | "frame";
  /** Estimate-level discount shown as its own row in the frame layout (only when > 0). */
  discountAmount?: number;
}

interface CustomItemFormState {
  name: string;
  description: string;
  itemType: RevenueLineItemDraft["itemType"];
  quantity: string;
  unitPrice: string;
  isTaxable: boolean;
}

const defaultCustomItemState: CustomItemFormState = {
  name: "",
  description: "",
  itemType: "service",
  quantity: "1",
  unitPrice: "0.00",
  isTaxable: true
};

export function EditableLineItemsTable({
  title,
  subtitle,
  items,
  readOnly = false,
  onChange,
  variant = "default",
  discountAmount = 0
}: EditableLineItemsTableProps) {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [customItemOpen, setCustomItemOpen] = useState(false);
  const [customItemForm, setCustomItemForm] = useState<CustomItemFormState>(defaultCustomItemState);

  function updateItem(localId: string, updates: Partial<RevenueLineItemDraft>) {
    onChange(
      items.map((item, index) =>
        item.localId === localId
          ? {
              ...item,
              ...updates,
              sortOrder: index
            }
          : item
      )
    );
  }

  function removeItem(localId: string) {
    onChange(
      items
        .filter((item) => item.localId !== localId)
        .map((item, index) => ({
          ...item,
          sortOrder: index
        }))
    );
  }

  async function handleAddPriceBookItem(seed: PriceBookItemPickerSeed) {
    setPendingProductId(seed.priceBookItemId);

    try {
      onChange([
        ...items,
        createLineItemDraft({
          priceBookItemId: seed.priceBookItemId,
          name: seed.name,
          description: seed.description ?? "",
          itemType: seed.itemType,
          quantity: "1",
          unitPrice: formatMoneyInput(seed.unitPrice),
          isTaxable: seed.isTaxable,
          sortOrder: items.length
        })
      ]);
      setCatalogOpen(false);
    } finally {
      setPendingProductId(null);
    }
  }

  function handleSaveCustomItem() {
    if (customItemForm.name.trim().length === 0) {
      return;
    }

    onChange([
      ...items,
      createLineItemDraft({
        name: customItemForm.name.trim(),
        description: customItemForm.description.trim(),
        itemType: customItemForm.itemType,
        quantity: formatQuantityInput(customItemForm.quantity),
        unitPrice: formatMoneyInput(customItemForm.unitPrice),
        isTaxable: customItemForm.isTaxable,
        sortOrder: items.length
      })
    ]);
    setCustomItemForm(defaultCustomItemState);
    setCustomItemOpen(false);
  }

  const frameInput =
    "w-full rounded-[8px] border border-[#e6dccb] bg-[#fbf6ef] px-2 py-1.5 text-[13px] text-[#0f1530] outline-none transition focus:border-[#0f1530]";
  const frameTable = (
    <section className="overflow-hidden rounded-[14px] border border-[#e6dccb] bg-white" aria-label={title}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-[#fbf6ef] font-mono text-[10px] font-medium uppercase tracking-[0.8px] text-[#5e6684]">
            <tr>
              <th className="px-5 py-2.5 font-medium">Line item</th>
              <th className="px-5 py-2.5 font-medium">Detail</th>
              <th className="px-5 py-2.5 font-medium">Qty</th>
              <th className="px-5 py-2.5 font-medium">Price</th>
              {!readOnly ? <th className="px-5 py-2.5 font-medium"><span className="sr-only">Actions</span></th> : null}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr className="border-t border-[#e6dccb]">
                <td colSpan={readOnly ? 4 : 5} className="px-5 py-8 text-center text-[#5e6684]">
                  No line items yet.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const lineTotal = parseMoneyValue(item.quantity) * parseMoneyValue(item.unitPrice);
                return (
                  <tr key={item.localId} className="border-t border-[#e6dccb] align-middle">
                    <td className="px-5 py-3.5 font-semibold text-[#0f1530]">
                      {readOnly ? (
                        item.name
                      ) : (
                        <input
                          aria-label="Line item"
                          value={item.name}
                          onChange={(event) => updateItem(item.localId, { name: event.target.value })}
                          placeholder="Line item name"
                          className={`${frameInput} font-semibold`}
                        />
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-[#2a3360]">
                      {readOnly ? (
                        item.description || "—"
                      ) : (
                        <input
                          aria-label="Detail"
                          value={item.description}
                          onChange={(event) => updateItem(item.localId, { description: event.target.value })}
                          placeholder="Detail"
                          className={frameInput}
                        />
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-[#2a3360]">
                      {readOnly ? (
                        item.quantity
                      ) : (
                        <input
                          aria-label="Qty"
                          value={item.quantity}
                          onChange={(event) => updateItem(item.localId, { quantity: event.target.value })}
                          onBlur={() => updateItem(item.localId, { quantity: formatQuantityInput(item.quantity) })}
                          inputMode="decimal"
                          className={`${frameInput} w-16`}
                        />
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-[#2a3360]">
                      {readOnly ? (
                        `$${formatMoneyInput(lineTotal)}`
                      ) : (
                        <div className="space-y-1">
                          <input
                            aria-label="Unit price"
                            value={item.unitPrice}
                            onChange={(event) => updateItem(item.localId, { unitPrice: event.target.value })}
                            onBlur={() => updateItem(item.localId, { unitPrice: formatMoneyInput(item.unitPrice) })}
                            inputMode="decimal"
                            className={`${frameInput} w-24`}
                          />
                          {parseMoneyValue(item.quantity) !== 1 ? (
                            <p className="text-xs text-[#5e6684]">${formatMoneyInput(lineTotal)} total</p>
                          ) : null}
                        </div>
                      )}
                    </td>
                    {!readOnly ? (
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <select
                            aria-label="Type"
                            value={item.itemType}
                            onChange={(event) =>
                              updateItem(item.localId, { itemType: event.target.value as RevenueLineItemDraft["itemType"] })
                            }
                            className={`${frameInput} w-auto`}
                          >
                            <option value="service">Service</option>
                            <option value="labor">Labor</option>
                            <option value="material">Material</option>
                            <option value="fee">Fee</option>
                          </select>
                          <label className="inline-flex items-center gap-1.5 text-xs text-[#5e6684]">
                            <input
                              type="checkbox"
                              checked={item.isTaxable}
                              onChange={(event) => updateItem(item.localId, { isTaxable: event.target.checked })}
                              className="h-4 w-4 rounded border-[#e6dccb]"
                            />
                            Taxable
                          </label>
                          <button
                            type="button"
                            onClick={() => removeItem(item.localId)}
                            className="rounded-full p-1.5 text-[#5e6684] transition hover:bg-[#fde4df] hover:text-[#a3261a]"
                            aria-label={`Remove ${item.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
            {discountAmount > 0 ? (
              <tr className="border-t border-[#e6dccb]">
                <td className="px-5 py-3.5 font-semibold text-[#0f1530]">Discount</td>
                <td className="px-5 py-3.5 text-[#2a3360]">Applied to this estimate</td>
                <td className="px-5 py-3.5 text-[#2a3360]">—</td>
                <td className="px-5 py-3.5 text-[#2a3360]">−${formatMoneyInput(discountAmount)}</td>
                {!readOnly ? <td /> : null}
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {!readOnly ? (
        <div className="flex flex-wrap gap-2 border-t border-[#e6dccb] px-5 py-3">
          <button
            type="button"
            onClick={() => setCatalogOpen(true)}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#0f1530]"
          >
            <Plus className="h-4 w-4" />
            Add from catalog
          </button>
          <button
            type="button"
            onClick={() => setCustomItemOpen(true)}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#2a3360]"
          >
            <Plus className="h-4 w-4" />
            Add custom item
          </button>
        </div>
      ) : null}
    </section>
  );

  return (
    <>
      {variant === "frame" ? frameTable : (
      <section className="rounded-[28px] border border-neutral-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-neutral-200 pb-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-neutral-900">{title}</h3>
            {subtitle ? <p className="mt-1 text-sm text-neutral-500">{subtitle}</p> : null}
          </div>

          {!readOnly ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCatalogOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-brand-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-primary"
              >
                <Plus className="h-4 w-4" />
                Add from catalog
              </button>
              <button
                type="button"
                onClick={() => setCustomItemOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-600 transition hover:border-brand-accent/30 hover:text-neutral-900"
              >
                <Plus className="h-4 w-4" />
                Add custom item
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
                <th className="pb-3 pr-3">Item</th>
                <th className="pb-3 pr-3">Type</th>
                <th className="pb-3 pr-3">Qty</th>
                <th className="pb-3 pr-3">Unit Price</th>
                <th className="pb-3 pr-3 text-right">Total</th>
                {!readOnly ? <th className="pb-3 pl-3 text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={readOnly ? 5 : 6} className="py-10 text-center text-sm text-neutral-400">
                    No line items yet.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const lineTotal = parseMoneyValue(item.quantity) * parseMoneyValue(item.unitPrice);

                  return (
                    <tr key={item.localId} className="align-top">
                      <td className="py-4 pr-3">
                        {readOnly ? (
                          <div>
                            <p className="font-semibold text-neutral-900">{item.name}</p>
                            {item.description ? <p className="mt-1 text-xs leading-5 text-neutral-500">{item.description}</p> : null}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <input
                              value={item.name}
                              onChange={(event) => updateItem(item.localId, { name: event.target.value })}
                              placeholder="Line item name"
                              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 font-semibold text-neutral-900 outline-none transition focus:border-brand-accent"
                            />
                            <textarea
                              value={item.description}
                              onChange={(event) => updateItem(item.localId, { description: event.target.value })}
                              placeholder="Optional description"
                              rows={2}
                              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600 outline-none transition focus:border-brand-accent"
                            />
                          </div>
                        )}
                      </td>
                      <td className="py-4 pr-3">
                        {readOnly ? (
                          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-500">
                            {item.itemType}
                          </span>
                        ) : (
                          <select
                            value={item.itemType}
                            onChange={(event) =>
                              updateItem(item.localId, {
                                itemType: event.target.value as RevenueLineItemDraft["itemType"]
                              })
                            }
                            className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 outline-none transition focus:border-brand-accent"
                          >
                            <option value="service">Service</option>
                            <option value="labor">Labor</option>
                            <option value="material">Material</option>
                            <option value="fee">Fee</option>
                          </select>
                        )}
                      </td>
                      <td className="py-4 pr-3">
                        {readOnly ? (
                          <span className="font-medium text-neutral-700">{item.quantity}</span>
                        ) : (
                          <input
                            value={item.quantity}
                            onChange={(event) => updateItem(item.localId, { quantity: event.target.value })}
                            onBlur={() => updateItem(item.localId, { quantity: formatQuantityInput(item.quantity) })}
                            inputMode="decimal"
                            className="w-24 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-neutral-700 outline-none transition focus:border-brand-accent"
                          />
                        )}
                      </td>
                      <td className="py-4 pr-3">
                        {readOnly ? (
                          <span className="font-medium text-neutral-700">${formatMoneyInput(item.unitPrice)}</span>
                        ) : (
                          <input
                            value={item.unitPrice}
                            onChange={(event) => updateItem(item.localId, { unitPrice: event.target.value })}
                            onBlur={() => updateItem(item.localId, { unitPrice: formatMoneyInput(item.unitPrice) })}
                            inputMode="decimal"
                            className="w-28 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-neutral-700 outline-none transition focus:border-brand-accent"
                          />
                        )}
                      </td>
                      <td className="py-4 pr-3 text-right font-semibold text-neutral-900">${formatMoneyInput(lineTotal)}</td>
                      {!readOnly ? (
                        <td className="py-4 pl-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-500">
                              <input
                                type="checkbox"
                                checked={item.isTaxable}
                                onChange={(event) => updateItem(item.localId, { isTaxable: event.target.checked })}
                                className="h-4 w-4 rounded border-neutral-300 text-brand-accent focus:ring-brand-accent"
                              />
                              Taxable
                            </label>
                            <button
                              type="button"
                              onClick={() => removeItem(item.localId)}
                              className="rounded-full p-2 text-neutral-400 transition hover:bg-error-light hover:text-error"
                              aria-label={`Remove ${item.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}

      <ProductCatalogPicker
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        onAddPriceBookItem={handleAddPriceBookItem}
        pendingProductId={pendingProductId}
      />

      <Sheet
        open={customItemOpen}
        onClose={() => {
          setCustomItemOpen(false);
          setCustomItemForm(defaultCustomItemState);
        }}
        title="Add Custom Item"
        description="Create a one-off service, labor, fee, or material line item for this quote."
      >
        <div className="space-y-5 px-6 py-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-neutral-700">Name</label>
            <input
              value={customItemForm.name}
              onChange={(event) => setCustomItemForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Compressor replacement"
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition focus:border-brand-accent"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-neutral-700">Description</label>
            <textarea
              value={customItemForm.description}
              onChange={(event) => setCustomItemForm((current) => ({ ...current, description: event.target.value }))}
              rows={3}
              placeholder="Optional customer-facing description"
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-700 outline-none transition focus:border-brand-accent"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-700">Type</label>
              <select
                value={customItemForm.itemType}
                onChange={(event) =>
                  setCustomItemForm((current) => ({
                    ...current,
                    itemType: event.target.value as RevenueLineItemDraft["itemType"]
                  }))
                }
                className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-700 outline-none transition focus:border-brand-accent"
              >
                <option value="service">Service</option>
                <option value="labor">Labor</option>
                <option value="material">Material</option>
                <option value="fee">Fee</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-700">Quantity</label>
              <input
                value={customItemForm.quantity}
                onChange={(event) => setCustomItemForm((current) => ({ ...current, quantity: event.target.value }))}
                inputMode="decimal"
                className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-700 outline-none transition focus:border-brand-accent"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-700">Unit Price</label>
              <input
                value={customItemForm.unitPrice}
                onChange={(event) => setCustomItemForm((current) => ({ ...current, unitPrice: event.target.value }))}
                inputMode="decimal"
                className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-700 outline-none transition focus:border-brand-accent"
              />
            </div>

            <label className="mt-7 inline-flex items-center gap-3 text-sm font-medium text-neutral-600">
              <input
                type="checkbox"
                checked={customItemForm.isTaxable}
                onChange={(event) =>
                  setCustomItemForm((current) => ({
                    ...current,
                    isTaxable: event.target.checked
                  }))
                }
                className="h-4 w-4 rounded border-neutral-300 text-brand-accent focus:ring-brand-accent"
              />
              Taxable item
            </label>
          </div>

          <div className="flex justify-end gap-3 border-t border-neutral-200 pt-5">
            <button
              type="button"
              onClick={() => {
                setCustomItemOpen(false);
                setCustomItemForm(defaultCustomItemState);
              }}
              className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveCustomItem}
              className="rounded-full bg-brand-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-primary"
            >
              Save custom item
            </button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
