import { z } from "zod";

import {
  QboMappingKindSchema,
  UpsertQboMappingsBodyV1Schema,
  UuidSchema
} from "@fsm/types";

export const qboCatalogQuerySchema = z.object({
  kind: QboMappingKindSchema
});

export const qboIssueParamsSchema = z.object({
  issueId: UuidSchema
});

export const upsertQboMappingsBodySchema = UpsertQboMappingsBodyV1Schema;
