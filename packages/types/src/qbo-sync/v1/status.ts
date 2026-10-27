import { z } from "zod";

import { UuidSchema } from "../../agent-control-plane/v1/zod-shared.js";
import {
  QboSyncDirectionSchema,
  QboSyncEntityTypeSchema,
  QboSyncIssueKindSchema
} from "../schemas.js";

import { QBO_SYNC_CONTRACT_VERSION } from "./constants.js";
import { QboMappingKindSchema } from "./mapping.js";

export const QboConnectionPhaseSchema = z.enum([
  "disconnected",
  "connected_sandbox",
  "connected_production"
]);

export type QboConnectionPhase = z.infer<typeof QboConnectionPhaseSchema>;

export const QboSyncRunStatusSchema = z.enum(["idle", "running", "degraded", "error"]);

export type QboSyncRunStatus = z.infer<typeof QboSyncRunStatusSchema>;

export const QboSyncIssueSummaryV1Schema = z
  .object({
    id: UuidSchema,
    direction: QboSyncDirectionSchema,
    entityType: QboSyncEntityTypeSchema,
    renvaniEntityId: UuidSchema.nullable(),
    qboEntityId: z.string().max(64).nullable(),
    kind: QboSyncIssueKindSchema,
    code: z.string().min(1).max(64),
    message: z.string().min(1).max(2_000),
    createdAt: z.string().datetime(),
    resolvedAt: z.string().datetime().nullable()
  })
  .strict();

export type QboSyncIssueSummaryV1 = z.infer<typeof QboSyncIssueSummaryV1Schema>;

export const QboSyncStatusV1Schema = z
  .object({
    contractVersion: z.literal(QBO_SYNC_CONTRACT_VERSION),
    companyId: UuidSchema,
    sandboxOnly: z.literal(true),
    connection: z
      .object({
        phase: QboConnectionPhaseSchema,
        realmId: z.string().min(1).max(64).nullable(),
        connectedAt: z.string().datetime().nullable()
      })
      .strict(),
    sync: z
      .object({
        status: QboSyncRunStatusSchema,
        lastSuccessfulAt: z.string().datetime().nullable(),
        lastAttemptAt: z.string().datetime().nullable(),
        pendingIssueCount: z.number().int().min(0),
        mappedCounts: z.object({
          priceBookItem: z.number().int().min(0),
          taxCode: z.number().int().min(0),
          paymentMethod: z.number().int().min(0)
        })
      })
      .strict(),
    recentIssues: z.array(QboSyncIssueSummaryV1Schema)
  })
  .strict();

export type QboSyncStatusV1 = z.infer<typeof QboSyncStatusV1Schema>;
