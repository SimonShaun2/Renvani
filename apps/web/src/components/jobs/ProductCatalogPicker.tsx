"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import type { PriceBookItemPickerSeed, ProductCategory } from "@fsm/types";

import { Sheet } from "@/src/components/ui/Sheet";
import { CurrencyDisplay } from "@/src/components/ui/CurrencyDisplay";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { StatBadge } from "@/src/components/ui/StatBadge";
import { usePriceBookItemSearch } from "@/src/hooks/price-book.hooks";

const categoryOptions: Array<{ value: "all" | ProductCategory; label: string }> = [
  { value: "all", label: "All" },
  { value: "service", label: "Service" },
  { value: "labor", label: "Labor" },
  { value: "material", label: "Material" },
  { value: "equipment", label: "Equipment" },
  { value: "fee", label: "Fee" },
  { value: "bundle", label: "Bundle" }
];

interface ProductCatalogPickerProps {
  open: boolean;
  onClose: () => void;
  onAddPriceBookItem: (item: PriceBookItemPickerSeed) => Promise<void>;
  pendingProductId: string | null;
}

export function ProductCatalogPicker({
  open,
  onClose,
  onAddPriceBookItem,
  pendingProductId
}: ProductCatalogPickerProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState<"all" | ProductCategory>("all");
  const productSearch = usePriceBookItemSearch(debouncedSearch);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setDebouncedSearch("");
      setCategory("all");
    }
  }, [open]);

  const results = useMemo(() => {
    const items = productSearch.data?.items ?? [];

    if (category === "all") {
      return items;
    }

    return items.filter((product) => {
      if (category === "service") {
        return product.itemType === "service";
      }

      return product.itemType === category;
    });
  }, [category, productSearch.data?.items]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Price book"
      description="Search imported price book items and add lines with description, price, and tax defaults."
    >
      <div className="space-y-5 px-6 py-6">
        <label className="flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
          <Search className="h-4 w-4" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search price book"
            className="w-full bg-transparent outline-none placeholder:text-neutral-400"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          {categoryOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setCategory(option.value)}
              className={
                category === option.value
                  ? "rounded-full bg-brand-accent px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-full bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-500 transition hover:text-neutral-900"
              }
            >
              {option.label}
            </button>
          ))}
        </div>

        {productSearch.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, index) => (
              <SkeletonCard key={index} className="h-[88px]" />
            ))}
          </div>
        ) : productSearch.isError ? (
          <p className="rounded-3xl border border-error/15 bg-error-light px-4 py-4 text-sm text-error">
            Catalog search could not be loaded right now.
          </p>
        ) : debouncedSearch.length < 2 ? (
          <EmptyState
            icon={Search}
            title="Search the price book"
            subtitle="Type at least two characters to find imported services, labor, materials, and fees."
            compact
          />
        ) : results.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No matching price book items"
            subtitle="Try a different search or switch categories to widen the result set."
            compact
          />
        ) : (
          <div className="space-y-3">
            {results.map((product) => (
              <div
                key={product.priceBookItemId}
                className="flex flex-col gap-3 rounded-[24px] border border-neutral-200 bg-white px-4 py-4 shadow-sm md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-neutral-900">{product.name}</p>
                    <StatBadge label={product.itemType} tone="neutral" />
                  </div>
                  {product.description ? <p className="mt-1 text-sm text-neutral-500">{product.description}</p> : null}
                </div>

                <div className="flex items-center gap-3">
                  <CurrencyDisplay value={product.unitPrice} className="text-sm font-semibold text-neutral-900" showCents />
                  <button
                    type="button"
                    disabled={pendingProductId === product.priceBookItemId}
                    onClick={() => {
                      void onAddPriceBookItem(product);
                    }}
                    className="inline-flex items-center gap-2 rounded-full bg-brand-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-primary disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {pendingProductId === product.priceBookItemId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}
