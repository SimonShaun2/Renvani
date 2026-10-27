import { z } from "zod";

import { UuidSchema } from "../../agent-control-plane/v1/zod-shared.js";

import { QBO_SYNC_CONTRACT_VERSION } from "./constants.js";

export const QboMappingKindSchema = z.enum([
  "price_book_item",
  "tax_code",
  "payment_method"
]);

export type QboMappingKind = z.infer<typeof QboMappingKindSchema>;

export const QboExternalRefSchema = z
  .object({
    qboId: z.string().min(1).max(64),
    qboName: z.string().min(1).max(255)
  })
  .strict();

export type QboExternalRef = z.infer<typeof QboExternalRefSchema>;

export const QboEntityMappingV1Schema = z
  .object({
    kind: QboMappingKindSchema,
    localKey: z.string().min(1).max(128),
    localLabel: z.string().min(1).max(255),
    qbo: QboExternalRefSchema.nullable()
  })
  .strict();

export type QboEntityMappingV1 = z.infer<typeof QboEntityMappingV1Schema>;

export const QboMappingBoardV1Schema = z
  .object({
    contractVersion: z.literal(QBO_SYNC_CONTRACT_VERSION),
    companyId: UuidSchema,
    mappings: z.array(QboEntityMappingV1Schema)
  })
  .strict();

export type QboMappingBoardV1 = z.infer<typeof QboMappingBoardV1Schema>;

export const UpsertQboMappingsBodyV1Schema = z
  .object({
    mappings: z.array(
      z
        .object({
          kind: QboMappingKindSchema,
          localKey: z.string().min(1).max(128),
          qbo: QboExternalRefSchema.nullable()
        })
        .strict()
    )
  })
  .strict();

export type UpsertQboMappingsBodyV1 = z.infer<typeof UpsertQboMappingsBodyV1Schema>;

export const QboCatalogItemV1Schema = z
  .object({
    qboId: z.string().min(1).max(64),
    name: z.string().min(1).max(255),
    active: z.boolean()
  })
  .strict();

export const QboCatalogV1Schema = z
  .object({
    contractVersion: z.literal(QBO_SYNC_CONTRACT_VERSION),
    kind: QboMappingKindSchema,
    items: z.array(QboCatalogItemV1Schema)
  })
  .strict();

export type QboCatalogV1 = z.infer<typeof QboCatalogV1Schema>;
