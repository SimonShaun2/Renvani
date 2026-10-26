/**
 * FSM v1 — Full Schema
 * Drizzle ORM + Postgres
 *
 * Architecture: Customer → Property → Asset → Job → Events → AI
 *
 * Table groups:
 *   1. Foundation (company, users, roles)
 *   2. Customer Graph (customer, property, asset)
 *   3. Workforce (technician, service_area)
 *   4. Job Lifecycle (job, job_note, job_photo)
 *   5. Estimates (estimate, estimate_item)
 *   6. Invoices & Payments (invoice, invoice_item, payment)
 *   7. Maintenance Plans → Service Agreements (maintenance_plan, maintenance_visit, service_agreement_template)
 *   8. Scheduling (schedule_slot)
 *   9. Activity Events (activity_event)
 *  10. AI Layer (ai_recommendation, campaign, campaign_recipient)
 *  11. Messaging (message_log)
 *  12. Forms (form_template, form_submission)
 *  13. Onboarding (import_session)
 */

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  integer,
  decimal,
  boolean,
  timestamp,
  date,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ─────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────

const timestamps = {
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"), // soft delete
};

const id = () => uuid("id").primaryKey().defaultRandom();

const companyId = () =>
  uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" });

// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", [
  "owner",
  "admin",
  "dispatcher",
  "office",
  "technician",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "lead",
  "estimate_requested",
  "estimate_sent",
  "estimate_approved",
  "scheduled",
  "dispatched",
  "in_progress",
  "on_hold",
  "completed",
  "invoiced",
  "paid",
  "cancelled",
  "closed",
]);

export const jobPriorityEnum = pgEnum("job_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);

export const jobTypeEnum = pgEnum("job_type", [
  "service_call",
  "maintenance",
  "installation",
  "inspection",
  "estimate_only",
  "warranty",
  "callback",
  "emergency",
]);

export const estimateStatusEnum = pgEnum("estimate_status", [
  "draft",
  "sent",
  "viewed",
  "approved",
  "declined",
  "expired",
  "converted",
  "revised",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "sent",
  "viewed",
  "partially_paid",
  "paid",
  "overdue",
  "void",
  "written_off",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "card",
  "ach",
  "cash",
  "check",
  "financing",
  "other",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "succeeded",
  "failed",
  "refunded",
  "disputed",
]);

export const propertyTypeEnum = pgEnum("property_type", [
  "residential",
  "commercial",
  "industrial",
  "multi_family",
]);

export const assetConditionEnum = pgEnum("asset_condition", [
  "excellent",
  "good",
  "fair",
  "poor",
  "failed",
]);

export const maintenancePlanStatusEnum = pgEnum("maintenance_plan_status", [
  "active",
  "paused",
  "expired",
  "cancelled",
]);

export const maintenancePlanFrequencyEnum = pgEnum(
  "maintenance_plan_frequency",
  ["monthly", "bi_monthly", "quarterly", "bi_annual", "annual"]
);

export const serviceAgreementBillingCycleEnum = pgEnum(
  "service_agreement_billing_cycle",
  ["monthly", "annual"]
);

export const formTypeEnum = pgEnum("form_type", [
  "job_checklist",
  "maintenance_checklist",
  "inspection_report",
  "customer_intake",
  "install_checklist",
  "safety_checklist",
  "custom",
]);

export const importSessionStatusEnum = pgEnum("import_session_status", [
  "uploaded",
  "mapping",
  "preview",
  "importing",
  "completed",
  "failed",
  "rolled_back",
]);

export const importChunkRunStatusEnum = pgEnum("import_chunk_run_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

export const dataExportStatusEnum = pgEnum("data_export_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "expired"
]);

export const dataExportFormatEnum = pgEnum("data_export_format", ["json", "csv_bundle"]);

export const importEntityTypeEnum = pgEnum("import_entity_type", [
  "customers",
  "properties",
  "assets",
  "jobs",
  "estimates",
  "invoices",
  "price_book",
  "payments",
  "notes",
  "communications",
]);

export const importBundleStatusEnum = pgEnum("import_bundle_status", [
  "active",
  "committing",
  "completed",
  "abandoned",
]);

export const technicianStatusEnum = pgEnum("technician_status", [
  "active",
  "inactive",
  "on_leave",
]);

export const activityEventTypeEnum = pgEnum("activity_event_type", [
  // Authentication & company
  "company.created",
  "company.updated",
  "company.stripe_onboarding_started",
  "company.stripe_onboarding_completed",
  "user.registered",
  "user.login",
  "user.logout",
  "user.password_reset",
  // Customer
  "customer.created",
  "customer.updated",
  "customer.deleted",
  "customer.merged",
  // Property
  "property.created",
  "property.updated",
  "property.deleted",
  // Asset
  "asset.created",
  "asset.updated",
  "asset.deleted",
  "asset.serviced",
  // Job
  "job.created",
  "job.updated",
  "job.scheduled",
  "job.dispatched",
  "job.started",
  "job.paused",
  "job.completed",
  "job.reopened",
  "job.rescheduled",
  "job.cancelled",
  "job.closed",
  "job.time_started",
  "job.time_stopped",
  "job.task_completed",
  "job.product_added",
  "job.product_removed",
  "job.upsell_approved",
  // Estimate
  "estimate.created",
  "estimate.updated",
  "estimate.deleted",
  "estimate.sent",
  "estimate.viewed",
  "estimate.approved",
  "estimate.declined",
  "estimate.expired",
  "estimate.converted",
  "estimate.revised",
  // Invoice
  "invoice.created",
  "invoice.updated",
  "invoice.sent",
  "invoice.viewed",
  "invoice.overdue",
  "invoice.paid",
  "invoice.void",
  // Payment
  "payment.received",
  "payment.partial",
  "payment.failed",
  "payment.refunded",
  "integration.qbo_connected",
  "integration.qbo_disconnected",
  "integration.qbo_sync_completed",
  "integration.qbo_sync_failed",
  // Product catalog
  "product.created",
  "product.updated",
  // Technician
  "technician.created",
  "technician.updated",
  "technician.deleted",
  "technician.assigned",
  "technician.unassigned",
  "technician.on_the_way",
  // Service agreement template
  "service_agreement_template.created",
  "service_agreement_template.updated",
  "service_agreement_template.deleted",
  // VIP membership (FS-132)
  "vip.tier.created",
  "vip.tier.updated",
  "vip.tier.deleted",
  // Maintenance plan
  "maintenance_plan.created",
  "maintenance_plan.updated",
  "maintenance_plan.renewed",
  "maintenance_plan.cancelled",
  "maintenance_visit.completed",
  // AI
  "ai.recommendation_created",
  "ai.recommendation_actioned",
  "ai.recommendation_dismissed",
  "ai.recommendation_snoozed",
  // Campaign
  "campaign.created",
  "campaign.converted",
  "campaign.sent",
  "campaign.opened",
  "campaign.replied",
  // Review requests
  "review_request.sent",
  "review_request.completed",
  // Message
  "message.sent",
  "message.received",
  // Import
  "import.started",
  "import.completed",
  "import.rolled_back",
  "import.failed",
  "import.bundle.created",
  "import.bundle.step_advanced",
  "import.bundle.commit_started",
  "import.bundle.completed",
  "import.bundle.abandoned",
  // QuickBooks ongoing sync (FS-133)
  "integration.qbo_mapping_updated",
  "integration.qbo_sync_retry_requested",
  // Data export (FS-89)
  "export.requested",
  "export.completed",
  "export.failed",
  "export.downloaded",
  "export.expired",
  // Growth check (FS-55)
  "growth.check_scan_enqueued",
  "growth.check_scan_completed",
  "growth.check_scan_failed",
  // Booking
  "booking.requested",
  "booking.confirmed",
  "booking.cancelled",
  "booking.completed",
  // Agent control plane (FS-10/12)
  "agent.proposal_created",
  "agent.proposal_approved",
  "agent.proposal_rejected",
  "agent.proposal_edited",
  "agent.execution_succeeded",
  "agent.execution_failed",
  "revenue.inquiry_qualified",
  "revenue.inquiry_received",
  "revenue.inquiry_escalated",
]);

export const aiRecommendationTypeEnum = pgEnum("ai_recommendation_type", [
  "reactivation",
  "aging_asset",
  "maintenance_due",
  "unsold_estimate",
  "unpaid_invoice",
  "upsell_opportunity",
  "seasonal_campaign",
  "maintenance_plan_offer",
]);

export const aiRecommendationStatusEnum = pgEnum("ai_recommendation_status", [
  "pending",
  "actioned",
  "dismissed",
  "snoozed",
  "expired",
]);

export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "cancelled",
]);

export const campaignTypeEnum = pgEnum("campaign_type", [
  "reactivation",
  "estimate_follow_up",
  "invoice_reminder",
  "seasonal",
  "maintenance_reminder",
  "custom",
]);

export const productCategoryEnum = pgEnum("product_category", [
  "service",
  "labor",
  "material",
  "equipment",
  "fee",
  "bundle",
]);

export const jobTaskStatusEnum = pgEnum("job_task_status", [
  "pending",
  "in_progress",
  "completed",
  "skipped",
]);

export const messageChannelEnum = pgEnum("message_channel", [
  "sms",
  "email",
  "in_app",
]);

export const messageDirectionEnum = pgEnum("message_direction", [
  "outbound",
  "inbound",
]);

export const reviewRequestStatusEnum = pgEnum("review_request_status", [
  "pending",
  "sent",
  "clicked",
  "completed",
  "declined",
]);

export const attachmentEntityTypeEnum = pgEnum("attachment_entity_type", [
  "company",
  "job",
  "customer",
  "property",
  "asset",
  "estimate",
  "invoice",
  "work_order",
]);

export const bookingRequestStatusEnum = pgEnum("booking_request_status", [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
]);

export const bookingSourceEnum = pgEnum("booking_source", [
  "google",
  "facebook",
  "instagram",
  "yelp",
  "direct",
  "website",
  "qr_code",
]);

// ─────────────────────────────────────────────
// 1. FOUNDATION
// ─────────────────────────────────────────────

export const companies = pgTable("companies", {
  id: id(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 255 }),
  website: varchar("website", { length: 255 }),
  logoUrl: text("logo_url"),
  addressLine1: varchar("address_line_1", { length: 255 }),
  addressLine2: varchar("address_line_2", { length: 255 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  zip: varchar("zip", { length: 20 }),
  country: varchar("country", { length: 50 }).notNull().default("US"),
  timezone: varchar("timezone", { length: 60 }).notNull().default("America/Chicago"),
  // Stripe
  stripeCustomerId: varchar("stripe_customer_id", { length: 100 }),
  stripeAccountId: varchar("stripe_account_id", { length: 100 }), // Connect for payments
  // Settings
  settings: jsonb("settings").default({}),
  ...timestamps,
}, (t) => ({
  slugIdx: uniqueIndex("companies_slug_idx").on(t.slug),
  // FS-157: at most one live company per Clerk organization (DB-level guarantee behind the advisory lock).
  clerkOrganizationIdIdx: uniqueIndex("companies_clerk_organization_id_idx")
    .on(sql`(${t.settings} -> 'clerk' ->> 'organizationId')`)
    .where(sql`${t.deletedAt} IS NULL AND (${t.settings} -> 'clerk' ->> 'organizationId') IS NOT NULL`),
}));

export const users = pgTable("users", {
  id: id(),
  companyId: companyId(),
  email: varchar("email", { length: 255 }).notNull(),
  passwordHash: text("password_hash"),
  passwordChangedAt: timestamp("password_changed_at"),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 30 }),
  role: userRoleEnum("role").notNull().default("office"),
  avatarUrl: text("avatar_url"),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  emailVerifiedAt: timestamp("email_verified_at"),
  // sha256 of the single-use verify-email token (raw token is never stored)
  emailVerificationTokenHash: text("email_verification_token_hash"),
  emailVerificationExpiresAt: timestamp("email_verification_expires_at"),
  // FS-157: stable Clerk user id (`sub`); logins map by this first. Nullable until linked/backfilled.
  clerkUserId: varchar("clerk_user_id", { length: 255 }),
  // FS-160b: tombstone set by Clerk user.deleted. A tombstoned user is never auto-linked (verified email /
  // membership webhook / first-login fallback); only an explicit admin relink clears it.
  clerkUnlinkedAt: timestamp("clerk_unlinked_at", { withTimezone: true }),
  // If this user is also a technician
  technicianId: uuid("technician_id"),
  ...timestamps,
}, (t) => ({
  emailIdx: uniqueIndex("users_email_idx").on(t.email),
  emailCompanyIdx: uniqueIndex("users_email_company_idx").on(t.email, t.companyId),
  companyIdx: index("users_company_idx").on(t.companyId),
  emailVerificationTokenIdx: index("users_email_verification_token_idx").on(t.emailVerificationTokenHash),
  clerkUserIdIdx: uniqueIndex("users_clerk_user_id_idx").on(t.clerkUserId).where(sql`${t.clerkUserId} IS NOT NULL`),
}));

export const refreshTokens = pgTable("refresh_tokens", {
  id: id(),
  companyId: companyId(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  companyIdx: index("refresh_tokens_company_idx").on(t.companyId),
  userIdx: index("refresh_tokens_user_idx").on(t.userId),
  expiresAtIdx: index("refresh_tokens_expires_at_idx").on(t.expiresAt),
}));

export const serviceAreas = pgTable("service_areas", {
  id: id(),
  companyId: companyId(),
  name: varchar("name", { length: 100 }).notNull(),
  zips: text("zips").array(), // zip codes covered
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

// ─────────────────────────────────────────────
// 2. CUSTOMER GRAPH
// ─────────────────────────────────────────────

export const customers = pgTable("customers", {
  id: id(),
  companyId: companyId(),
  // Identity
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  displayName: varchar("display_name", { length: 255 }), // business name override
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 30 }),
  altPhone: varchar("alt_phone", { length: 30 }),
  // Source
  leadSource: varchar("lead_source", { length: 100 }), // google, referral, door_hanger, etc
  referredBy: uuid("referred_by"), // customer_id
  // Tags + notes
  tags: text("tags").array().default([]),
  internalNotes: text("internal_notes"),
  // Computed / denormalized for AI queries (updated on job completion)
  lifetimeValue: decimal("lifetime_value", { precision: 10, scale: 2 }).default("0"),
  totalJobs: integer("total_jobs").default(0),
  lastServiceDate: date("last_service_date"),
  firstServiceDate: date("first_service_date"),
  // Comms preferences
  prefersSms: boolean("prefers_sms").default(true),
  prefersEmail: boolean("prefers_email").default(true),
  doNotContact: boolean("do_not_contact").default(false),
  // Stripe
  stripeCustomerId: varchar("stripe_customer_id", { length: 100 }),
  sourceSystem: varchar("source_system", { length: 64 }),
  sourceId: varchar("source_id", { length: 256 }),
  importSessionId: uuid("import_session_id").references(() => importSessions.id),
  ...timestamps,
}, (t) => ({
  companyIdx: index("customers_company_idx").on(t.companyId),
  emailIdx: index("customers_email_idx").on(t.email),
  lastServiceIdx: index("customers_last_service_idx").on(t.lastServiceDate),
  importLineageIdx: uniqueIndex("customers_import_lineage_idx").on(
    t.companyId,
    t.sourceSystem,
    t.sourceId,
  ),
}));

export const properties = pgTable("properties", {
  id: id(),
  companyId: companyId(),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  // Address
  addressLine1: varchar("address_line_1", { length: 255 }).notNull(),
  addressLine2: varchar("address_line_2", { length: 255 }),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 50 }).notNull(),
  zip: varchar("zip", { length: 20 }).notNull(),
  country: varchar("country", { length: 50 }).default("US"),
  // Geo (for routing later)
  lat: decimal("lat", { precision: 10, scale: 7 }),
  lng: decimal("lng", { precision: 10, scale: 7 }),
  // Property details
  type: propertyTypeEnum("type").notNull().default("residential"),
  sqft: integer("sqft"),
  yearBuilt: integer("year_built"),
  accessNotes: text("access_notes"), // gate codes, dogs, etc
  notes: text("notes"),
  isPrimary: boolean("is_primary").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  sourceSystem: varchar("source_system", { length: 64 }),
  sourceId: varchar("source_id", { length: 256 }),
  importSessionId: uuid("import_session_id").references(() => importSessions.id),
  ...timestamps,
}, (t) => ({
  customerIdx: index("properties_customer_idx").on(t.customerId),
  companyIdx: index("properties_company_idx").on(t.companyId),
  zipIdx: index("properties_zip_idx").on(t.zip),
  importLineageIdx: uniqueIndex("properties_import_lineage_idx").on(
    t.companyId,
    t.sourceSystem,
    t.sourceId,
  ),
}));

export const assets = pgTable("assets", {
  id: id(),
  companyId: companyId(),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  customerId: uuid("customer_id").notNull().references(() => customers.id), // denorm for fast queries
  // Identity
  name: varchar("name", { length: 255 }).notNull(), // "Main HVAC Unit", "Water Heater #1"
  assetType: varchar("asset_type", { length: 100 }).notNull(), // hvac, water_heater, electrical_panel, etc
  brand: varchar("brand", { length: 100 }),
  model: varchar("model", { length: 100 }),
  serialNumber: varchar("serial_number", { length: 100 }),
  // Age / service history
  installDate: date("install_date"),
  warrantyExpiration: date("warranty_expiration"),
  lastServiceDate: date("last_service_date"),
  nextServiceDate: date("next_service_date"), // computed from maintenance plan or job
  // Condition (manual until AI takes over)
  condition: assetConditionEnum("condition"),
  conditionNotes: text("condition_notes"),
  // AI scoring (v1.5+, column present but nullable)
  conditionScore: integer("condition_score"), // 0–100
  replacementProbability: decimal("replacement_probability", { precision: 5, scale: 4 }), // 0.0000–1.0000
  // Photos
  photoUrls: text("photo_urls").array().default([]),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  sourceSystem: varchar("source_system", { length: 64 }),
  sourceId: varchar("source_id", { length: 256 }),
  importSessionId: uuid("import_session_id").references(() => importSessions.id),
  ...timestamps,
}, (t) => ({
  propertyIdx: index("assets_property_idx").on(t.propertyId),
  customerIdx: index("assets_customer_idx").on(t.customerId),
  companyIdx: index("assets_company_idx").on(t.companyId),
  typeIdx: index("assets_type_idx").on(t.assetType),
  warrantyIdx: index("assets_warranty_idx").on(t.warrantyExpiration),
  installIdx: index("assets_install_idx").on(t.installDate),
  importLineageIdx: uniqueIndex("assets_import_lineage_idx").on(
    t.companyId,
    t.sourceSystem,
    t.sourceId,
  ),
}));

// ─────────────────────────────────────────────
// 3. WORKFORCE
// ─────────────────────────────────────────────

export const technicians = pgTable("technicians", {
  id: id(),
  companyId: companyId(),
  userId: uuid("user_id").references(() => users.id), // nullable — tech may not have login yet
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 30 }).notNull(),
  avatarUrl: text("avatar_url"),
  // Skills + capacity
  skills: text("skills").array().default([]), // hvac, plumbing, electrical
  serviceAreaIds: uuid("service_area_ids").array().default([]),
  serviceZipCodes: text("service_zip_codes").array().default([]),
  availableDays: text("available_days").array().default(["mon", "tue", "wed", "thu", "fri"]),
  hoursPerDay: decimal("hours_per_day", { precision: 4, scale: 2 }).default("8"),
  // Performance (updated on job completion)
  totalJobsCompleted: integer("total_jobs_completed").default(0),
  avgJobDurationMinutes: integer("avg_job_duration_minutes"),
  estimateCloseRate: decimal("estimate_close_rate", { precision: 5, scale: 4 }),
  avgTicketValue: decimal("avg_ticket_value", { precision: 10, scale: 2 }),
  // Status
  status: technicianStatusEnum("status").notNull().default("active"),
  // Color for dispatch board
  calendarColor: varchar("calendar_color", { length: 7 }).default("#6366f1"),
  notes: text("notes"),
  ...timestamps,
}, (t) => ({
  companyIdx: index("technicians_company_idx").on(t.companyId),
}));

// ─────────────────────────────────────────────
// 4. JOB LIFECYCLE
// ─────────────────────────────────────────────

export const jobs = pgTable("jobs", {
  id: id(),
  companyId: companyId(),
  // Job number (human-readable, company-scoped)
  jobNumber: varchar("job_number", { length: 30 }).notNull(),
  // Relationships
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  propertyId: uuid("property_id").references(() => properties.id),
  assetId: uuid("asset_id").references(() => assets.id), // primary asset
  technicianId: uuid("technician_id").references(() => technicians.id),
  assignedById: uuid("assigned_by_id").references(() => users.id),
  // Classification
  type: jobTypeEnum("type").notNull().default("service_call"),
  priority: jobPriorityEnum("priority").notNull().default("normal"),
  status: jobStatusEnum("status").notNull().default("lead"),
  // Source
  leadSource: varchar("lead_source", { length: 100 }),
  // Description
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  // Scheduling
  scheduledStart: timestamp("scheduled_start"),
  scheduledEnd: timestamp("scheduled_end"),
  scheduledDurationMinutes: integer("scheduled_duration_minutes"),
  // Actuals
  actualStart: timestamp("actual_start"),
  actualEnd: timestamp("actual_end"),
  // On-site
  techNotes: text("tech_notes"),
  completionNotes: text("completion_notes"),
  signatureUrl: text("signature_url"),
  signedAt: timestamp("signed_at"),
  signedByName: varchar("signed_by_name", { length: 255 }),
  // Financials (denorm for fast dashboard queries)
  estimateTotal: decimal("estimate_total", { precision: 10, scale: 2 }),
  invoiceTotal: decimal("invoice_total", { precision: 10, scale: 2 }),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).default("0"),
  // Linked entities
  maintenancePlanId: uuid("maintenance_plan_id"),
  parentJobId: uuid("parent_job_id"), // for return visits / follow-up jobs
  // Tags
  tags: text("tags").array().default([]),
  sourceSystem: varchar("source_system", { length: 64 }),
  sourceId: varchar("source_id", { length: 256 }),
  importSessionId: uuid("import_session_id").references(() => importSessions.id),
  ...timestamps,
}, (t) => ({
  companyIdx: index("jobs_company_idx").on(t.companyId),
  customerIdx: index("jobs_customer_idx").on(t.customerId),
  technicianIdx: index("jobs_technician_idx").on(t.technicianId),
  statusIdx: index("jobs_status_idx").on(t.status),
  scheduledStartIdx: index("jobs_scheduled_start_idx").on(t.scheduledStart),
  jobNumberIdx: uniqueIndex("jobs_job_number_company_idx").on(t.jobNumber, t.companyId),
  importLineageIdx: uniqueIndex("jobs_import_lineage_idx").on(
    t.companyId,
    t.sourceSystem,
    t.sourceId,
  ),
}));

export const customerNotes = pgTable("customer_notes", {
  id: id(),
  companyId: companyId(),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").references(() => users.id),
  content: text("content").notNull(),
  isInternal: boolean("is_internal").notNull().default(true),
  notedAt: timestamp("noted_at"),
  sourceSystem: varchar("source_system", { length: 64 }),
  sourceId: varchar("source_id", { length: 256 }),
  importSessionId: uuid("import_session_id").references(() => importSessions.id),
  ...timestamps,
}, (t) => ({
  companyIdx: index("customer_notes_company_idx").on(t.companyId),
  customerIdx: index("customer_notes_customer_idx").on(t.customerId),
  importLineageIdx: uniqueIndex("customer_notes_import_lineage_idx").on(
    t.companyId,
    t.sourceSystem,
    t.sourceId,
  ),
}));

export const jobNotes = pgTable("job_notes", {
  id: id(),
  companyId: companyId(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").references(() => users.id),
  // null authorId = system/AI note
  content: text("content").notNull(),
  isInternal: boolean("is_internal").notNull().default(true),
  notedAt: timestamp("noted_at"),
  sourceSystem: varchar("source_system", { length: 64 }),
  sourceId: varchar("source_id", { length: 256 }),
  importSessionId: uuid("import_session_id").references(() => importSessions.id),
  ...timestamps,
}, (t) => ({
  importLineageIdx: uniqueIndex("job_notes_import_lineage_idx").on(
    t.companyId,
    t.sourceSystem,
    t.sourceId,
  ),
}));

export const jobPhotos = pgTable("job_photos", {
  id: id(),
  companyId: companyId(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  uploadedById: uuid("uploaded_by_id").references(() => users.id),
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  caption: text("caption"),
  takenAt: timestamp("taken_at"),
  // before / after / general
  photoType: varchar("photo_type", { length: 30 }).default("general"),
  ...timestamps,
});

// ─────────────────────────────────────────────
// 5. ESTIMATES
// ─────────────────────────────────────────────

export const estimates = pgTable("estimates", {
  id: id(),
  companyId: companyId(),
  estimateNumber: varchar("estimate_number", { length: 30 }).notNull(),
  jobId: uuid("job_id").references(() => jobs.id),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  propertyId: uuid("property_id").references(() => properties.id),
  createdById: uuid("created_by_id").references(() => users.id),
  status: estimateStatusEnum("status").notNull().default("draft"),
  // Tiers — good / better / best
  // Each tier is a separate estimate row; selectedTierId links them
  tierLabel: varchar("tier_label", { length: 50 }), // "Good", "Better", "Best", null if single
  tierGroupId: uuid("tier_group_id"), // groups the 3 tiers together
  isSelectedTier: boolean("is_selected_tier").default(false),
  // Totals (computed from items)
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  taxRate: decimal("tax_rate", { precision: 5, scale: 4 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0"),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull().default("0"),
  // Customer-facing
  title: varchar("title", { length: 255 }),
  messageToCustomer: text("message_to_customer"),
  internalNotes: text("internal_notes"),
  // Approval
  approvalToken: varchar("approval_token", { length: 100 }), // for public link
  approvedAt: timestamp("approved_at"),
  approvedByName: varchar("approved_by_name", { length: 255 }),
  approvedSignatureUrl: text("approved_signature_url"),
  declinedAt: timestamp("declined_at"),
  declineReason: text("decline_reason"),
  // Follow-up
  expiresAt: timestamp("expires_at"),
  sentAt: timestamp("sent_at"),
  viewedAt: timestamp("viewed_at"),
  followUpSentAt: timestamp("follow_up_sent_at"),
  // Financing
  financingOffered: boolean("financing_offered").default(false),
  sourceSystem: varchar("source_system", { length: 64 }),
  sourceId: varchar("source_id", { length: 256 }),
  importSessionId: uuid("import_session_id").references(() => importSessions.id),
  ...timestamps,
}, (t) => ({
  companyIdx: index("estimates_company_idx").on(t.companyId),
  customerIdx: index("estimates_customer_idx").on(t.customerId),
  statusIdx: index("estimates_status_idx").on(t.status),
  tokenIdx: uniqueIndex("estimates_approval_token_idx").on(t.approvalToken),
  numberIdx: uniqueIndex("estimates_number_company_idx").on(t.estimateNumber, t.companyId),
  importLineageIdx: uniqueIndex("estimates_import_lineage_idx").on(
    t.companyId,
    t.sourceSystem,
    t.sourceId,
  ),
}));

export const estimateItems = pgTable("estimate_items", {
  id: id(),
  estimateId: uuid("estimate_id").notNull().references(() => estimates.id, { onDelete: "cascade" }),
  companyId: companyId(),
  // Item
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  itemType: varchar("item_type", { length: 30 }).notNull().default("service"), // service, labor, material, fee
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull().default("1"),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  isTaxable: boolean("is_taxable").default(true),
  sortOrder: integer("sort_order").default(0),
  ...timestamps,
});

// ─────────────────────────────────────────────
// 6. INVOICES & PAYMENTS
// ─────────────────────────────────────────────

export const invoices = pgTable("invoices", {
  id: id(),
  companyId: companyId(),
  invoiceNumber: varchar("invoice_number", { length: 30 }).notNull(),
  jobId: uuid("job_id").references(() => jobs.id),
  estimateId: uuid("estimate_id").references(() => estimates.id),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  createdById: uuid("created_by_id").references(() => users.id),
  status: invoiceStatusEnum("status").notNull().default("draft"),
  // Totals
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  taxRate: decimal("tax_rate", { precision: 5, scale: 4 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0"),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull().default("0"),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).default("0"),
  balanceDue: decimal("balance_due", { precision: 10, scale: 2 }).notNull().default("0"),
  // Dates
  issuedAt: timestamp("issued_at"),
  dueAt: timestamp("due_at"),
  sentAt: timestamp("sent_at"),
  viewedAt: timestamp("viewed_at"),
  paidAt: timestamp("paid_at"),
  // Payment link (Stripe)
  stripePaymentLinkId: varchar("stripe_payment_link_id", { length: 100 }),
  stripePaymentLinkUrl: text("stripe_payment_link_url"),
  paymentToken: varchar("payment_token", { length: 100 }),
  // Reminders
  reminder1SentAt: timestamp("reminder_1_sent_at"),
  reminder2SentAt: timestamp("reminder_2_sent_at"),
  reminder3SentAt: timestamp("reminder_3_sent_at"),
  // Notes
  title: varchar("title", { length: 255 }),
  messageToCustomer: text("message_to_customer"),
  internalNotes: text("internal_notes"),
  sourceSystem: varchar("source_system", { length: 64 }),
  sourceId: varchar("source_id", { length: 256 }),
  importSessionId: uuid("import_session_id").references(() => importSessions.id),
  ...timestamps,
}, (t) => ({
  companyIdx: index("invoices_company_idx").on(t.companyId),
  customerIdx: index("invoices_customer_idx").on(t.customerId),
  statusIdx: index("invoices_status_idx").on(t.status),
  dueIdx: index("invoices_due_idx").on(t.dueAt),
  numberIdx: uniqueIndex("invoices_number_company_idx").on(t.invoiceNumber, t.companyId),
  importLineageIdx: uniqueIndex("invoices_import_lineage_idx").on(
    t.companyId,
    t.sourceSystem,
    t.sourceId,
  ),
}));

export const invoiceItems = pgTable("invoice_items", {
  id: id(),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  companyId: companyId(),
  productCatalogId: uuid("product_catalog_id").references(() => productCatalog.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  itemType: varchar("item_type", { length: 30 }).notNull().default("service"),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull().default("1"),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  isTaxable: boolean("is_taxable").default(true),
  sortOrder: integer("sort_order").default(0),
  ...timestamps,
});

export const payments = pgTable("payments", {
  id: id(),
  companyId: companyId(),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  collectedById: uuid("collected_by_id").references(() => users.id),
  // Amounts
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  method: paymentMethodEnum("method").notNull(),
  status: paymentStatusEnum("status").notNull().default("pending"),
  // Stripe
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 100 }),
  stripeChargeId: varchar("stripe_charge_id", { length: 100 }),
  // Manual payment details
  checkNumber: varchar("check_number", { length: 50 }),
  referenceNumber: varchar("reference_number", { length: 100 }),
  notes: text("notes"),
  paidAt: timestamp("paid_at"),
  sourceSystem: varchar("source_system", { length: 64 }),
  sourceId: varchar("source_id", { length: 256 }),
  importSessionId: uuid("import_session_id").references(() => importSessions.id),
  ...timestamps,
}, (t) => ({
  companyIdx: index("payments_company_idx").on(t.companyId),
  invoiceIdx: index("payments_invoice_idx").on(t.invoiceId),
  stripeIntentIdx: index("payments_stripe_intent_idx").on(t.stripePaymentIntentId),
  importLineageIdx: uniqueIndex("payments_import_lineage_idx").on(
    t.companyId,
    t.sourceSystem,
    t.sourceId,
  ),
}));

// ─────────────────────────────────────────────
// 7. SERVICE AGREEMENTS (MAINTENANCE PLANS)
// ─────────────────────────────────────────────

// Service Agreement Templates — the plan products the company sells
// e.g. "Silver Plan", "Gold Plan", "Platinum Plan"
// Company defines these once; customers are enrolled into instances (maintenancePlans)
export const vipMembershipTiers = pgTable("vip_membership_tiers", {
  id: id(),
  companyId: companyId(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }).notNull(),
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  includedVisitsPerMonth: integer("included_visits_per_month"),
  stripeMonthlyPriceId: varchar("stripe_monthly_price_id", { length: 100 }),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
}, (t) => ({
  companyIdx: index("vip_membership_tiers_company_idx").on(t.companyId),
  activeIdx: index("vip_membership_tiers_active_idx").on(t.isActive),
}));

export const serviceAgreementTemplates = pgTable("service_agreement_templates", {
  id: id(),
  companyId: companyId(),
  name: varchar("name", { length: 255 }).notNull(), // "Gold Maintenance Plan"
  description: text("description"),
  // What's included
  includedServices: text("included_services").array().default([]),
  visitsPerYear: integer("visits_per_year").notNull().default(2),
  frequency: maintenancePlanFrequencyEnum("frequency").notNull().default("bi_annual"),
  // Pricing
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }),
  annualPrice: decimal("annual_price", { precision: 10, scale: 2 }),
  // Stripe Price IDs — one per billing cycle, created in Stripe dashboard
  stripeMthlyPriceId: varchar("stripe_mthly_price_id", { length: 100 }),
  stripeAnnualPriceId: varchar("stripe_annual_price_id", { length: 100 }),
  // Display + filtering
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").notNull().default(true),
  applicableAssetTypes: text("applicable_asset_types").array().default([]), // ["hvac", "water_heater"]
  notes: text("notes"),
  ...timestamps,
}, (t) => ({
  companyIdx: index("service_agreement_templates_company_idx").on(t.companyId),
  activeIdx: index("service_agreement_templates_active_idx").on(t.isActive),
}));

export const maintenancePlans = pgTable("maintenance_plans", {
  id: id(),
  companyId: companyId(),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  propertyId: uuid("property_id").references(() => properties.id),
  // Template this plan was created from (nullable — plan may be one-off custom)
  serviceAgreementTemplateId: uuid("service_agreement_template_id")
    .references(() => serviceAgreementTemplates.id),
  vipTierId: uuid("vip_tier_id").references(() => vipMembershipTiers.id),
  // Plan definition
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  includedServices: text("included_services").array().default([]),
  frequency: maintenancePlanFrequencyEnum("frequency").notNull(),
  status: maintenancePlanStatusEnum("status").notNull().default("active"),
  // Pricing
  price: decimal("price", { precision: 10, scale: 2 }),
  billingCycle: serviceAgreementBillingCycleEnum("billing_cycle").default("annual"),
  // Stripe recurring billing
  // When a plan has recurring billing, a Stripe Subscription is created.
  // Stripe handles renewal, dunning, and cancellation automatically.
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 100 }),
  stripePriceId: varchar("stripe_price_id", { length: 100 }),
  stripeCurrentPeriodStart: timestamp("stripe_current_period_start"),
  stripeCurrentPeriodEnd: timestamp("stripe_current_period_end"),
  stripeCancelAtPeriodEnd: boolean("stripe_cancel_at_period_end").default(false),
  // Dates
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  nextServiceDate: date("next_service_date"),
  lastServiceDate: date("last_service_date"),
  // Assets covered under this plan
  assetIds: uuid("asset_ids").array().default([]),
  notes: text("notes"),
  ...timestamps,
}, (t) => ({
  companyIdx: index("maintenance_plans_company_idx").on(t.companyId),
  customerIdx: index("maintenance_plans_customer_idx").on(t.customerId),
  nextServiceIdx: index("maintenance_plans_next_service_idx").on(t.nextServiceDate),
  statusIdx: index("maintenance_plans_status_idx").on(t.status),
  stripeSubIdx: index("maintenance_plans_stripe_sub_idx").on(t.stripeSubscriptionId),
}));

export const maintenanceVisits = pgTable("maintenance_visits", {
  id: id(),
  companyId: companyId(),
  maintenancePlanId: uuid("maintenance_plan_id").notNull().references(() => maintenancePlans.id),
  jobId: uuid("job_id").references(() => jobs.id), // job created for this visit
  scheduledDate: date("scheduled_date"),
  completedDate: date("completed_date"),
  notes: text("notes"),
  ...timestamps,
});

// ─────────────────────────────────────────────
// 8. SCHEDULING
// ─────────────────────────────────────────────

export const scheduleSlots = pgTable("schedule_slots", {
  id: id(),
  companyId: companyId(),
  technicianId: uuid("technician_id").notNull().references(() => technicians.id),
  jobId: uuid("job_id").references(() => jobs.id),
  // Blocked time (no job — meeting, PTO, lunch, etc.)
  isBlockedTime: boolean("is_blocked_time").default(false),
  blockReason: varchar("block_reason", { length: 100 }),
  // Times
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  // Travel
  travelMinutesBefore: integer("travel_minutes_before").default(0),
  // Status
  isConfirmed: boolean("is_confirmed").default(false),
  notes: text("notes"),
  ...timestamps,
}, (t) => ({
  technicianIdx: index("schedule_slots_technician_idx").on(t.technicianId),
  startTimeIdx: index("schedule_slots_start_time_idx").on(t.startTime),
  jobIdx: index("schedule_slots_job_idx").on(t.jobId),
}));

// ─────────────────────────────────────────────
// 9. ACTIVITY EVENTS
// ─────────────────────────────────────────────

export const activityEvents = pgTable("activity_events", {
  id: id(),
  companyId: companyId(),
  // What happened
  eventType: activityEventTypeEnum("event_type").notNull(),
  // Who did it
  actorId: uuid("actor_id"), // user_id or null for system/AI
  actorType: varchar("actor_type", { length: 30 }).default("user"), // user | system | ai | customer
  actorName: varchar("actor_name", { length: 255 }), // denorm for display
  // What it happened to
  entityType: varchar("entity_type", { length: 50 }).notNull(), // job, customer, invoice, etc.
  entityId: uuid("entity_id").notNull(),
  // Context links (for timeline display on any object)
  customerId: uuid("customer_id"),
  jobId: uuid("job_id"),
  estimateId: uuid("estimate_id"),
  invoiceId: uuid("invoice_id"),
  // Payload — state change details, metadata, etc.
  payload: jsonb("payload").default({}),
  // Human-readable summary for timeline display
  summary: text("summary").notNull(),
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
}, (t) => ({
  companyIdx: index("activity_events_company_idx").on(t.companyId),
  entityIdx: index("activity_events_entity_idx").on(t.entityType, t.entityId),
  customerIdx: index("activity_events_customer_idx").on(t.customerId),
  jobIdx: index("activity_events_job_idx").on(t.jobId),
  eventTypeIdx: index("activity_events_event_type_idx").on(t.eventType),
  occurredAtIdx: index("activity_events_occurred_at_idx").on(t.occurredAt),
}));

// ─────────────────────────────────────────────
// 10. AI LAYER
// ─────────────────────────────────────────────

export const aiRecommendations = pgTable("ai_recommendations", {
  id: id(),
  companyId: companyId(),
  type: aiRecommendationTypeEnum("type").notNull(),
  status: aiRecommendationStatusEnum("status").notNull().default("pending"),
  // Target
  customerId: uuid("customer_id").references(() => customers.id),
  propertyId: uuid("property_id").references(() => properties.id),
  assetId: uuid("asset_id").references(() => assets.id),
  jobId: uuid("job_id").references(() => jobs.id),
  estimateId: uuid("estimate_id").references(() => estimates.id),
  invoiceId: uuid("invoice_id").references(() => invoices.id),
  // Revenue opportunity
  estimatedRevenue: decimal("estimated_revenue", { precision: 10, scale: 2 }),
  // AI-generated content
  headline: varchar("headline", { length: 255 }).notNull(),
  body: text("body").notNull(),
  suggestedAction: varchar("suggested_action", { length: 100 }), // send_sms, create_job, call, etc.
  suggestedMessage: text("suggested_message"), // pre-drafted SMS/email copy
  // Scoring
  urgencyScore: integer("urgency_score"), // 0–100
  confidenceScore: integer("confidence_score"), // 0–100
  // Lifecycle
  actionedAt: timestamp("actioned_at"),
  actionedById: uuid("actioned_by_id").references(() => users.id),
  dismissedAt: timestamp("dismissed_at"),
  snoozedUntil: timestamp("snoozed_until"),
  expiresAt: timestamp("expires_at"),
  // Source events that triggered this recommendation
  sourceEventIds: uuid("source_event_ids").array().default([]),
  ...timestamps,
}, (t) => ({
  companyIdx: index("ai_recommendations_company_idx").on(t.companyId),
  typeIdx: index("ai_recommendations_type_idx").on(t.type),
  statusIdx: index("ai_recommendations_status_idx").on(t.status),
  customerIdx: index("ai_recommendations_customer_idx").on(t.customerId),
  urgencyIdx: index("ai_recommendations_urgency_idx").on(t.urgencyScore),
}));

export const campaigns = pgTable("campaigns", {
  id: id(),
  companyId: companyId(),
  createdById: uuid("created_by_id").references(() => users.id),
  type: campaignTypeEnum("type").notNull(),
  status: campaignStatusEnum("status").notNull().default("draft"),
  name: varchar("name", { length: 255 }).notNull(),
  // Content
  subject: varchar("subject", { length: 255 }), // email subject
  body: text("body").notNull(),
  channel: messageChannelEnum("channel").notNull().default("sms"),
  // AI-generated flag
  isAiGenerated: boolean("is_ai_generated").default(false),
  aiRecommendationId: uuid("ai_recommendation_id").references(() => aiRecommendations.id),
  // Scheduling
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  // Metrics
  recipientCount: integer("recipient_count").default(0),
  deliveredCount: integer("delivered_count").default(0),
  openedCount: integer("opened_count").default(0),
  repliedCount: integer("replied_count").default(0),
  convertedCount: integer("converted_count").default(0),
  revenueAttributed: decimal("revenue_attributed", { precision: 10, scale: 2 }).default("0"),
  ...timestamps,
}, (t) => ({
  companyIdx: index("campaigns_company_idx").on(t.companyId),
  statusIdx: index("campaigns_status_idx").on(t.status),
}));

export const campaignRecipients = pgTable("campaign_recipients", {
  id: id(),
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  companyId: companyId(),
  // Delivery
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  openedAt: timestamp("opened_at"),
  repliedAt: timestamp("replied_at"),
  // Conversion
  convertedAt: timestamp("converted_at"),
  conversionJobId: uuid("conversion_job_id").references(() => jobs.id),
  // Contact used
  sentToPhone: varchar("sent_to_phone", { length: 30 }),
  sentToEmail: varchar("sent_to_email", { length: 255 }),
  // Unsubscribe
  unsubscribedAt: timestamp("unsubscribed_at"),
  ...timestamps,
});

// ─────────────────────────────────────────────
// 11. MESSAGING
// ─────────────────────────────────────────────

export const messageLogs = pgTable("message_logs", {
  id: id(),
  companyId: companyId(),
  customerId: uuid("customer_id").references(() => customers.id),
  jobId: uuid("job_id").references(() => jobs.id),
  campaignId: uuid("campaign_id").references(() => campaigns.id),
  channel: messageChannelEnum("channel").notNull(),
  direction: messageDirectionEnum("direction").notNull(),
  // Content
  toAddress: varchar("to_address", { length: 255 }).notNull(), // phone or email
  fromAddress: varchar("from_address", { length: 255 }),
  subject: varchar("subject", { length: 255 }),
  body: text("body").notNull(),
  // Provider
  providerMessageId: varchar("provider_message_id", { length: 255 }), // Twilio SID / SendGrid ID
  providerStatus: varchar("provider_status", { length: 50 }),
  // Delivery
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  failedAt: timestamp("failed_at"),
  failureReason: text("failure_reason"),
  sourceSystem: varchar("source_system", { length: 64 }),
  sourceId: varchar("source_id", { length: 256 }),
  importSessionId: uuid("import_session_id").references(() => importSessions.id),
  ...timestamps,
}, (t) => ({
  companyIdx: index("message_logs_company_idx").on(t.companyId),
  customerIdx: index("message_logs_customer_idx").on(t.customerId),
  jobIdx: index("message_logs_job_idx").on(t.jobId),
  importLineageIdx: uniqueIndex("message_logs_import_lineage_idx").on(
    t.companyId,
    t.sourceSystem,
    t.sourceId,
  ),
}));

// ─────────────────────────────────────────────
// 12. FORMS
// ─────────────────────────────────────────────

// Form templates — defined at the company level, reused across jobs
// v1 ships with pre-built HVAC templates; custom form builder is v2
export const formTemplates = pgTable("form_templates", {
  id: id(),
  companyId: companyId(),
  name: varchar("name", { length: 255 }).notNull(), // "HVAC Maintenance Checklist"
  formType: formTypeEnum("form_type").notNull(),
  description: text("description"),
  // JSON Schema defining the form fields
  // Each field: { id, label, type, required, options?, conditionalOn? }
  // Field types: text, textarea, number, boolean, select, multi_select, date, signature, photo
  fields: jsonb("fields").notNull().default([]),
  // Which asset types this form is relevant for
  applicableAssetTypes: text("applicable_asset_types").array().default([]),
  // Whether this is a system-provided template (cannot be deleted, only archived)
  isSystemTemplate: boolean("is_system_template").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").default(0),
  ...timestamps,
}, (t) => ({
  companyIdx: index("form_templates_company_idx").on(t.companyId),
  typeIdx: index("form_templates_type_idx").on(t.formType),
  activeIdx: index("form_templates_active_idx").on(t.isActive),
}));

// Form submissions — one per job+form combination, filled out by technician
export const formSubmissions = pgTable("form_submissions", {
  id: id(),
  companyId: companyId(),
  formTemplateId: uuid("form_template_id").notNull().references(() => formTemplates.id),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  assetId: uuid("asset_id").references(() => assets.id), // form may target a specific asset
  submittedById: uuid("submitted_by_id").references(() => users.id), // technician
  // Responses as key-value: { [fieldId]: value }
  responses: jsonb("responses").notNull().default({}),
  // Computed pass/fail for checklist-type forms (v1.5 feature, column present now)
  passedInspection: boolean("passed_inspection"),
  failureNotes: text("failure_notes"),
  // Submission state
  startedAt: timestamp("started_at"),
  submittedAt: timestamp("submitted_at"),
  ...timestamps,
}, (t) => ({
  companyIdx: index("form_submissions_company_idx").on(t.companyId),
  jobIdx: index("form_submissions_job_idx").on(t.jobId),
  templateIdx: index("form_submissions_template_idx").on(t.formTemplateId),
}));

// ─────────────────────────────────────────────
// 13. ONBOARDING / IMPORT
// ─────────────────────────────────────────────

// Multi-file onboarding bundle (FS-MIGRATE); many import_sessions may share one bundle.
export const importBundles = pgTable("import_bundles", {
  id: id(),
  companyId: companyId(),
  createdById: uuid("created_by_id").references(() => users.id),
  sourceSystem: varchar("source_system", { length: 64 }).notNull().default("manual_csv"),
  label: varchar("label", { length: 255 }),
  status: importBundleStatusEnum("status").notNull().default("active"),
  wizardStep: integer("wizard_step").notNull().default(1),
  stepState: jsonb("step_state").notNull().default({}),
  dedupeDecisions: jsonb("dedupe_decisions").notNull().default({}),
  completedAt: timestamp("completed_at"),
  abandonedAt: timestamp("abandoned_at"),
  ...timestamps,
}, (t) => ({
  companyIdx: index("import_bundles_company_idx").on(t.companyId),
}));

// Tracks a single CSV import session from upload through completion
// Supports rollback: all records created by an import are tagged with import_session_id
export const importSessions = pgTable("import_sessions", {
  id: id(),
  companyId: companyId(),
  createdById: uuid("created_by_id").references(() => users.id),
  importBundleId: uuid("import_bundle_id").references(() => importBundles.id),
  sourceSystem: varchar("source_system", { length: 64 }),
  entityType: importEntityTypeEnum("entity_type").notNull(), // what is being imported
  status: importSessionStatusEnum("status").notNull().default("uploaded"),
  // Source file
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileUrl: text("file_url").notNull(), // S3/storage URL of the uploaded CSV
  // Row counts
  totalRows: integer("total_rows").default(0),
  validRows: integer("valid_rows").default(0),
  errorRows: integer("error_rows").default(0),
  importedRows: integer("imported_rows").default(0),
  skippedRows: integer("skipped_rows").default(0),
  duplicateRows: integer("duplicate_rows").default(0),
  // AI column mapping: { [csvColumnName]: schemaFieldName }
  // AI generates this; user reviews and confirms before import runs
  columnMappings: jsonb("column_mappings").default({}),
  // Validation errors per row: [{ row: 12, field: "phone", message: "Invalid format" }]
  validationErrors: jsonb("validation_errors").default([]),
  // AI-inferred values (e.g. asset types inferred from job description text)
  aiInferences: jsonb("ai_inferences").default({}),
  // Chunked ingest progress (FS-MIGRATE ADR): chunksTotal, chunksDone, rowsOk, lastCursor, …
  progress: jsonb("progress").default({}),
  // Rollback
  rolledBackAt: timestamp("rolled_back_at"),
  rolledBackById: uuid("rolled_back_by_id").references(() => users.id),
  // Completion
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  ...timestamps,
}, (t) => ({
  companyIdx: index("import_sessions_company_idx").on(t.companyId),
  statusIdx: index("import_sessions_status_idx").on(t.status),
  entityTypeIdx: index("import_sessions_entity_type_idx").on(t.entityType),
  bundleIdx: index("import_sessions_bundle_idx").on(t.importBundleId),
}));

// Idempotent chunk commits for large imports (ADR-FS-MIGRATE §3).
export const importChunkRuns = pgTable("import_chunk_runs", {
  id: id(),
  companyId: companyId(),
  importSessionId: uuid("import_session_id")
    .notNull()
    .references(() => importSessions.id),
  entityType: importEntityTypeEnum("entity_type").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  chunksTotal: integer("chunks_total").notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 255 }).notNull(),
  status: importChunkRunStatusEnum("status").notNull().default("pending"),
  cursor: jsonb("cursor").default({}),
  rowsOk: integer("rows_ok").default(0),
  rowsFailed: integer("rows_failed").default(0),
  errorMessage: text("error_message"),
  completedAt: timestamp("completed_at"),
  ...timestamps,
}, (t) => ({
  companyIdx: index("import_chunk_runs_company_idx").on(t.companyId),
  sessionIdx: index("import_chunk_runs_session_idx").on(t.importSessionId),
  idempotencyUnique: uniqueIndex("import_chunk_runs_idempotency_key_idx").on(t.idempotencyKey),
}));

export const qboConnectionStatusEnum = pgEnum("qbo_connection_status", [
  "pending",
  "connected",
  "error",
  "disconnected"
]);

export const qboSyncIssueKindEnum = pgEnum("qbo_sync_issue_kind", ["conflict", "error"]);

export const qboSyncDirectionEnum = pgEnum("qbo_sync_direction", ["push", "pull"]);

export const qboSyncEntityTypeEnum = pgEnum("qbo_sync_entity_type", [
  "customer",
  "invoice",
  "payment"
]);

export const qboConnections = pgTable("qbo_connections", {
  id: id(),
  companyId: companyId(),
  realmId: varchar("realm_id", { length: 64 }).notNull(),
  environment: varchar("environment", { length: 16 }).notNull().default("sandbox"),
  status: qboConnectionStatusEnum("status").notNull().default("pending"),
  accessTokenEnc: text("access_token_enc").notNull(),
  refreshTokenEnc: text("refresh_token_enc").notNull(),
  accessTokenExpiresAt: timestamp("access_token_expires_at").notNull(),
  pullCursor: varchar("pull_cursor", { length: 128 }),
  lastSyncAt: timestamp("last_sync_at"),
  lastErrorMessage: text("last_error_message"),
  ...timestamps
}, (t) => ({
  companyUnique: uniqueIndex("qbo_connections_company_idx").on(t.companyId),
  realmIdx: index("qbo_connections_realm_idx").on(t.realmId)
}));

export const qboSyncIssues = pgTable("qbo_sync_issues", {
  id: id(),
  companyId: companyId(),
  connectionId: uuid("connection_id")
    .notNull()
    .references(() => qboConnections.id),
  direction: qboSyncDirectionEnum("direction").notNull(),
  entityType: qboSyncEntityTypeEnum("entity_type").notNull(),
  renvaniEntityId: uuid("renvani_entity_id"),
  qboEntityId: varchar("qbo_entity_id", { length: 64 }),
  kind: qboSyncIssueKindEnum("kind").notNull(),
  code: varchar("code", { length: 64 }).notNull(),
  message: text("message").notNull(),
  payload: jsonb("payload").notNull().default({}),
  resolvedAt: timestamp("resolved_at"),
  resolvedById: uuid("resolved_by_id").references(() => users.id),
  ...timestamps
}, (t) => ({
  companyIdx: index("qbo_sync_issues_company_idx").on(t.companyId),
  openIdx: index("qbo_sync_issues_open_idx").on(t.companyId, t.resolvedAt)
}));

export const dataExportSessions = pgTable("data_export_sessions", {
  id: id(),
  companyId: companyId(),
  requestedById: uuid("requested_by_id").references(() => users.id),
  status: dataExportStatusEnum("status").notNull().default("pending"),
  format: dataExportFormatEnum("format").notNull().default("json"),
  manifestVersion: varchar("manifest_version", { length: 64 }).notNull().default("fsm.data-export.v1"),
  progressPercent: integer("progress_percent").notNull().default(0),
  fileName: varchar("file_name", { length: 255 }),
  fileUrl: text("file_url"),
  recordCounts: jsonb("record_counts").notNull().default({}),
  expiresAt: timestamp("expires_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  ...timestamps
}, (t) => ({
  companyIdx: index("data_export_sessions_company_idx").on(t.companyId),
  statusIdx: index("data_export_sessions_status_idx").on(t.status)
}));

export const automationRuleTypeEnum = pgEnum("automation_rule_type", [
  "estimate_follow_up",
  "estimate_declined",
  "invoice_reminder",
  "invoice_overdue",
  "dormant_customer",
  "maintenance_due",
  "service_agreement_renewal",
  "job_follow_up",
  "review_request",
]);

export const automationRules = pgTable("automation_rules", {
  id: id(),
  companyId: companyId(),
  ruleType: automationRuleTypeEnum("rule_type").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(false),
  delayHours: integer("delay_hours"),
  thresholdDays: integer("threshold_days"),
  config: jsonb("config").default({}),
  ...timestamps,
}, (t) => ({
  companyIdx: index("automation_rules_company_idx").on(t.companyId),
  ruleTypeIdx: index("automation_rules_rule_type_idx").on(t.ruleType),
  companyRuleTypeIdx: uniqueIndex("automation_rules_company_rule_type_idx").on(t.companyId, t.ruleType),
}));

export const productCatalog = pgTable("product_catalog", {
  id: id(),
  companyId: companyId(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: productCategoryEnum("category").notNull().default("service"),
  sku: varchar("sku", { length: 100 }),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull().default("0"),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  unit: varchar("unit", { length: 50 }).default("each"),
  isTaxable: boolean("is_taxable").default(true),
  isActive: boolean("is_active").notNull().default(true),
  applicableAssetTypes: text("applicable_asset_types").array().default([]),
  sortOrder: integer("sort_order").default(0),
  sourceSystem: varchar("source_system", { length: 64 }),
  sourceId: varchar("source_id", { length: 256 }),
  importSessionId: uuid("import_session_id").references(() => importSessions.id),
  ...timestamps,
}, (t) => ({
  companyIdx: index("product_catalog_company_idx").on(t.companyId),
  activeIdx: index("product_catalog_active_idx").on(t.isActive),
  lineageIdx: uniqueIndex("product_catalog_lineage_company_idx").on(
    t.companyId,
    t.sourceSystem,
    t.sourceId
  ),
}));

/** Maps vendor price-book ids to catalog rows for invoice line resolution during FS-MIGRATE. */
export const importInvoiceLineSeeds = pgTable("import_invoice_line_seeds", {
  id: id(),
  companyId: companyId(),
  importSessionId: uuid("import_session_id")
    .notNull()
    .references(() => importSessions.id),
  sourceSystem: varchar("source_system", { length: 64 }).notNull(),
  sourceId: varchar("source_id", { length: 256 }).notNull(),
  productCatalogId: uuid("product_catalog_id")
    .notNull()
    .references(() => productCatalog.id),
  sku: varchar("sku", { length: 100 }),
  name: varchar("name", { length: 255 }).notNull(),
  ...timestamps,
}, (t) => ({
  companyIdx: index("import_invoice_line_seeds_company_idx").on(t.companyId),
  sessionIdx: index("import_invoice_line_seeds_session_idx").on(t.importSessionId),
  lookupIdx: uniqueIndex("import_invoice_line_seeds_lookup_idx").on(
    t.companyId,
    t.sourceSystem,
    t.sourceId
  ),
}));

export const jobTasks = pgTable("job_tasks", {
  id: id(),
  companyId: companyId(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  assignedToId: uuid("assigned_to_id").references(() => technicians.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: jobTaskStatusEnum("status").notNull().default("pending"),
  isRequired: boolean("is_required").default(false),
  completedAt: timestamp("completed_at"),
  completedById: uuid("completed_by_id").references(() => users.id),
  estimatedMinutes: integer("estimated_minutes"),
  actualMinutes: integer("actual_minutes"),
  sortOrder: integer("sort_order").default(0),
  notes: text("notes"),
  ...timestamps,
}, (t) => ({
  companyIdx: index("job_tasks_company_idx").on(t.companyId),
  jobIdx: index("job_tasks_job_idx").on(t.jobId),
  statusIdx: index("job_tasks_status_idx").on(t.status),
}));

export const jobProducts = pgTable("job_products", {
  id: id(),
  companyId: companyId(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  productCatalogId: uuid("product_catalog_id").references(() => productCatalog.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: productCategoryEnum("category").notNull().default("service"),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull().default("1"),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  isTaxable: boolean("is_taxable").default(true),
  addedById: uuid("added_by_id").references(() => users.id),
  isUpsell: boolean("is_upsell").default(false),
  upsellApproved: boolean("upsell_approved").default(false),
  upsellApprovedAt: timestamp("upsell_approved_at"),
  ...timestamps,
}, (t) => ({
  companyIdx: index("job_products_company_idx").on(t.companyId),
  jobIdx: index("job_products_job_idx").on(t.jobId),
}));

export const timeEntries = pgTable("time_entries", {
  id: id(),
  companyId: companyId(),
  jobId: uuid("job_id").notNull().references(() => jobs.id),
  technicianId: uuid("technician_id").notNull().references(() => technicians.id),
  startedAt: timestamp("started_at").notNull(),
  endedAt: timestamp("ended_at"),
  durationMinutes: integer("duration_minutes"),
  entryType: varchar("entry_type", { length: 30 }).default("on_site"),
  notes: text("notes"),
  travelFromAddress: text("travel_from_address"),
  ...timestamps,
}, (t) => ({
  companyIdx: index("time_entries_company_idx").on(t.companyId),
  jobIdx: index("time_entries_job_idx").on(t.jobId),
  technicianIdx: index("time_entries_technician_idx").on(t.technicianId),
}));

export const reviewRequests = pgTable("review_requests", {
  id: id(),
  companyId: companyId(),
  jobId: uuid("job_id").references(() => jobs.id),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  technicianId: uuid("technician_id").references(() => technicians.id),
  referenceId: uuid("reference_id").notNull().defaultRandom(),
  status: reviewRequestStatusEnum("status").notNull().default("pending"),
  channel: varchar("channel", { length: 20 }).default("sms"),
  reviewUrl: text("review_url"),
  sentAt: timestamp("sent_at"),
  clickedAt: timestamp("clicked_at"),
  completedAt: timestamp("completed_at"),
  rating: integer("rating"),
  reviewText: text("review_text"),
  ...timestamps,
}, (t) => ({
  companyIdx: index("review_requests_company_idx").on(t.companyId),
  customerIdx: index("review_requests_customer_idx").on(t.customerId),
  jobIdx: index("review_requests_job_idx").on(t.jobId),
  statusIdx: index("review_requests_status_idx").on(t.status),
  referenceIdx: uniqueIndex("review_requests_reference_idx").on(t.referenceId),
}));

export const fileAttachments = pgTable("file_attachments", {
  id: id(),
  companyId: companyId(),
  entityType: attachmentEntityTypeEnum("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  jobId: uuid("job_id"),
  customerId: uuid("customer_id"),
  uploadedById: uuid("uploaded_by_id").references(() => users.id),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileUrl: text("file_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  mimeType: varchar("mime_type", { length: 100 }),
  fileSizeBytes: integer("file_size_bytes"),
  fileType: varchar("file_type", { length: 30 }).default("photo"),
  caption: text("caption"),
  photoType: varchar("photo_type", { length: 20 }).default("general"),
  takenAt: timestamp("taken_at"),
  ...timestamps,
}, (t) => ({
  companyIdx: index("file_attachments_company_idx").on(t.companyId),
  entityIdx: index("file_attachments_entity_idx").on(t.entityType, t.entityId),
  jobIdx: index("file_attachments_job_idx").on(t.jobId),
  customerIdx: index("file_attachments_customer_idx").on(t.customerId),
}));

export const onTheWayNotifications = pgTable("on_the_way_notifications", {
  id: id(),
  companyId: companyId(),
  jobId: uuid("job_id").notNull().references(() => jobs.id),
  technicianId: uuid("technician_id").notNull().references(() => technicians.id),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  sentAt: timestamp("sent_at"),
  channel: varchar("channel", { length: 20 }).default("sms"),
  message: text("message"),
  estimatedArrivalMinutes: integer("estimated_arrival_minutes"),
  technicianLat: decimal("technician_lat", { precision: 10, scale: 7 }),
  technicianLng: decimal("technician_lng", { precision: 10, scale: 7 }),
  ...timestamps,
}, (t) => ({
  companyIdx: index("on_the_way_company_idx").on(t.companyId),
  jobIdx: index("on_the_way_job_idx").on(t.jobId),
}));

export const bookingRequests = pgTable("booking_requests", {
  id: id(),
  companyId: companyId(),
  customerId: uuid("customer_id").references(() => customers.id),
  jobId: uuid("job_id").references(() => jobs.id),
  assignedTechnicianId: uuid("assigned_technician_id").references(() => technicians.id),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 30 }).notNull(),
  email: varchar("email", { length: 255 }),
  addressLine1: varchar("address_line1", { length: 255 }).notNull(),
  addressLine2: varchar("address_line2", { length: 100 }),
  city: varchar("city", { length: 100 }).notNull(),
  state: varchar("state", { length: 50 }).notNull(),
  zip: varchar("zip", { length: 20 }).notNull(),
  propertyType: varchar("property_type", { length: 30 }).default("residential"),
  serviceCategory: varchar("service_category", { length: 100 }),
  serviceType: varchar("service_type", { length: 100 }),
  serviceDetail: varchar("service_detail", { length: 255 }),
  urgency: varchar("urgency", { length: 30 }).default("this_week"),
  customerNotes: text("customer_notes"),
  preferredDate: date("preferred_date"),
  preferredWindow: varchar("preferred_window", { length: 50 }),
  status: bookingRequestStatusEnum("status").notNull().default("pending"),
  source: bookingSourceEnum("source").notNull().default("direct"),
  referenceNumber: varchar("reference_number", { length: 50 }),
  isPropertyOwner: boolean("is_property_owner").default(false),
  smsConsentAppointments: boolean("sms_consent_appointments").default(false),
  smsConsentMarketing: boolean("sms_consent_marketing").default(false),
  confirmedAt: timestamp("confirmed_at"),
  confirmedById: uuid("confirmed_by_id"),
  confirmationSentAt: timestamp("confirmation_sms_sent_at"),
  cancelledAt: timestamp("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
  ...timestamps,
}, (t) => ({
  companyIdx: index("booking_requests_company_idx").on(t.companyId),
  statusIdx: index("booking_requests_status_idx").on(t.status),
  zipIdx: index("booking_requests_zip_idx").on(t.zip),
  sourceIdx: index("booking_requests_source_idx").on(t.source),
  phoneIdx: index("booking_requests_phone_idx").on(t.phone),
}));

export const inquirySubmitIdempotency = pgTable("inquiry_submit_idempotency", {
  id: id(),
  companyId: companyId(),
  idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
  payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
  bookingRequestId: uuid("booking_request_id")
    .notNull()
    .references(() => bookingRequests.id),
  responseSnapshot: jsonb("response_snapshot").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  ...timestamps,
}, (t) => ({
  companyKeyUnique: uniqueIndex("inquiry_submit_idempotency_company_key_idx").on(
    t.companyId,
    t.idempotencyKey
  ),
  expiresIdx: index("inquiry_submit_idempotency_expires_idx").on(t.expiresAt)
}));

export const agentActionStateEnum = pgEnum("agent_action_state", [
  "proposed",
  "policy_evaluated",
  "awaiting_approval",
  "approved",
  "executing",
  "succeeded",
  "failed",
  "expired",
  "cancelled",
  "escalated",
  "reversed",
]);

export const agentProductEnum = pgEnum("agent_product", [
  "revenue",
  "scheduling",
  "service",
  "retention",
  "owner",
  "loyalty",
]);

export const fieldSyncBatchStatusEnum = pgEnum("field_sync_batch_status", ["open", "completed"]);

export const fieldSyncOperationOutcomeEnum = pgEnum("field_sync_operation_outcome", [
  "applied",
  "duplicate",
  "conflict",
  "rejected"
]);

export const fieldSyncBatches = pgTable(
  "field_sync_batches",
  {
    id: id(),
    companyId: companyId(),
    userId: uuid("user_id").notNull().references(() => users.id),
    deviceId: varchar("device_id", { length: 128 }).notNull(),
    batchClientId: varchar("batch_client_id", { length: 128 }).notNull(),
    status: fieldSyncBatchStatusEnum("status").notNull().default("open"),
    lastAcknowledgedSequence: integer("last_acknowledged_sequence").notNull().default(0),
    ...timestamps
  },
  (t) => ({
    deviceBatchUnique: uniqueIndex("field_sync_batches_device_client_idx").on(
      t.companyId,
      t.deviceId,
      t.batchClientId
    ),
    companyUserIdx: index("field_sync_batches_company_user_idx").on(t.companyId, t.userId)
  })
);

export const fieldSyncOperations = pgTable(
  "field_sync_operations",
  {
    id: id(),
    companyId: companyId(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => fieldSyncBatches.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    clientOperationId: varchar("client_operation_id", { length: 128 }).notNull(),
    jobId: uuid("job_id").notNull().references(() => jobs.id),
    operationType: varchar("operation_type", { length: 64 }).notNull(),
    requestPayload: jsonb("request_payload").notNull(),
    outcome: fieldSyncOperationOutcomeEnum("outcome").notNull(),
    resultPayload: jsonb("result_payload").notNull().default({}),
    payloadHash: varchar("payload_hash", { length: 128 }).notNull(),
    ...timestamps
  },
  (t) => ({
    companyClientOpUnique: uniqueIndex("field_sync_operations_company_client_op_idx").on(
      t.companyId,
      t.clientOperationId
    ),
    batchSequenceIdx: index("field_sync_operations_batch_sequence_idx").on(t.batchId, t.sequence)
  })
);

export const agentActions = pgTable(
  "agent_actions",
  {
    id: id(),
    companyId: companyId(),
    agentProduct: agentProductEnum("agent_product").notNull(),
    actionType: varchar("action_type", { length: 100 }).notNull(),
    parameters: jsonb("parameters").notNull().default({}),
    target: jsonb("target").notNull(),
    sourceEventIds: jsonb("source_event_ids").$type<string[]>().notNull().default([]),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    payloadHash: varchar("payload_hash", { length: 128 }).notNull(),
    policyVersion: varchar("policy_version", { length: 64 }).notNull(),
    requiresApproval: boolean("requires_approval").notNull(),
    state: agentActionStateEnum("state").notNull().default("proposed"),
    confidence: decimal("confidence", { precision: 5, scale: 4 }),
    reason: text("reason"),
    expiresAt: timestamp("expires_at").notNull(),
    reviewerId: uuid("reviewer_id"),
    approvedParameters: jsonb("approved_parameters"),
    executionReceipt: jsonb("execution_receipt"),
    ...timestamps,
  },
  (t) => ({
    companyIdempotencyUnique: uniqueIndex("agent_actions_company_idempotency_idx").on(
      t.companyId,
      t.idempotencyKey
    ),
    companyStateIdx: index("agent_actions_company_state_idx").on(t.companyId, t.state),
  })
);

export const growthIntakeCheckStatusEnum = pgEnum("growth_intake_check_status", [
  "intake_draft",
  "queued",
  "scanning",
  "review_needed",
  "completed",
  "archived",
]);

export const growthIntakeIdentitySourceEnum = pgEnum("growth_intake_identity_source", [
  "manual",
  "website",
  "google_business",
  "facebook",
  "import",
  "ai",
]);

export const growthIntakeFindingSeverityEnum = pgEnum("growth_intake_finding_severity", [
  "info",
  "low",
  "medium",
  "high",
  "critical",
]);

export const growthIntakeFindingStatusEnum = pgEnum("growth_intake_finding_status", [
  "open",
  "acknowledged",
  "resolved",
  "dismissed",
]);

export const growthIntakeAuditEntityTypeEnum = pgEnum("growth_intake_audit_entity_type", [
  "growth_intake_check",
  "growth_intake_identity_candidate",
  "growth_intake_finding",
]);

export const growthIntakeAuditActionEnum = pgEnum("growth_intake_audit_action", [
  "created",
  "updated",
  "deleted",
]);

export const growthIntakeChecks = pgTable(
  "growth_intake_checks",
  {
    id: id(),
    companyId: companyId(),
    status: growthIntakeCheckStatusEnum("status").notNull().default("queued"),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    reviewNeeded: boolean("review_needed").notNull().default(false),
    lastScanAt: timestamp("last_scan_at"),
    businessName: varchar("business_name", { length: 255 }).notNull(),
    websiteUrl: varchar("website_url", { length: 500 }),
    industry: varchar("industry", { length: 120 }),
    trade: varchar("trade", { length: 120 }),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 50 }),
    zip: varchar("zip", { length: 20 }),
    contactName: varchar("contact_name", { length: 255 }),
    contactEmail: varchar("contact_email", { length: 255 }),
    contactPhone: varchar("contact_phone", { length: 30 }),
    targetMarket: text("target_market"),
    googleBusinessProfileUrl: varchar("google_business_profile_url", { length: 500 }),
    facebookPageUrl: varchar("facebook_page_url", { length: 500 }),
    intakeNotes: text("intake_notes"),
    ...timestamps,
  },
  (t) => ({
    companyStatusIdx: index("growth_intake_checks_company_status_idx").on(t.companyId, t.status),
    companyOwnerIdx: index("growth_intake_checks_company_owner_idx").on(t.companyId, t.ownerUserId),
    companyReviewIdx: index("growth_intake_checks_company_review_idx").on(t.companyId, t.reviewNeeded),
  })
);

export const growthIntakeIdentityCandidates = pgTable(
  "growth_intake_identity_candidates",
  {
    id: id(),
    companyId: companyId(),
    growthIntakeCheckId: uuid("growth_intake_check_id")
      .notNull()
      .references(() => growthIntakeChecks.id, { onDelete: "cascade" }),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    domain: varchar("domain", { length: 255 }),
    source: growthIntakeIdentitySourceEnum("source").notNull().default("manual"),
    confidenceScore: decimal("confidence_score", { precision: 5, scale: 4 }),
    isPrimary: boolean("is_primary").notNull().default(false),
    metadata: jsonb("metadata").notNull().default({}),
    ...timestamps,
  },
  (t) => ({
    checkIdx: index("growth_intake_identity_candidates_check_idx").on(t.growthIntakeCheckId),
    companyCheckIdx: index("growth_intake_identity_candidates_company_check_idx").on(
      t.companyId,
      t.growthIntakeCheckId
    ),
  })
);

export const growthIntakeFindings = pgTable(
  "growth_intake_findings",
  {
    id: id(),
    companyId: companyId(),
    growthIntakeCheckId: uuid("growth_intake_check_id")
      .notNull()
      .references(() => growthIntakeChecks.id, { onDelete: "cascade" }),
    category: varchar("category", { length: 100 }).notNull(),
    severity: growthIntakeFindingSeverityEnum("severity").notNull().default("info"),
    status: growthIntakeFindingStatusEnum("status").notNull().default("open"),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    recommendation: text("recommendation"),
    evidence: jsonb("evidence").notNull().default({}),
    ...timestamps,
  },
  (t) => ({
    checkIdx: index("growth_intake_findings_check_idx").on(t.growthIntakeCheckId),
    companyCheckIdx: index("growth_intake_findings_company_check_idx").on(t.companyId, t.growthIntakeCheckId),
  })
);

export const growthIntakeAuditEvents = pgTable(
  "growth_intake_audit_events",
  {
    id: id(),
    companyId: companyId(),
    entityType: growthIntakeAuditEntityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    growthIntakeCheckId: uuid("growth_intake_check_id").references(() => growthIntakeChecks.id, {
      onDelete: "set null",
    }),
    action: growthIntakeAuditActionEnum("action").notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    beforeState: jsonb("before_state"),
    afterState: jsonb("after_state"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    companyEntityIdx: index("growth_intake_audit_events_company_entity_idx").on(
      t.companyId,
      t.entityType,
      t.entityId
    ),
    companyCheckIdx: index("growth_intake_audit_events_company_check_idx").on(
      t.companyId,
      t.growthIntakeCheckId
    ),
  })
);

export const qboMappingKindEnum = pgEnum("qbo_mapping_kind", [
  "price_book_item",
  "tax_code",
  "payment_method",
]);

export const qboEntityMappings = pgTable(
  "qbo_entity_mappings",
  {
    id: id(),
    companyId: companyId(),
    kind: qboMappingKindEnum("kind").notNull(),
    localKey: varchar("local_key", { length: 128 }).notNull(),
    qboId: varchar("qbo_id", { length: 64 }),
    qboName: varchar("qbo_name", { length: 255 }),
    ...timestamps,
  },
  (t) => ({
    companyIdx: index("qbo_entity_mappings_company_idx").on(t.companyId),
    lookupIdx: uniqueIndex("qbo_entity_mappings_lookup_idx").on(t.companyId, t.kind, t.localKey),
  })
);

export const bookingSettings = pgTable("booking_settings", {
  id: id(),
  companyId: companyId(),
  isEnabled: boolean("is_enabled").notNull().default(false),
  bookingSlug: varchar("booking_slug", { length: 100 }),
  offeredServices: jsonb("offered_services").default([]),
  availableHoursStart: integer("available_hours_start").default(8),
  availableHoursEnd: integer("available_hours_end").default(17),
  availableDays: text("available_days").array().default(["mon", "tue", "wed", "thu", "fri"]),
  slotDuration: integer("slot_duration").default(2),
  maxAdvanceDays: integer("max_advance_days").default(14),
  autoConfirm: boolean("auto_confirm").default(false),
  googleReviewUrl: text("google_review_url"),
  yelpReviewUrl: text("yelp_review_url"),
  facebookReviewUrl: text("facebook_review_url"),
  customReviewUrl: text("custom_review_url"),
  tagline: text("tagline"),
  allowZipOverflow: boolean("allow_zip_overflow").default(false),
  balanceWorkload: boolean("balance_workload").default(true),
  notifyOnNewBooking: boolean("notify_on_new_booking").default(true),
  notificationEmail: varchar("notification_email", { length: 255 }),
  ...timestamps,
}, (t) => ({
  companyIdx: uniqueIndex("booking_settings_company_idx").on(t.companyId),
  slugIdx: uniqueIndex("booking_settings_slug_idx").on(t.bookingSlug),
}));

export const growthCheckScanStatusEnum = pgEnum("growth_check_scan_status", [
  "queued",
  "running",
  "completed",
  "failed",
]);

export const growthCheckFindingStatusEnum = pgEnum("growth_check_finding_status", [
  "pass",
  "fail",
  "warning",
  "unknown",
]);

export const growthCheckFindingConfidenceEnum = pgEnum("growth_check_finding_confidence", [
  "high",
  "medium",
  "low",
]);

export const growthCheckScans = pgTable(
  "growth_check_scans",
  {
    id: id(),
    companyId: companyId(),
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id),
    targetUrl: text("target_url").notNull(),
    rubricId: varchar("rubric_id", { length: 64 }).notNull(),
    rubricVersion: varchar("rubric_version", { length: 32 }).notNull(),
    status: growthCheckScanStatusEnum("status").notNull().default("queued"),
    progress: jsonb("progress").notNull().default({}),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    failureReason: text("failure_reason"),
    ...timestamps,
  },
  (t) => ({
    companyIdx: index("growth_check_scans_company_idx").on(t.companyId),
    companyIdempotencyUnique: uniqueIndex("growth_check_scans_company_idempotency_idx").on(
      t.companyId,
      t.idempotencyKey
    ),
  })
);

export const growthCheckFindings = pgTable(
  "growth_check_findings",
  {
    id: id(),
    companyId: companyId(),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => growthCheckScans.id, { onDelete: "cascade" }),
    areaId: varchar("area_id", { length: 64 }).notNull(),
    checkId: varchar("check_id", { length: 64 }).notNull(),
    sourceUrl: text("source_url").notNull(),
    observedAt: timestamp("observed_at").notNull(),
    status: growthCheckFindingStatusEnum("status").notNull(),
    confidence: growthCheckFindingConfidenceEnum("confidence").notNull(),
    summary: text("summary").notNull(),
    ...timestamps,
  },
  (t) => ({
    companyIdx: index("growth_check_findings_company_idx").on(t.companyId),
    scanIdx: index("growth_check_findings_scan_idx").on(t.scanId),
    scanCheckUnique: uniqueIndex("growth_check_findings_scan_check_idx").on(t.scanId, t.checkId),
  })
);

// ─────────────────────────────────────────────
// RELATIONS
// ─────────────────────────────────────────────

export const companiesRelations = relations(companies, ({ many }) => ({
  users: many(users),
  customers: many(customers),
  technicians: many(technicians),
  jobs: many(jobs),
  productCatalog: many(productCatalog),
  automationRules: many(automationRules),
  serviceAreas: many(serviceAreas),
  serviceAgreementTemplates: many(serviceAgreementTemplates),
  formTemplates: many(formTemplates),
  importSessions: many(importSessions),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  company: one(companies, { fields: [customers.companyId], references: [companies.id] }),
  properties: many(properties),
  assets: many(assets),
  jobs: many(jobs),
  notes: many(customerNotes),
  estimates: many(estimates),
  invoices: many(invoices),
  payments: many(payments),
  maintenancePlans: many(maintenancePlans),
  aiRecommendations: many(aiRecommendations),
}));

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  company: one(companies, { fields: [properties.companyId], references: [companies.id] }),
  customer: one(customers, { fields: [properties.customerId], references: [customers.id] }),
  assets: many(assets),
  jobs: many(jobs),
}));

export const assetsRelations = relations(assets, ({ one, many }) => ({
  company: one(companies, { fields: [assets.companyId], references: [companies.id] }),
  property: one(properties, { fields: [assets.propertyId], references: [properties.id] }),
  customer: one(customers, { fields: [assets.customerId], references: [customers.id] }),
  jobs: many(jobs),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  company: one(companies, { fields: [jobs.companyId], references: [companies.id] }),
  customer: one(customers, { fields: [jobs.customerId], references: [customers.id] }),
  property: one(properties, { fields: [jobs.propertyId], references: [properties.id] }),
  asset: one(assets, { fields: [jobs.assetId], references: [assets.id] }),
  technician: one(technicians, { fields: [jobs.technicianId], references: [technicians.id] }),
  notes: many(jobNotes),
  photos: many(jobPhotos),
  estimates: many(estimates),
  invoices: many(invoices),
  scheduleSlots: many(scheduleSlots),
  tasks: many(jobTasks),
  products: many(jobProducts),
  activityEvents: many(activityEvents),
  formSubmissions: many(formSubmissions),
}));

export const techniciansRelations = relations(technicians, ({ one, many }) => ({
  company: one(companies, { fields: [technicians.companyId], references: [companies.id] }),
  user: one(users, { fields: [technicians.userId], references: [users.id] }),
  jobs: many(jobs),
  assignedTasks: many(jobTasks),
  scheduleSlots: many(scheduleSlots),
}));

export const estimatesRelations = relations(estimates, ({ one, many }) => ({
  company: one(companies, { fields: [estimates.companyId], references: [companies.id] }),
  customer: one(customers, { fields: [estimates.customerId], references: [customers.id] }),
  property: one(properties, { fields: [estimates.propertyId], references: [properties.id] }),
  job: one(jobs, { fields: [estimates.jobId], references: [jobs.id] }),
  items: many(estimateItems),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  company: one(companies, { fields: [invoices.companyId], references: [companies.id] }),
  customer: one(customers, { fields: [invoices.customerId], references: [customers.id] }),
  job: one(jobs, { fields: [invoices.jobId], references: [jobs.id] }),
  items: many(invoiceItems),
  payments: many(payments),
}));

export const maintenancePlansRelations = relations(maintenancePlans, ({ one, many }) => ({
  company: one(companies, { fields: [maintenancePlans.companyId], references: [companies.id] }),
  customer: one(customers, { fields: [maintenancePlans.customerId], references: [customers.id] }),
  template: one(serviceAgreementTemplates, {
    fields: [maintenancePlans.serviceAgreementTemplateId],
    references: [serviceAgreementTemplates.id],
  }),
  visits: many(maintenanceVisits),
}));

export const serviceAgreementTemplatesRelations = relations(serviceAgreementTemplates, ({ one, many }) => ({
  company: one(companies, { fields: [serviceAgreementTemplates.companyId], references: [companies.id] }),
  plans: many(maintenancePlans),
}));

export const aiRecommendationsRelations = relations(aiRecommendations, ({ one }) => ({
  company: one(companies, { fields: [aiRecommendations.companyId], references: [companies.id] }),
  customer: one(customers, { fields: [aiRecommendations.customerId], references: [customers.id] }),
  asset: one(assets, { fields: [aiRecommendations.assetId], references: [assets.id] }),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  company: one(companies, { fields: [campaigns.companyId], references: [companies.id] }),
  recipients: many(campaignRecipients),
}));

export const formTemplatesRelations = relations(formTemplates, ({ one, many }) => ({
  company: one(companies, { fields: [formTemplates.companyId], references: [companies.id] }),
  submissions: many(formSubmissions),
}));

export const formSubmissionsRelations = relations(formSubmissions, ({ one }) => ({
  company: one(companies, { fields: [formSubmissions.companyId], references: [companies.id] }),
  formTemplate: one(formTemplates, {
    fields: [formSubmissions.formTemplateId],
    references: [formTemplates.id],
  }),
  job: one(jobs, { fields: [formSubmissions.jobId], references: [jobs.id] }),
  asset: one(assets, { fields: [formSubmissions.assetId], references: [assets.id] }),
}));

export const importBundlesRelations = relations(importBundles, ({ one, many }) => ({
  company: one(companies, { fields: [importBundles.companyId], references: [companies.id] }),
  createdBy: one(users, { fields: [importBundles.createdById], references: [users.id] }),
  sessions: many(importSessions),
}));

export const importSessionsRelations = relations(importSessions, ({ one, many }) => ({
  company: one(companies, { fields: [importSessions.companyId], references: [companies.id] }),
  createdBy: one(users, { fields: [importSessions.createdById], references: [users.id] }),
  bundle: one(importBundles, {
    fields: [importSessions.importBundleId],
    references: [importBundles.id],
  }),
  chunkRuns: many(importChunkRuns),
}));

export const importChunkRunsRelations = relations(importChunkRuns, ({ one }) => ({
  company: one(companies, { fields: [importChunkRuns.companyId], references: [companies.id] }),
  importSession: one(importSessions, {
    fields: [importChunkRuns.importSessionId],
    references: [importSessions.id],
  }),
}));

export const automationRulesRelations = relations(automationRules, ({ one }) => ({
  company: one(companies, { fields: [automationRules.companyId], references: [companies.id] }),
}));

export const productCatalogRelations = relations(productCatalog, ({ one, many }) => ({
  company: one(companies, { fields: [productCatalog.companyId], references: [companies.id] }),
  jobProducts: many(jobProducts),
}));

export const jobTasksRelations = relations(jobTasks, ({ one }) => ({
  company: one(companies, { fields: [jobTasks.companyId], references: [companies.id] }),
  job: one(jobs, { fields: [jobTasks.jobId], references: [jobs.id] }),
  assignedTo: one(technicians, { fields: [jobTasks.assignedToId], references: [technicians.id] }),
  completedBy: one(users, { fields: [jobTasks.completedById], references: [users.id] }),
}));

export const jobProductsRelations = relations(jobProducts, ({ one }) => ({
  company: one(companies, { fields: [jobProducts.companyId], references: [companies.id] }),
  job: one(jobs, { fields: [jobProducts.jobId], references: [jobs.id] }),
  product: one(productCatalog, {
    fields: [jobProducts.productCatalogId],
    references: [productCatalog.id],
  }),
  addedBy: one(users, { fields: [jobProducts.addedById], references: [users.id] }),
}));
