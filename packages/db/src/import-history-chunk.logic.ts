import type { EstimateStatus, JobStatus, JobType, JobPriority } from "@fsm/types";

import { formatImportMoney, parseImportMoney } from "./import-invoice-balance-commit.logic.js";

export function normalizeImportedJobStatus(value: string | undefined): JobStatus {
  if (!value) {
    return "completed";
  }

  const normalized = value.trim().toLowerCase().replace(/[\s-]+/gu, "_");

  const direct: Record<string, JobStatus> = {
    lead: "lead",
    estimate_requested: "estimate_requested",
    estimate_sent: "estimate_sent",
    estimate_approved: "estimate_approved",
    scheduled: "scheduled",
    dispatched: "dispatched",
    in_progress: "in_progress",
    on_hold: "on_hold",
    completed: "completed",
    complete: "completed",
    done: "completed",
    closed: "closed",
    cancelled: "cancelled",
    canceled: "cancelled",
    invoiced: "invoiced",
    paid: "paid",
  };

  if (direct[normalized]) {
    return direct[normalized];
  }

  if (normalized.includes("cancel")) {
    return "cancelled";
  }
  if (normalized.includes("progress") || normalized.includes("working")) {
    return "in_progress";
  }
  if (normalized.includes("schedule")) {
    return "scheduled";
  }
  if (normalized.includes("invoice")) {
    return "invoiced";
  }

  return "completed";
}

export function normalizeImportedJobType(value: string | undefined): JobType {
  if (!value) {
    return "service_call";
  }

  const normalized = value.trim().toLowerCase();

  if (normalized.includes("maintenance") || normalized.includes("tune")) {
    return "maintenance";
  }
  if (normalized.includes("install")) {
    return "installation";
  }
  if (normalized.includes("inspect")) {
    return "inspection";
  }
  if (normalized.includes("estimate")) {
    return "estimate_only";
  }
  if (normalized.includes("warranty")) {
    return "warranty";
  }
  if (normalized.includes("callback") || normalized.includes("follow")) {
    return "callback";
  }
  if (normalized.includes("emergency") || normalized.includes("after hours")) {
    return "emergency";
  }

  return "service_call";
}

export function normalizeImportedJobPriority(value: string | undefined): JobPriority {
  if (!value) {
    return "normal";
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.includes("urgent") || normalized.includes("emergency")) {
    return "urgent";
  }
  if (normalized.includes("high")) {
    return "high";
  }
  if (normalized.includes("low")) {
    return "low";
  }

  return "normal";
}

export function normalizeImportedEstimateStatus(value: string | undefined): EstimateStatus {
  if (!value) {
    return "sent";
  }

  const normalized = value.trim().toLowerCase().replace(/[\s-]+/gu, "_");

  const direct: Record<string, EstimateStatus> = {
    draft: "draft",
    sent: "sent",
    viewed: "viewed",
    approved: "approved",
    accepted: "approved",
    declined: "declined",
    rejected: "declined",
    expired: "expired",
    converted: "converted",
    revised: "revised",
  };

  if (direct[normalized]) {
    return direct[normalized];
  }

  if (normalized.includes("approve") || normalized.includes("accept")) {
    return "approved";
  }
  if (normalized.includes("declin") || normalized.includes("reject")) {
    return "declined";
  }
  if (normalized.includes("expire")) {
    return "expired";
  }
  if (normalized.includes("view")) {
    return "viewed";
  }

  return "sent";
}

export function normalizeOptionalImportMoney(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsed = parseImportMoney(value);
  return parsed ? formatImportMoney(parsed) : null;
}

export function resolveImportedJobCompletionTime(row: {
  actualEnd?: Date | null;
  scheduledEnd?: Date | null;
  scheduledStart?: Date | null;
}): Date | null {
  return row.actualEnd ?? row.scheduledEnd ?? row.scheduledStart ?? null;
}
