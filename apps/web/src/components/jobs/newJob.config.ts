import type { CreateJobInput, JobPriority, JobType } from "@fsm/types";

/**
 * FS-177 create-job form registry. Fields render in this order; add a field here (and to
 * buildCreateJobPayload) rather than in the component. Only fields the dev API accepts
 * (POST /api/v1/jobs, CreateJobInput) are listed.
 */
export type NewJobFieldKey =
  | "customerId"
  | "propertyId"
  | "title"
  | "type"
  | "priority"
  | "technicianId"
  | "scheduledStart"
  | "scheduledEnd"
  | "description";

export type NewJobFieldKind = "customer" | "property" | "text" | "select" | "technician" | "datetime" | "textarea";

export interface NewJobField {
  key: NewJobFieldKey;
  label: string;
  kind: NewJobFieldKind;
  required?: boolean;
  maxLength?: number;
  options?: ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string;
  /** Grid span on desktop (2 = full row). */
  span?: 1 | 2;
}

export const JOB_TYPE_OPTIONS: ReadonlyArray<{ value: JobType; label: string }> = [
  { value: "service_call", label: "Service call" },
  { value: "maintenance", label: "Maintenance" },
  { value: "installation", label: "Installation" },
  { value: "inspection", label: "Inspection" },
  { value: "estimate_only", label: "Estimate only" },
  { value: "warranty", label: "Warranty" },
  { value: "callback", label: "Callback" },
  { value: "emergency", label: "Emergency" }
];

export const JOB_PRIORITY_OPTIONS: ReadonlyArray<{ value: JobPriority; label: string }> = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" }
];

export const NEW_JOB_FIELDS: readonly NewJobField[] = [
  { key: "customerId", label: "Customer", kind: "customer", required: true, span: 2 },
  { key: "propertyId", label: "Service address", kind: "property", span: 2 },
  { key: "title", label: "Service", kind: "text", required: true, maxLength: 200, placeholder: "e.g. No-heat diagnostic", span: 2 },
  { key: "type", label: "Job type", kind: "select", options: JOB_TYPE_OPTIONS },
  { key: "priority", label: "Priority", kind: "select", options: JOB_PRIORITY_OPTIONS },
  { key: "technicianId", label: "Tech", kind: "technician", span: 2 },
  { key: "scheduledStart", label: "Start", kind: "datetime" },
  { key: "scheduledEnd", label: "End", kind: "datetime" },
  { key: "description", label: "Work order", kind: "textarea", maxLength: 2000, placeholder: "What's going on?", span: 2 }
];

export const NEW_JOB_COPY = {
  eyebrow: "NEW JOB",
  title: "New job",
  subtitle: "Book work for a customer. You can add line items after the job is created.",
  submit: "Create job",
  submitting: "Creating…",
  cancel: "Cancel",
  customerSearchPlaceholder: "Search customers…",
  customerChange: "Change",
  noProperties: "No saved addresses for this customer",
  unassigned: "Unassigned",
  submitError: "We couldn't create the job. Check the details and try again."
} as const;

export type NewJobValues = Record<NewJobFieldKey, string>;

export function emptyNewJobValues(customerId = ""): NewJobValues {
  return {
    customerId,
    propertyId: "",
    title: "",
    type: "service_call",
    priority: "normal",
    technicianId: "",
    scheduledStart: "",
    scheduledEnd: "",
    description: ""
  };
}

export type NewJobErrors = Partial<Record<NewJobFieldKey, string>>;

export function validateNewJob(values: NewJobValues): NewJobErrors {
  const errors: NewJobErrors = {};
  for (const field of NEW_JOB_FIELDS) {
    const value = values[field.key].trim();
    if (field.required && !value) errors[field.key] = `${field.label} is required`;
    else if (field.maxLength && value.length > field.maxLength) errors[field.key] = `${field.label} must be ${field.maxLength} characters or less`;
  }
  const { scheduledStart: start, scheduledEnd: end } = values;
  if (start && !end) errors.scheduledEnd = "Add an end time";
  if (end && !start) errors.scheduledStart = "Add a start time";
  if (start && end && !(new Date(end).getTime() > new Date(start).getTime())) errors.scheduledEnd = "End must be after start";
  if (!JOB_TYPE_OPTIONS.some((o) => o.value === values.type)) errors.type = "Pick a job type";
  if (!JOB_PRIORITY_OPTIONS.some((o) => o.value === values.priority)) errors.priority = "Pick a priority";
  return errors;
}

/** datetime-local value (local wall time) → ISO string. */
function toIso(value: string): string {
  return new Date(value).toISOString();
}

export function buildCreateJobPayload(values: NewJobValues): CreateJobInput {
  const payload: CreateJobInput = {
    customerId: values.customerId.trim(),
    title: values.title.trim(),
    type: values.type as JobType,
    priority: values.priority as JobPriority
  };
  if (values.propertyId) payload.propertyId = values.propertyId;
  if (values.technicianId) payload.technicianId = values.technicianId;
  if (values.scheduledStart && values.scheduledEnd) {
    payload.scheduledStart = toIso(values.scheduledStart);
    payload.scheduledEnd = toIso(values.scheduledEnd);
  }
  const description = values.description.trim();
  if (description) payload.description = description;
  return payload;
}

/** Reads `/jobs?new=1&customerId=<id>`. */
export function parseNewJobQuery(params: Record<string, string | string[] | undefined>): { open: boolean; customerId: string } {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const customerId = first(params.customerId).trim();
  return { open: first(params.new) === "1", customerId: /^[A-Za-z0-9_-]{1,64}$/.test(customerId) ? customerId : "" };
}
