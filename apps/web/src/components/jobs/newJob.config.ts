import type { AddJobProductInput, CreateJobInput, JobPriority, JobType, PriceBookItemPickerSeed } from "@fsm/types";

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

/** Order per Figma 160:32 (Nadia). Card-on-file chip and line items render outside the registry. */
export const NEW_JOB_FIELDS: readonly NewJobField[] = [
  { key: "customerId", label: "Customer", kind: "customer", required: true, span: 2 },
  { key: "propertyId", label: "Service address", kind: "property", span: 2 },
  { key: "type", label: "Job type / service", kind: "select", required: true, options: JOB_TYPE_OPTIONS, placeholder: "Choose a job type", span: 2 },
  { key: "description", label: "Description", kind: "textarea", maxLength: 2000, placeholder: "Optional", span: 2 },
  { key: "scheduledStart", label: "Scheduled (optional)", kind: "datetime" },
  { key: "priority", label: "Priority", kind: "select", options: JOB_PRIORITY_OPTIONS },
  { key: "scheduledEnd", label: "Ends", kind: "datetime", span: 2 },
  { key: "technicianId", label: "Assigned crew / van (optional)", kind: "technician", span: 2 }
];

export const NEW_JOB_COPY = {
  title: "New job",
  jobNumberPending: "Job # assigned on create",
  submit: "Create job",
  submitting: "Creating…",
  cancel: "Cancel",
  customerSearchPlaceholder: "Search customers…",
  customerChange: "Change",
  customerPreselected: "Preselected when opened from a customer profile",
  addressAutofilled: "Autofilled — customer has one address",
  addressNeedsCustomer: "Select a customer first",
  noProperties: "No saved addresses for this customer",
  unassigned: "Unassigned",
  notScheduled: "Not scheduled",
  required: "Required",
  missingBanner: "Add a customer and job type to continue.",
  lineItemsEyebrow: "LINE ITEMS · PRICE BOOK",
  noItems: "No items yet",
  addItem: "+ Add item from price book",
  itemSearchPlaceholder: "Search price book…",
  removeItem: "Remove",
  subtotal: "Subtotal",
  customerPays: "Customer pays",
  totalAfterTax: "Calculated after tax at checkout",
  submitError: "We couldn't create the job. Check the details and try again.",
  itemsError: "Job created, but some line items couldn't be added. Add them on the job."
} as const;

/** "Service Fee (2%) · paid by customer at checkout"; null hides the line (Flat plan / no fee from the API). */
export function newJobServiceFeeLabel(platformFeePercent: number | null | undefined): string | null {
  if (platformFeePercent === null || platformFeePercent === undefined || !(platformFeePercent > 0)) return null;
  return `Service Fee (${platformFeePercent}%) · paid by customer at checkout`;
}

export interface NewJobLineItem {
  priceBookItemId: string;
  name: string;
  description: string | null;
  unitPrice: number;
  quantity: number;
  isTaxable: boolean;
}

export function lineItemFromSeed(seed: PriceBookItemPickerSeed): NewJobLineItem {
  return {
    priceBookItemId: seed.priceBookItemId,
    name: seed.name,
    description: seed.description,
    unitPrice: Number(seed.unitPrice) || 0,
    quantity: 1,
    isTaxable: seed.isTaxable
  };
}

/** Adds a price-book item, or bumps quantity when already listed. */
export function addLineItem(items: readonly NewJobLineItem[], seed: PriceBookItemPickerSeed): NewJobLineItem[] {
  const existing = items.find((i) => i.priceBookItemId === seed.priceBookItemId);
  if (existing) return items.map((i) => (i === existing ? { ...i, quantity: i.quantity + 1 } : i));
  return [...items, lineItemFromSeed(seed)];
}

export function lineItemsSubtotal(items: readonly NewJobLineItem[]): number {
  return Math.round(items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0) * 100) / 100;
}

export function toAddJobProductInput(item: NewJobLineItem): AddJobProductInput {
  const input: AddJobProductInput = { name: item.name, quantity: item.quantity, unitPrice: item.unitPrice, isTaxable: item.isTaxable };
  if (item.description) input.description = item.description;
  return input;
}

export function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export type NewJobValues = Record<NewJobFieldKey, string>;

export function emptyNewJobValues(customerId = ""): NewJobValues {
  return {
    customerId,
    propertyId: "",
    title: "",
    type: "",
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
    if (field.required && !value) errors[field.key] = NEW_JOB_COPY.required;
    else if (field.maxLength && value.length > field.maxLength) errors[field.key] = `${field.label} must be ${field.maxLength} characters or less`;
  }
  const { scheduledStart: start, scheduledEnd: end } = values;
  if (start && !end) errors.scheduledEnd = "Add an end time";
  if (end && !start) errors.scheduledStart = "Add a start time";
  if (start && end && !(new Date(end).getTime() > new Date(start).getTime())) errors.scheduledEnd = "End must be after start";
  if (values.type && !JOB_TYPE_OPTIONS.some((o) => o.value === values.type)) errors.type = "Pick a job type";
  if (!JOB_PRIORITY_OPTIONS.some((o) => o.value === values.priority)) errors.priority = "Pick a priority";
  return errors;
}

export function jobTitle(values: NewJobValues): string {
  const firstLine = values.description.trim().split("\n")[0]?.trim() ?? "";
  if (firstLine) return firstLine.slice(0, 200);
  return JOB_TYPE_OPTIONS.find((o) => o.value === values.type)?.label ?? "Job";
}

/** True when the frame 160:102 banner applies (customer or job type missing). */
export function isMissingRequired(errors: NewJobErrors): boolean {
  return Boolean(errors.customerId || errors.type);
}

/** datetime-local value (local wall time) → ISO string. */
function toIso(value: string): string {
  return new Date(value).toISOString();
}

export function buildCreateJobPayload(values: NewJobValues): CreateJobInput {
  const payload: CreateJobInput = {
    customerId: values.customerId.trim(),
    // No title field in frame 160:32: the API's required title is the description's first line, else the job type label.
    title: jobTitle(values),
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
