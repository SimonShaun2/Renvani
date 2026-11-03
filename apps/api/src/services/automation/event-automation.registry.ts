/**
 * Event-to-automation registry. Domain services emit an event after their transaction commits;
 * registered automations run best-effort and never throw back into the payment path.
 */
import pino from "pino";

import { requestPlanReminder } from "../plan-reminders/plan-reminder.service.js";
import { requestReviewForPaidInvoice } from "../review-request.service.js";

const logger = pino({ name: "event-automation" });

export type AutomationEvent =
  | {
      eventType: "invoice.paid";
      companyId: string;
      invoiceId: string;
    }
  | {
      /** Plan renewal or seasonal tune-up is inside its reminder window (daily plan-reminder scan). */
      eventType: "renewal.due";
      companyId: string;
      maintenancePlanId: string;
      reminderKind: "renewal" | "tune_up";
      dueDate: string;
    };

export type AutomationEventType = AutomationEvent["eventType"];

export interface EventAutomation {
  id: string;
  run(event: AutomationEvent): Promise<unknown>;
}

const registry = new Map<AutomationEventType, EventAutomation[]>();

export function registerEventAutomation(eventType: AutomationEventType, automation: EventAutomation): void {
  const existing = registry.get(eventType) ?? [];
  if (existing.some((entry) => entry.id === automation.id)) {
    return;
  }
  registry.set(eventType, [...existing, automation]);
}

export function listEventAutomations(eventType: AutomationEventType): readonly EventAutomation[] {
  return registry.get(eventType) ?? [];
}

/** Test hook. */
export function resetEventAutomationsForTests(): void {
  registry.clear();
  registerDefaultEventAutomations();
}

export async function dispatchEventAutomation(event: AutomationEvent): Promise<void> {
  for (const automation of listEventAutomations(event.eventType)) {
    try {
      await automation.run(event);
    } catch (error: unknown) {
      logger.error(
        { err: error, automationId: automation.id, eventType: event.eventType, companyId: event.companyId },
        "Event automation failed"
      );
    }
  }
}

export const INVOICE_PAID_REVIEW_REQUEST_AUTOMATION_ID = "review-request.on-invoice-paid";
export const RENEWAL_DUE_PLAN_REMINDER_AUTOMATION_ID = "plan-reminder.on-renewal-due";

function registerDefaultEventAutomations(): void {
  registerEventAutomation("invoice.paid", {
    id: INVOICE_PAID_REVIEW_REQUEST_AUTOMATION_ID,
    run: (event) => (event.eventType === "invoice.paid" ? requestReviewForPaidInvoice(event.companyId, event.invoiceId) : Promise.resolve(null))
  });
  registerEventAutomation("renewal.due", {
    id: RENEWAL_DUE_PLAN_REMINDER_AUTOMATION_ID,
    run: (event) => (event.eventType === "renewal.due" ? requestPlanReminder(event) : Promise.resolve(null))
  });
}

registerDefaultEventAutomations();
