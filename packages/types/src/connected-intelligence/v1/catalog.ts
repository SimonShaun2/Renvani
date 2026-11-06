import { COMMAND_CENTER_KPI_REGISTRY } from "../../command-center.types.js";

/** Internal foundation only. This module is intentionally absent from package exports/startup. */
export const EVIDENCE_VERSION = "1.0.0" as const;
export const SENSITIVITIES = ["operational", "financial", "labor_aggregate", "wages", "internal_safety"] as const;
export type Sensitivity = (typeof SENSITIVITIES)[number];
export type FactUnit = "count" | "money" | "percent" | "quantity";
export interface MetricDefinition {
  id: string;
  version: string;
  label: string;
  unit: FactUnit;
  basis: string;
  grain: string;
  sensitivity: Sensitivity;
  formula: string;
  exclusions: readonly string[];
  requiredEvidence: readonly string[];
  maturity: "legacy_defined" | "proposed_contract";
}

const metric = (
  id: string, label: string, unit: FactUnit, basis: string, grain: string,
  sensitivity: Sensitivity, formula: string, requiredEvidence: readonly string[],
  exclusions: readonly string[] = []
): MetricDefinition => ({ id, version: EVIDENCE_VERSION, label, unit, basis, grain, sensitivity, formula,
  requiredEvidence, exclusions, maturity: "proposed_contract" });

export const METRICS: readonly MetricDefinition[] = [
  ...COMMAND_CENTER_KPI_REGISTRY.map((item): MetricDefinition => ({
    id: `legacy.${item.key}`, version: "1.0.0", label: item.label, unit: item.unit,
    basis: `legacy.${item.key}.v1`, grain: "company_calendar_month",
    sensitivity: item.unit === "money" ? "financial" : "operational",
    formula: item.definition, requiredEvidence: ["command_center_brief"],
    exclusions: ["Not a causal lift estimate", "Keep legacy cohort and accounting meaning"], maturity: "legacy_defined"
  })),
  metric("attention.approvals", "Approvals awaiting review", "count", "current_action_state", "company_as_of", "operational", "Count pending authorized proposals; not dispatched actions.", ["needs_you"]),
  metric("attention.exceptions", "Recorded exceptions", "count", "current_action_state", "company_as_of", "operational", "Count current recorded exceptions; not inferred failures.", ["needs_you"]),
  metric("jobs.today", "Jobs today", "count", "scheduled_company_local_day", "company_local_day", "operational", "Distinct scheduled job IDs in the resolved company-local day.", ["jobs"]),
  metric("sales.completed_net", "Completed-job net sales", "money", "completed_job_net_sales", "job_cohort", "financial", "Allocated net sales less credits for the fixed completed cohort.", ["jobs", "invoices", "adjustments"], ["Tax treatment needs approved policy", "Collections and estimates are not additional sales"]),
  metric("invoices.value", "Invoice value", "money", "finalized_invoice_value", "invoice_cohort", "financial", "Sum finalized allocated invoice values under the stated basis.", ["invoices", "adjustments"]),
  metric("cash.collected", "Reconciled net collections", "money", "payment_settlement", "payment_cohort", "financial", "Settled collections less settled refunds; not another sale.", ["payments", "refunds", "reconciliation"]),
  metric("cost.labor", "Approved labor cost", "money", "approved_historical_labor", "job_cohort", "labor_aggregate", "Approved time and effective rate versions with approved allocation policy.", ["approved_time", "effective_rates", "allocation_policy"]),
  metric("cost.material", "Consumed material cost", "money", "historical_consumption", "job_cohort", "financial", "Historical issue valuation less source-linked returns/corrections.", ["stock_issues", "valuation", "returns"]),
  metric("cost.actual", "Direct actual cost", "money", "direct_actual_cost", "job_cohort", "financial", "Unique approved direct cost postings; missing components invalidate final completeness.", ["cost_postings", "cost_completeness"]),
  metric("cost.committed", "Open purchase commitment", "money", "approved_unfulfilled_commitment", "job_cohort", "financial", "Approved unfulfilled spending commitments; never an additional actual expense.", ["purchase_orders"]),
  metric("margin.direct", "Direct gross margin", "money", "completed_sales_less_direct_actual", "job_cohort", "financial", "Completed-job net sales less complete source-linked direct actual costs.", ["sales.completed_net", "cost.actual"], ["Not statutory net profit", "Exclude unconsumed commitments from actual cost"]),
  metric("margin.percent", "Direct gross margin percentage", "percent", "completed_sales_less_direct_actual", "job_cohort", "financial", "100 × direct gross margin / completed-job net sales; zero denominator is unavailable.", ["sales.completed_net", "cost.actual"]),
  metric("payroll.gross", "Approved gross preparation", "money", "approved_earnings", "employee_pay_period", "wages", "Approved time/earning snapshots under the effective policy; missing required rate blocks final total.", ["approved_time", "effective_rates", "earnings_policy"], ["Not net pay", "Exported is not paid"]),
  metric("payroll.blockers", "Payroll preparation blockers", "count", "required_payroll_exceptions", "pay_period", "wages", "Unresolved mandatory payroll-preparation prerequisites.", ["payroll_review"]),
  metric("stock.available", "Available stock", "quantity", "on_hand_less_reserved", "product_location", "operational", "Verified on-hand quantity minus current reservations in one approved unit.", ["stock_levels", "reservations", "unit_policy"], ["Unreceived stock is not on hand"]),
  metric("purchasing.exceptions", "Purchasing exceptions", "count", "purchase_receipt_bill_state", "purchase_line", "financial", "Unresolved source-linked purchasing/receipt/bill exceptions.", ["purchase_orders", "receipts", "bill_matches"]),
  metric("forms.blockers", "Required form blockers", "count", "pinned_form_requirements", "job_form_assignment", "operational", "Unmet required fields/artifacts/reviews against the assigned template version.", ["form_assignments", "submissions", "uploads"]),
  metric("accounting.mismatches", "Unreconciled accounting records", "count", "accounting_reconciliation", "connection_entity", "financial", "Records with an unresolved mapping, effect or basis-adjusted difference.", ["accounting_mappings", "reconciliation"]),
  metric("migration.accepted", "Reconciled imported records", "count", "accepted_import_lineage", "import_entity_batch", "operational", "Accepted records with reconciled source relationships; historical origin retained.", ["import_lineage", "reconciliation"]),
  metric("implementation.pending", "Unmet launch requirements", "count", "verified_readiness_requirements", "implementation_project", "operational", "Mandatory unaccepted readiness gates for the selected capability scope.", ["implementation_evidence"])
];

export function getMetric(id: string): MetricDefinition | undefined { return METRICS.find((item) => item.id === id); }
export const CAPABILITY_IDS = ["brief", "jobs", "estimates", "invoices", "workforce", "inventory", "costing", "purchasing", "forms", "qbo", "qbd", "migration", "implementation", "retention", "attribution", "goals"] as const;
export type CapabilityId = (typeof CAPABILITY_IDS)[number];
export interface CapabilityDescriptor {
  id: CapabilityId;
  version: string;
  permission: string;
  sensitivity: Sensitivity;
  sourceStatus: "source_present" | "partial_source" | "new_domain";
  maxPageSize: number;
  configured: false;
  validated: false;
  enabled: false;
  runtimeOwner: string;
}
const capability = (id: CapabilityId, sensitivity: Sensitivity, sourceStatus: CapabilityDescriptor["sourceStatus"], runtimeOwner: string, maxPageSize = 100): CapabilityDescriptor => ({
  id, version: EVIDENCE_VERSION, permission: `insights.read.${id}`, sensitivity, sourceStatus, maxPageSize,
  configured: false, validated: false, enabled: false, runtimeOwner
});
/** Source presence is not a grant, configured adapter, verified integration or activation. */
export const CAPABILITIES: readonly CapabilityDescriptor[] = [
  capability("brief", "operational", "source_present", "C05"), capability("jobs", "operational", "source_present", "C05"),
  capability("estimates", "operational", "source_present", "C05"), capability("invoices", "financial", "source_present", "C05"),
  capability("workforce", "wages", "partial_source", "C11"), capability("inventory", "operational", "partial_source", "C12", 200),
  capability("costing", "financial", "new_domain", "C13/C18"), capability("purchasing", "financial", "new_domain", "C16/C17"),
  capability("forms", "operational", "partial_source", "C14/C15"), capability("qbo", "financial", "partial_source", "C19"),
  capability("qbd", "financial", "new_domain", "C20"), capability("migration", "operational", "partial_source", "C22"),
  capability("implementation", "operational", "partial_source", "C23"), capability("retention", "operational", "partial_source", "C24"),
  capability("attribution", "financial", "partial_source", "C24"), capability("goals", "financial", "partial_source", "C24")
];
export function getCapability(id: CapabilityId): CapabilityDescriptor {
  const result = CAPABILITIES.find((item) => item.id === id);
  if (!result) throw new Error("Unknown capability");
  return result;
}
