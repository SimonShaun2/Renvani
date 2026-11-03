import { z } from "zod";

import type { EstimateItemType } from "./estimate.types.js";
import type { InvoiceItemType } from "./invoice.types.js";

export type PriceBookLineItemType = EstimateItemType | InvoiceItemType;

export const priceBookItemSearchQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(200)
  })
  .strict();

export type PriceBookItemSearchQuery = z.infer<typeof priceBookItemSearchQuerySchema>;

export const priceBookItemPickerSeedSchema = z.object({
  priceBookItemId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  unitPrice: z.string(),
  isTaxable: z.boolean(),
  itemType: z.enum(["service", "labor", "material", "fee"])
});

export type PriceBookItemPickerSeed = z.infer<typeof priceBookItemPickerSeedSchema>;

export const priceBookItemSearchResponseSchema = z.object({
  items: z.array(priceBookItemPickerSeedSchema)
});

export type PriceBookItemSearchResponse = z.infer<typeof priceBookItemSearchResponseSchema>;
