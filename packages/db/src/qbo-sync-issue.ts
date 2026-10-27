import { and, desc, eq, isNull } from "drizzle-orm";

import type { QboSyncDirection, QboSyncEntityType, QboSyncIssueKind } from "@fsm/types";

import { db } from "./client.js";
import { qboSyncIssues } from "./schema.js";

export interface RecordQboSyncIssueInput {
  companyId: string;
  connectionId: string;
  direction: QboSyncDirection;
  entityType: QboSyncEntityType;
  renvaniEntityId?: string;
  qboEntityId?: string;
  kind: QboSyncIssueKind;
  code: string;
  message: string;
  payload?: Record<string, unknown>;
}

export async function recordQboSyncIssue(input: RecordQboSyncIssueInput): Promise<void> {
  await db.insert(qboSyncIssues).values({
    companyId: input.companyId,
    connectionId: input.connectionId,
    direction: input.direction,
    entityType: input.entityType,
    renvaniEntityId: input.renvaniEntityId ?? null,
    qboEntityId: input.qboEntityId ?? null,
    kind: input.kind,
    code: input.code,
    message: input.message,
    payload: input.payload ?? {}
  });
}

export async function listOpenQboSyncIssues(input: {
  companyId?: string;
  limit?: number;
}): Promise<Array<typeof qboSyncIssues.$inferSelect>> {
  const limit = input.limit ?? 50;
  const conditions = [isNull(qboSyncIssues.resolvedAt), isNull(qboSyncIssues.deletedAt)];
  if (input.companyId) {
    conditions.push(eq(qboSyncIssues.companyId, input.companyId));
  }

  return db
    .select()
    .from(qboSyncIssues)
    .where(and(...conditions))
    .orderBy(desc(qboSyncIssues.createdAt))
    .limit(limit);
}

export async function resolveQboSyncIssueRecord(input: {
  issueId: string;
  resolvedById: string;
}): Promise<void> {
  await db
    .update(qboSyncIssues)
    .set({ resolvedAt: new Date(), resolvedById: input.resolvedById })
    .where(and(eq(qboSyncIssues.id, input.issueId), isNull(qboSyncIssues.resolvedAt)));
}
