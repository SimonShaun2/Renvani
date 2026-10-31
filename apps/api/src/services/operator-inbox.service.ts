import { and, count, eq, gte, inArray, lt } from "drizzle-orm";

import { activityEvents, agentActions, db } from "@fsm/db";
import type {
  OperatorInboxCounts,
  OperatorInboxItem,
  OperatorInboxProvenanceEvent,
  OperatorInboxTimelineEntry
} from "@fsm/types";
import { AgentActionStateV1Schema, AppError, ErrorCode } from "@fsm/types";

import { getAgentAction, listAgentActions, type AgentActionState } from "./agent-action.service.js";
import {
  type AgentActionRowView,
  type OperatorInboxItemExtras,
  formatProposalNumber,
  toOperatorInboxItem
} from "./operator-inbox.mapper.js";

const AGENT_ACTION_ENTITY_TYPE = "agent_action";

function mapToRowView(action: Awaited<ReturnType<typeof getAgentAction>>): AgentActionRowView {
  return {
    id: action.id,
    agentProduct: action.agentProduct,
    actionType: action.actionType,
    parameters: action.parameters,
    approvedParameters: action.approvedParameters ?? null,
    sourceEventIds: action.sourceEventIds,
    policyVersion: action.policyVersion,
    requiresApproval: action.requiresApproval,
    state: action.state,
    confidence: action.confidence?.toString() ?? null,
    reason: action.reason,
    expiresAt: action.expiresAt,
    reviewerId: action.reviewerId,
    executionReceipt: action.executionReceipt,
    createdAt: action.createdAt,
    updatedAt: action.updatedAt
  };
}

async function loadProvenanceEvents(
  companyId: string,
  eventIds: string[]
): Promise<OperatorInboxProvenanceEvent[]> {
  if (eventIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      id: activityEvents.id,
      eventType: activityEvents.eventType,
      summary: activityEvents.summary,
      occurredAt: activityEvents.occurredAt
    })
    .from(activityEvents)
    .where(and(eq(activityEvents.companyId, companyId), inArray(activityEvents.id, eventIds)));

  return rows.map((row) => ({
    id: row.id,
    eventType: row.eventType,
    summary: row.summary,
    createdAt: row.occurredAt.toISOString()
  }));
}

type ProposalKey = { id: string; createdAt: Date };

function compareProposalKey(a: ProposalKey, b: ProposalKey): number {
  const byTime = a.createdAt.getTime() - b.createdAt.getTime();
  if (byTime !== 0) return byTime;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Proposal numbers: 1-based (createdAt, id) order within the tenant, counting soft-deleted rows so numbers never
 * shift. Bounded instead of scanning the tenant: one COUNT for rows before the earliest requested proposal, plus
 * the (createdAt, id) window spanning the requested proposals. A single get reads a window of ~1 row.
 */
export async function loadProposalSequences(companyId: string, actionIds: string[]): Promise<Map<string, number>> {
  const sequences = new Map<string, number>();
  if (actionIds.length === 0) return sequences;

  // agent_actions.created_at has microsecond precision but JS Dates are millisecond-truncated, so every bound
  // below is built from whole milliseconds: prefix is strictly before firstMs, the window is the half-open
  // [firstMs, lastMs + 1ms). Ordering is (ms, id) in JS, so rows sharing a millisecond are numbered by id.
  const targets: ProposalKey[] = (
    await db
      .select({ id: agentActions.id, createdAt: agentActions.createdAt })
      .from(agentActions)
      .where(and(eq(agentActions.companyId, companyId), inArray(agentActions.id, actionIds)))
  ).map((row) => ({ id: row.id, createdAt: new Date(row.createdAt.getTime()) }));
  if (targets.length === 0) return sequences;
  targets.sort(compareProposalKey);
  const firstMs = new Date(targets[0]!.createdAt.getTime());
  const afterLastMs = new Date(targets[targets.length - 1]!.createdAt.getTime() + 1);

  const [prefix] = await db
    .select({ value: count() })
    .from(agentActions)
    .where(and(eq(agentActions.companyId, companyId), lt(agentActions.createdAt, firstMs)));
  const before = Number(prefix?.value ?? 0);

  const window: ProposalKey[] = (
    await db
      .select({ id: agentActions.id, createdAt: agentActions.createdAt })
      .from(agentActions)
      .where(
        and(
          eq(agentActions.companyId, companyId),
          gte(agentActions.createdAt, firstMs),
          lt(agentActions.createdAt, afterLastMs)
        )
      )
  )
    .map((row) => ({ id: row.id, createdAt: new Date(row.createdAt.getTime()) }))
    .sort(compareProposalKey);

  const wanted = new Set(targets.map((row) => row.id));
  window.forEach((row, index) => {
    if (wanted.has(row.id)) sequences.set(row.id, before + index + 1);
  });
  return sequences;
}

/** Proposal number (bounded lookup) + proposal version: 1 + operator edits (agent.proposal_edited audit events). */
async function loadItemExtras(companyId: string, actionIds: string[]): Promise<Map<string, OperatorInboxItemExtras>> {
  const extras = new Map<string, OperatorInboxItemExtras>();
  if (actionIds.length === 0) {
    return extras;
  }

  const sequenceById = await loadProposalSequences(companyId, actionIds);

  const edits = await db
    .select({ entityId: activityEvents.entityId })
    .from(activityEvents)
    .where(
      and(
        eq(activityEvents.companyId, companyId),
        eq(activityEvents.entityType, AGENT_ACTION_ENTITY_TYPE),
        eq(activityEvents.eventType, "agent.proposal_edited"),
        inArray(activityEvents.entityId, actionIds)
      )
    );
  const editCounts = new Map<string, number>();
  for (const edit of edits) {
    editCounts.set(edit.entityId, (editCounts.get(edit.entityId) ?? 0) + 1);
  }

  for (const id of actionIds) {
    const sequence = sequenceById.get(id);
    extras.set(id, {
      ...(sequence ? { proposalNumber: formatProposalNumber(sequence) } : {}),
      proposalVersion: 1 + (editCounts.get(id) ?? 0)
    });
  }
  return extras;
}

/** Per-state counts for inbox tabs (every agent-action state present, zero-filled). */
export async function countOperatorInbox(
  companyId: string,
  filters: { agentProduct?: string } = {}
): Promise<OperatorInboxCounts> {
  const actions = await listAgentActions(companyId, filters);
  const counts: Record<string, number> = Object.fromEntries(AgentActionStateV1Schema.options.map((state) => [state, 0]));
  for (const action of actions) {
    counts[action.state] = (counts[action.state] ?? 0) + 1;
  }
  return { counts, total: actions.length };
}

function isEscalationAudit(row: { eventType: string; payload: unknown }): boolean {
  const payload = row.payload as Record<string, unknown> | null;
  return row.eventType === "agent.proposal_rejected" && payload?.outcome === "escalated";
}

/** Audit timeline for one proposal: agent_action activity events, oldest first, plus escalation from the receipt. */
export async function getOperatorInboxTimeline(
  companyId: string,
  actionId: string
): Promise<OperatorInboxTimelineEntry[]> {
  const action = await getAgentAction(companyId, actionId);
  const rows = await db
    .select({
      id: activityEvents.id,
      eventType: activityEvents.eventType,
      actorId: activityEvents.actorId,
      actorType: activityEvents.actorType,
      summary: activityEvents.summary,
      payload: activityEvents.payload,
      occurredAt: activityEvents.occurredAt
    })
    .from(activityEvents)
    .where(
      and(
        eq(activityEvents.companyId, companyId),
        eq(activityEvents.entityType, AGENT_ACTION_ENTITY_TYPE),
        eq(activityEvents.entityId, actionId)
      )
    );

  const receipt = action.executionReceipt as Record<string, unknown> | null;
  const escalationSummary =
    typeof receipt?.reason === "string" ? `Escalated: ${receipt.reason}` : "Agent proposal escalated";
  const entries: OperatorInboxTimelineEntry[] = rows.map((row) => ({
    id: row.id,
    at: row.occurredAt.toISOString(),
    // Escalation is audited as proposal_rejected + outcome "escalated" (no enum migration); show it as escalated.
    kind: isEscalationAudit(row) ? "agent.proposal_escalated" : row.eventType,
    actorId: row.actorId ?? null,
    actorType: row.actorType ?? null,
    summary: isEscalationAudit(row) ? escalationSummary : row.summary
  }));

  const hasEscalationEvent = rows.some(isEscalationAudit);
  if (!hasEscalationEvent && action.state === "escalated" && receipt && typeof receipt.escalatedAt === "string") {
    entries.push({
      id: `${actionId}:escalated`,
      at: receipt.escalatedAt,
      kind: "agent.proposal_escalated",
      actorId: typeof receipt.escalatedBy === "string" ? receipt.escalatedBy : null,
      actorType: "user",
      summary: escalationSummary
    });
  }

  return entries.sort((a, b) => a.at.localeCompare(b.at));
}

export async function listOperatorInbox(
  companyId: string,
  filters: { state?: AgentActionState; agentProduct?: string }
): Promise<OperatorInboxItem[]> {
  const actions = await listAgentActions(companyId, filters);
  const allEventIds = Array.from(new Set(actions.flatMap((action) => action.sourceEventIds)));
  const events = await loadProvenanceEvents(companyId, allEventIds);
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const extras = await loadItemExtras(companyId, actions.map((action) => action.id));

  return actions.map((action) => {
    const row = mapToRowView(action);
    const sourceEvents = row.sourceEventIds
      .map((eventId) => eventsById.get(eventId))
      .filter((event): event is OperatorInboxProvenanceEvent => Boolean(event));

    return toOperatorInboxItem(row, sourceEvents, extras.get(row.id));
  });
}

export async function getOperatorInboxItem(companyId: string, actionId: string): Promise<OperatorInboxItem> {
  const action = await getAgentAction(companyId, actionId);
  const row = mapToRowView(action);
  const sourceEvents = await loadProvenanceEvents(companyId, row.sourceEventIds);
  const extras = await loadItemExtras(companyId, [row.id]);
  return toOperatorInboxItem(row, sourceEvents, extras.get(row.id));
}

export async function getJobTimelineForProvenance(
  companyId: string,
  jobId: string,
  eventIds: string[]
): Promise<OperatorInboxProvenanceEvent[]> {
  if (eventIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      id: activityEvents.id,
      eventType: activityEvents.eventType,
      summary: activityEvents.summary,
      occurredAt: activityEvents.occurredAt
    })
    .from(activityEvents)
    .where(
      and(eq(activityEvents.companyId, companyId), eq(activityEvents.jobId, jobId), inArray(activityEvents.id, eventIds))
    );

  if (rows.length !== eventIds.length) {
    throw new AppError(ErrorCode.FORBIDDEN, "One or more provenance events are not visible for this job");
  }

  return rows.map((row) => ({
    id: row.id,
    eventType: row.eventType,
    summary: row.summary,
    createdAt: row.occurredAt.toISOString()
  }));
}
