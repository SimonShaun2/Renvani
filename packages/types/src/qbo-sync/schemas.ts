import { z } from "zod";

export const QBO_SYNC_ENTITY_TYPES = ["customer", "invoice", "payment"] as const;

export const QboSyncEntityTypeSchema = z.enum(QBO_SYNC_ENTITY_TYPES);

export type QboSyncEntityType = z.infer<typeof QboSyncEntityTypeSchema>;

export const QboSyncDirectionSchema = z.enum(["push", "pull"]);

export type QboSyncDirection = z.infer<typeof QboSyncDirectionSchema>;

export const QboSyncIssueKindSchema = z.enum(["conflict", "error"]);

export type QboSyncIssueKind = z.infer<typeof QboSyncIssueKindSchema>;

export const QboConnectionStatusSchema = z.enum(["pending", "connected", "error", "disconnected"]);

export type QboConnectionStatus = z.infer<typeof QboConnectionStatusSchema>;

export const QboSyncPushJobPayloadSchema = z.object({
  companyId: z.string().uuid(),
  entityType: QboSyncEntityTypeSchema,
  entityId: z.string().uuid(),
  idempotencyKey: z.string().min(1).max(255),
  actorId: z.string().uuid().optional()
});

export type QboSyncPushJobPayload = z.infer<typeof QboSyncPushJobPayloadSchema>;

export const QboSyncPullJobPayloadSchema = z.object({
  companyId: z.string().uuid(),
  idempotencyKey: z.string().min(1).max(255),
  cdcSince: z.string().max(64).optional(),
  actorId: z.string().uuid().optional()
});

export type QboSyncPullJobPayload = z.infer<typeof QboSyncPullJobPayloadSchema>;

export function buildQboSyncPushJobId(idempotencyKey: string): string {
  return `qbo-sync-push-${idempotencyKey}`;
}

export function buildQboSyncPullJobId(companyId: string, windowKey: string): string {
  return `qbo-sync-pull-${companyId}-${windowKey}`;
}
