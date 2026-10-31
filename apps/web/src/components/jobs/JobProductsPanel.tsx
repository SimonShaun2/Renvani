"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { AiRecommendationDetail, JobProduct, ProductCategory } from "@fsm/types";

import { CurrencyDisplay } from "@/src/components/ui/CurrencyDisplay";
import { StatBadge } from "@/src/components/ui/StatBadge";
import {
  useAddJobProduct,
  useApproveUpsell,
  useRemoveJobProduct,
  useUpdateJobProduct
} from "@/src/hooks/jobs.hooks";

import { ProductCatalogPicker } from "./ProductCatalogPicker";
import { computeProductTotals, formatDateOnly, parseMoney } from "./jobs.utils";

interface JobProductsPanelProps {
  jobId: string;
  products: JobProduct[];
  taxRate: number;
  suggestion: AiRecommendationDetail | null;
}

interface CustomItemDraft {
  name: string;
  category: ProductCategory;
  quantity: string;
  unitPrice: string;
  isTaxable: boolean;
  isUpsell: boolean;
}

const emptyCustomItem: CustomItemDraft = {
  name: "",
  category: "service",
  quantity: "1",
  unitPrice: "",
  isTaxable: true,
  isUpsell: false
};

export function JobProductsPanel({ jobId, products, taxRate, suggestion }: JobProductsPanelProps) {
  const addJobProduct = useAddJobProduct(jobId);
  const updateJobProduct = useUpdateJobProduct(jobId);
  const removeJobProduct = useRemoveJobProduct(jobId);
  const approveUpsell = useApproveUpsell(jobId);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [customItemOpen, setCustomItemOpen] = useState(false);
  const [draftDiscount, setDraftDiscount] = useState("0");
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [customItem, setCustomItem] = useState<CustomItemDraft>(emptyCustomItem);
  const [pendingCatalogProductId, setPendingCatalogProductId] = useState<string | null>(null);
  const [pendingRowProductId, setPendingRowProductId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const quantityOverrides = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(quantityDrafts).map(([productId, value]) => [productId, Math.max(0, Number.parseFloat(value) || 0)])
      ),
    [quantityDrafts]
  );
  const totals = computeProductTotals(products, taxRate, Number.parseFloat(draftDiscount) || 0, quantityOverrides);

  async function handleAddCatalogProduct(productCatalogId: string) {
    setErrorMessage(null);
    setPendingCatalogProductId(productCatalogId);

    try {
      await addJobProduct.mutateAsync({
        productCatalogId,
        quantity: 1
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Product could not be added.");
    } finally {
      setPendingCatalogProductId(null);
    }
  }

  async function handleRemoveProduct(productId: string) {
    setErrorMessage(null);
    setPendingRowProductId(productId);

    try {
      await removeJobProduct.mutateAsync(productId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Product could not be removed.");
    } finally {
      setPendingRowProductId(null);
    }
  }

  async function handleApproveUpsell(productId: string) {
    setErrorMessage(null);
    setPendingRowProductId(productId);

    try {
      await approveUpsell.mutateAsync(productId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Upsell approval could not be recorded.");
    } finally {
      setPendingRowProductId(null);
    }
  }

  async function handleQuantityBlur(product: JobProduct) {
    const nextQuantity = Number.parseFloat(quantityDrafts[product.id] ?? product.quantity);

    if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) {
      setQuantityDrafts((current) => ({
        ...current,
        [product.id]: product.quantity
      }));
      return;
    }

    if (nextQuantity === parseMoney(product.quantity)) {
      return;
    }

    setErrorMessage(null);
    setPendingRowProductId(product.id);

    try {
      await updateJobProduct.mutateAsync({
        productId: product.id,
        input: {
          quantity: nextQuantity
        }
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Quantity could not be updated.");
      setQuantityDrafts((current) => ({
        ...current,
        [product.id]: product.quantity
      }));
    } finally {
      setPendingRowProductId(null);
    }
  }

  async function handleAddCustomItem() {
    if (!customItem.name.trim() || !customItem.unitPrice.trim()) {
      setErrorMessage("Custom items need a name and unit price.");
      return;
    }

    setErrorMessage(null);

    try {
      await addJobProduct.mutateAsync({
        name: customItem.name.trim(),
        category: customItem.category,
        quantity: Number.parseFloat(customItem.quantity) || 1,
        unitPrice: Number.parseFloat(customItem.unitPrice),
        isTaxable: customItem.isTaxable,
        isUpsell: customItem.isUpsell
      });
      setCustomItem(emptyCustomItem);
      setCustomItemOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Custom item could not be added.");
    }
  }

  function seedUpsellDraft() {
    if (!suggestion) {
      return;
    }

    setCustomItem({
      name: suggestion.headline,
      category: "service",
      quantity: "1",
      unitPrice: String(parseMoney(suggestion.estimatedRevenue) || 250),
      isTaxable: true,
      isUpsell: true
    });
    setCustomItemOpen(true);
  }

  return (
    <section className="surface-card px-6 py-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900">📦 Products on Job</h2>
          <p className="mt-1 text-sm text-neutral-500">Add catalog items, track upsells, and keep labor totals in sync.</p>
        </div>
        <button
          type="button"
          onClick={() => setCatalogOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-brand-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-primary"
        >
          <Plus className="h-4 w-4" />
          Add from catalog
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {products.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-neutral-200 bg-neutral-50 px-4 py-5 text-sm text-neutral-500">
            No products have been attached to this job yet.
          </div>
        ) : (
          products.map((product) => {
            const quantityValue = quantityDrafts[product.id] ?? product.quantity;
            const quantity = Math.max(0, Number.parseFloat(quantityValue) || 0);
            const lineTotal = quantity * parseMoney(product.unitPrice);

            return (
              <div
                key={product.id}
                className={`rounded-[24px] border px-4 py-4 shadow-sm ${
                  product.isUpsell ? "border-warning/30 bg-warning-light/50" : "border-neutral-200 bg-white"
                }`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-neutral-900">{product.name}</p>
                      <StatBadge label={product.category} tone="neutral" />
                      {product.isUpsell ? <StatBadge label="Upsell" tone="orange" /> : null}
                    </div>
                    {product.description ? <p className="mt-1 text-sm text-neutral-500">{product.description}</p> : null}

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-neutral-500">
                      <label className="inline-flex items-center gap-2">
                        <span>Qty</span>
                        <input
                          value={quantityValue}
                          onChange={(event) =>
                            setQuantityDrafts((current) => ({
                              ...current,
                              [product.id]: event.target.value
                            }))
                          }
                          onBlur={() => {
                            void handleQuantityBlur(product);
                          }}
                          className="w-16 rounded-xl border border-neutral-200 bg-white px-2 py-1 text-sm text-neutral-900 outline-none transition focus:border-brand-accent"
                        />
                      </label>
                      <span>
                        <CurrencyDisplay value={product.unitPrice} showCents /> each
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-3 lg:items-end">
                    <CurrencyDisplay value={lineTotal} className="text-lg font-semibold text-neutral-900" showCents />
                    <div className="flex flex-wrap items-center gap-3">
                      {product.isUpsell && !product.upsellApproved ? (
                        <button
                          type="button"
                          disabled={pendingRowProductId === product.id}
                          onClick={() => {
                            void handleApproveUpsell(product.id);
                          }}
                          className="rounded-full bg-warning px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {pendingRowProductId === product.id ? "Approving..." : "Get Approval"}
                        </button>
                      ) : null}
                      {product.upsellApprovedAt ? (
                        <span className="text-xs font-medium text-success">Approved {formatDateOnly(product.upsellApprovedAt)}</span>
                      ) : null}
                      <button
                        type="button"
                        disabled={pendingRowProductId === product.id}
                        onClick={() => {
                          void handleRemoveProduct(product.id);
                        }}
                        className="rounded-full border border-neutral-200 p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={`Remove ${product.name}`}
                      >
                        {pendingRowProductId === product.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setCatalogOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-brand-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-primary"
        >
          <Plus className="h-4 w-4" />
          Add from Product Catalog
        </button>
        <button
          type="button"
          onClick={() => setCustomItemOpen((current) => !current)}
          className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100"
        >
          + Add Custom Item
        </button>
      </div>

      {customItemOpen ? (
        <div className="mt-4 rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={customItem.name}
              onChange={(event) => setCustomItem((current) => ({ ...current, name: event.target.value }))}
              placeholder="Custom item name"
              className="rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-accent"
            />
            <select
              value={customItem.category}
              onChange={(event) =>
                setCustomItem((current) => ({ ...current, category: event.target.value as ProductCategory }))
              }
              className="rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-accent"
            >
              <option value="service">Service</option>
              <option value="labor">Labor</option>
              <option value="material">Material</option>
              <option value="equipment">Equipment</option>
              <option value="fee">Fee</option>
              <option value="bundle">Bundle</option>
            </select>
            <input
              value={customItem.quantity}
              onChange={(event) => setCustomItem((current) => ({ ...current, quantity: event.target.value }))}
              placeholder="Qty"
              className="rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-accent"
            />
            <input
              value={customItem.unitPrice}
              onChange={(event) => setCustomItem((current) => ({ ...current, unitPrice: event.target.value }))}
              placeholder="Unit price"
              className="rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-accent"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-neutral-600">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={customItem.isTaxable}
                onChange={(event) =>
                  setCustomItem((current) => ({ ...current, isTaxable: event.target.checked }))
                }
              />
              Taxable
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={customItem.isUpsell}
                onChange={(event) =>
                  setCustomItem((current) => ({ ...current, isUpsell: event.target.checked }))
                }
              />
              Mark as upsell
            </label>
          </div>

          <div className="mt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setCustomItem(emptyCustomItem);
                setCustomItemOpen(false);
              }}
              className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-600 transition hover:bg-neutral-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={addJobProduct.isPending}
              onClick={() => {
                void handleAddCustomItem();
              }}
              className="rounded-full bg-brand-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-primary disabled:cursor-not-allowed disabled:opacity-70"
            >
              {addJobProduct.isPending ? "Adding..." : "Add Item"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-6 rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
        <div className="space-y-2 text-sm text-neutral-600">
          <div className="flex items-center justify-between gap-3">
            <span>Subtotal</span>
            <CurrencyDisplay value={totals.subtotal} showCents className="font-medium text-neutral-900" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Tax ({(taxRate * 100).toFixed(2)}%)</span>
            <CurrencyDisplay value={totals.taxAmount} showCents className="font-medium text-neutral-900" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="job-discount" className="shrink-0">
              Discount
            </label>
            <input
              id="job-discount"
              value={draftDiscount}
              onChange={(event) => setDraftDiscount(event.target.value)}
              className="w-24 rounded-xl border border-neutral-200 bg-white px-2 py-1 text-right text-sm text-neutral-900 outline-none transition focus:border-brand-accent"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-neutral-200 pt-4">
          <span className="text-base font-semibold text-neutral-900">Job Total</span>
          <CurrencyDisplay value={totals.total} className="text-2xl font-semibold text-neutral-900" showCents />
        </div>
      </div>

      {suggestion ? (
        <div className="mt-5 rounded-[24px] border border-ai/10 bg-ai-light/60 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-neutral-900">✨ AI Upsell Suggestion</p>
              <p className="mt-1 text-sm text-neutral-600">{suggestion.headline}</p>
              <p className="mt-2 text-xs text-neutral-500">{suggestion.body}</p>
            </div>
            <button
              type="button"
              onClick={seedUpsellDraft}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ai shadow-sm transition hover:bg-neutral-50"
            >
              Add to Job →
            </button>
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <p className="mt-4 rounded-3xl border border-error/15 bg-error-light px-4 py-3 text-sm text-error">{errorMessage}</p>
      ) : null}

      <ProductCatalogPicker
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        onAddPriceBookItem={async (item) => {
          await handleAddCatalogProduct(item.priceBookItemId);
        }}
        pendingProductId={pendingCatalogProductId}
      />
    </section>
  );
}
