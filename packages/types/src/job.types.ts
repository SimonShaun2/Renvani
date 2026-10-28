import type { AddJobProductInput } from "./job-product.types.js";

export type JobStatus =
  | "lead"
  | "estimate_requested"
  | "estimate_sent"
  | "estimate_approved"
  | "scheduled"
  | "dispatched"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "invoiced"
  | "paid"
  | "cancelled"
  | "closed";

export type JobType =
  | "service_call"
  | "maintenance"
  | "installation"
  | "inspection"
  | "estimate_only"
  | "warranty"
  | "callback"
  | "emergency";

export type JobPriority = "low" | "normal" | "high" | "urgent";

export type JobPhotoType = "before" | "after" | "general";

export interface Job {
  id: string;
  companyId: string;
  jobNumber: string;
  customerId: string;
  propertyId: string | null;
  assetId: string | null;
  technicianId: string | null;
  assignedById: string | null;
  type: JobType;
  priority: JobPriority;
  status: JobStatus;
  leadSource: string | null;
  title: string;
  description: string | null;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  scheduledDurationMinutes: number | null;
  actualStart: Date | null;
  actualEnd: Date | null;
  techNotes: string | null;
  completionNotes: string | null;
  signatureUrl: string | null;
  signedAt: Date | null;
  signedByName: string | null;
  estimateTotal: string | null;
  invoiceTotal: string | null;
  amountPaid: string | null;
  maintenancePlanId: string | null;
  parentJobId: string | null;
  tags: string[] | null;
  importSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface JobCustomerSummary {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email?: string | null;
}

export interface JobPropertySummary {
  id: string;
  addressLine1: string;
  city: string;
  state: string;
  zip?: string;
  accessNotes?: string | null;
}

export interface JobAssetSummary {
  id: string;
  name: string;
  assetType: string;
  brand: string | null;
  model: string | null;
  installDate: string | null;
  lastServiceDate: string | null;
}

export interface JobTechnicianSummary {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  calendarColor: string | null;
}

export interface JobListItem {
  id: string;
  jobNumber: string;
  title: string;
  type: JobType;
  priority: JobPriority;
  status: JobStatus;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  customer: JobCustomerSummary;
  property: JobPropertySummary | null;
  technician: JobTechnicianSummary | null;
  createdAt: Date;
}

export interface JobDetail extends Job {
  customer: JobCustomerSummary;
  property: JobPropertySummary | null;
  asset: JobAssetSummary | null;
  technician: JobTechnicianSummary | null;
  availableTransitions: JobStatus[];
}

export type JobNoteKind = "internal" | "field";

export interface JobNote {
  id: string;
  companyId: string;
  jobId: string;
  authorId: string | null;
  content: string;
  noteKind: JobNoteKind;
  isInternal: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface JobPhoto {
  id: string;
  companyId: string;
  jobId: string;
  uploadedById: string | null;
  url: string;
  thumbnailUrl: string | null;
  caption: string | null;
  takenAt: Date | null;
  photoType: JobPhotoType | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface ActivityEvent {
  id: string;
  companyId: string;
  eventType: string;
  actorId: string | null;
  actorType: string | null;
  actorName: string | null;
  entityType: string;
  entityId: string;
  customerId: string | null;
  jobId: string | null;
  estimateId: string | null;
  invoiceId: string | null;
  payload: unknown;
  summary: string;
  occurredAt: Date;
}

export interface CreateJobInput {
  customerId: string;
  propertyId?: string;
  assetId?: string;
  technicianId?: string;
  type?: JobType;
  priority?: JobPriority;
  title: string;
  description?: string;
  leadSource?: string;
  tags?: string[];
  scheduledStart?: string;
  scheduledEnd?: string;
  /** Line items added in the same transaction as the job (price-book productCatalogId or manual). */
  products?: AddJobProductInput[];
  /** Existing crew (GET /crews); validated active in the same transaction. */
  crewId?: string;
}

export interface UpdateJobInput {
  title?: string;
  description?: string;
  type?: JobType;
  priority?: JobPriority;
  tags?: string[];
  techNotes?: string;
  technicianId?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
}

export interface ScheduleJobInput {
  scheduledStart: string;
  scheduledEnd: string;
}

export interface CompleteJobInput {
  completionNotes?: string;
  signatureUrl?: string;
  signedByName?: string;
  signedAt?: string;
}

export interface AddNoteInput {
  content: string;
  isInternal?: boolean;
  noteKind?: "internal" | "field";
}

export interface AddPhotoInput {
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  photoType?: JobPhotoType;
  takenAt?: string;
}

export interface ListJobsQuery {
  status?: JobStatus | JobStatus[];
  technicianId?: string;
  customerId?: string;
  propertyId?: string;
  assetId?: string;
  type?: JobType;
  priority?: JobPriority;
  scheduledAfter?: string;
  scheduledBefore?: string;
  search?: string;
  sortBy?: "scheduledStart" | "createdAt" | "priority" | "status";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

/** Fee/total preview at checkout rules (Service Fee on Flex, none on Flat). Shared by job-create and invoice previews. */
export interface ChargePreview {
  plan: "flex" | "flat" | null;
  subtotal: string;
  serviceFeeAmount: string;
  serviceFeeRateBps: number;
  serviceFeeLabel: string | null;
  total: string;
}

export interface JobCreatePreviewInput {
  customerId?: string;
  products?: AddJobProductInput[];
}

export interface JobCreatePreview extends ChargePreview {
  /** Next number at preview time; not reserved (assigned on create). */
  jobNumberPreview: string;
  lines: Array<{ name: string; quantity: string; unitPrice: string; total: string }>;
  /** Customer has a saved card on file (Stripe customer linked). Null when no customerId was given. */
  cardOnFile: boolean | null;
}
