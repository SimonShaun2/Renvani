import type { JobStatus } from "@fsm/types";

/** Labels describe server-owned job state; they never initiate financial actions. */
export function mobileCloseoutMessage(status: JobStatus): string | null {
  switch (status) {
    case "completed": return "Work record saved. The office can review this job and prepare the invoice.";
    case "invoiced": return "This job is invoiced. The office manages the invoice and payment follow-up.";
    case "paid": return "This job is marked paid. No new invoice is needed here.";
    default: return null;
  }
}
