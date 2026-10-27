import { and, eq, isNull } from "drizzle-orm";

import { automationRules, db, emitEventWithExecutor, users } from "@fsm/db";
import {
  AppError,
  ErrorCode,
  type AutomationRule,
  type AutomationRuleType,
  type UpdateAutomationRuleInput
} from "@fsm/types";

import { enforceAutomationEnablePlanLimit } from "../lib/plan-usage-limits.js";

type AutomationRuleRow = typeof automationRules.$inferSelect;
type UserRow = typeof users.$inferSelect;
type SelectExecutor = Pick<typeof db, "select">;
type TransactionExecutor = Pick<typeof db, "select" | "insert" | "update">;

const AUTOMATION_RULE_DEFAULTS: ReadonlyArray<{
  ruleType: AutomationRuleType;
  delayHours: number | null;
  thresholdDays: number | null;
}> = [
  { ruleType: "estimate_follow_up", delayHours: 24, thresholdDays: null },
  { ruleType: "estimate_declined", delayHours: 24, thresholdDays: null },
  { ruleType: "invoice_reminder", delayHours: null, thresholdDays: 3 },
  { ruleType: "invoice_overdue", delayHours: null, thresholdDays: 7 },
  { ruleType: "dormant_customer", delayHours: null, thresholdDays: 180 },
  { ruleType: "maintenance_due", delayHours: null, thresholdDays: 30 },
  { ruleType: "service_agreement_renewal", delayHours: null, thresholdDays: 30 },
  { ruleType: "job_follow_up", delayHours: 48, thresholdDays: null },
  { ruleType: "review_request", delayHours: 4, thresholdDays: null }
] as const;

function buildActorName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

function toAutomationRule(row: AutomationRuleRow): AutomationRule {
  return {
    ...row,
    ruleType: row.ruleType as AutomationRule["ruleType"],
    config:
      row.config && typeof row.config === "object" && !Array.isArray(row.config)
        ? (row.config as Record<string, unknown>)
        : null
  };
}

async function getActor(companyId: string, actorId: string, executor: SelectExecutor): Promise<UserRow> {
  const [actor] = await executor
    .select()
    .from(users)
    .where(and(eq(users.companyId, companyId), eq(users.id, actorId), isNull(users.deletedAt)))
    .limit(1);

  if (!actor) {
    throw new AppError(ErrorCode.NOT_FOUND, "User not found");
  }

  return actor;
}

async function ensureAutomationRules(companyId: string, executor: TransactionExecutor): Promise<AutomationRuleRow[]> {
  const existingRules = await executor
    .select()
    .from(automationRules)
    .where(and(eq(automationRules.companyId, companyId), isNull(automationRules.deletedAt)));
  const existingTypes = new Set(existingRules.map((rule) => rule.ruleType));
  const missingRules = AUTOMATION_RULE_DEFAULTS.filter((rule) => !existingTypes.has(rule.ruleType));

  if (missingRules.length === 0) {
    return existingRules;
  }

  const insertedRules = await executor
    .insert(automationRules)
    .values(
      missingRules.map((rule) => ({
        companyId,
        ruleType: rule.ruleType,
        isEnabled: false,
        delayHours: rule.delayHours,
        thresholdDays: rule.thresholdDays,
        config: {}
      }))
    )
    .returning();

  return [...existingRules, ...insertedRules];
}

async function getAutomationRuleRecord(
  companyId: string,
  ruleId: string,
  executor: SelectExecutor
): Promise<AutomationRuleRow> {
  const [rule] = await executor
    .select()
    .from(automationRules)
    .where(and(eq(automationRules.companyId, companyId), eq(automationRules.id, ruleId), isNull(automationRules.deletedAt)))
    .limit(1);

  if (!rule) {
    throw new AppError(ErrorCode.NOT_FOUND, "Automation rule not found");
  }

  return rule;
}

export async function listAutomationRules(companyId: string): Promise<AutomationRule[]> {
  const rows = await db.transaction(async (tx) => ensureAutomationRules(companyId, tx));
  const orderByType = new Map(AUTOMATION_RULE_DEFAULTS.map((rule, index) => [rule.ruleType, index]));

  return rows
    .slice()
    .sort(
      (left, right) =>
        (orderByType.get(left.ruleType as AutomationRuleType) ?? Number.MAX_SAFE_INTEGER) -
        (orderByType.get(right.ruleType as AutomationRuleType) ?? Number.MAX_SAFE_INTEGER)
    )
    .map((row) => toAutomationRule(row));
}

export async function updateAutomationRule(
  companyId: string,
  actorId: string,
  ruleId: string,
  input: UpdateAutomationRuleInput
): Promise<AutomationRule> {
  return db.transaction(async (tx) => {
    await ensureAutomationRules(companyId, tx);
    const actor = await getActor(companyId, actorId, tx);
    const existingRule = await getAutomationRuleRecord(companyId, ruleId, tx);

    if (input.isEnabled === true && !existingRule.isEnabled) {
      await enforceAutomationEnablePlanLimit(companyId, tx);
    }

    const updatedRows = await tx
      .update(automationRules)
      .set({
        ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
        ...(input.delayHours !== undefined ? { delayHours: input.delayHours } : {}),
        ...(input.thresholdDays !== undefined ? { thresholdDays: input.thresholdDays } : {}),
        ...(input.config !== undefined ? { config: input.config ?? {} } : {}),
        updatedAt: new Date()
      })
      .where(
        and(
          eq(automationRules.companyId, companyId),
          eq(automationRules.id, existingRule.id),
          isNull(automationRules.deletedAt)
        )
      )
      .returning();
    const updatedRule = updatedRows[0];

    if (!updatedRule) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to update automation rule");
    }

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "company.updated",
      actorId,
      actorType: "user",
      actorName: buildActorName(actor.firstName, actor.lastName),
      entityType: "company",
      entityId: companyId,
      payload: {
        automationRuleId: updatedRule.id,
        ruleType: updatedRule.ruleType,
        isEnabled: updatedRule.isEnabled
      },
      summary: `Automation rule ${updatedRule.ruleType} updated`
    });

    return toAutomationRule(updatedRule);
  });
}
