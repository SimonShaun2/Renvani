import { randomUUID } from "node:crypto";
import { Decimal } from "decimal.js";

type Predicate<T> = (row: T) => boolean;

type TableName =
  | "companies"
  | "users"
  | "refreshTokens"
  | "customers"
  | "properties"
  | "assets"
  | "jobs"
  | "importSessions"
  | "importBundles"
  | "savedCardMigrations"
  | "importChunkRuns"
  | "dataExportSessions"
  | "estimates"
  | "estimateItems"
  | "invoices"
  | "invoiceItems"
  | "payments"
  | "jobNotes"
  | "customerNotes"
  | "jobPhotos"
  | "serviceAgreementTemplates"
  | "maintenancePlans"
  | "vipMembershipTiers"
  | "maintenanceVisits"
  | "recurringVisitSeries"
  | "recurringVisitOccurrences"
  | "automationRules"
  | "aiRecommendations"
  | "campaigns"
  | "campaignRecipients"
  | "messageLogs"
  | "productCatalog"
  | "stockLocations"
  | "stockLevels"
  | "stockMovements"
  | "callTrackingSettings"
  | "callTrackingNumbers"
  | "callRecords"
  | "growthCheckScans"
  | "growthCheckFindings"
  | "growthCheckFindingRevisions"
  | "growthCheckReportDrafts"
  | "growthCheckReportDraftRevisions"
  | "growthCheckReportShares"
  | "technicians"
  | "jobTasks"
  | "jobProducts"
  | "scheduleSlots"
  | "activityEvents"
  | "timeEntries"
  | "timesheets"
  | "timesheetAuditEvents"
  | "technicianPayRates"
  | "reviewRequests"
  | "fileAttachments"
  | "onTheWayNotifications"
  | "bookingRequests"
  | "bookingSettings"
  | "agentActions"
  | "inquirySubmitIdempotency"
  | "serviceAreas"
  | "growthIntakeChecks"
  | "growthIntakeIdentityCandidates"
  | "growthIntakeFindings"
  | "growthIntakeAuditEvents"
  | "fieldSyncBatches"
  | "fieldSyncOperations";

type UserRole = "owner" | "admin" | "dispatcher" | "office" | "technician";
type TechnicianStatus = "active" | "inactive" | "on_leave";
type JobStatus =
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
type JobType =
  | "service_call"
  | "maintenance"
  | "installation"
  | "inspection"
  | "estimate_only"
  | "warranty"
  | "callback"
  | "emergency";
type JobPriority = "low" | "normal" | "high" | "urgent";
type JobPhotoType = "before" | "after" | "general";
type EstimateStatus = "draft" | "sent" | "viewed" | "approved" | "declined" | "expired" | "converted" | "revised";
type EstimateItemType = "service" | "labor" | "material" | "fee";
type InvoiceStatus = "draft" | "sent" | "viewed" | "partially_paid" | "paid" | "overdue" | "void" | "written_off";
type InvoiceItemType = "service" | "labor" | "material" | "fee";
type PaymentMethod = "card" | "ach" | "cash" | "check" | "financing" | "other";
type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded" | "disputed";
type MaintenancePlanStatus = "active" | "paused" | "expired" | "cancelled";
type MaintenancePlanFrequency = "monthly" | "bi_monthly" | "quarterly" | "bi_annual" | "annual";
type ServiceAgreementBillingCycle = "monthly" | "annual";
type ImportSessionStatus = "uploaded" | "mapping" | "preview" | "importing" | "completed" | "failed" | "rolled_back";
type ImportChunkRunStatus = "pending" | "running" | "completed" | "failed";
type DataExportStatus = "pending" | "processing" | "completed" | "failed" | "expired";
type DataExportFormat = "json" | "csv_bundle";
type ImportEntityType =
  | "customers"
  | "properties"
  | "assets"
  | "jobs"
  | "estimates"
  | "invoices"
  | "payments";
type AutomationRuleType =
  | "estimate_follow_up"
  | "estimate_declined"
  | "invoice_reminder"
  | "invoice_overdue"
  | "dormant_customer"
  | "maintenance_due"
  | "service_agreement_renewal"
  | "job_follow_up"
  | "review_request";
type AiRecommendationType =
  | "reactivation"
  | "aging_asset"
  | "maintenance_due"
  | "unsold_estimate"
  | "unpaid_invoice"
  | "upsell_opportunity"
  | "seasonal_campaign"
  | "maintenance_plan_offer";
type AiRecommendationStatus = "pending" | "actioned" | "dismissed" | "snoozed" | "expired";
type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "cancelled";
type CampaignType =
  | "reactivation"
  | "estimate_follow_up"
  | "invoice_reminder"
  | "seasonal"
  | "maintenance_reminder"
  | "custom";
type MessageChannel = "sms" | "email";
type MessageDirection = "inbound" | "outbound";
type ProductCategory = "service" | "labor" | "material" | "equipment" | "fee" | "bundle";
type JobTaskStatus = "pending" | "in_progress" | "completed" | "skipped";
type TimeEntryType = "travel" | "on_site" | "break";
type ReviewRequestStatus = "pending" | "sent" | "clicked" | "completed" | "declined";
type AttachmentEntityType =
  | "company"
  | "job"
  | "customer"
  | "property"
  | "asset"
  | "estimate"
  | "invoice"
  | "work_order";
type AttachmentFileType = "photo" | "document" | "video";
type BookingRequestStatus = "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
type BookingSource = "google" | "facebook" | "instagram" | "yelp" | "direct" | "website" | "qr_code";
type BookingUrgency = "emergency" | "this_week" | "flexible";
type PreferredBookingWindow = "morning" | "afternoon" | "first_available";

export interface TestCompanyRecord {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string;
  timezone: string;
  stripeCustomerId: string | null;
  stripeAccountId: string | null;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestUserRecord {
  id: string;
  companyId: string;
  email: string;
  passwordHash: string | null;
  passwordChangedAt: Date | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: UserRole;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  emailVerifiedAt?: Date | null;
  emailVerificationTokenHash?: string | null;
  emailVerificationExpiresAt?: Date | null;
  clerkUserId?: string | null;
  clerkUnlinkedAt?: Date | null;
  technicianId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestRefreshTokenRecord {
  id: string;
  companyId: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface TestCustomerRecord {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  altPhone: string | null;
  leadSource: string | null;
  referredBy: string | null;
  tags: string[] | null;
  internalNotes: string | null;
  lifetimeValue: string | null;
  totalJobs: number | null;
  lastServiceDate: string | null;
  firstServiceDate: string | null;
  prefersSms: boolean | null;
  prefersEmail: boolean | null;
  doNotContact: boolean | null;
  stripeCustomerId: string | null;
  sourceSystem: string | null;
  sourceId: string | null;
  importSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestPropertyRecord {
  id: string;
  companyId: string;
  customerId: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  zip: string;
  country: string | null;
  lat: string | null;
  lng: string | null;
  type: "residential" | "commercial" | "industrial" | "multi_family";
  sqft: number | null;
  yearBuilt: number | null;
  accessNotes: string | null;
  notes: string | null;
  isPrimary: boolean;
  isActive: boolean;
  sourceSystem?: string | null;
  sourceId?: string | null;
  importSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestAssetRecord {
  id: string;
  companyId: string;
  propertyId: string;
  customerId: string;
  name: string;
  assetType: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  installDate: string | null;
  warrantyExpiration: string | null;
  lastServiceDate: string | null;
  nextServiceDate: string | null;
  condition: "excellent" | "good" | "fair" | "poor" | "failed" | null;
  conditionNotes: string | null;
  conditionScore: number | null;
  replacementProbability: string | null;
  photoUrls: string[] | null;
  notes: string | null;
  isActive: boolean;
  importSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestJobRecord {
  id: string;
  companyId: string;
  customerId: string;
  jobNumber: string;
  propertyId: string | null;
  assetId: string | null;
  technicianId: string | null;
  assignedById: string | null;
  type: JobType;
  priority: JobPriority;
  status: JobStatus;
  leadSource: string | null;
  leadAttribution: Partial<Record<string, string>> | null;
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

export interface TestImportValidationError {
  row: number;
  field: string;
  message: string;
  value: string;
}

export interface TestImportBundleRecord {
  id: string;
  companyId: string;
  createdById: string | null;
  sourceSystem: string;
  label: string | null;
  status: "active" | "committing" | "completed" | "abandoned";
  wizardStep: number;
  stepState: Record<string, unknown>;
  dedupeDecisions: Record<string, unknown>;
  completedAt: Date | null;
  abandonedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestImportSessionRecord {
  id: string;
  companyId: string;
  createdById: string | null;
  importBundleId: string | null;
  sourceSystem: string | null;
  entityType: ImportEntityType;
  status: ImportSessionStatus;
  fileName: string;
  fileUrl: string;
  totalRows: number | null;
  validRows: number | null;
  errorRows: number | null;
  importedRows: number | null;
  skippedRows: number | null;
  duplicateRows: number | null;
  columnMappings: Record<string, string | null>;
  validationErrors: TestImportValidationError[];
  aiInferences: Record<string, unknown>;
  progress: Record<string, unknown>;
  rolledBackAt: Date | null;
  rolledBackById: string | null;
  completedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestImportChunkRunRecord {
  id: string;
  companyId: string;
  importSessionId: string;
  entityType: ImportEntityType;
  chunkIndex: number;
  chunksTotal: number;
  idempotencyKey: string;
  status: ImportChunkRunStatus;
  cursor: Record<string, unknown>;
  rowsOk: number | null;
  rowsFailed: number | null;
  errorMessage: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestEstimateRecord {
  id: string;
  companyId: string;
  estimateNumber: string;
  jobId: string | null;
  customerId: string;
  propertyId: string | null;
  createdById: string | null;
  status: EstimateStatus;
  tierLabel: string | null;
  tierGroupId: string | null;
  isSelectedTier: boolean | null;
  isRecommended: boolean;
  optionSetVersion: number;
  subtotal: string;
  taxRate: string | null;
  taxAmount: string | null;
  discountAmount: string | null;
  total: string;
  title: string | null;
  messageToCustomer: string | null;
  internalNotes: string | null;
  approvalToken: string | null;
  approvedAt: Date | null;
  approvedByName: string | null;
  approvedSignatureUrl: string | null;
  declinedAt: Date | null;
  declineReason: string | null;
  expiresAt: Date | null;
  sentAt: Date | null;
  viewedAt: Date | null;
  followUpSentAt: Date | null;
  financingOffered: boolean | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestEstimateItemRecord {
  id: string;
  estimateId: string;
  companyId: string;
  productCatalogId: string | null;
  name: string;
  description: string | null;
  itemType: EstimateItemType;
  quantity: string;
  unitPrice: string;
  total: string;
  isTaxable: boolean | null;
  sortOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestInvoiceRecord {
  id: string;
  companyId: string;
  invoiceNumber: string;
  jobId: string | null;
  estimateId: string | null;
  customerId: string;
  createdById: string | null;
  status: InvoiceStatus;
  subtotal: string;
  taxRate: string | null;
  taxAmount: string | null;
  discountAmount: string | null;
  total: string;
  amountPaid: string | null;
  balanceDue: string;
  serviceFeeAmount: string;
  bookingFeeAmount: string;
  issuedAt: Date | null;
  dueAt: Date | null;
  sentAt: Date | null;
  viewedAt: Date | null;
  paidAt: Date | null;
  stripePaymentLinkId: string | null;
  stripePaymentLinkUrl: string | null;
  paymentToken: string | null;
  reminder1SentAt: Date | null;
  reminder2SentAt: Date | null;
  reminder3SentAt: Date | null;
  title: string | null;
  messageToCustomer: string | null;
  internalNotes: string | null;
  sourceSystem: string | null;
  sourceId: string | null;
  importSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestInvoiceItemRecord {
  id: string;
  invoiceId: string;
  companyId: string;
  productCatalogId: string | null;
  name: string;
  description: string | null;
  itemType: InvoiceItemType;
  quantity: string;
  unitPrice: string;
  total: string;
  isTaxable: boolean | null;
  sortOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestPaymentRecord {
  id: string;
  companyId: string;
  invoiceId: string;
  customerId: string;
  collectedById: string | null;
  amount: string;
  serviceFeeAmount: string;
  bookingFeeAmount: string;
  feeRefundable: boolean;
  amountRefunded: string;
  method: PaymentMethod;
  status: PaymentStatus;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  checkNumber: string | null;
  referenceNumber: string | null;
  notes: string | null;
  paidAt: Date | null;
  sourceSystem: string | null;
  sourceId: string | null;
  importSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestJobNoteRecord {
  id: string;
  companyId: string;
  jobId: string;
  authorId: string | null;
  content: string;
  isInternal: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestCustomerNoteRecord {
  id: string;
  companyId: string;
  customerId: string;
  authorId: string | null;
  content: string;
  isInternal: boolean;
  notedAt: Date | null;
  sourceSystem: string | null;
  sourceId: string | null;
  importSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestJobPhotoRecord {
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

export interface TestServiceAgreementTemplateRecord {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  includedServices: string[] | null;
  visitsPerYear: number;
  frequency: MaintenancePlanFrequency;
  monthlyPrice: string | null;
  annualPrice: string | null;
  stripeMthlyPriceId: string | null;
  stripeAnnualPriceId: string | null;
  sortOrder: number | null;
  isActive: boolean;
  applicableAssetTypes: string[] | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestVipMembershipTierRecord {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  monthlyPrice: string;
  discountPercent: string;
  includedVisitsPerMonth: number | null;
  stripeMonthlyPriceId: string | null;
  sortOrder: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestMaintenancePlanRecord {
  id: string;
  companyId: string;
  customerId: string;
  propertyId: string | null;
  serviceAgreementTemplateId: string | null;
  vipTierId: string | null;
  name: string;
  description: string | null;
  includedServices: string[] | null;
  assetIds: string[] | null;
  status: MaintenancePlanStatus;
  frequency: MaintenancePlanFrequency;
  price: string | null;
  billingCycle: ServiceAgreementBillingCycle | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  stripeCurrentPeriodStart: Date | null;
  stripeCurrentPeriodEnd: Date | null;
  stripeCancelAtPeriodEnd: boolean | null;
  startDate: string;
  endDate: string | null;
  nextServiceDate: string | null;
  lastServiceDate: string | null;
  notes: string | null;
  sourceSystem: string | null;
  sourceId: string | null;
  importSessionId: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestMaintenanceVisitRecord {
  id: string;
  companyId: string;
  maintenancePlanId: string;
  jobId: string | null;
  scheduledDate: string | null;
  completedDate: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}


export interface TestRecurringVisitSeriesRecord {
  id: string;
  companyId: string;
  customerId: string;
  propertyId: string | null;
  maintenancePlanId: string | null;
  anchorMaintenanceVisitId: string | null;
  timeZone: string;
  frequency: MaintenancePlanFrequency;
  anchorLocalDate: string;
  localTime: string;
  status: "active" | "paused" | "cancelled";
  externalSchedulerAuthoritative: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestRecurringVisitOccurrenceRecord {
  id: string;
  companyId: string;
  seriesId: string;
  occurrenceIndex: number;
  scheduledLocalDate: string;
  scheduledAtUtc: Date;
  status: "scheduled" | "completed" | "cancelled" | "skipped";
  overrideScheduledLocalDate: string | null;
  overrideNotes: string | null;
  maintenanceVisitId: string | null;
  jobId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestAutomationRuleRecord {
  id: string;
  companyId: string;
  ruleType: AutomationRuleType;
  isEnabled: boolean;
  delayHours: number | null;
  thresholdDays: number | null;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestAiRecommendationRecord {
  id: string;
  companyId: string;
  type: AiRecommendationType;
  status: AiRecommendationStatus;
  customerId: string | null;
  propertyId: string | null;
  assetId: string | null;
  jobId: string | null;
  estimateId: string | null;
  invoiceId: string | null;
  estimatedRevenue: string | null;
  headline: string;
  body: string;
  suggestedAction: string | null;
  suggestedMessage: string | null;
  urgencyScore: number | null;
  confidenceScore: number | null;
  actionedAt: Date | null;
  actionedById: string | null;
  dismissedAt: Date | null;
  snoozedUntil: Date | null;
  expiresAt: Date | null;
  sourceEventIds: string[] | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestCampaignRecord {
  id: string;
  companyId: string;
  createdById: string | null;
  type: CampaignType;
  status: CampaignStatus;
  name: string;
  subject: string | null;
  body: string;
  channel: MessageChannel;
  isAiGenerated: boolean | null;
  aiRecommendationId: string | null;
  scheduledAt: Date | null;
  sentAt: Date | null;
  recipientCount: number | null;
  deliveredCount: number | null;
  openedCount: number | null;
  repliedCount: number | null;
  convertedCount: number | null;
  revenueAttributed: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestCampaignRecipientRecord {
  id: string;
  campaignId: string;
  customerId: string;
  companyId: string;
  sentAt: Date | null;
  deliveredAt: Date | null;
  openedAt: Date | null;
  repliedAt: Date | null;
  convertedAt: Date | null;
  conversionJobId: string | null;
  sentToPhone: string | null;
  sentToEmail: string | null;
  unsubscribedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestMessageLogRecord {
  id: string;
  companyId: string;
  customerId: string | null;
  jobId: string | null;
  campaignId: string | null;
  channel: MessageChannel;
  direction: MessageDirection;
  toAddress: string;
  fromAddress: string | null;
  subject: string | null;
  body: string;
  providerMessageId: string | null;
  providerStatus: string | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestProductCatalogRecord {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  category: ProductCategory;
  sku: string | null;
  unitPrice: string;
  cost: string | null;
  unit: string | null;
  isTaxable: boolean | null;
  isActive: boolean;
  applicableAssetTypes: string[] | null;
  sortOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestTechnicianRecord {
  id: string;
  companyId: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  avatarUrl: string | null;
  skills: string[] | null;
  serviceAreaIds: string[] | null;
  serviceZipCodes: string[] | null;
  availableDays: string[] | null;
  hoursPerDay: string | null;
  totalJobsCompleted: number | null;
  avgJobDurationMinutes: number | null;
  estimateCloseRate: string | null;
  avgTicketValue: string | null;
  status: TechnicianStatus;
  calendarColor: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestJobTaskRecord {
  id: string;
  companyId: string;
  jobId: string;
  assignedToId: string | null;
  title: string;
  description: string | null;
  status: JobTaskStatus;
  isRequired: boolean | null;
  completedAt: Date | null;
  completedById: string | null;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  sortOrder: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestJobProductRecord {
  id: string;
  companyId: string;
  jobId: string;
  productCatalogId: string | null;
  name: string;
  description: string | null;
  category: ProductCategory;
  quantity: string;
  unitPrice: string;
  total: string;
  isTaxable: boolean | null;
  addedById: string | null;
  isUpsell: boolean | null;
  upsellApproved: boolean | null;
  upsellApprovedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestScheduleSlotRecord {
  id: string;
  companyId: string;
  technicianId: string;
  jobId: string | null;
  isBlockedTime: boolean | null;
  blockReason: string | null;
  startTime: Date;
  endTime: Date;
  travelMinutesBefore: number | null;
  isConfirmed: boolean | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestActivityEventRecord {
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

export interface TestTimeEntryRecord {
  id: string;
  companyId: string;
  jobId: string;
  technicianId: string;
  startedAt: Date;
  endedAt: Date | null;
  durationMinutes: number | null;
  entryType: TimeEntryType | null;
  notes: string | null;
  travelFromAddress: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestReviewRequestRecord {
  id: string;
  companyId: string;
  jobId: string | null;
  customerId: string;
  technicianId: string | null;
  referenceId: string;
  status: ReviewRequestStatus;
  channel: MessageChannel;
  reviewUrl: string | null;
  sentAt: Date | null;
  clickedAt: Date | null;
  completedAt: Date | null;
  rating: number | null;
  reviewText: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestFileAttachmentRecord {
  id: string;
  companyId: string;
  entityType: AttachmentEntityType;
  entityId: string;
  jobId: string | null;
  customerId: string | null;
  uploadedById: string | null;
  fileName: string;
  fileUrl: string;
  thumbnailUrl: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  fileType: AttachmentFileType | null;
  caption: string | null;
  photoType: JobPhotoType | null;
  takenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestOnTheWayNotificationRecord {
  id: string;
  companyId: string;
  jobId: string;
  technicianId: string;
  customerId: string;
  sentAt: Date | null;
  channel: MessageChannel;
  message: string | null;
  estimatedArrivalMinutes: number | null;
  technicianLat: string | null;
  technicianLng: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestBookingRequestRecord {
  id: string;
  companyId: string;
  customerId: string | null;
  jobId: string | null;
  assignedTechnicianId: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  zip: string;
  propertyType: string | null;
  serviceCategory: string | null;
  serviceType: string | null;
  serviceDetail: string | null;
  urgency: BookingUrgency | null;
  customerNotes: string | null;
  preferredDate: string | null;
  preferredWindow: PreferredBookingWindow | null;
  status: BookingRequestStatus;
  source: BookingSource;
  referenceNumber: string | null;
  isPropertyOwner: boolean | null;
  smsConsentAppointments: boolean | null;
  smsConsentMarketing: boolean | null;
  leadAttribution: Partial<Record<string, string>> | null;
  confirmedAt: Date | null;
  confirmedById: string | null;
  confirmationSentAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

type GrowthCheckStatus =
  | "intake_draft"
  | "queued"
  | "scanning"
  | "review_needed"
  | "completed"
  | "archived";
type GrowthCheckIdentitySource = "manual" | "website" | "google_business" | "facebook" | "import" | "ai";
type GrowthCheckFindingSeverity = "info" | "low" | "medium" | "high" | "critical";
type GrowthCheckFindingStatus = "open" | "acknowledged" | "resolved" | "dismissed";
type GrowthIntakeAuditEntityType =
  | "growth_intake_check"
  | "growth_intake_identity_candidate"
  | "growth_intake_finding";
type GrowthCheckAuditAction = "created" | "updated" | "deleted";

export interface TestGrowthIntakeCheckRecord {
  id: string;
  companyId: string;
  status: GrowthCheckStatus;
  ownerUserId: string;
  createdById: string;
  reviewNeeded: boolean;
  lastScanAt: Date | null;
  businessName: string;
  websiteUrl: string | null;
  industry: string | null;
  trade: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  targetMarket: string | null;
  googleBusinessProfileUrl: string | null;
  facebookPageUrl: string | null;
  intakeNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestGrowthIntakeIdentityCandidateRecord {
  id: string;
  companyId: string;
  growthIntakeCheckId: string;
  displayName: string;
  domain: string | null;
  source: GrowthCheckIdentitySource;
  confidenceScore: string | null;
  isPrimary: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestGrowthIntakeFindingRecord {
  id: string;
  companyId: string;
  growthIntakeCheckId: string;
  category: string;
  severity: GrowthCheckFindingSeverity;
  status: GrowthCheckFindingStatus;
  title: string;
  description: string | null;
  recommendation: string | null;
  evidence: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestGrowthIntakeAuditEventRecord {
  id: string;
  companyId: string;
  entityType: GrowthIntakeAuditEntityType;
  entityId: string;
  growthIntakeCheckId: string | null;
  action: GrowthCheckAuditAction;
  actorId: string | null;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  createdAt: Date;
}

type AgentProduct = "revenue" | "scheduling" | "service" | "retention" | "owner";
type AgentActionState =
  | "proposed"
  | "policy_evaluated"
  | "awaiting_approval"
  | "approved"
  | "executing"
  | "succeeded"
  | "failed"
  | "expired"
  | "cancelled"
  | "escalated"
  | "reversed";

export interface TestCompanyRecord {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string;
  timezone: string;
  stripeCustomerId: string | null;
  stripeAccountId: string | null;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestUserRecord {
  id: string;
  companyId: string;
  email: string;
  passwordHash: string | null;
  passwordChangedAt: Date | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: UserRole;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  emailVerifiedAt?: Date | null;
  emailVerificationTokenHash?: string | null;
  emailVerificationExpiresAt?: Date | null;
  clerkUserId?: string | null;
  clerkUnlinkedAt?: Date | null;
  technicianId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestRefreshTokenRecord {
  id: string;
  companyId: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface TestCustomerRecord {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  altPhone: string | null;
  leadSource: string | null;
  referredBy: string | null;
  tags: string[] | null;
  internalNotes: string | null;
  lifetimeValue: string | null;
  totalJobs: number | null;
  lastServiceDate: string | null;
  firstServiceDate: string | null;
  prefersSms: boolean | null;
  prefersEmail: boolean | null;
  doNotContact: boolean | null;
  stripeCustomerId: string | null;
  sourceSystem: string | null;
  sourceId: string | null;
  importSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestPropertyRecord {
  id: string;
  companyId: string;
  customerId: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  zip: string;
  country: string | null;
  lat: string | null;
  lng: string | null;
  type: "residential" | "commercial" | "industrial" | "multi_family";
  sqft: number | null;
  yearBuilt: number | null;
  accessNotes: string | null;
  notes: string | null;
  isPrimary: boolean;
  isActive: boolean;
  importSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestAssetRecord {
  id: string;
  companyId: string;
  propertyId: string;
  customerId: string;
  name: string;
  assetType: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  installDate: string | null;
  warrantyExpiration: string | null;
  lastServiceDate: string | null;
  nextServiceDate: string | null;
  condition: "excellent" | "good" | "fair" | "poor" | "failed" | null;
  conditionNotes: string | null;
  conditionScore: number | null;
  replacementProbability: string | null;
  photoUrls: string[] | null;
  notes: string | null;
  isActive: boolean;
  importSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestJobRecord {
  id: string;
  companyId: string;
  customerId: string;
  jobNumber: string;
  propertyId: string | null;
  assetId: string | null;
  technicianId: string | null;
  assignedById: string | null;
  type: JobType;
  priority: JobPriority;
  status: JobStatus;
  leadSource: string | null;
  leadAttribution: Partial<Record<string, string>> | null;
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

export interface TestImportValidationError {
  row: number;
  field: string;
  message: string;
  value: string;
}

export interface TestDataExportSessionRecord {
  id: string;
  companyId: string;
  requestedById: string | null;
  status: DataExportStatus;
  format: DataExportFormat;
  manifestVersion: string;
  progressPercent: number;
  fileName: string | null;
  fileUrl: string | null;
  recordCounts: Record<string, number>;
  expiresAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestImportSessionRecord {
  id: string;
  companyId: string;
  createdById: string | null;
  importBundleId: string | null;
  sourceSystem: string | null;
  entityType: ImportEntityType;
  status: ImportSessionStatus;
  fileName: string;
  fileUrl: string;
  totalRows: number | null;
  validRows: number | null;
  errorRows: number | null;
  importedRows: number | null;
  skippedRows: number | null;
  duplicateRows: number | null;
  columnMappings: Record<string, string | null>;
  validationErrors: TestImportValidationError[];
  aiInferences: Record<string, unknown>;
  progress: Record<string, unknown>;
  rolledBackAt: Date | null;
  rolledBackById: string | null;
  completedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestEstimateRecord {
  id: string;
  companyId: string;
  estimateNumber: string;
  jobId: string | null;
  importSessionId?: string | null;
  customerId: string;
  propertyId: string | null;
  createdById: string | null;
  status: EstimateStatus;
  tierLabel: string | null;
  tierGroupId: string | null;
  isSelectedTier: boolean | null;
  isRecommended: boolean;
  optionSetVersion: number;
  subtotal: string;
  taxRate: string | null;
  taxAmount: string | null;
  discountAmount: string | null;
  total: string;
  title: string | null;
  messageToCustomer: string | null;
  internalNotes: string | null;
  approvalToken: string | null;
  approvedAt: Date | null;
  approvedByName: string | null;
  approvedSignatureUrl: string | null;
  declinedAt: Date | null;
  declineReason: string | null;
  expiresAt: Date | null;
  sentAt: Date | null;
  viewedAt: Date | null;
  followUpSentAt: Date | null;
  financingOffered: boolean | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestEstimateItemRecord {
  id: string;
  estimateId: string;
  companyId: string;
  productCatalogId: string | null;
  name: string;
  description: string | null;
  itemType: EstimateItemType;
  quantity: string;
  unitPrice: string;
  total: string;
  isTaxable: boolean | null;
  sortOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestInvoiceRecord {
  id: string;
  companyId: string;
  invoiceNumber: string;
  jobId: string | null;
  estimateId: string | null;
  customerId: string;
  createdById: string | null;
  status: InvoiceStatus;
  subtotal: string;
  taxRate: string | null;
  taxAmount: string | null;
  discountAmount: string | null;
  total: string;
  amountPaid: string | null;
  balanceDue: string;
  serviceFeeAmount: string;
  bookingFeeAmount: string;
  issuedAt: Date | null;
  dueAt: Date | null;
  sentAt: Date | null;
  viewedAt: Date | null;
  paidAt: Date | null;
  stripePaymentLinkId: string | null;
  stripePaymentLinkUrl: string | null;
  paymentToken: string | null;
  reminder1SentAt: Date | null;
  reminder2SentAt: Date | null;
  reminder3SentAt: Date | null;
  title: string | null;
  messageToCustomer: string | null;
  internalNotes: string | null;
  sourceSystem: string | null;
  sourceId: string | null;
  importSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestInvoiceItemRecord {
  id: string;
  invoiceId: string;
  companyId: string;
  productCatalogId: string | null;
  name: string;
  description: string | null;
  itemType: InvoiceItemType;
  quantity: string;
  unitPrice: string;
  total: string;
  isTaxable: boolean | null;
  sortOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestPaymentRecord {
  id: string;
  companyId: string;
  invoiceId: string;
  customerId: string;
  collectedById: string | null;
  amount: string;
  method: PaymentMethod;
  status: PaymentStatus;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  checkNumber: string | null;
  referenceNumber: string | null;
  notes: string | null;
  paidAt: Date | null;
  sourceSystem: string | null;
  sourceId: string | null;
  importSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestJobNoteRecord {
  id: string;
  companyId: string;
  jobId: string;
  authorId: string | null;
  content: string;
  isInternal: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestJobPhotoRecord {
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

export interface TestServiceAgreementTemplateRecord {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  includedServices: string[] | null;
  visitsPerYear: number;
  frequency: MaintenancePlanFrequency;
  monthlyPrice: string | null;
  annualPrice: string | null;
  stripeMthlyPriceId: string | null;
  stripeAnnualPriceId: string | null;
  sortOrder: number | null;
  isActive: boolean;
  applicableAssetTypes: string[] | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestVipMembershipTierRecord {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  monthlyPrice: string;
  discountPercent: string;
  includedVisitsPerMonth: number | null;
  stripeMonthlyPriceId: string | null;
  sortOrder: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestMaintenancePlanRecord {
  id: string;
  companyId: string;
  customerId: string;
  propertyId: string | null;
  serviceAgreementTemplateId: string | null;
  vipTierId: string | null;
  name: string;
  description: string | null;
  includedServices: string[] | null;
  assetIds: string[] | null;
  status: MaintenancePlanStatus;
  frequency: MaintenancePlanFrequency;
  price: string | null;
  billingCycle: ServiceAgreementBillingCycle | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  stripeCurrentPeriodStart: Date | null;
  stripeCurrentPeriodEnd: Date | null;
  stripeCancelAtPeriodEnd: boolean | null;
  startDate: string;
  endDate: string | null;
  nextServiceDate: string | null;
  lastServiceDate: string | null;
  notes: string | null;
  sourceSystem: string | null;
  sourceId: string | null;
  importSessionId: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestMaintenanceVisitRecord {
  id: string;
  companyId: string;
  maintenancePlanId: string;
  jobId: string | null;
  scheduledDate: string | null;
  completedDate: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestAutomationRuleRecord {
  id: string;
  companyId: string;
  ruleType: AutomationRuleType;
  isEnabled: boolean;
  delayHours: number | null;
  thresholdDays: number | null;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestAiRecommendationRecord {
  id: string;
  companyId: string;
  type: AiRecommendationType;
  status: AiRecommendationStatus;
  customerId: string | null;
  propertyId: string | null;
  assetId: string | null;
  jobId: string | null;
  estimateId: string | null;
  invoiceId: string | null;
  estimatedRevenue: string | null;
  headline: string;
  body: string;
  suggestedAction: string | null;
  suggestedMessage: string | null;
  urgencyScore: number | null;
  confidenceScore: number | null;
  actionedAt: Date | null;
  actionedById: string | null;
  dismissedAt: Date | null;
  snoozedUntil: Date | null;
  expiresAt: Date | null;
  sourceEventIds: string[] | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestCampaignRecord {
  id: string;
  companyId: string;
  createdById: string | null;
  type: CampaignType;
  status: CampaignStatus;
  name: string;
  subject: string | null;
  body: string;
  channel: MessageChannel;
  isAiGenerated: boolean | null;
  aiRecommendationId: string | null;
  scheduledAt: Date | null;
  sentAt: Date | null;
  recipientCount: number | null;
  deliveredCount: number | null;
  openedCount: number | null;
  repliedCount: number | null;
  convertedCount: number | null;
  revenueAttributed: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestCampaignRecipientRecord {
  id: string;
  campaignId: string;
  customerId: string;
  companyId: string;
  sentAt: Date | null;
  deliveredAt: Date | null;
  openedAt: Date | null;
  repliedAt: Date | null;
  convertedAt: Date | null;
  conversionJobId: string | null;
  sentToPhone: string | null;
  sentToEmail: string | null;
  unsubscribedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestMessageLogRecord {
  id: string;
  companyId: string;
  customerId: string | null;
  jobId: string | null;
  campaignId: string | null;
  channel: MessageChannel;
  direction: MessageDirection;
  toAddress: string;
  fromAddress: string | null;
  subject: string | null;
  body: string;
  providerMessageId: string | null;
  providerStatus: string | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestProductCatalogRecord {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  category: ProductCategory;
  sku: string | null;
  unitPrice: string;
  cost: string | null;
  unit: string | null;
  isTaxable: boolean | null;
  isActive: boolean;
  applicableAssetTypes: string[] | null;
  sortOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestTechnicianRecord {
  id: string;
  companyId: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  avatarUrl: string | null;
  skills: string[] | null;
  serviceAreaIds: string[] | null;
  serviceZipCodes: string[] | null;
  availableDays: string[] | null;
  hoursPerDay: string | null;
  totalJobsCompleted: number | null;
  avgJobDurationMinutes: number | null;
  estimateCloseRate: string | null;
  avgTicketValue: string | null;
  status: TechnicianStatus;
  calendarColor: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestJobTaskRecord {
  id: string;
  companyId: string;
  jobId: string;
  assignedToId: string | null;
  title: string;
  description: string | null;
  status: JobTaskStatus;
  isRequired: boolean | null;
  completedAt: Date | null;
  completedById: string | null;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  sortOrder: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestJobProductRecord {
  id: string;
  companyId: string;
  jobId: string;
  productCatalogId: string | null;
  name: string;
  description: string | null;
  category: ProductCategory;
  quantity: string;
  unitPrice: string;
  total: string;
  isTaxable: boolean | null;
  addedById: string | null;
  isUpsell: boolean | null;
  upsellApproved: boolean | null;
  upsellApprovedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestScheduleSlotRecord {
  id: string;
  companyId: string;
  technicianId: string;
  jobId: string | null;
  isBlockedTime: boolean | null;
  blockReason: string | null;
  startTime: Date;
  endTime: Date;
  travelMinutesBefore: number | null;
  isConfirmed: boolean | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestActivityEventRecord {
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

export interface TestTimeEntryRecord {
  id: string;
  companyId: string;
  jobId: string;
  technicianId: string;
  startedAt: Date;
  endedAt: Date | null;
  durationMinutes: number | null;
  entryType: TimeEntryType | null;
  notes: string | null;
  travelFromAddress: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestReviewRequestRecord {
  id: string;
  companyId: string;
  jobId: string | null;
  customerId: string;
  technicianId: string | null;
  referenceId: string;
  status: ReviewRequestStatus;
  channel: MessageChannel;
  reviewUrl: string | null;
  sentAt: Date | null;
  clickedAt: Date | null;
  completedAt: Date | null;
  rating: number | null;
  reviewText: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestFileAttachmentRecord {
  id: string;
  companyId: string;
  entityType: AttachmentEntityType;
  entityId: string;
  jobId: string | null;
  customerId: string | null;
  uploadedById: string | null;
  fileName: string;
  fileUrl: string;
  thumbnailUrl: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  fileType: AttachmentFileType | null;
  caption: string | null;
  photoType: JobPhotoType | null;
  takenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestOnTheWayNotificationRecord {
  id: string;
  companyId: string;
  jobId: string;
  technicianId: string;
  customerId: string;
  sentAt: Date | null;
  channel: MessageChannel;
  message: string | null;
  estimatedArrivalMinutes: number | null;
  technicianLat: string | null;
  technicianLng: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestBookingRequestRecord {
  id: string;
  companyId: string;
  customerId: string | null;
  jobId: string | null;
  assignedTechnicianId: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  zip: string;
  propertyType: string | null;
  serviceCategory: string | null;
  serviceType: string | null;
  serviceDetail: string | null;
  urgency: BookingUrgency | null;
  customerNotes: string | null;
  preferredDate: string | null;
  preferredWindow: PreferredBookingWindow | null;
  status: BookingRequestStatus;
  source: BookingSource;
  referenceNumber: string | null;
  isPropertyOwner: boolean | null;
  smsConsentAppointments: boolean | null;
  smsConsentMarketing: boolean | null;
  leadAttribution: Partial<Record<string, string>> | null;
  confirmedAt: Date | null;
  confirmedById: string | null;
  confirmationSentAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

type FieldSyncBatchStatus = "open" | "completed";
type FieldSyncOperationOutcome = "applied" | "duplicate" | "conflict" | "rejected";

export interface TestFieldSyncBatchRecord {
  id: string;
  companyId: string;
  userId: string;
  deviceId: string;
  batchClientId: string;
  status: FieldSyncBatchStatus;
  lastAcknowledgedSequence: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestFieldSyncOperationRecord {
  id: string;
  companyId: string;
  batchId: string;
  sequence: number;
  clientOperationId: string;
  jobId: string;
  operationType: string;
  requestPayload: Record<string, unknown>;
  outcome: FieldSyncOperationOutcome;
  resultPayload: Record<string, unknown>;
  payloadHash: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestAgentActionRecord {
  id: string;
  companyId: string;
  agentProduct: AgentProduct;
  actionType: string;
  parameters: Record<string, unknown>;
  target: Record<string, unknown>;
  sourceEventIds: string[];
  idempotencyKey: string;
  payloadHash: string;
  policyVersion: string;
  requiresApproval: boolean;
  state: AgentActionState;
  confidence: string | null;
  reason: string | null;
  expiresAt: Date;
  reviewerId: string | null;
  executionReceipt: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestServiceAreaRecord {
  id: string;
  companyId: string;
  name: string;
  zips: string[] | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestInquirySubmitIdempotencyRecord {
  id: string;
  companyId: string;
  idempotencyKey: string;
  payloadHash: string;
  bookingRequestId: string;
  responseSnapshot: Record<string, unknown>;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}


export interface TestBookingSettingsRecord {
  id: string;
  companyId: string;
  isEnabled: boolean;
  bookingSlug: string | null;
  offeredServices: Array<Record<string, unknown>>;
  availableHoursStart: number | null;
  availableHoursEnd: number | null;
  availableDays: string[] | null;
  slotDuration: number | null;
  maxAdvanceDays: number | null;
  autoConfirm: boolean | null;
  googleReviewUrl: string | null;
  yelpReviewUrl: string | null;
  facebookReviewUrl: string | null;
  customReviewUrl: string | null;
  tagline: string | null;
  allowZipOverflow: boolean | null;
  balanceWorkload: boolean | null;
  notifyOnNewBooking: boolean | null;
  notificationEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

type AnyTestRecord =
  | TestTimesheetRecord
  | TestTimesheetAuditEventRecord
  | TestTechnicianPayRateRecord
  | TestStockLocationRecord
  | TestStockLevelRecord
  | TestStockMovementRecord
  | TestCallTrackingSettingsRecord
  | TestCallTrackingNumberRecord
  | TestCallRecordRecord
  | TestGrowthCheckScanRecord
  | TestGrowthCheckFindingRecord
  | TestGrowthCheckFindingRevisionRecord
  | TestGrowthCheckReportDraftRecord
  | TestGrowthCheckReportDraftRevisionRecord
  | TestGrowthCheckReportShareRecord
  | TestCompanyRecord
  | TestUserRecord
  | TestRefreshTokenRecord
  | TestCustomerRecord
  | TestPropertyRecord
  | TestAssetRecord
  | TestJobRecord
  | TestImportSessionRecord
  | TestImportChunkRunRecord
  | TestDataExportSessionRecord
  | TestEstimateRecord
  | TestEstimateItemRecord
  | TestInvoiceRecord
  | TestInvoiceItemRecord
  | TestPaymentRecord
  | TestJobNoteRecord
  | TestCustomerNoteRecord
  | TestJobPhotoRecord
  | TestServiceAgreementTemplateRecord
  | TestMaintenancePlanRecord
  | TestVipMembershipTierRecord
  | TestMaintenanceVisitRecord
  | TestRecurringVisitSeriesRecord
  | TestRecurringVisitOccurrenceRecord
  | TestAutomationRuleRecord
  | TestAiRecommendationRecord
  | TestCampaignRecord
  | TestCampaignRecipientRecord
  | TestMessageLogRecord
  | TestProductCatalogRecord
  | TestTechnicianRecord
  | TestJobTaskRecord
  | TestJobProductRecord
  | TestScheduleSlotRecord
  | TestActivityEventRecord
  | TestTimeEntryRecord
  | TestReviewRequestRecord
  | TestFileAttachmentRecord
  | TestOnTheWayNotificationRecord
  | TestBookingRequestRecord
  | TestBookingSettingsRecord
  | TestAgentActionRecord
  | TestFieldSyncBatchRecord
  | TestFieldSyncOperationRecord
  | TestInquirySubmitIdempotencyRecord
  | TestServiceAreaRecord
  | TestGrowthIntakeCheckRecord
  | TestGrowthIntakeIdentityCandidateRecord
  | TestGrowthIntakeFindingRecord
  | TestGrowthIntakeAuditEventRecord;

type MockTable =
  | typeof companiesTable
  | typeof usersTable
  | typeof refreshTokensTable
  | typeof customersTable
  | typeof propertiesTable
  | typeof assetsTable
  | typeof jobsTable
  | typeof importSessionsTable
  | typeof importBundlesTable
  | typeof dataExportSessionsTable
  | typeof estimatesTable
  | typeof estimateItemsTable
  | typeof invoicesTable
  | typeof invoiceItemsTable
  | typeof paymentsTable
  | typeof jobNotesTable
  | typeof customerNotesTable
  | typeof jobPhotosTable
  | typeof serviceAgreementTemplatesTable
  | typeof maintenancePlansTable
  | typeof vipMembershipTiersTable
  | typeof maintenanceVisitsTable
  | typeof automationRulesTable
  | typeof aiRecommendationsTable
  | typeof campaignsTable
  | typeof campaignRecipientsTable
  | typeof messageLogsTable
  | typeof productCatalogTable
  | typeof stockLocationsTable
  | typeof stockLevelsTable
  | typeof stockMovementsTable
  | typeof callTrackingSettingsTable
  | typeof callTrackingNumbersTable
  | typeof callRecordsTable
  | typeof growthCheckScansTable
  | typeof growthCheckFindingsTable
  | typeof growthCheckFindingRevisionsTable
  | typeof growthCheckReportDraftsTable
  | typeof growthCheckReportDraftRevisionsTable
  | typeof growthCheckReportSharesTable
  | typeof techniciansTable
  | typeof jobTasksTable
  | typeof jobProductsTable
  | typeof scheduleSlotsTable
  | typeof activityEventsTable
  | typeof timeEntriesTable
  | typeof timesheetsTable
  | typeof timesheetAuditEventsTable
  | typeof technicianPayRatesTable
  | typeof reviewRequestsTable
  | typeof fileAttachmentsTable
  | typeof onTheWayNotificationsTable
  | typeof bookingRequestsTable
  | typeof bookingSettingsTable
  | typeof agentActionsTable
  | typeof inquirySubmitIdempotencyTable
  | typeof serviceAreasTable
  | typeof growthIntakeChecksTable
  | typeof growthIntakeIdentityCandidatesTable
  | typeof growthIntakeFindingsTable
  | typeof growthIntakeAuditEventsTable
  | typeof fieldSyncBatchesTable
  | typeof fieldSyncOperationsTable;

interface TestState {
  companies: TestCompanyRecord[];
  users: TestUserRecord[];
  refreshTokens: TestRefreshTokenRecord[];
  customers: TestCustomerRecord[];
  properties: TestPropertyRecord[];
  assets: TestAssetRecord[];
  jobs: TestJobRecord[];
  importSessions: TestImportSessionRecord[];
  importBundles: Array<Record<string, unknown> & { id: string; companyId: string }>;
  savedCardMigrations: Array<Record<string, unknown> & { id: string; companyId: string }>;
  importChunkRuns: TestImportChunkRunRecord[];
  dataExportSessions: TestDataExportSessionRecord[];
  estimates: TestEstimateRecord[];
  estimateItems: TestEstimateItemRecord[];
  invoices: TestInvoiceRecord[];
  invoiceItems: TestInvoiceItemRecord[];
  payments: TestPaymentRecord[];
  jobNotes: TestJobNoteRecord[];
  customerNotes: TestCustomerNoteRecord[];
  jobPhotos: TestJobPhotoRecord[];
  serviceAgreementTemplates: TestServiceAgreementTemplateRecord[];
  maintenancePlans: TestMaintenancePlanRecord[];
  vipMembershipTiers: TestVipMembershipTierRecord[];
  maintenanceVisits: TestMaintenanceVisitRecord[];
  recurringVisitSeries: TestRecurringVisitSeriesRecord[];
  recurringVisitOccurrences: TestRecurringVisitOccurrenceRecord[];
  automationRules: TestAutomationRuleRecord[];
  aiRecommendations: TestAiRecommendationRecord[];
  campaigns: TestCampaignRecord[];
  campaignRecipients: TestCampaignRecipientRecord[];
  messageLogs: TestMessageLogRecord[];
  productCatalog: TestProductCatalogRecord[];
  stockLocations: TestStockLocationRecord[];
  stockLevels: TestStockLevelRecord[];
  stockMovements: TestStockMovementRecord[];
  callTrackingSettings: TestCallTrackingSettingsRecord[];
  callTrackingNumbers: TestCallTrackingNumberRecord[];
  callRecords: TestCallRecordRecord[];
  growthCheckScans: TestGrowthCheckScanRecord[];
  growthCheckFindings: TestGrowthCheckFindingRecord[];
  growthCheckFindingRevisions: TestGrowthCheckFindingRevisionRecord[];
  growthCheckReportDrafts: TestGrowthCheckReportDraftRecord[];
  growthCheckReportDraftRevisions: TestGrowthCheckReportDraftRevisionRecord[];
  growthCheckReportShares: TestGrowthCheckReportShareRecord[];
  technicians: TestTechnicianRecord[];
  jobTasks: TestJobTaskRecord[];
  jobProducts: TestJobProductRecord[];
  scheduleSlots: TestScheduleSlotRecord[];
  activityEvents: TestActivityEventRecord[];
  timeEntries: TestTimeEntryRecord[];
  timesheets: TestTimesheetRecord[];
  timesheetAuditEvents: TestTimesheetAuditEventRecord[];
  technicianPayRates: TestTechnicianPayRateRecord[];
  reviewRequests: TestReviewRequestRecord[];
  fileAttachments: TestFileAttachmentRecord[];
  onTheWayNotifications: TestOnTheWayNotificationRecord[];
  bookingRequests: TestBookingRequestRecord[];
  bookingSettings: TestBookingSettingsRecord[];
  agentActions: TestAgentActionRecord[];
  inquirySubmitIdempotency: TestInquirySubmitIdempotencyRecord[];
  serviceAreas: TestServiceAreaRecord[];
  growthIntakeChecks: TestGrowthIntakeCheckRecord[];
  growthIntakeIdentityCandidates: TestGrowthIntakeIdentityCandidateRecord[];
  growthIntakeFindings: TestGrowthIntakeFindingRecord[];
  growthIntakeAuditEvents: TestGrowthIntakeAuditEventRecord[];
  fieldSyncBatches: TestFieldSyncBatchRecord[];
  fieldSyncOperations: TestFieldSyncOperationRecord[];
}

interface OrderByDefinition {
  direction: "asc" | "desc";
  field: string;
  expr?: TimelineAtMarker;
}

const companiesTable = {
  __name: "companies",
  id: "id",
  name: "name",
  slug: "slug",
  phone: "phone",
  email: "email",
  website: "website",
  logoUrl: "logoUrl",
  addressLine1: "addressLine1",
  addressLine2: "addressLine2",
  city: "city",
  state: "state",
  zip: "zip",
  country: "country",
  timezone: "timezone",
  stripeCustomerId: "stripeCustomerId",
  stripeAccountId: "stripeAccountId",
  settings: "settings",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const usersTable = {
  __name: "users",
  id: "id",
  clerkUserId: "clerkUserId",
  clerkUnlinkedAt: "clerkUnlinkedAt",
  companyId: "companyId",
  email: "email",
  passwordHash: "passwordHash",
  passwordChangedAt: "passwordChangedAt",
  firstName: "firstName",
  lastName: "lastName",
  phone: "phone",
  role: "role",
  avatarUrl: "avatarUrl",
  isActive: "isActive",
  lastLoginAt: "lastLoginAt",
  emailVerifiedAt: "emailVerifiedAt",
  emailVerificationTokenHash: "emailVerificationTokenHash",
  emailVerificationExpiresAt: "emailVerificationExpiresAt",
  technicianId: "technicianId",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const refreshTokensTable = {
  __name: "refreshTokens",
  id: "id",
  companyId: "companyId",
  userId: "userId",
  tokenHash: "tokenHash",
  expiresAt: "expiresAt",
  revokedAt: "revokedAt",
  createdAt: "createdAt"
} as const;

const customersTable = {
  __name: "customers",
  id: "id",
  companyId: "companyId",
  firstName: "firstName",
  lastName: "lastName",
  displayName: "displayName",
  email: "email",
  phone: "phone",
  altPhone: "altPhone",
  leadSource: "leadSource",
  referredBy: "referredBy",
  tags: "tags",
  internalNotes: "internalNotes",
  lifetimeValue: "lifetimeValue",
  totalJobs: "totalJobs",
  lastServiceDate: "lastServiceDate",
  firstServiceDate: "firstServiceDate",
  prefersSms: "prefersSms",
  prefersEmail: "prefersEmail",
  doNotContact: "doNotContact",
  stripeCustomerId: "stripeCustomerId",
  sourceSystem: "sourceSystem",
  sourceId: "sourceId",
  importSessionId: "importSessionId",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const propertiesTable = {
  __name: "properties",
  id: "id",
  companyId: "companyId",
  customerId: "customerId",
  addressLine1: "addressLine1",
  addressLine2: "addressLine2",
  city: "city",
  state: "state",
  zip: "zip",
  country: "country",
  lat: "lat",
  lng: "lng",
  type: "type",
  sqft: "sqft",
  yearBuilt: "yearBuilt",
  accessNotes: "accessNotes",
  notes: "notes",
  isPrimary: "isPrimary",
  isActive: "isActive",
  sourceSystem: "sourceSystem",
  sourceId: "sourceId",
  importSessionId: "importSessionId",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const assetsTable = {
  __name: "assets",
  id: "id",
  companyId: "companyId",
  propertyId: "propertyId",
  customerId: "customerId",
  name: "name",
  assetType: "assetType",
  brand: "brand",
  model: "model",
  serialNumber: "serialNumber",
  installDate: "installDate",
  warrantyExpiration: "warrantyExpiration",
  lastServiceDate: "lastServiceDate",
  nextServiceDate: "nextServiceDate",
  condition: "condition",
  conditionNotes: "conditionNotes",
  conditionScore: "conditionScore",
  replacementProbability: "replacementProbability",
  photoUrls: "photoUrls",
  notes: "notes",
  isActive: "isActive",
  importSessionId: "importSessionId",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const jobsTable = {
  __name: "jobs",
  id: "id",
  companyId: "companyId",
  customerId: "customerId",
  jobNumber: "jobNumber",
  propertyId: "propertyId",
  assetId: "assetId",
  technicianId: "technicianId",
  assignedById: "assignedById",
  type: "type",
  priority: "priority",
  status: "status",
  leadSource: "leadSource",
  leadAttribution: "leadAttribution",
  title: "title",
  description: "description",
  scheduledStart: "scheduledStart",
  scheduledEnd: "scheduledEnd",
  scheduledDurationMinutes: "scheduledDurationMinutes",
  actualStart: "actualStart",
  actualEnd: "actualEnd",
  techNotes: "techNotes",
  completionNotes: "completionNotes",
  signatureUrl: "signatureUrl",
  signedAt: "signedAt",
  signedByName: "signedByName",
  estimateTotal: "estimateTotal",
  invoiceTotal: "invoiceTotal",
  amountPaid: "amountPaid",
  maintenancePlanId: "maintenancePlanId",
  parentJobId: "parentJobId",
  tags: "tags",
  importSessionId: "importSessionId",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const importChunkRunsTable = {
  __name: "importChunkRuns",
  id: "id",
  companyId: "companyId",
  importSessionId: "importSessionId",
  entityType: "entityType",
  chunkIndex: "chunkIndex",
  chunksTotal: "chunksTotal",
  idempotencyKey: "idempotencyKey",
  status: "status",
  cursor: "cursor",
  rowsOk: "rowsOk",
  rowsFailed: "rowsFailed",
  errorMessage: "errorMessage",
  completedAt: "completedAt",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const savedCardMigrationsTable = {
  __name: "savedCardMigrations",
  id: "id",
  companyId: "companyId",
  importBundleId: "importBundleId",
  createdById: "createdById",
  status: "status",
  priorProcessorName: "priorProcessorName",
  stripeImportReference: "stripeImportReference",
  mappingSummary: "mappingSummary",
  customerMappings: "customerMappings",
  lastError: "lastError",
  fallbackEmailSentAt: "fallbackEmailSentAt",
  fallbackEmailCustomerIds: "fallbackEmailCustomerIds",
  offSessionConsentAcknowledgedAt: "offSessionConsentAcknowledgedAt",
  offSessionConsentAcknowledgedById: "offSessionConsentAcknowledgedById",
  offSessionConsentTextVersion: "offSessionConsentTextVersion",
  offSessionConsentBatchId: "offSessionConsentBatchId",
  completedAt: "completedAt",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const importBundlesTable = {
  __name: "importBundles",
  id: "id",
  companyId: "companyId",
  createdById: "createdById",
  sourceSystem: "sourceSystem",
  label: "label",
  status: "status",
  wizardStep: "wizardStep",
  stepState: "stepState",
  dedupeDecisions: "dedupeDecisions",
  completedAt: "completedAt",
  abandonedAt: "abandonedAt",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const importSessionsTable = {
  __name: "importSessions",
  id: "id",
  companyId: "companyId",
  createdById: "createdById",
  importBundleId: "importBundleId",
  sourceSystem: "sourceSystem",
  entityType: "entityType",
  status: "status",
  fileName: "fileName",
  fileUrl: "fileUrl",
  totalRows: "totalRows",
  validRows: "validRows",
  errorRows: "errorRows",
  importedRows: "importedRows",
  skippedRows: "skippedRows",
  duplicateRows: "duplicateRows",
  columnMappings: "columnMappings",
  validationErrors: "validationErrors",
  aiInferences: "aiInferences",
  progress: "progress",
  rolledBackAt: "rolledBackAt",
  rolledBackById: "rolledBackById",
  completedAt: "completedAt",
  errorMessage: "errorMessage",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const dataExportSessionsTable = {
  __name: "dataExportSessions",
  id: "id",
  companyId: "companyId",
  requestedById: "requestedById",
  status: "status",
  format: "format",
  manifestVersion: "manifestVersion",
  progressPercent: "progressPercent",
  fileName: "fileName",
  fileUrl: "fileUrl",
  recordCounts: "recordCounts",
  expiresAt: "expiresAt",
  completedAt: "completedAt",
  errorMessage: "errorMessage",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const estimatesTable = {
  importSessionId: "importSessionId",
  __name: "estimates",
  id: "id",
  companyId: "companyId",
  estimateNumber: "estimateNumber",
  jobId: "jobId",
  customerId: "customerId",
  propertyId: "propertyId",
  createdById: "createdById",
  status: "status",
  tierLabel: "tierLabel",
  tierGroupId: "tierGroupId",
  isSelectedTier: "isSelectedTier",
  isRecommended: "isRecommended",
  optionSetVersion: "optionSetVersion",
  subtotal: "subtotal",
  taxRate: "taxRate",
  taxAmount: "taxAmount",
  discountAmount: "discountAmount",
  total: "total",
  title: "title",
  messageToCustomer: "messageToCustomer",
  internalNotes: "internalNotes",
  approvalToken: "approvalToken",
  approvedAt: "approvedAt",
  approvedByName: "approvedByName",
  approvedSignatureUrl: "approvedSignatureUrl",
  declinedAt: "declinedAt",
  declineReason: "declineReason",
  expiresAt: "expiresAt",
  sentAt: "sentAt",
  viewedAt: "viewedAt",
  followUpSentAt: "followUpSentAt",
  financingOffered: "financingOffered",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const estimateItemsTable = {
  __name: "estimateItems",
  id: "id",
  estimateId: "estimateId",
  companyId: "companyId",
  productCatalogId: "productCatalogId",
  name: "name",
  description: "description",
  itemType: "itemType",
  quantity: "quantity",
  unitPrice: "unitPrice",
  total: "total",
  isTaxable: "isTaxable",
  sortOrder: "sortOrder",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const invoicesTable = {
  __name: "invoices",
  id: "id",
  companyId: "companyId",
  invoiceNumber: "invoiceNumber",
  jobId: "jobId",
  estimateId: "estimateId",
  customerId: "customerId",
  createdById: "createdById",
  status: "status",
  subtotal: "subtotal",
  taxRate: "taxRate",
  taxAmount: "taxAmount",
  discountAmount: "discountAmount",
  total: "total",
  amountPaid: "amountPaid",
  balanceDue: "balanceDue",
  serviceFeeAmount: "serviceFeeAmount",
  bookingFeeAmount: "bookingFeeAmount",
  issuedAt: "issuedAt",
  dueAt: "dueAt",
  sentAt: "sentAt",
  viewedAt: "viewedAt",
  paidAt: "paidAt",
  stripePaymentLinkId: "stripePaymentLinkId",
  stripePaymentLinkUrl: "stripePaymentLinkUrl",
  paymentToken: "paymentToken",
  reminder1SentAt: "reminder1SentAt",
  reminder2SentAt: "reminder2SentAt",
  reminder3SentAt: "reminder3SentAt",
  title: "title",
  messageToCustomer: "messageToCustomer",
  internalNotes: "internalNotes",
  sourceSystem: "sourceSystem",
  sourceId: "sourceId",
  importSessionId: "importSessionId",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const invoiceItemsTable = {
  __name: "invoiceItems",
  id: "id",
  invoiceId: "invoiceId",
  companyId: "companyId",
  productCatalogId: "productCatalogId",
  name: "name",
  description: "description",
  itemType: "itemType",
  quantity: "quantity",
  unitPrice: "unitPrice",
  total: "total",
  isTaxable: "isTaxable",
  sortOrder: "sortOrder",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const paymentsTable = {
  __name: "payments",
  id: "id",
  companyId: "companyId",
  invoiceId: "invoiceId",
  customerId: "customerId",
  collectedById: "collectedById",
  amount: "amount",
  serviceFeeAmount: "serviceFeeAmount",
  bookingFeeAmount: "bookingFeeAmount",
  feeRefundable: "feeRefundable",
  amountRefunded: "amountRefunded",
  method: "method",
  status: "status",
  stripePaymentIntentId: "stripePaymentIntentId",
  stripeChargeId: "stripeChargeId",
  checkNumber: "checkNumber",
  referenceNumber: "referenceNumber",
  notes: "notes",
  paidAt: "paidAt",
  sourceSystem: "sourceSystem",
  sourceId: "sourceId",
  importSessionId: "importSessionId",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const jobNotesTable = {
  __name: "jobNotes",
  id: "id",
  companyId: "companyId",
  jobId: "jobId",
  authorId: "authorId",
  content: "content",
  isInternal: "isInternal",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const customerNotesTable = {
  __name: "customerNotes",
  id: "id",
  companyId: "companyId",
  customerId: "customerId",
  authorId: "authorId",
  content: "content",
  isInternal: "isInternal",
  notedAt: "notedAt",
  sourceSystem: "sourceSystem",
  sourceId: "sourceId",
  importSessionId: "importSessionId",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const jobPhotosTable = {
  __name: "jobPhotos",
  id: "id",
  companyId: "companyId",
  jobId: "jobId",
  uploadedById: "uploadedById",
  url: "url",
  thumbnailUrl: "thumbnailUrl",
  caption: "caption",
  takenAt: "takenAt",
  photoType: "photoType",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const serviceAgreementTemplatesTable = {
  __name: "serviceAgreementTemplates",
  id: "id",
  companyId: "companyId",
  name: "name",
  description: "description",
  includedServices: "includedServices",
  visitsPerYear: "visitsPerYear",
  frequency: "frequency",
  monthlyPrice: "monthlyPrice",
  annualPrice: "annualPrice",
  stripeMthlyPriceId: "stripeMthlyPriceId",
  stripeAnnualPriceId: "stripeAnnualPriceId",
  sortOrder: "sortOrder",
  isActive: "isActive",
  applicableAssetTypes: "applicableAssetTypes",
  notes: "notes",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const maintenancePlansTable = {
  __name: "maintenancePlans",
  id: "id",
  companyId: "companyId",
  customerId: "customerId",
  propertyId: "propertyId",
  serviceAgreementTemplateId: "serviceAgreementTemplateId",
  vipTierId: "vipTierId",
  name: "name",
  description: "description",
  includedServices: "includedServices",
  assetIds: "assetIds",
  status: "status",
  frequency: "frequency",
  price: "price",
  billingCycle: "billingCycle",
  stripeSubscriptionId: "stripeSubscriptionId",
  stripePriceId: "stripePriceId",
  stripeCurrentPeriodStart: "stripeCurrentPeriodStart",
  stripeCurrentPeriodEnd: "stripeCurrentPeriodEnd",
  stripeCancelAtPeriodEnd: "stripeCancelAtPeriodEnd",
  startDate: "startDate",
  endDate: "endDate",
  nextServiceDate: "nextServiceDate",
  lastServiceDate: "lastServiceDate",
  notes: "notes",
  sourceSystem: "sourceSystem",
  sourceId: "sourceId",
  importSessionId: "importSessionId",
  deletedAt: "deletedAt",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
} as const;

const vipMembershipTiersTable = {
  __name: "vipMembershipTiers",
  id: "id",
  companyId: "companyId",
  name: "name",
  description: "description",
  monthlyPrice: "monthlyPrice",
  discountPercent: "discountPercent",
  includedVisitsPerMonth: "includedVisitsPerMonth",
  stripeMonthlyPriceId: "stripeMonthlyPriceId",
  sortOrder: "sortOrder",
  isActive: "isActive",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const maintenanceVisitsTable = {
  __name: "maintenanceVisits",
  id: "id",
  companyId: "companyId",
  maintenancePlanId: "maintenancePlanId",
  jobId: "jobId",
  scheduledDate: "scheduledDate",
  completedDate: "completedDate",
  notes: "notes",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;


const recurringVisitSeriesTable = {
  __name: "recurringVisitSeries",
  id: "id",
  companyId: "companyId",
  customerId: "customerId",
  propertyId: "propertyId",
  maintenancePlanId: "maintenancePlanId",
  anchorMaintenanceVisitId: "anchorMaintenanceVisitId",
  timeZone: "timeZone",
  frequency: "frequency",
  anchorLocalDate: "anchorLocalDate",
  localTime: "localTime",
  status: "status",
  externalSchedulerAuthoritative: "externalSchedulerAuthoritative",
  notes: "notes",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const recurringVisitOccurrencesTable = {
  __name: "recurringVisitOccurrences",
  id: "id",
  companyId: "companyId",
  seriesId: "seriesId",
  occurrenceIndex: "occurrenceIndex",
  scheduledLocalDate: "scheduledLocalDate",
  scheduledAtUtc: "scheduledAtUtc",
  status: "status",
  overrideScheduledLocalDate: "overrideScheduledLocalDate",
  overrideNotes: "overrideNotes",
  maintenanceVisitId: "maintenanceVisitId",
  jobId: "jobId",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const automationRulesTable = {
  __name: "automationRules",
  id: "id",
  companyId: "companyId",
  ruleType: "ruleType",
  isEnabled: "isEnabled",
  delayHours: "delayHours",
  thresholdDays: "thresholdDays",
  config: "config",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const aiRecommendationsTable = {
  __name: "aiRecommendations",
  id: "id",
  companyId: "companyId",
  type: "type",
  status: "status",
  customerId: "customerId",
  propertyId: "propertyId",
  assetId: "assetId",
  jobId: "jobId",
  estimateId: "estimateId",
  invoiceId: "invoiceId",
  estimatedRevenue: "estimatedRevenue",
  headline: "headline",
  body: "body",
  suggestedAction: "suggestedAction",
  suggestedMessage: "suggestedMessage",
  urgencyScore: "urgencyScore",
  confidenceScore: "confidenceScore",
  actionedAt: "actionedAt",
  actionedById: "actionedById",
  dismissedAt: "dismissedAt",
  snoozedUntil: "snoozedUntil",
  expiresAt: "expiresAt",
  sourceEventIds: "sourceEventIds",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const campaignsTable = {
  __name: "campaigns",
  id: "id",
  companyId: "companyId",
  createdById: "createdById",
  type: "type",
  status: "status",
  name: "name",
  subject: "subject",
  body: "body",
  channel: "channel",
  isAiGenerated: "isAiGenerated",
  aiRecommendationId: "aiRecommendationId",
  scheduledAt: "scheduledAt",
  sentAt: "sentAt",
  recipientCount: "recipientCount",
  deliveredCount: "deliveredCount",
  openedCount: "openedCount",
  repliedCount: "repliedCount",
  convertedCount: "convertedCount",
  revenueAttributed: "revenueAttributed",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const campaignRecipientsTable = {
  __name: "campaignRecipients",
  id: "id",
  campaignId: "campaignId",
  customerId: "customerId",
  companyId: "companyId",
  sentAt: "sentAt",
  deliveredAt: "deliveredAt",
  openedAt: "openedAt",
  repliedAt: "repliedAt",
  convertedAt: "convertedAt",
  conversionJobId: "conversionJobId",
  sentToPhone: "sentToPhone",
  sentToEmail: "sentToEmail",
  unsubscribedAt: "unsubscribedAt",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const messageLogsTable = {
  __name: "messageLogs",
  id: "id",
  companyId: "companyId",
  customerId: "customerId",
  jobId: "jobId",
  campaignId: "campaignId",
  channel: "channel",
  direction: "direction",
  toAddress: "toAddress",
  fromAddress: "fromAddress",
  subject: "subject",
  body: "body",
  providerMessageId: "providerMessageId",
  providerStatus: "providerStatus",
  sentAt: "sentAt",
  deliveredAt: "deliveredAt",
  failedAt: "failedAt",
  failureReason: "failureReason",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

// FS-170 inventory tables.
export interface TestStockLocationRecord {
  id: string;
  companyId: string;
  name: string;
  kind: "warehouse" | "van";
  technicianId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestStockLevelRecord {
  id: string;
  companyId: string;
  locationId: string;
  productId: string;
  quantity: number;
  lowStockThreshold: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestStockMovementRecord {
  id: string;
  companyId: string;
  locationId: string;
  productId: string;
  kind: "adjustment" | "transfer_out" | "transfer_in" | "job_usage";
  quantityDelta: number;
  quantityAfter: number;
  reason: string | null;
  jobId: string | null;
  transferGroupId: string | null;
  allowNegative: boolean;
  actorUserId: string | null;
  createdAt: Date;
}

export interface TestCallTrackingSettingsRecord {
  id: string;
  companyId: string;
  provider: string;
  enabled: boolean;
  recordingEnabled: boolean;
  recordingDisclosureEnabled: boolean;
  consentMode: string;
  recordingNoticeState: string | null;
  version: number;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const callTrackingSettingsTable = {
  __name: "callTrackingSettings",
  id: "id",
  companyId: "companyId",
  provider: "provider",
  enabled: "enabled",
  recordingEnabled: "recordingEnabled",
  recordingDisclosureEnabled: "recordingDisclosureEnabled",
  consentMode: "consentMode",
  recordingNoticeState: "recordingNoticeState",
  version: "version",
  updatedByUserId: "updatedByUserId",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
} as const;

function createCallTrackingSettingsRecord(values: Partial<TestCallTrackingSettingsRecord> & Pick<TestCallTrackingSettingsRecord, "companyId">): TestCallTrackingSettingsRecord {
  if (state.callTrackingSettings.some((row) => row.companyId === values.companyId)) {
    throw Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" });
  }
  const now = new Date();
  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    provider: values.provider ?? "disabled",
    enabled: values.enabled ?? false,
    recordingEnabled: values.recordingEnabled ?? false,
    recordingDisclosureEnabled: values.recordingDisclosureEnabled ?? true,
    consentMode: values.consentMode ?? "all_party",
    recordingNoticeState: values.recordingNoticeState ?? null,
    version: values.version ?? 1,
    updatedByUserId: values.updatedByUserId ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now
  };
}

export function seedCallTrackingSettings(values: Partial<TestCallTrackingSettingsRecord> & Pick<TestCallTrackingSettingsRecord, "companyId">): TestCallTrackingSettingsRecord {
  const record = createCallTrackingSettingsRecord(values);
  state.callTrackingSettings.push(record);
  return record;
}

export interface TestCallTrackingNumberRecord {
  id: string;
  companyId: string;
  provider: string;
  providerNumberId: string | null;
  trackingNumber: string;
  label: string;
  marketingSource: string;
  marketingCampaign: string | null;
  forwardingNumber: string;
  active: boolean;
  version: number;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

const callTrackingNumbersTable = {
  __name: "callTrackingNumbers",
  id: "id",
  companyId: "companyId",
  provider: "provider",
  providerNumberId: "providerNumberId",
  trackingNumber: "trackingNumber",
  label: "label",
  marketingSource: "marketingSource",
  marketingCampaign: "marketingCampaign",
  forwardingNumber: "forwardingNumber",
  active: "active",
  version: "version",
  verifiedAt: "verifiedAt",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt",
} as const;

function createCallTrackingNumberRecord(values: Partial<TestCallTrackingNumberRecord> & Pick<TestCallTrackingNumberRecord, "companyId" | "trackingNumber">): TestCallTrackingNumberRecord {
  if (state.callTrackingNumbers.some((row) => row.deletedAt === null && row.trackingNumber === values.trackingNumber && (values.deletedAt ?? null) === null)) {
    throw Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" });
  }
  const now = new Date();
  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    provider: values.provider ?? "disabled",
    providerNumberId: values.providerNumberId ?? null,
    trackingNumber: values.trackingNumber,
    label: values.label ?? "Main line",
    marketingSource: values.marketingSource ?? "google",
    marketingCampaign: values.marketingCampaign ?? null,
    forwardingNumber: values.forwardingNumber ?? "+15125550100",
    active: values.active ?? true,
    version: values.version ?? 1,
    verifiedAt: values.verifiedAt ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

export function seedCallTrackingNumber(values: Partial<TestCallTrackingNumberRecord> & Pick<TestCallTrackingNumberRecord, "companyId" | "trackingNumber">): TestCallTrackingNumberRecord {
  const record = createCallTrackingNumberRecord(values);
  state.callTrackingNumbers.push(record);
  return record;
}

export interface TestCallRecordRecord {
  id: string;
  companyId: string;
  trackingNumberId: string;
  provider: string;
  providerCallId: string;
  callerHash: string;
  callerLast4: string;
  startedAt: Date;
  durationSeconds: number;
  outcome: string;
  attribution: Record<string, string> | null;
  recordingRef: string | null;
  recordingDisclosurePlayed: boolean;
  callerConsent: string;
  recordingNoticeState: string | null;
  createdAt: Date;
}

const callRecordsTable = {
  __name: "callRecords",
  id: "id",
  companyId: "companyId",
  trackingNumberId: "trackingNumberId",
  provider: "provider",
  providerCallId: "providerCallId",
  callerHash: "callerHash",
  callerLast4: "callerLast4",
  startedAt: "startedAt",
  durationSeconds: "durationSeconds",
  outcome: "outcome",
  attribution: "attribution",
  recordingRef: "recordingRef",
  recordingDisclosurePlayed: "recordingDisclosurePlayed",
  callerConsent: "callerConsent",
  recordingNoticeState: "recordingNoticeState",
  createdAt: "createdAt",
} as const;

function createCallRecordRecord(values: Partial<TestCallRecordRecord> & Pick<TestCallRecordRecord, "companyId" | "trackingNumberId" | "providerCallId">): TestCallRecordRecord {
  if (state.callRecords.some((row) => row.provider === (values.provider ?? "disabled") && row.providerCallId === values.providerCallId)) {
    throw Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" });
  }
  const now = new Date();
  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    trackingNumberId: values.trackingNumberId,
    provider: values.provider ?? "disabled",
    providerCallId: values.providerCallId,
    callerHash: values.callerHash ?? "0".repeat(64),
    callerLast4: values.callerLast4 ?? "0000",
    startedAt: values.startedAt ?? now,
    durationSeconds: values.durationSeconds ?? 0,
    outcome: values.outcome ?? "answered",
    attribution: values.attribution ?? null,
    recordingRef: values.recordingRef ?? null,
    recordingDisclosurePlayed: values.recordingDisclosurePlayed ?? false,
    callerConsent: values.callerConsent ?? "unknown",
    recordingNoticeState: values.recordingNoticeState ?? null,
    createdAt: values.createdAt ?? now
  };
}

export function seedCallRecord(values: Partial<TestCallRecordRecord> & Pick<TestCallRecordRecord, "companyId" | "trackingNumberId" | "providerCallId">): TestCallRecordRecord {
  const record = createCallRecordRecord(values);
  state.callRecords.push(record);
  return record;
}

export interface TestGrowthCheckScanRecord {
  id: string;
  companyId: string;
  requestedByUserId: string | null;
  targetUrl: string;
  rubricId: string;
  rubricVersion: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: Record<string, unknown>;
  idempotencyKey: string;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestGrowthCheckFindingRecord {
  id: string;
  companyId: string;
  scanId: string;
  areaId: string;
  checkId: string;
  sourceUrl: string;
  observedAt: Date;
  status: "pass" | "fail" | "warning" | "unknown";
  confidence: "high" | "medium" | "low";
  summary: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestGrowthCheckFindingRevisionRecord {
  id: string;
  companyId: string;
  findingId: string;
  scanId: string;
  revision: number;
  action: string;
  actorUserId: string | null;
  reason: string | null;
  note: string | null;
  previousState: Record<string, unknown>;
  nextState: Record<string, unknown>;
  idempotencyKey: string;
  payloadHash: string;
  createdAt: Date;
}

const growthCheckScansTable = {
  __name: "growthCheckScans",
  id: "id", companyId: "companyId", requestedByUserId: "requestedByUserId", targetUrl: "targetUrl",
  rubricId: "rubricId", rubricVersion: "rubricVersion", status: "status", progress: "progress",
  idempotencyKey: "idempotencyKey", failureReason: "failureReason", createdAt: "createdAt",
  updatedAt: "updatedAt", deletedAt: "deletedAt"
} as const;

const growthCheckFindingsTable = {
  __name: "growthCheckFindings",
  id: "id", companyId: "companyId", scanId: "scanId", areaId: "areaId", checkId: "checkId",
  sourceUrl: "sourceUrl", observedAt: "observedAt", status: "status", confidence: "confidence",
  summary: "summary", createdAt: "createdAt", updatedAt: "updatedAt", deletedAt: "deletedAt"
} as const;

const growthCheckFindingRevisionsTable = {
  __name: "growthCheckFindingRevisions",
  id: "id", companyId: "companyId", findingId: "findingId", scanId: "scanId", revision: "revision",
  action: "action", actorUserId: "actorUserId", reason: "reason", note: "note",
  previousState: "previousState", nextState: "nextState", idempotencyKey: "idempotencyKey",
  payloadHash: "payloadHash", createdAt: "createdAt"
} as const;

function createGrowthCheckScanRecord(
  values: Partial<TestGrowthCheckScanRecord> & Pick<TestGrowthCheckScanRecord, "companyId">
): TestGrowthCheckScanRecord {
  const now = new Date();
  return {
    id: values.id ?? nextId(), companyId: values.companyId, requestedByUserId: values.requestedByUserId ?? null,
    targetUrl: values.targetUrl ?? "https://example.test/", rubricId: values.rubricId ?? "home-services",
    rubricVersion: values.rubricVersion ?? "1.0.0", status: values.status ?? "completed",
    progress: values.progress ?? {}, idempotencyKey: values.idempotencyKey ?? `gc-${nextId()}`,
    failureReason: values.failureReason ?? null, createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now, deletedAt: values.deletedAt ?? null
  };
}

function createGrowthCheckFindingRecord(
  values: Partial<TestGrowthCheckFindingRecord> & Pick<TestGrowthCheckFindingRecord, "companyId" | "scanId">
): TestGrowthCheckFindingRecord {
  const now = new Date();
  return {
    id: values.id ?? nextId(), companyId: values.companyId, scanId: values.scanId,
    areaId: values.areaId ?? "booking_intake", checkId: values.checkId ?? "booking_cta",
    sourceUrl: values.sourceUrl ?? "https://example.test/", observedAt: values.observedAt ?? now,
    status: values.status ?? "fail", confidence: values.confidence ?? "medium",
    summary: values.summary ?? "No service request call-to-action found", createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now, deletedAt: values.deletedAt ?? null
  };
}

function createGrowthCheckFindingRevisionRecord(
  values: Partial<TestGrowthCheckFindingRevisionRecord> &
    Pick<TestGrowthCheckFindingRevisionRecord, "companyId" | "findingId" | "scanId" | "revision" | "action">
): TestGrowthCheckFindingRevisionRecord {
  const duplicate = state.growthCheckFindingRevisions.find(
    (row) =>
      (row.findingId === values.findingId && row.revision === values.revision) ||
      (row.companyId === values.companyId && row.idempotencyKey === values.idempotencyKey)
  );
  if (duplicate) {
    // Mirrors the unique indexes (finding_id, revision) and (company_id, idempotency_key).
    throw Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" });
  }
  return {
    id: values.id ?? nextId(), companyId: values.companyId, findingId: values.findingId, scanId: values.scanId,
    revision: values.revision, action: values.action, actorUserId: values.actorUserId ?? null,
    reason: values.reason ?? null, note: values.note ?? null, previousState: values.previousState ?? {},
    nextState: values.nextState ?? {}, idempotencyKey: values.idempotencyKey ?? `rev-${nextId()}`,
    payloadHash: values.payloadHash ?? "hash", createdAt: values.createdAt ?? new Date()
  };
}

export function seedGrowthCheckScan(
  values: Partial<TestGrowthCheckScanRecord> & Pick<TestGrowthCheckScanRecord, "companyId">
): TestGrowthCheckScanRecord {
  const record = createGrowthCheckScanRecord(values);
  state.growthCheckScans.push(record);
  return record;
}

export function seedGrowthCheckFinding(
  values: Partial<TestGrowthCheckFindingRecord> & Pick<TestGrowthCheckFindingRecord, "companyId" | "scanId">
): TestGrowthCheckFindingRecord {
  const record = createGrowthCheckFindingRecord(values);
  state.growthCheckFindings.push(record);
  return record;
}

export function getGrowthCheckFindingRevisions(): TestGrowthCheckFindingRevisionRecord[] {
  return state.growthCheckFindingRevisions;
}

export interface TestGrowthCheckReportDraftRecord {
  id: string;
  companyId: string;
  scanId: string;
  version: number;
  content: Record<string, unknown>;
  approvedVersion: number | null;
  approvedByUserId: string | null;
  approvedAt: Date | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestGrowthCheckReportDraftRevisionRecord {
  id: string;
  companyId: string;
  draftId: string;
  version: number;
  action: string;
  actorUserId: string | null;
  previousContent: Record<string, unknown> | null;
  nextContent: Record<string, unknown>;
  idempotencyKey: string;
  payloadHash: string;
  createdAt: Date;
}

export interface TestGrowthCheckReportShareRecord {
  id: string;
  companyId: string;
  draftId: string;
  draftVersion: number;
  contentHash: string;
  snapshot: Record<string, unknown>;
  tokenHash: string;
  createdByUserId: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  revokedByUserId: string | null;
  idempotencyKey: string;
  payloadHash: string;
}

const growthCheckReportDraftsTable = {
  __name: "growthCheckReportDrafts",
  id: "id", companyId: "companyId", scanId: "scanId", version: "version", content: "content",
  approvedVersion: "approvedVersion", approvedByUserId: "approvedByUserId", approvedAt: "approvedAt",
  createdByUserId: "createdByUserId", createdAt: "createdAt", updatedAt: "updatedAt"
} as const;

const growthCheckReportDraftRevisionsTable = {
  __name: "growthCheckReportDraftRevisions",
  id: "id", companyId: "companyId", draftId: "draftId", version: "version", action: "action",
  actorUserId: "actorUserId", previousContent: "previousContent", nextContent: "nextContent",
  idempotencyKey: "idempotencyKey", payloadHash: "payloadHash", createdAt: "createdAt"
} as const;

const growthCheckReportSharesTable = {
  __name: "growthCheckReportShares",
  id: "id", companyId: "companyId", draftId: "draftId", draftVersion: "draftVersion", contentHash: "contentHash",
  snapshot: "snapshot", tokenHash: "tokenHash", createdByUserId: "createdByUserId", createdAt: "createdAt",
  expiresAt: "expiresAt", revokedAt: "revokedAt", revokedByUserId: "revokedByUserId",
  idempotencyKey: "idempotencyKey", payloadHash: "payloadHash"
} as const;

function uniqueViolation(): Error {
  return Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" });
}

function createGrowthCheckReportDraftRecord(
  values: Partial<TestGrowthCheckReportDraftRecord> & Pick<TestGrowthCheckReportDraftRecord, "companyId" | "scanId" | "content">
): TestGrowthCheckReportDraftRecord {
  // Mirrors the unique index (company_id, scan_id).
  if (state.growthCheckReportDrafts.some((row) => row.companyId === values.companyId && row.scanId === values.scanId)) throw uniqueViolation();
  const now = new Date();
  return {
    id: values.id ?? nextId(), companyId: values.companyId, scanId: values.scanId, version: values.version ?? 1,
    content: values.content, approvedVersion: values.approvedVersion ?? null, approvedByUserId: values.approvedByUserId ?? null,
    approvedAt: values.approvedAt ?? null, createdByUserId: values.createdByUserId ?? null,
    createdAt: values.createdAt ?? now, updatedAt: values.updatedAt ?? now
  };
}

function createGrowthCheckReportDraftRevisionRecord(
  values: Partial<TestGrowthCheckReportDraftRevisionRecord> &
    Pick<TestGrowthCheckReportDraftRevisionRecord, "companyId" | "draftId" | "version" | "action" | "nextContent">
): TestGrowthCheckReportDraftRevisionRecord {
  // Mirrors the unique indexes (draft_id, version) and (company_id, idempotency_key).
  if (
    state.growthCheckReportDraftRevisions.some(
      (row) =>
        (row.draftId === values.draftId && row.version === values.version) ||
        (row.companyId === values.companyId && row.idempotencyKey === values.idempotencyKey)
    )
  ) throw uniqueViolation();
  return {
    id: values.id ?? nextId(), companyId: values.companyId, draftId: values.draftId, version: values.version,
    action: values.action, actorUserId: values.actorUserId ?? null, previousContent: values.previousContent ?? null,
    nextContent: values.nextContent, idempotencyKey: values.idempotencyKey ?? `rdr-${nextId()}`,
    payloadHash: values.payloadHash ?? "hash", createdAt: values.createdAt ?? new Date()
  };
}

function createGrowthCheckReportShareRecord(
  values: Partial<TestGrowthCheckReportShareRecord> &
    Pick<TestGrowthCheckReportShareRecord, "companyId" | "draftId" | "draftVersion" | "contentHash" | "tokenHash">
): TestGrowthCheckReportShareRecord {
  // Mirrors the unique indexes (token_hash) and (company_id, idempotency_key).
  if (
    state.growthCheckReportShares.some(
      (row) => row.tokenHash === values.tokenHash || (row.companyId === values.companyId && row.idempotencyKey === values.idempotencyKey)
    )
  ) throw uniqueViolation();
  return {
    id: values.id ?? nextId(), companyId: values.companyId, draftId: values.draftId, draftVersion: values.draftVersion,
    contentHash: values.contentHash, snapshot: values.snapshot ?? {}, tokenHash: values.tokenHash,
    createdByUserId: values.createdByUserId ?? null, createdAt: values.createdAt ?? new Date(),
    expiresAt: values.expiresAt ?? null, revokedAt: values.revokedAt ?? null, revokedByUserId: values.revokedByUserId ?? null,
    idempotencyKey: values.idempotencyKey ?? `rsh-${nextId()}`, payloadHash: values.payloadHash ?? "hash"
  };
}

export function getGrowthCheckReportShares(): TestGrowthCheckReportShareRecord[] {
  return state.growthCheckReportShares;
}

export function getGrowthCheckReportDraftRevisions(): TestGrowthCheckReportDraftRevisionRecord[] {
  return state.growthCheckReportDraftRevisions;
}

const stockLocationsTable = {
  __name: "stockLocations",
  id: "id", companyId: "companyId", name: "name", kind: "kind", technicianId: "technicianId",
  isActive: "isActive", createdAt: "createdAt", updatedAt: "updatedAt", deletedAt: "deletedAt"
} as const;

const stockLevelsTable = {
  __name: "stockLevels",
  id: "id", companyId: "companyId", locationId: "locationId", productId: "productId", quantity: "quantity",
  lowStockThreshold: "lowStockThreshold", createdAt: "createdAt", updatedAt: "updatedAt", deletedAt: "deletedAt"
} as const;

const stockMovementsTable = {
  __name: "stockMovements",
  id: "id", companyId: "companyId", locationId: "locationId", productId: "productId", kind: "kind",
  quantityDelta: "quantityDelta", quantityAfter: "quantityAfter", reason: "reason", jobId: "jobId",
  transferGroupId: "transferGroupId", allowNegative: "allowNegative", actorUserId: "actorUserId", createdAt: "createdAt"
} as const;

function createStockLocationRecord(
  values: Partial<TestStockLocationRecord> & Pick<TestStockLocationRecord, "companyId" | "name" | "kind">
): TestStockLocationRecord {
  const now = new Date();
  return {
    id: values.id ?? nextId(), companyId: values.companyId, name: values.name, kind: values.kind,
    technicianId: values.technicianId ?? null, isActive: values.isActive ?? true,
    createdAt: values.createdAt ?? now, updatedAt: values.updatedAt ?? now, deletedAt: values.deletedAt ?? null
  };
}

function createStockLevelRecord(
  values: Partial<TestStockLevelRecord> & Pick<TestStockLevelRecord, "companyId" | "locationId" | "productId">
): TestStockLevelRecord {
  const now = new Date();
  return {
    id: values.id ?? nextId(), companyId: values.companyId, locationId: values.locationId, productId: values.productId,
    quantity: values.quantity ?? 0, lowStockThreshold: values.lowStockThreshold ?? null,
    createdAt: values.createdAt ?? now, updatedAt: values.updatedAt ?? now, deletedAt: values.deletedAt ?? null
  };
}

function createStockMovementRecord(
  values: Partial<TestStockMovementRecord> &
    Pick<TestStockMovementRecord, "companyId" | "locationId" | "productId" | "kind" | "quantityDelta" | "quantityAfter">
): TestStockMovementRecord {
  return {
    id: values.id ?? nextId(), companyId: values.companyId, locationId: values.locationId, productId: values.productId,
    kind: values.kind, quantityDelta: values.quantityDelta, quantityAfter: values.quantityAfter,
    reason: values.reason ?? null, jobId: values.jobId ?? null, transferGroupId: values.transferGroupId ?? null,
    allowNegative: values.allowNegative ?? false, actorUserId: values.actorUserId ?? null,
    createdAt: values.createdAt ?? new Date()
  };
}

export function seedStockLocation(
  values: Partial<TestStockLocationRecord> & Pick<TestStockLocationRecord, "companyId" | "name" | "kind">
): TestStockLocationRecord {
  const record = createStockLocationRecord(values);
  state.stockLocations.push(record);
  return record;
}

export function seedStockLevel(
  values: Partial<TestStockLevelRecord> & Pick<TestStockLevelRecord, "companyId" | "locationId" | "productId">
): TestStockLevelRecord {
  const record = createStockLevelRecord(values);
  state.stockLevels.push(record);
  return record;
}

export function getStockMovements(): TestStockMovementRecord[] {
  return state.stockMovements;
}

const productCatalogTable = {
  __name: "productCatalog",
  id: "id",
  companyId: "companyId",
  name: "name",
  description: "description",
  category: "category",
  sku: "sku",
  unitPrice: "unitPrice",
  cost: "cost",
  unit: "unit",
  isTaxable: "isTaxable",
  isActive: "isActive",
  applicableAssetTypes: "applicableAssetTypes",
  sortOrder: "sortOrder",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const techniciansTable = {
  __name: "technicians",
  id: "id",
  companyId: "companyId",
  userId: "userId",
  firstName: "firstName",
  lastName: "lastName",
  email: "email",
  phone: "phone",
  avatarUrl: "avatarUrl",
  skills: "skills",
  serviceAreaIds: "serviceAreaIds",
  serviceZipCodes: "serviceZipCodes",
  availableDays: "availableDays",
  hoursPerDay: "hoursPerDay",
  totalJobsCompleted: "totalJobsCompleted",
  avgJobDurationMinutes: "avgJobDurationMinutes",
  estimateCloseRate: "estimateCloseRate",
  avgTicketValue: "avgTicketValue",
  status: "status",
  calendarColor: "calendarColor",
  notes: "notes",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const jobTasksTable = {
  __name: "jobTasks",
  id: "id",
  companyId: "companyId",
  jobId: "jobId",
  assignedToId: "assignedToId",
  title: "title",
  description: "description",
  status: "status",
  isRequired: "isRequired",
  completedAt: "completedAt",
  completedById: "completedById",
  estimatedMinutes: "estimatedMinutes",
  actualMinutes: "actualMinutes",
  sortOrder: "sortOrder",
  notes: "notes",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const jobProductsTable = {
  __name: "jobProducts",
  id: "id",
  companyId: "companyId",
  jobId: "jobId",
  productCatalogId: "productCatalogId",
  name: "name",
  description: "description",
  category: "category",
  quantity: "quantity",
  unitPrice: "unitPrice",
  total: "total",
  isTaxable: "isTaxable",
  addedById: "addedById",
  isUpsell: "isUpsell",
  upsellApproved: "upsellApproved",
  upsellApprovedAt: "upsellApprovedAt",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const scheduleSlotsTable = {
  __name: "scheduleSlots",
  id: "id",
  companyId: "companyId",
  technicianId: "technicianId",
  jobId: "jobId",
  isBlockedTime: "isBlockedTime",
  blockReason: "blockReason",
  startTime: "startTime",
  endTime: "endTime",
  travelMinutesBefore: "travelMinutesBefore",
  isConfirmed: "isConfirmed",
  notes: "notes",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const activityEventsTable = {
  __name: "activityEvents",
  id: "id",
  companyId: "companyId",
  eventType: "eventType",
  actorId: "actorId",
  actorType: "actorType",
  actorName: "actorName",
  entityType: "entityType",
  entityId: "entityId",
  customerId: "customerId",
  jobId: "jobId",
  estimateId: "estimateId",
  invoiceId: "invoiceId",
  payload: "payload",
  summary: "summary",
  occurredAt: "occurredAt"
} as const;

const timeEntriesTable = {
  __name: "timeEntries",
  id: "id",
  companyId: "companyId",
  jobId: "jobId",
  technicianId: "technicianId",
  startedAt: "startedAt",
  endedAt: "endedAt",
  durationMinutes: "durationMinutes",
  entryType: "entryType",
  notes: "notes",
  travelFromAddress: "travelFromAddress",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;


// FS-171 timesheets / payroll tables.
export interface TestTimesheetRecord {
  id: string;
  companyId: string;
  technicianId: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  submittedAt: Date | null;
  submittedById: string | null;
  approvedAt: Date | null;
  approvedById: string | null;
  rejectedAt: Date | null;
  rejectedById: string | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TestTimesheetAuditEventRecord {
  id: string;
  companyId: string;
  timesheetId: string | null;
  timeEntryId: string | null;
  action: string;
  actorUserId: string | null;
  reason: string | null;
  before: unknown;
  after: unknown;
  createdAt: Date;
}

export interface TestTechnicianPayRateRecord {
  id: string;
  companyId: string;
  technicianId: string;
  hourlyRateCents: number;
  effectiveFrom: string;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

const timesheetsTable = {
  __name: "timesheets",
  id: "id", companyId: "companyId", technicianId: "technicianId", periodStart: "periodStart", periodEnd: "periodEnd",
  status: "status", submittedAt: "submittedAt", submittedById: "submittedById", approvedAt: "approvedAt",
  approvedById: "approvedById", rejectedAt: "rejectedAt", rejectedById: "rejectedById", rejectionReason: "rejectionReason",
  createdAt: "createdAt", updatedAt: "updatedAt", deletedAt: "deletedAt"
} as const;

const timesheetAuditEventsTable = {
  __name: "timesheetAuditEvents",
  id: "id", companyId: "companyId", timesheetId: "timesheetId", timeEntryId: "timeEntryId", action: "action",
  actorUserId: "actorUserId", reason: "reason", before: "before", after: "after", createdAt: "createdAt"
} as const;

const technicianPayRatesTable = {
  __name: "technicianPayRates",
  id: "id", companyId: "companyId", technicianId: "technicianId", hourlyRateCents: "hourlyRateCents",
  effectiveFrom: "effectiveFrom", createdById: "createdById", createdAt: "createdAt", updatedAt: "updatedAt", deletedAt: "deletedAt"
} as const;

function createTimesheetRecord(
  values: Partial<TestTimesheetRecord> & Pick<TestTimesheetRecord, "companyId" | "technicianId" | "periodStart" | "periodEnd">
): TestTimesheetRecord {
  const now = new Date();
  return {
    id: values.id ?? nextId(), companyId: values.companyId, technicianId: values.technicianId,
    periodStart: values.periodStart, periodEnd: values.periodEnd, status: values.status ?? "open",
    submittedAt: values.submittedAt ?? null, submittedById: values.submittedById ?? null,
    approvedAt: values.approvedAt ?? null, approvedById: values.approvedById ?? null,
    rejectedAt: values.rejectedAt ?? null, rejectedById: values.rejectedById ?? null,
    rejectionReason: values.rejectionReason ?? null,
    createdAt: values.createdAt ?? now, updatedAt: values.updatedAt ?? now, deletedAt: values.deletedAt ?? null
  };
}

function createTimesheetAuditEventRecord(
  values: Partial<TestTimesheetAuditEventRecord> & Pick<TestTimesheetAuditEventRecord, "companyId" | "action">
): TestTimesheetAuditEventRecord {
  return {
    id: values.id ?? nextId(), companyId: values.companyId, timesheetId: values.timesheetId ?? null,
    timeEntryId: values.timeEntryId ?? null, action: values.action, actorUserId: values.actorUserId ?? null,
    reason: values.reason ?? null, before: values.before ?? null, after: values.after ?? null,
    createdAt: values.createdAt ?? new Date()
  };
}

function createTechnicianPayRateRecord(
  values: Partial<TestTechnicianPayRateRecord> &
    Pick<TestTechnicianPayRateRecord, "companyId" | "technicianId" | "hourlyRateCents" | "effectiveFrom">
): TestTechnicianPayRateRecord {
  const now = new Date();
  return {
    id: values.id ?? nextId(), companyId: values.companyId, technicianId: values.technicianId,
    hourlyRateCents: values.hourlyRateCents, effectiveFrom: values.effectiveFrom, createdById: values.createdById ?? null,
    createdAt: values.createdAt ?? now, updatedAt: values.updatedAt ?? now, deletedAt: values.deletedAt ?? null
  };
}

export function seedTimesheet(
  values: Partial<TestTimesheetRecord> & Pick<TestTimesheetRecord, "companyId" | "technicianId" | "periodStart" | "periodEnd">
): TestTimesheetRecord {
  const record = createTimesheetRecord(values);
  state.timesheets.push(record);
  return record;
}

export function seedTechnicianPayRate(
  values: Partial<TestTechnicianPayRateRecord> &
    Pick<TestTechnicianPayRateRecord, "companyId" | "technicianId" | "hourlyRateCents" | "effectiveFrom">
): TestTechnicianPayRateRecord {
  const record = createTechnicianPayRateRecord(values);
  state.technicianPayRates.push(record);
  return record;
}

export function getTimesheetAuditEvents(): TestTimesheetAuditEventRecord[] {
  return state.timesheetAuditEvents;
}

export function getTimeEntries(): TestTimeEntryRecord[] {
  return state.timeEntries;
}

const reviewRequestsTable = {
  __name: "reviewRequests",
  id: "id",
  companyId: "companyId",
  jobId: "jobId",
  customerId: "customerId",
  technicianId: "technicianId",
  referenceId: "referenceId",
  status: "status",
  channel: "channel",
  reviewUrl: "reviewUrl",
  sentAt: "sentAt",
  clickedAt: "clickedAt",
  completedAt: "completedAt",
  rating: "rating",
  reviewText: "reviewText",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const fileAttachmentsTable = {
  __name: "fileAttachments",
  id: "id",
  companyId: "companyId",
  entityType: "entityType",
  entityId: "entityId",
  jobId: "jobId",
  customerId: "customerId",
  uploadedById: "uploadedById",
  fileName: "fileName",
  fileUrl: "fileUrl",
  thumbnailUrl: "thumbnailUrl",
  mimeType: "mimeType",
  fileSizeBytes: "fileSizeBytes",
  fileType: "fileType",
  caption: "caption",
  photoType: "photoType",
  takenAt: "takenAt",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const onTheWayNotificationsTable = {
  __name: "onTheWayNotifications",
  id: "id",
  companyId: "companyId",
  jobId: "jobId",
  technicianId: "technicianId",
  customerId: "customerId",
  sentAt: "sentAt",
  channel: "channel",
  message: "message",
  estimatedArrivalMinutes: "estimatedArrivalMinutes",
  technicianLat: "technicianLat",
  technicianLng: "technicianLng",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const bookingRequestsTable = {
  __name: "bookingRequests",
  id: "id",
  companyId: "companyId",
  customerId: "customerId",
  jobId: "jobId",
  assignedTechnicianId: "assignedTechnicianId",
  firstName: "firstName",
  lastName: "lastName",
  phone: "phone",
  email: "email",
  addressLine1: "addressLine1",
  addressLine2: "addressLine2",
  city: "city",
  state: "state",
  zip: "zip",
  propertyType: "propertyType",
  serviceCategory: "serviceCategory",
  serviceType: "serviceType",
  serviceDetail: "serviceDetail",
  urgency: "urgency",
  customerNotes: "customerNotes",
  preferredDate: "preferredDate",
  preferredWindow: "preferredWindow",
  status: "status",
  source: "source",
  referenceNumber: "referenceNumber",
  isPropertyOwner: "isPropertyOwner",
  smsConsentAppointments: "smsConsentAppointments",
  smsConsentMarketing: "smsConsentMarketing",
  leadAttribution: "leadAttribution",
  confirmedAt: "confirmedAt",
  confirmedById: "confirmedById",
  confirmationSentAt: "confirmationSentAt",
  cancelledAt: "cancelledAt",
  cancellationReason: "cancellationReason",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const fieldSyncBatchesTable = {
  __name: "fieldSyncBatches",
  id: "id",
  companyId: "companyId",
  userId: "userId",
  deviceId: "deviceId",
  batchClientId: "batchClientId",
  status: "status",
  lastAcknowledgedSequence: "lastAcknowledgedSequence",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const fieldSyncOperationsTable = {
  __name: "fieldSyncOperations",
  id: "id",
  companyId: "companyId",
  batchId: "batchId",
  sequence: "sequence",
  clientOperationId: "clientOperationId",
  jobId: "jobId",
  operationType: "operationType",
  requestPayload: "requestPayload",
  outcome: "outcome",
  resultPayload: "resultPayload",
  payloadHash: "payloadHash",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const agentActionsTable = {
  __name: "agentActions",
  id: "id",
  companyId: "companyId",
  agentProduct: "agentProduct",
  actionType: "actionType",
  parameters: "parameters",
  target: "target",
  sourceEventIds: "sourceEventIds",
  idempotencyKey: "idempotencyKey",
  payloadHash: "payloadHash",
  policyVersion: "policyVersion",
  requiresApproval: "requiresApproval",
  state: "state",
  confidence: "confidence",
  reason: "reason",
  expiresAt: "expiresAt",
  reviewerId: "reviewerId",
  executionReceipt: "executionReceipt",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const serviceAreasTable = {
  __name: "serviceAreas",
  id: "id",
  companyId: "companyId",
  name: "name",
  zips: "zips",
  notes: "notes",
  isActive: "isActive",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const inquirySubmitIdempotencyTable = {
  __name: "inquirySubmitIdempotency",
  id: "id",
  companyId: "companyId",
  idempotencyKey: "idempotencyKey",
  payloadHash: "payloadHash",
  bookingRequestId: "bookingRequestId",
  responseSnapshot: "responseSnapshot",
  expiresAt: "expiresAt",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const growthIntakeChecksTable = {
  __name: "growthIntakeChecks",
  id: "id",
  companyId: "companyId",
  status: "status",
  ownerUserId: "ownerUserId",
  createdById: "createdById",
  reviewNeeded: "reviewNeeded",
  lastScanAt: "lastScanAt",
  businessName: "businessName",
  websiteUrl: "websiteUrl",
  industry: "industry",
  trade: "trade",
  city: "city",
  state: "state",
  zip: "zip",
  contactName: "contactName",
  contactEmail: "contactEmail",
  contactPhone: "contactPhone",
  targetMarket: "targetMarket",
  googleBusinessProfileUrl: "googleBusinessProfileUrl",
  facebookPageUrl: "facebookPageUrl",
  intakeNotes: "intakeNotes",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const growthIntakeIdentityCandidatesTable = {
  __name: "growthIntakeIdentityCandidates",
  id: "id",
  companyId: "companyId",
  growthIntakeCheckId: "growthIntakeCheckId",
  displayName: "displayName",
  domain: "domain",
  source: "source",
  confidenceScore: "confidenceScore",
  isPrimary: "isPrimary",
  metadata: "metadata",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const growthIntakeFindingsTable = {
  __name: "growthIntakeFindings",
  id: "id",
  companyId: "companyId",
  growthIntakeCheckId: "growthIntakeCheckId",
  category: "category",
  severity: "severity",
  status: "status",
  title: "title",
  description: "description",
  recommendation: "recommendation",
  evidence: "evidence",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const growthIntakeAuditEventsTable = {
  __name: "growthIntakeAuditEvents",
  id: "id",
  companyId: "companyId",
  entityType: "entityType",
  entityId: "entityId",
  growthIntakeCheckId: "growthIntakeCheckId",
  action: "action",
  actorId: "actorId",
  beforeState: "beforeState",
  afterState: "afterState",
  createdAt: "createdAt"
} as const;

const bookingSettingsTable = {
  __name: "bookingSettings",
  id: "id",
  companyId: "companyId",
  isEnabled: "isEnabled",
  bookingSlug: "bookingSlug",
  offeredServices: "offeredServices",
  availableHoursStart: "availableHoursStart",
  availableHoursEnd: "availableHoursEnd",
  availableDays: "availableDays",
  slotDuration: "slotDuration",
  maxAdvanceDays: "maxAdvanceDays",
  autoConfirm: "autoConfirm",
  googleReviewUrl: "googleReviewUrl",
  yelpReviewUrl: "yelpReviewUrl",
  facebookReviewUrl: "facebookReviewUrl",
  allowZipOverflow: "allowZipOverflow",
  balanceWorkload: "balanceWorkload",
  notifyOnNewBooking: "notifyOnNewBooking",
  notificationEmail: "notificationEmail",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  deletedAt: "deletedAt"
} as const;

const state: TestState = {
  companies: [],
  users: [],
  refreshTokens: [],
  customers: [],
  properties: [],
  assets: [],
  jobs: [],
  importSessions: [],
  importBundles: [],
  savedCardMigrations: [],
  importChunkRuns: [],
  dataExportSessions: [],
  estimates: [],
  estimateItems: [],
  invoices: [],
  invoiceItems: [],
  payments: [],
  jobNotes: [],
  customerNotes: [],
  jobPhotos: [],
  serviceAgreementTemplates: [],
  maintenancePlans: [],
  vipMembershipTiers: [],
  maintenanceVisits: [],
  recurringVisitSeries: [],
  recurringVisitOccurrences: [],
  automationRules: [],
  aiRecommendations: [],
  campaigns: [],
  campaignRecipients: [],
  messageLogs: [],
  productCatalog: [],
  stockLocations: [],
  stockLevels: [],
  stockMovements: [],
  callTrackingSettings: [],
  callTrackingNumbers: [],
  callRecords: [],
  growthCheckScans: [],
  growthCheckFindings: [],
  growthCheckFindingRevisions: [],
  growthCheckReportDrafts: [],
  growthCheckReportDraftRevisions: [],
  growthCheckReportShares: [],
  technicians: [],
  jobTasks: [],
  jobProducts: [],
  scheduleSlots: [],
  activityEvents: [],
  timeEntries: [],
  timesheets: [],
  timesheetAuditEvents: [],
  technicianPayRates: [],
  reviewRequests: [],
  fileAttachments: [],
  onTheWayNotifications: [],
  bookingRequests: [],
  bookingSettings: [],
  agentActions: [],
  inquirySubmitIdempotency: [],
  serviceAreas: [],
  growthIntakeChecks: [],
  growthIntakeIdentityCandidates: [],
  growthIntakeFindings: [],
  growthIntakeAuditEvents: [],
  fieldSyncBatches: [],
  fieldSyncOperations: []
};

function nextId(): string {
  return randomUUID();
}

function cloneState(): TestState {
  return structuredClone(state);
}

function restoreState(snapshot: TestState): void {
  state.companies.splice(0, state.companies.length, ...snapshot.companies);
  state.users.splice(0, state.users.length, ...snapshot.users);
  state.refreshTokens.splice(0, state.refreshTokens.length, ...snapshot.refreshTokens);
  state.customers.splice(0, state.customers.length, ...snapshot.customers);
  state.properties.splice(0, state.properties.length, ...snapshot.properties);
  state.assets.splice(0, state.assets.length, ...snapshot.assets);
  state.jobs.splice(0, state.jobs.length, ...snapshot.jobs);
  state.importSessions.splice(0, state.importSessions.length, ...snapshot.importSessions);
  state.importChunkRuns.splice(0, state.importChunkRuns.length, ...snapshot.importChunkRuns);
  state.dataExportSessions.splice(0, state.dataExportSessions.length, ...snapshot.dataExportSessions);
  state.estimates.splice(0, state.estimates.length, ...snapshot.estimates);
  state.estimateItems.splice(0, state.estimateItems.length, ...snapshot.estimateItems);
  state.invoices.splice(0, state.invoices.length, ...snapshot.invoices);
  state.invoiceItems.splice(0, state.invoiceItems.length, ...snapshot.invoiceItems);
  state.payments.splice(0, state.payments.length, ...snapshot.payments);
  state.jobNotes.splice(0, state.jobNotes.length, ...snapshot.jobNotes);
  state.customerNotes.splice(0, state.customerNotes.length, ...snapshot.customerNotes);
  state.jobPhotos.splice(0, state.jobPhotos.length, ...snapshot.jobPhotos);
  state.serviceAgreementTemplates.splice(0, state.serviceAgreementTemplates.length, ...snapshot.serviceAgreementTemplates);
  state.maintenancePlans.splice(0, state.maintenancePlans.length, ...snapshot.maintenancePlans);
  state.maintenanceVisits.splice(0, state.maintenanceVisits.length, ...snapshot.maintenanceVisits);
  state.automationRules.splice(0, state.automationRules.length, ...snapshot.automationRules);
  state.aiRecommendations.splice(0, state.aiRecommendations.length, ...snapshot.aiRecommendations);
  state.campaigns.splice(0, state.campaigns.length, ...snapshot.campaigns);
  state.campaignRecipients.splice(0, state.campaignRecipients.length, ...snapshot.campaignRecipients);
  state.messageLogs.splice(0, state.messageLogs.length, ...snapshot.messageLogs);
  state.productCatalog.splice(0, state.productCatalog.length, ...snapshot.productCatalog);
  state.stockLocations.splice(0, state.stockLocations.length, ...snapshot.stockLocations);
  state.stockLevels.splice(0, state.stockLevels.length, ...snapshot.stockLevels);
  state.stockMovements.splice(0, state.stockMovements.length, ...snapshot.stockMovements);
  state.callTrackingSettings.splice(0, state.callTrackingSettings.length, ...snapshot.callTrackingSettings);
  state.callTrackingNumbers.splice(0, state.callTrackingNumbers.length, ...snapshot.callTrackingNumbers);
  state.callRecords.splice(0, state.callRecords.length, ...snapshot.callRecords);
  state.growthCheckScans.splice(0, state.growthCheckScans.length, ...snapshot.growthCheckScans);
  state.growthCheckFindings.splice(0, state.growthCheckFindings.length, ...snapshot.growthCheckFindings);
  state.growthCheckFindingRevisions.splice(0, state.growthCheckFindingRevisions.length, ...snapshot.growthCheckFindingRevisions);
  state.growthCheckReportDrafts.splice(0, state.growthCheckReportDrafts.length, ...snapshot.growthCheckReportDrafts);
  state.growthCheckReportDraftRevisions.splice(0, state.growthCheckReportDraftRevisions.length, ...snapshot.growthCheckReportDraftRevisions);
  state.growthCheckReportShares.splice(0, state.growthCheckReportShares.length, ...snapshot.growthCheckReportShares);
  state.technicians.splice(0, state.technicians.length, ...snapshot.technicians);
  state.jobTasks.splice(0, state.jobTasks.length, ...snapshot.jobTasks);
  state.jobProducts.splice(0, state.jobProducts.length, ...snapshot.jobProducts);
  state.scheduleSlots.splice(0, state.scheduleSlots.length, ...snapshot.scheduleSlots);
  state.activityEvents.splice(0, state.activityEvents.length, ...snapshot.activityEvents);
  state.timeEntries.splice(0, state.timeEntries.length, ...snapshot.timeEntries);
  state.timesheets.splice(0, state.timesheets.length, ...snapshot.timesheets);
  state.timesheetAuditEvents.splice(0, state.timesheetAuditEvents.length, ...snapshot.timesheetAuditEvents);
  state.technicianPayRates.splice(0, state.technicianPayRates.length, ...snapshot.technicianPayRates);
  state.reviewRequests.splice(0, state.reviewRequests.length, ...snapshot.reviewRequests);
  state.fileAttachments.splice(0, state.fileAttachments.length, ...snapshot.fileAttachments);
  state.onTheWayNotifications.splice(
    0,
    state.onTheWayNotifications.length,
    ...snapshot.onTheWayNotifications
  );
  state.bookingRequests.splice(0, state.bookingRequests.length, ...snapshot.bookingRequests);
  state.bookingSettings.splice(0, state.bookingSettings.length, ...snapshot.bookingSettings);
  state.agentActions.splice(0, state.agentActions.length, ...snapshot.agentActions);
  state.serviceAreas.splice(0, state.serviceAreas.length, ...(snapshot.serviceAreas ?? []));
  state.inquirySubmitIdempotency.splice(
    0,
    state.inquirySubmitIdempotency.length,
    ...snapshot.inquirySubmitIdempotency
  );
  state.growthIntakeChecks.splice(0, state.growthIntakeChecks.length, ...snapshot.growthIntakeChecks);
  state.growthIntakeIdentityCandidates.splice(
    0,
    state.growthIntakeIdentityCandidates.length,
    ...snapshot.growthIntakeIdentityCandidates
  );
  state.growthIntakeFindings.splice(0, state.growthIntakeFindings.length, ...snapshot.growthIntakeFindings);
  state.growthIntakeAuditEvents.splice(0, state.growthIntakeAuditEvents.length, ...snapshot.growthIntakeAuditEvents);
  state.fieldSyncBatches.splice(0, state.fieldSyncBatches.length, ...snapshot.fieldSyncBatches);
  state.fieldSyncOperations.splice(0, state.fieldSyncOperations.length, ...snapshot.fieldSyncOperations);
}

function getRows(tableName: TableName): AnyTestRecord[] {
  switch (tableName) {
    case "companies":
      return state.companies;
    case "users":
      return state.users;
    case "refreshTokens":
      return state.refreshTokens;
    case "customers":
      return state.customers;
    case "properties":
      return state.properties;
    case "assets":
      return state.assets;
    case "jobs":
      return state.jobs;
    case "importSessions":
      return state.importSessions;
    case "importBundles":
      return state.importBundles as unknown as AnyTestRecord[];
    case "savedCardMigrations":
      return state.savedCardMigrations as unknown as AnyTestRecord[];
    case "importChunkRuns":
      return state.importChunkRuns;
    case "dataExportSessions":
      return state.dataExportSessions;
    case "estimates":
      return state.estimates;
    case "estimateItems":
      return state.estimateItems;
    case "invoices":
      return state.invoices;
    case "invoiceItems":
      return state.invoiceItems;
    case "payments":
      return state.payments;
    case "jobNotes":
      return state.jobNotes;
    case "customerNotes":
      return state.customerNotes;
    case "jobPhotos":
      return state.jobPhotos;
    case "serviceAgreementTemplates":
      return state.serviceAgreementTemplates;
    case "maintenancePlans":
      return state.maintenancePlans;
    case "vipMembershipTiers":
      return state.vipMembershipTiers;
    case "maintenanceVisits":
      return state.maintenanceVisits;
    case "recurringVisitSeries":
      return state.recurringVisitSeries;
    case "recurringVisitOccurrences":
      return state.recurringVisitOccurrences;
    case "automationRules":
      return state.automationRules;
    case "aiRecommendations":
      return state.aiRecommendations;
    case "campaigns":
      return state.campaigns;
    case "campaignRecipients":
      return state.campaignRecipients;
    case "messageLogs":
      return state.messageLogs;
    case "productCatalog":
      return state.productCatalog;
    case "stockLocations":
      return state.stockLocations;
    case "stockLevels":
      return state.stockLevels;
    case "stockMovements":
      return state.stockMovements;
    case "callTrackingSettings":
      return state.callTrackingSettings;
    case "callTrackingNumbers":
      return state.callTrackingNumbers;
    case "callRecords":
      return state.callRecords;
    case "growthCheckScans":
      return state.growthCheckScans;
    case "growthCheckFindings":
      return state.growthCheckFindings;
    case "growthCheckFindingRevisions":
      return state.growthCheckFindingRevisions;
    case "growthCheckReportDrafts":
      return state.growthCheckReportDrafts;
    case "growthCheckReportDraftRevisions":
      return state.growthCheckReportDraftRevisions;
    case "growthCheckReportShares":
      return state.growthCheckReportShares;
    case "technicians":
      return state.technicians;
    case "jobTasks":
      return state.jobTasks;
    case "jobProducts":
      return state.jobProducts;
    case "scheduleSlots":
      return state.scheduleSlots;
    case "activityEvents":
      return state.activityEvents;
    case "timeEntries":
      return state.timeEntries;
    case "timesheets":
      return state.timesheets;
    case "timesheetAuditEvents":
      return state.timesheetAuditEvents;
    case "technicianPayRates":
      return state.technicianPayRates;
    case "reviewRequests":
      return state.reviewRequests;
    case "fileAttachments":
      return state.fileAttachments;
    case "onTheWayNotifications":
      return state.onTheWayNotifications;
    case "bookingRequests":
      return state.bookingRequests;
    case "bookingSettings":
      return state.bookingSettings;
    case "agentActions":
      return state.agentActions;
    case "inquirySubmitIdempotency":
      return state.inquirySubmitIdempotency;
    case "serviceAreas":
      return state.serviceAreas;
    case "growthIntakeChecks":
      return state.growthIntakeChecks;
    case "growthIntakeIdentityCandidates":
      return state.growthIntakeIdentityCandidates;
    case "growthIntakeFindings":
      return state.growthIntakeFindings;
    case "growthIntakeAuditEvents":
      return state.growthIntakeAuditEvents;
    case "fieldSyncBatches":
      return state.fieldSyncBatches;
    case "fieldSyncOperations":
      return state.fieldSyncOperations;
  }
}

function sortRows<T extends Record<string, unknown>>(
  rows: T[],
  definition: OrderByDefinition,
  ...rest: OrderByDefinition[]
): T[] {
  const definitions = [definition, ...rest];
  return [...rows].sort((left, right) => {
    for (const current of definitions) {
      const result = compareByDefinition(left, right, current);
      if (result !== 0) {
        return result;
      }
    }
    return 0;
  });
}

function readSortValue(row: Record<string, unknown>, definition: OrderByDefinition) {
  if (definition.expr) {
    return getTimelineAt(row, definition.expr)?.getTime() ?? null;
  }
  return row[definition.field] as string | number | Date | null | undefined;
}

function compareByDefinition<T extends Record<string, unknown>>(
  left: T,
  right: T,
  definition: OrderByDefinition
): number {
  {
    const leftValue = readSortValue(left, definition);
    const rightValue = readSortValue(right, definition);

    if (leftValue === rightValue) {
      return 0;
    }

    if (leftValue === null || leftValue === undefined) {
      return 1;
    }

    if (rightValue === null || rightValue === undefined) {
      return -1;
    }

    if (definition.direction === "asc") {
      return leftValue > rightValue ? 1 : -1;
    }

    return leftValue > rightValue ? -1 : 1;
  }
}

function createCompanyRecord(values: Partial<TestCompanyRecord> & Pick<TestCompanyRecord, "name" | "slug">): TestCompanyRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    name: values.name,
    slug: values.slug,
    phone: values.phone ?? null,
    email: values.email ?? null,
    website: values.website ?? null,
    logoUrl: values.logoUrl ?? null,
    addressLine1: values.addressLine1 ?? null,
    addressLine2: values.addressLine2 ?? null,
    city: values.city ?? null,
    state: values.state ?? null,
    zip: values.zip ?? null,
    country: values.country ?? "US",
    timezone: values.timezone ?? "America/Chicago",
    stripeCustomerId: values.stripeCustomerId ?? null,
    stripeAccountId: values.stripeAccountId ?? null,
    settings: values.settings ?? {},
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createUserRecord(
  values: Partial<TestUserRecord> &
    Pick<TestUserRecord, "companyId" | "email" | "firstName" | "lastName">
): TestUserRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    email: values.email,
    passwordHash: values.passwordHash ?? null,
    passwordChangedAt: values.passwordChangedAt ?? null,
    firstName: values.firstName,
    lastName: values.lastName,
    phone: values.phone ?? null,
    role: values.role ?? "office",
    avatarUrl: values.avatarUrl ?? null,
    isActive: values.isActive ?? true,
    lastLoginAt: values.lastLoginAt ?? null,
    emailVerifiedAt: values.emailVerifiedAt ?? null,
    emailVerificationTokenHash: values.emailVerificationTokenHash ?? null,
    emailVerificationExpiresAt: values.emailVerificationExpiresAt ?? null,
    clerkUserId: values.clerkUserId ?? null,
    clerkUnlinkedAt: values.clerkUnlinkedAt ?? null,
    technicianId: values.technicianId ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createRefreshTokenRecord(
  values: Partial<TestRefreshTokenRecord> &
    Pick<TestRefreshTokenRecord, "companyId" | "userId" | "tokenHash" | "expiresAt">
): TestRefreshTokenRecord {
  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    userId: values.userId,
    tokenHash: values.tokenHash,
    expiresAt: values.expiresAt,
    revokedAt: values.revokedAt ?? null,
    createdAt: values.createdAt ?? new Date()
  };
}

function createCustomerRecord(
  values: Partial<TestCustomerRecord> &
    Pick<TestCustomerRecord, "companyId" | "firstName" | "lastName">
): TestCustomerRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    firstName: values.firstName,
    lastName: values.lastName,
    displayName: values.displayName ?? null,
    email: values.email ?? null,
    phone: values.phone ?? null,
    altPhone: values.altPhone ?? null,
    leadSource: values.leadSource ?? null,
    referredBy: values.referredBy ?? null,
    tags: values.tags ?? [],
    internalNotes: values.internalNotes ?? null,
    lifetimeValue: values.lifetimeValue ?? "0.00",
    totalJobs: values.totalJobs ?? 0,
    lastServiceDate: values.lastServiceDate ?? null,
    firstServiceDate: values.firstServiceDate ?? null,
    prefersSms: values.prefersSms ?? true,
    prefersEmail: values.prefersEmail ?? true,
    doNotContact: values.doNotContact ?? false,
    stripeCustomerId: values.stripeCustomerId ?? null,
    sourceSystem: values.sourceSystem ?? null,
    sourceId: values.sourceId ?? null,
    importSessionId: values.importSessionId ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createPropertyRecord(
  values: Partial<TestPropertyRecord> &
    Pick<TestPropertyRecord, "companyId" | "customerId" | "addressLine1" | "city" | "state" | "zip">
): TestPropertyRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    customerId: values.customerId,
    addressLine1: values.addressLine1,
    addressLine2: values.addressLine2 ?? null,
    city: values.city,
    state: values.state,
    zip: values.zip,
    country: values.country ?? "US",
    lat: values.lat ?? null,
    lng: values.lng ?? null,
    type: values.type ?? "residential",
    sqft: values.sqft ?? null,
    yearBuilt: values.yearBuilt ?? null,
    accessNotes: values.accessNotes ?? null,
    notes: values.notes ?? null,
    isPrimary: values.isPrimary ?? false,
    isActive: values.isActive ?? true,
    ...(values.sourceSystem !== undefined ? { sourceSystem: values.sourceSystem } : {}),
    ...(values.sourceId !== undefined ? { sourceId: values.sourceId } : {}),
    importSessionId: values.importSessionId ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createAssetRecord(
  values: Partial<TestAssetRecord> &
    Pick<TestAssetRecord, "companyId" | "customerId" | "propertyId" | "name" | "assetType">
): TestAssetRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    propertyId: values.propertyId,
    customerId: values.customerId,
    name: values.name,
    assetType: values.assetType,
    brand: values.brand ?? null,
    model: values.model ?? null,
    serialNumber: values.serialNumber ?? null,
    installDate: values.installDate ?? null,
    warrantyExpiration: values.warrantyExpiration ?? null,
    lastServiceDate: values.lastServiceDate ?? null,
    nextServiceDate: values.nextServiceDate ?? null,
    condition: values.condition ?? null,
    conditionNotes: values.conditionNotes ?? null,
    conditionScore: values.conditionScore ?? null,
    replacementProbability: values.replacementProbability ?? null,
    photoUrls: values.photoUrls ?? [],
    notes: values.notes ?? null,
    isActive: values.isActive ?? true,
    importSessionId: values.importSessionId ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createJobRecord(
  values: Partial<TestJobRecord> &
    Pick<TestJobRecord, "companyId" | "customerId">
): TestJobRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    customerId: values.customerId,
    jobNumber: values.jobNumber ?? `JOB-${String(state.jobs.length + 1).padStart(4, "0")}`,
    propertyId: values.propertyId ?? null,
    assetId: values.assetId ?? null,
    technicianId: values.technicianId ?? null,
    assignedById: values.assignedById ?? null,
    type: values.type ?? "service_call",
    priority: values.priority ?? "normal",
    status: values.status ?? "lead",
    leadSource: values.leadSource ?? null,
    leadAttribution: values.leadAttribution ?? null,
    title: values.title ?? "Service Call",
    description: values.description ?? null,
    scheduledStart: values.scheduledStart ?? null,
    scheduledEnd: values.scheduledEnd ?? null,
    scheduledDurationMinutes: values.scheduledDurationMinutes ?? null,
    actualStart: values.actualStart ?? null,
    actualEnd: values.actualEnd ?? null,
    techNotes: values.techNotes ?? null,
    completionNotes: values.completionNotes ?? null,
    signatureUrl: values.signatureUrl ?? null,
    signedAt: values.signedAt ?? null,
    signedByName: values.signedByName ?? null,
    estimateTotal: values.estimateTotal ?? null,
    invoiceTotal: values.invoiceTotal ?? null,
    amountPaid: values.amountPaid ?? "0.00",
    maintenancePlanId: values.maintenancePlanId ?? null,
    parentJobId: values.parentJobId ?? null,
    tags: values.tags ?? [],
    importSessionId: values.importSessionId ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createDataExportSessionRecord(
  values: Partial<TestDataExportSessionRecord> & Pick<TestDataExportSessionRecord, "companyId">
): TestDataExportSessionRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    requestedById: values.requestedById ?? null,
    status: values.status ?? "pending",
    format: values.format ?? "json",
    manifestVersion: values.manifestVersion ?? "fsm.data-export.v1",
    progressPercent: values.progressPercent ?? 0,
    fileName: values.fileName ?? null,
    fileUrl: values.fileUrl ?? null,
    recordCounts: values.recordCounts ?? {},
    expiresAt: values.expiresAt ?? null,
    completedAt: values.completedAt ?? null,
    errorMessage: values.errorMessage ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createImportSessionRecord(
  values: Partial<TestImportSessionRecord> &
    Pick<TestImportSessionRecord, "companyId" | "fileName" | "fileUrl">
): TestImportSessionRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    createdById: values.createdById ?? null,
    importBundleId: values.importBundleId ?? null,
    sourceSystem: values.sourceSystem ?? null,
    entityType: values.entityType ?? "customers",
    status: values.status ?? "uploaded",
    fileName: values.fileName,
    fileUrl: values.fileUrl,
    totalRows: values.totalRows ?? 0,
    validRows: values.validRows ?? 0,
    errorRows: values.errorRows ?? 0,
    importedRows: values.importedRows ?? 0,
    skippedRows: values.skippedRows ?? 0,
    duplicateRows: values.duplicateRows ?? 0,
    columnMappings: values.columnMappings ?? {},
    validationErrors: values.validationErrors ?? [],
    aiInferences: values.aiInferences ?? {},
    progress: values.progress ?? {},
    rolledBackAt: values.rolledBackAt ?? null,
    rolledBackById: values.rolledBackById ?? null,
    completedAt: values.completedAt ?? null,
    errorMessage: values.errorMessage ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createImportChunkRunRecord(
  values: Partial<TestImportChunkRunRecord> &
    Pick<
      TestImportChunkRunRecord,
      | "companyId"
      | "importSessionId"
      | "entityType"
      | "chunkIndex"
      | "chunksTotal"
      | "idempotencyKey"
    >
): TestImportChunkRunRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    importSessionId: values.importSessionId,
    entityType: values.entityType,
    chunkIndex: values.chunkIndex,
    chunksTotal: values.chunksTotal,
    idempotencyKey: values.idempotencyKey,
    status: values.status ?? "pending",
    cursor: values.cursor ?? {},
    rowsOk: values.rowsOk ?? 0,
    rowsFailed: values.rowsFailed ?? 0,
    errorMessage: values.errorMessage ?? null,
    completedAt: values.completedAt ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createEstimateRecord(
  values: Partial<TestEstimateRecord> &
    Pick<TestEstimateRecord, "companyId" | "customerId">
): TestEstimateRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    estimateNumber: values.estimateNumber ?? `EST-${String(state.estimates.length + 1).padStart(4, "0")}`,
    importSessionId: values.importSessionId ?? null,
    jobId: values.jobId ?? null,
    customerId: values.customerId,
    propertyId: values.propertyId ?? null,
    createdById: values.createdById ?? null,
    status: values.status ?? "draft",
    tierLabel: values.tierLabel ?? null,
    tierGroupId: values.tierGroupId ?? null,
    isSelectedTier: values.isSelectedTier ?? false,
    isRecommended: values.isRecommended ?? false,
    optionSetVersion: values.optionSetVersion ?? 1,
    subtotal: values.subtotal ?? "0.00",
    taxRate: values.taxRate ?? "0.0000",
    taxAmount: values.taxAmount ?? "0.00",
    discountAmount: values.discountAmount ?? "0.00",
    total: values.total ?? "0.00",
    title: values.title ?? null,
    messageToCustomer: values.messageToCustomer ?? null,
    internalNotes: values.internalNotes ?? null,
    approvalToken: values.approvalToken ?? null,
    approvedAt: values.approvedAt ?? null,
    approvedByName: values.approvedByName ?? null,
    approvedSignatureUrl: values.approvedSignatureUrl ?? null,
    declinedAt: values.declinedAt ?? null,
    declineReason: values.declineReason ?? null,
    expiresAt: values.expiresAt ?? null,
    sentAt: values.sentAt ?? null,
    viewedAt: values.viewedAt ?? null,
    followUpSentAt: values.followUpSentAt ?? null,
    financingOffered: values.financingOffered ?? false,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createEstimateItemRecord(
  values: Partial<TestEstimateItemRecord> &
    Pick<TestEstimateItemRecord, "companyId" | "estimateId" | "name">
): TestEstimateItemRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    estimateId: values.estimateId,
    companyId: values.companyId,
    productCatalogId: values.productCatalogId ?? null,
    name: values.name,
    description: values.description ?? null,
    itemType: values.itemType ?? "service",
    quantity: values.quantity ?? "1.000",
    unitPrice: values.unitPrice ?? "0.00",
    total: values.total ?? "0.00",
    isTaxable: values.isTaxable ?? true,
    sortOrder: values.sortOrder ?? 0,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createInvoiceRecord(
  values: Partial<TestInvoiceRecord> &
    Pick<TestInvoiceRecord, "companyId" | "customerId">
): TestInvoiceRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    invoiceNumber: values.invoiceNumber ?? `INV-${String(state.invoices.length + 1).padStart(4, "0")}`,
    jobId: values.jobId ?? null,
    estimateId: values.estimateId ?? null,
    customerId: values.customerId,
    createdById: values.createdById ?? null,
    status: values.status ?? "draft",
    subtotal: values.subtotal ?? "0.00",
    taxRate: values.taxRate ?? "0.0000",
    taxAmount: values.taxAmount ?? "0.00",
    discountAmount: values.discountAmount ?? "0.00",
    total: values.total ?? "0.00",
    amountPaid: values.amountPaid ?? "0.00",
    balanceDue: values.balanceDue ?? values.total ?? "0.00",
    serviceFeeAmount: values.serviceFeeAmount ?? "0.00",
    bookingFeeAmount: values.bookingFeeAmount ?? "0.00",
    issuedAt: values.issuedAt ?? null,
    dueAt: values.dueAt ?? null,
    sentAt: values.sentAt ?? null,
    viewedAt: values.viewedAt ?? null,
    paidAt: values.paidAt ?? null,
    stripePaymentLinkId: values.stripePaymentLinkId ?? null,
    stripePaymentLinkUrl: values.stripePaymentLinkUrl ?? null,
    paymentToken: values.paymentToken ?? null,
    reminder1SentAt: values.reminder1SentAt ?? null,
    reminder2SentAt: values.reminder2SentAt ?? null,
    reminder3SentAt: values.reminder3SentAt ?? null,
    title: values.title ?? null,
    messageToCustomer: values.messageToCustomer ?? null,
    internalNotes: values.internalNotes ?? null,
    sourceSystem: values.sourceSystem ?? null,
    sourceId: values.sourceId ?? null,
    importSessionId: values.importSessionId ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createInvoiceItemRecord(
  values: Partial<TestInvoiceItemRecord> &
    Pick<TestInvoiceItemRecord, "companyId" | "invoiceId" | "name">
): TestInvoiceItemRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    invoiceId: values.invoiceId,
    companyId: values.companyId,
    productCatalogId: values.productCatalogId ?? null,
    name: values.name,
    description: values.description ?? null,
    itemType: values.itemType ?? "service",
    quantity: values.quantity ?? "1.000",
    unitPrice: values.unitPrice ?? "0.00",
    total: values.total ?? "0.00",
    isTaxable: values.isTaxable ?? true,
    sortOrder: values.sortOrder ?? 0,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createPaymentRecord(
  values: Partial<TestPaymentRecord> &
    Pick<TestPaymentRecord, "companyId" | "invoiceId" | "customerId" | "amount">
): TestPaymentRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    invoiceId: values.invoiceId,
    customerId: values.customerId,
    collectedById: values.collectedById ?? null,
    amount: values.amount,
    serviceFeeAmount: values.serviceFeeAmount ?? "0.00",
    bookingFeeAmount: values.bookingFeeAmount ?? "0.00",
    feeRefundable: values.feeRefundable ?? false,
    amountRefunded: values.amountRefunded ?? "0.00",
    method: values.method ?? "card",
    status: values.status ?? "pending",
    stripePaymentIntentId: values.stripePaymentIntentId ?? null,
    stripeChargeId: values.stripeChargeId ?? null,
    checkNumber: values.checkNumber ?? null,
    referenceNumber: values.referenceNumber ?? null,
    notes: values.notes ?? null,
    paidAt: values.paidAt ?? null,
    sourceSystem: values.sourceSystem ?? null,
    sourceId: values.sourceId ?? null,
    importSessionId: values.importSessionId ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createJobNoteRecord(
  values: Partial<TestJobNoteRecord> &
    Pick<TestJobNoteRecord, "companyId" | "jobId" | "content">
): TestJobNoteRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    jobId: values.jobId,
    authorId: values.authorId ?? null,
    content: values.content,
    isInternal: values.isInternal ?? true,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createCustomerNoteRecord(
  values: Partial<TestCustomerNoteRecord> &
    Pick<TestCustomerNoteRecord, "companyId" | "customerId" | "content">
): TestCustomerNoteRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    customerId: values.customerId,
    authorId: values.authorId ?? null,
    content: values.content,
    isInternal: values.isInternal ?? true,
    notedAt: values.notedAt ?? null,
    sourceSystem: values.sourceSystem ?? null,
    sourceId: values.sourceId ?? null,
    importSessionId: values.importSessionId ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createJobPhotoRecord(
  values: Partial<TestJobPhotoRecord> &
    Pick<TestJobPhotoRecord, "companyId" | "jobId" | "url">
): TestJobPhotoRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    jobId: values.jobId,
    uploadedById: values.uploadedById ?? null,
    url: values.url,
    thumbnailUrl: values.thumbnailUrl ?? null,
    caption: values.caption ?? null,
    takenAt: values.takenAt ?? null,
    photoType: values.photoType ?? "general",
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createServiceAgreementTemplateRecord(
  values: Partial<TestServiceAgreementTemplateRecord> &
    Pick<TestServiceAgreementTemplateRecord, "companyId" | "name" | "visitsPerYear" | "frequency">
): TestServiceAgreementTemplateRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    name: values.name,
    description: values.description ?? null,
    includedServices: values.includedServices ?? [],
    visitsPerYear: values.visitsPerYear,
    frequency: values.frequency,
    monthlyPrice: values.monthlyPrice ?? null,
    annualPrice: values.annualPrice ?? null,
    stripeMthlyPriceId: values.stripeMthlyPriceId ?? null,
    stripeAnnualPriceId: values.stripeAnnualPriceId ?? null,
    sortOrder: values.sortOrder ?? 0,
    isActive: values.isActive ?? true,
    applicableAssetTypes: values.applicableAssetTypes ?? [],
    notes: values.notes ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createMaintenancePlanRecord(
  values: Partial<TestMaintenancePlanRecord> &
    Pick<TestMaintenancePlanRecord, "companyId" | "customerId">
): TestMaintenancePlanRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    customerId: values.customerId,
    propertyId: values.propertyId ?? null,
    serviceAgreementTemplateId: values.serviceAgreementTemplateId ?? null,
    vipTierId: values.vipTierId ?? null,
    name: values.name ?? "Maintenance Plan",
    description: values.description ?? null,
    includedServices: values.includedServices ?? [],
    assetIds: values.assetIds ?? [],
    status: values.status ?? "active",
    frequency: values.frequency ?? "quarterly",
    price: values.price ?? null,
    billingCycle: values.billingCycle ?? "annual",
    stripeSubscriptionId: values.stripeSubscriptionId ?? null,
    stripePriceId: values.stripePriceId ?? null,
    stripeCurrentPeriodStart: values.stripeCurrentPeriodStart ?? null,
    stripeCurrentPeriodEnd: values.stripeCurrentPeriodEnd ?? null,
    stripeCancelAtPeriodEnd: values.stripeCancelAtPeriodEnd ?? false,
    startDate: values.startDate ?? now.toISOString().slice(0, 10),
    endDate: values.endDate ?? null,
    nextServiceDate: values.nextServiceDate ?? null,
    lastServiceDate: values.lastServiceDate ?? null,
    notes: values.notes ?? null,
    sourceSystem: values.sourceSystem ?? null,
    sourceId: values.sourceId ?? null,
    importSessionId: values.importSessionId ?? null,
    deletedAt: values.deletedAt ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now
  };
}

function createMaintenanceVisitRecord(
  values: Partial<TestMaintenanceVisitRecord> &
    Pick<TestMaintenanceVisitRecord, "companyId" | "maintenancePlanId">
): TestMaintenanceVisitRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    maintenancePlanId: values.maintenancePlanId,
    jobId: values.jobId ?? null,
    scheduledDate: values.scheduledDate ?? null,
    completedDate: values.completedDate ?? null,
    notes: values.notes ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}


function createRecurringVisitSeriesRecord(
  values: Partial<TestRecurringVisitSeriesRecord> &
    Pick<TestRecurringVisitSeriesRecord, "companyId" | "customerId" | "timeZone" | "frequency" | "anchorLocalDate">
): TestRecurringVisitSeriesRecord {
  const now = new Date();
  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    customerId: values.customerId,
    propertyId: values.propertyId ?? null,
    maintenancePlanId: values.maintenancePlanId ?? null,
    anchorMaintenanceVisitId: values.anchorMaintenanceVisitId ?? null,
    timeZone: values.timeZone,
    frequency: values.frequency,
    anchorLocalDate: values.anchorLocalDate,
    localTime: values.localTime ?? "09:00",
    status: values.status ?? "active",
    externalSchedulerAuthoritative: values.externalSchedulerAuthoritative ?? false,
    notes: values.notes ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createRecurringVisitOccurrenceRecord(
  values: Partial<TestRecurringVisitOccurrenceRecord> &
    Pick<
      TestRecurringVisitOccurrenceRecord,
      "companyId" | "seriesId" | "occurrenceIndex" | "scheduledLocalDate" | "scheduledAtUtc"
    >
): TestRecurringVisitOccurrenceRecord {
  const now = new Date();
  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    seriesId: values.seriesId,
    occurrenceIndex: values.occurrenceIndex,
    scheduledLocalDate: values.scheduledLocalDate,
    scheduledAtUtc: values.scheduledAtUtc,
    status: values.status ?? "scheduled",
    overrideScheduledLocalDate: values.overrideScheduledLocalDate ?? null,
    overrideNotes: values.overrideNotes ?? null,
    maintenanceVisitId: values.maintenanceVisitId ?? null,
    jobId: values.jobId ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createAutomationRuleRecord(
  values: Partial<TestAutomationRuleRecord> &
    Pick<TestAutomationRuleRecord, "companyId" | "ruleType">
): TestAutomationRuleRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    ruleType: values.ruleType,
    isEnabled: values.isEnabled ?? false,
    delayHours: values.delayHours ?? null,
    thresholdDays: values.thresholdDays ?? null,
    config: values.config ?? {},
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createAiRecommendationRecord(
  values: Partial<TestAiRecommendationRecord> &
    Pick<TestAiRecommendationRecord, "companyId" | "type" | "headline" | "body">
): TestAiRecommendationRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    type: values.type,
    status: values.status ?? "pending",
    customerId: values.customerId ?? null,
    propertyId: values.propertyId ?? null,
    assetId: values.assetId ?? null,
    jobId: values.jobId ?? null,
    estimateId: values.estimateId ?? null,
    invoiceId: values.invoiceId ?? null,
    estimatedRevenue: values.estimatedRevenue ?? null,
    headline: values.headline,
    body: values.body,
    suggestedAction: values.suggestedAction ?? null,
    suggestedMessage: values.suggestedMessage ?? null,
    urgencyScore: values.urgencyScore ?? null,
    confidenceScore: values.confidenceScore ?? null,
    actionedAt: values.actionedAt ?? null,
    actionedById: values.actionedById ?? null,
    dismissedAt: values.dismissedAt ?? null,
    snoozedUntil: values.snoozedUntil ?? null,
    expiresAt: values.expiresAt ?? null,
    sourceEventIds: values.sourceEventIds ?? [],
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createCampaignRecord(
  values: Partial<TestCampaignRecord> &
    Pick<TestCampaignRecord, "companyId" | "type" | "name">
): TestCampaignRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    createdById: values.createdById ?? null,
    type: values.type,
    status: values.status ?? "draft",
    name: values.name,
    subject: values.subject ?? null,
    body: values.body ?? "",
    channel: values.channel ?? "sms",
    isAiGenerated: values.isAiGenerated ?? false,
    aiRecommendationId: values.aiRecommendationId ?? null,
    scheduledAt: values.scheduledAt ?? null,
    sentAt: values.sentAt ?? null,
    recipientCount: values.recipientCount ?? 0,
    deliveredCount: values.deliveredCount ?? 0,
    openedCount: values.openedCount ?? 0,
    repliedCount: values.repliedCount ?? 0,
    convertedCount: values.convertedCount ?? 0,
    revenueAttributed: values.revenueAttributed ?? "0.00",
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createCampaignRecipientRecord(
  values: Partial<TestCampaignRecipientRecord> &
    Pick<TestCampaignRecipientRecord, "campaignId" | "customerId" | "companyId">
): TestCampaignRecipientRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    campaignId: values.campaignId,
    customerId: values.customerId,
    companyId: values.companyId,
    sentAt: values.sentAt ?? null,
    deliveredAt: values.deliveredAt ?? null,
    openedAt: values.openedAt ?? null,
    repliedAt: values.repliedAt ?? null,
    convertedAt: values.convertedAt ?? null,
    conversionJobId: values.conversionJobId ?? null,
    sentToPhone: values.sentToPhone ?? null,
    sentToEmail: values.sentToEmail ?? null,
    unsubscribedAt: values.unsubscribedAt ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createMessageLogRecord(
  values: Partial<TestMessageLogRecord> &
    Pick<TestMessageLogRecord, "companyId" | "channel" | "direction" | "toAddress" | "body">
): TestMessageLogRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    customerId: values.customerId ?? null,
    jobId: values.jobId ?? null,
    campaignId: values.campaignId ?? null,
    channel: values.channel,
    direction: values.direction,
    toAddress: values.toAddress,
    fromAddress: values.fromAddress ?? null,
    subject: values.subject ?? null,
    body: values.body,
    providerMessageId: values.providerMessageId ?? null,
    providerStatus: values.providerStatus ?? null,
    sentAt: values.sentAt ?? null,
    deliveredAt: values.deliveredAt ?? null,
    failedAt: values.failedAt ?? null,
    failureReason: values.failureReason ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createProductCatalogRecord(
  values: Partial<TestProductCatalogRecord> &
    Pick<TestProductCatalogRecord, "companyId" | "name">
): TestProductCatalogRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    name: values.name,
    description: values.description ?? null,
    category: values.category ?? "service",
    sku: values.sku ?? null,
    unitPrice: values.unitPrice ?? "0.00",
    cost: values.cost ?? null,
    unit: values.unit ?? "each",
    isTaxable: values.isTaxable ?? true,
    isActive: values.isActive ?? true,
    applicableAssetTypes: values.applicableAssetTypes ?? [],
    sortOrder: values.sortOrder ?? 0,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createTechnicianRecord(
  values: Partial<TestTechnicianRecord> &
    Pick<TestTechnicianRecord, "companyId" | "firstName" | "lastName" | "phone">
): TestTechnicianRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    userId: values.userId ?? null,
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email ?? null,
    phone: values.phone,
    avatarUrl: values.avatarUrl ?? null,
    skills: values.skills ?? [],
    serviceAreaIds: values.serviceAreaIds ?? [],
    serviceZipCodes: values.serviceZipCodes ?? [],
    availableDays: values.availableDays ?? ["mon", "tue", "wed", "thu", "fri"],
    hoursPerDay: values.hoursPerDay ?? "8",
    totalJobsCompleted: values.totalJobsCompleted ?? 0,
    avgJobDurationMinutes: values.avgJobDurationMinutes ?? null,
    estimateCloseRate: values.estimateCloseRate ?? null,
    avgTicketValue: values.avgTicketValue ?? null,
    status: values.status ?? "active",
    calendarColor: values.calendarColor ?? "#6366f1",
    notes: values.notes ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createJobTaskRecord(
  values: Partial<TestJobTaskRecord> &
    Pick<TestJobTaskRecord, "companyId" | "jobId" | "title">
): TestJobTaskRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    jobId: values.jobId,
    assignedToId: values.assignedToId ?? null,
    title: values.title,
    description: values.description ?? null,
    status: values.status ?? "pending",
    isRequired: values.isRequired ?? false,
    completedAt: values.completedAt ?? null,
    completedById: values.completedById ?? null,
    estimatedMinutes: values.estimatedMinutes ?? null,
    actualMinutes: values.actualMinutes ?? null,
    sortOrder: values.sortOrder ?? 0,
    notes: values.notes ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createJobProductRecord(
  values: Partial<TestJobProductRecord> &
    Pick<TestJobProductRecord, "companyId" | "jobId" | "name" | "unitPrice" | "total">
): TestJobProductRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    jobId: values.jobId,
    productCatalogId: values.productCatalogId ?? null,
    name: values.name,
    description: values.description ?? null,
    category: values.category ?? "service",
    quantity: values.quantity ?? "1.000",
    unitPrice: values.unitPrice,
    total: values.total,
    isTaxable: values.isTaxable ?? true,
    addedById: values.addedById ?? null,
    isUpsell: values.isUpsell ?? false,
    upsellApproved: values.upsellApproved ?? false,
    upsellApprovedAt: values.upsellApprovedAt ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createScheduleSlotRecord(
  values: Partial<TestScheduleSlotRecord> &
    Pick<TestScheduleSlotRecord, "companyId" | "technicianId" | "startTime" | "endTime">
): TestScheduleSlotRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    technicianId: values.technicianId,
    jobId: values.jobId ?? null,
    isBlockedTime: values.isBlockedTime ?? false,
    blockReason: values.blockReason ?? null,
    startTime: values.startTime,
    endTime: values.endTime,
    travelMinutesBefore: values.travelMinutesBefore ?? 0,
    isConfirmed: values.isConfirmed ?? false,
    notes: values.notes ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createActivityEventRecord(
  values: Partial<TestActivityEventRecord> &
    Pick<TestActivityEventRecord, "companyId" | "eventType" | "entityType" | "entityId" | "summary">
): TestActivityEventRecord {
  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    eventType: values.eventType,
    actorId: values.actorId ?? null,
    actorType: values.actorType ?? "user",
    actorName: values.actorName ?? null,
    entityType: values.entityType,
    entityId: values.entityId,
    customerId: values.customerId ?? null,
    jobId: values.jobId ?? null,
    estimateId: values.estimateId ?? null,
    invoiceId: values.invoiceId ?? null,
    payload: values.payload ?? {},
    summary: values.summary,
    occurredAt: values.occurredAt ?? new Date()
  };
}

function createTimeEntryRecord(
  values: Partial<TestTimeEntryRecord> &
    Pick<TestTimeEntryRecord, "companyId" | "jobId" | "technicianId" | "startedAt">
): TestTimeEntryRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    jobId: values.jobId,
    technicianId: values.technicianId,
    startedAt: values.startedAt,
    endedAt: values.endedAt ?? null,
    durationMinutes: values.durationMinutes ?? null,
    entryType: values.entryType ?? "on_site",
    notes: values.notes ?? null,
    travelFromAddress: values.travelFromAddress ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createReviewRequestRecord(
  values: Partial<TestReviewRequestRecord> &
    Pick<TestReviewRequestRecord, "companyId" | "customerId">
): TestReviewRequestRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    jobId: values.jobId ?? null,
    customerId: values.customerId,
    technicianId: values.technicianId ?? null,
    referenceId: values.referenceId ?? nextId(),
    status: values.status ?? "pending",
    channel: values.channel ?? "sms",
    reviewUrl: values.reviewUrl ?? null,
    sentAt: values.sentAt ?? null,
    clickedAt: values.clickedAt ?? null,
    completedAt: values.completedAt ?? null,
    rating: values.rating ?? null,
    reviewText: values.reviewText ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createFileAttachmentRecord(
  values: Partial<TestFileAttachmentRecord> &
    Pick<TestFileAttachmentRecord, "companyId" | "entityType" | "entityId" | "fileName" | "fileUrl">
): TestFileAttachmentRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    entityType: values.entityType,
    entityId: values.entityId,
    jobId: values.jobId ?? null,
    customerId: values.customerId ?? null,
    uploadedById: values.uploadedById ?? null,
    fileName: values.fileName,
    fileUrl: values.fileUrl,
    thumbnailUrl: values.thumbnailUrl ?? null,
    mimeType: values.mimeType ?? null,
    fileSizeBytes: values.fileSizeBytes ?? null,
    fileType: values.fileType ?? "photo",
    caption: values.caption ?? null,
    photoType: values.photoType ?? "general",
    takenAt: values.takenAt ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createOnTheWayNotificationRecord(
  values: Partial<TestOnTheWayNotificationRecord> &
    Pick<TestOnTheWayNotificationRecord, "companyId" | "jobId" | "technicianId" | "customerId">
): TestOnTheWayNotificationRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    jobId: values.jobId,
    technicianId: values.technicianId,
    customerId: values.customerId,
    sentAt: values.sentAt ?? null,
    channel: values.channel ?? "sms",
    message: values.message ?? null,
    estimatedArrivalMinutes: values.estimatedArrivalMinutes ?? null,
    technicianLat: values.technicianLat ?? null,
    technicianLng: values.technicianLng ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createBookingRequestRecord(
  values: Partial<TestBookingRequestRecord> &
    Pick<
      TestBookingRequestRecord,
      "companyId" | "firstName" | "lastName" | "phone" | "addressLine1" | "city" | "state" | "zip"
    >
): TestBookingRequestRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    customerId: values.customerId ?? null,
    jobId: values.jobId ?? null,
    assignedTechnicianId: values.assignedTechnicianId ?? null,
    firstName: values.firstName,
    lastName: values.lastName,
    phone: values.phone,
    email: values.email ?? null,
    addressLine1: values.addressLine1,
    addressLine2: values.addressLine2 ?? null,
    city: values.city,
    state: values.state,
    zip: values.zip,
    propertyType: values.propertyType ?? "residential",
    serviceCategory: values.serviceCategory ?? null,
    serviceType: values.serviceType ?? null,
    serviceDetail: values.serviceDetail ?? null,
    urgency: values.urgency ?? "this_week",
    customerNotes: values.customerNotes ?? null,
    preferredDate: values.preferredDate ?? null,
    preferredWindow: values.preferredWindow ?? null,
    status: values.status ?? "pending",
    source: values.source ?? "direct",
    referenceNumber: values.referenceNumber ?? null,
    isPropertyOwner: values.isPropertyOwner ?? false,
    smsConsentAppointments: values.smsConsentAppointments ?? false,
    smsConsentMarketing: values.smsConsentMarketing ?? false,
    leadAttribution: values.leadAttribution ?? null,
    confirmedAt: values.confirmedAt ?? null,
    confirmedById: values.confirmedById ?? null,
    confirmationSentAt: values.confirmationSentAt ?? null,
    cancelledAt: values.cancelledAt ?? null,
    cancellationReason: values.cancellationReason ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createBookingSettingsRecord(
  values: Partial<TestBookingSettingsRecord> & Pick<TestBookingSettingsRecord, "companyId">
): TestBookingSettingsRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    isEnabled: values.isEnabled ?? false,
    bookingSlug: values.bookingSlug ?? null,
    offeredServices: values.offeredServices ?? [],
    availableHoursStart: values.availableHoursStart ?? 8,
    availableHoursEnd: values.availableHoursEnd ?? 17,
    availableDays: values.availableDays ?? ["mon", "tue", "wed", "thu", "fri"],
    slotDuration: values.slotDuration ?? 2,
    maxAdvanceDays: values.maxAdvanceDays ?? 14,
    autoConfirm: values.autoConfirm ?? false,
    googleReviewUrl: values.googleReviewUrl ?? null,
    yelpReviewUrl: values.yelpReviewUrl ?? null,
    facebookReviewUrl: values.facebookReviewUrl ?? null,
    customReviewUrl: values.customReviewUrl ?? null,
    tagline: values.tagline ?? null,
    allowZipOverflow: values.allowZipOverflow ?? false,
    balanceWorkload: values.balanceWorkload ?? true,
    notifyOnNewBooking: values.notifyOnNewBooking ?? true,
    notificationEmail: values.notificationEmail ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createServiceAreaRecord(
  values: Partial<TestServiceAreaRecord> & Pick<TestServiceAreaRecord, "companyId" | "name">
): TestServiceAreaRecord {
  const now = new Date();
  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    name: values.name,
    zips: values.zips ?? [],
    notes: values.notes ?? null,
    isActive: values.isActive ?? true,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

export function seedServiceArea(
  values: Partial<TestServiceAreaRecord> & Pick<TestServiceAreaRecord, "companyId" | "name">
): TestServiceAreaRecord {
  const record = createServiceAreaRecord(values);
  state.serviceAreas.push(record);
  return record;
}

function createInquirySubmitIdempotencyRecord(
  values: Partial<TestInquirySubmitIdempotencyRecord> &
    Pick<
      TestInquirySubmitIdempotencyRecord,
      "companyId" | "idempotencyKey" | "payloadHash" | "bookingRequestId" | "responseSnapshot" | "expiresAt"
    >
): TestInquirySubmitIdempotencyRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    idempotencyKey: values.idempotencyKey,
    payloadHash: values.payloadHash,
    bookingRequestId: values.bookingRequestId,
    responseSnapshot: values.responseSnapshot,
    expiresAt: values.expiresAt,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createFieldSyncBatchRecord(
  values: Partial<TestFieldSyncBatchRecord> &
    Pick<TestFieldSyncBatchRecord, "companyId" | "userId" | "deviceId" | "batchClientId">
): TestFieldSyncBatchRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    userId: values.userId,
    deviceId: values.deviceId,
    batchClientId: values.batchClientId,
    status: values.status ?? "open",
    lastAcknowledgedSequence: values.lastAcknowledgedSequence ?? 0,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createFieldSyncOperationRecord(
  values: Partial<TestFieldSyncOperationRecord> &
    Pick<
      TestFieldSyncOperationRecord,
      | "companyId"
      | "batchId"
      | "sequence"
      | "clientOperationId"
      | "jobId"
      | "operationType"
      | "requestPayload"
      | "outcome"
      | "payloadHash"
    >
): TestFieldSyncOperationRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    batchId: values.batchId,
    sequence: values.sequence,
    clientOperationId: values.clientOperationId,
    jobId: values.jobId,
    operationType: values.operationType,
    requestPayload: values.requestPayload,
    outcome: values.outcome,
    resultPayload: values.resultPayload ?? {},
    payloadHash: values.payloadHash,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createAgentActionRecord(
  values: Partial<TestAgentActionRecord> &
    Pick<
      TestAgentActionRecord,
      | "companyId"
      | "agentProduct"
      | "actionType"
      | "target"
      | "idempotencyKey"
      | "payloadHash"
      | "policyVersion"
      | "requiresApproval"
      | "state"
      | "expiresAt"
    >
): TestAgentActionRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    agentProduct: values.agentProduct,
    actionType: values.actionType,
    parameters: values.parameters ?? {},
    target: values.target,
    sourceEventIds: values.sourceEventIds ?? [],
    idempotencyKey: values.idempotencyKey,
    payloadHash: values.payloadHash,
    policyVersion: values.policyVersion,
    requiresApproval: values.requiresApproval,
    state: values.state,
    confidence: values.confidence ?? null,
    reason: values.reason ?? null,
    expiresAt: values.expiresAt,
    reviewerId: values.reviewerId ?? null,
    executionReceipt: values.executionReceipt ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createGrowthIntakeCheckRecord(
  values: Partial<TestGrowthIntakeCheckRecord> &
    Pick<TestGrowthIntakeCheckRecord, "companyId" | "ownerUserId" | "createdById" | "businessName">
): TestGrowthIntakeCheckRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    status: values.status ?? "queued",
    ownerUserId: values.ownerUserId,
    createdById: values.createdById,
    reviewNeeded: values.reviewNeeded ?? false,
    lastScanAt: values.lastScanAt ?? null,
    businessName: values.businessName,
    websiteUrl: values.websiteUrl ?? null,
    industry: values.industry ?? null,
    trade: values.trade ?? null,
    city: values.city ?? null,
    state: values.state ?? null,
    zip: values.zip ?? null,
    contactName: values.contactName ?? null,
    contactEmail: values.contactEmail ?? null,
    contactPhone: values.contactPhone ?? null,
    targetMarket: values.targetMarket ?? null,
    googleBusinessProfileUrl: values.googleBusinessProfileUrl ?? null,
    facebookPageUrl: values.facebookPageUrl ?? null,
    intakeNotes: values.intakeNotes ?? null,
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createGrowthIntakeIdentityCandidateRecord(
  values: Partial<TestGrowthIntakeIdentityCandidateRecord> &
    Pick<TestGrowthIntakeIdentityCandidateRecord, "companyId" | "growthIntakeCheckId" | "displayName">
): TestGrowthIntakeIdentityCandidateRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    growthIntakeCheckId: values.growthIntakeCheckId,
    displayName: values.displayName,
    domain: values.domain ?? null,
    source: values.source ?? "manual",
    confidenceScore: values.confidenceScore ?? null,
    isPrimary: values.isPrimary ?? false,
    metadata: values.metadata ?? {},
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createGrowthIntakeFindingRecord(
  values: Partial<TestGrowthIntakeFindingRecord> &
    Pick<TestGrowthIntakeFindingRecord, "companyId" | "growthIntakeCheckId" | "category" | "title">
): TestGrowthIntakeFindingRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    growthIntakeCheckId: values.growthIntakeCheckId,
    category: values.category,
    severity: values.severity ?? "info",
    status: values.status ?? "open",
    title: values.title,
    description: values.description ?? null,
    recommendation: values.recommendation ?? null,
    evidence: values.evidence ?? {},
    createdAt: values.createdAt ?? now,
    updatedAt: values.updatedAt ?? now,
    deletedAt: values.deletedAt ?? null
  };
}

function createGrowthIntakeAuditEventRecord(
  values: Partial<TestGrowthIntakeAuditEventRecord> &
    Pick<
      TestGrowthIntakeAuditEventRecord,
      "companyId" | "entityType" | "entityId" | "action"
    >
): TestGrowthIntakeAuditEventRecord {
  const now = new Date();

  return {
    id: values.id ?? nextId(),
    companyId: values.companyId,
    entityType: values.entityType,
    entityId: values.entityId,
    growthIntakeCheckId: values.growthIntakeCheckId ?? null,
    action: values.action,
    actorId: values.actorId ?? null,
    beforeState: values.beforeState ?? null,
    afterState: values.afterState ?? null,
    createdAt: values.createdAt ?? now
  };
}

function createRow(tableName: TableName, values: Record<string, unknown>): AnyTestRecord {
  switch (tableName) {
    case "companies":
      return createCompanyRecord(values as Partial<TestCompanyRecord> & Pick<TestCompanyRecord, "name" | "slug">);
    case "users":
      return createUserRecord(
        values as Partial<TestUserRecord> & Pick<TestUserRecord, "companyId" | "email" | "firstName" | "lastName">
      );
    case "refreshTokens":
      return createRefreshTokenRecord(
        values as Partial<TestRefreshTokenRecord> &
          Pick<TestRefreshTokenRecord, "companyId" | "userId" | "tokenHash" | "expiresAt">
      );
    case "customers":
      return createCustomerRecord(
        values as Partial<TestCustomerRecord> & Pick<TestCustomerRecord, "companyId" | "firstName" | "lastName">
      );
    case "properties":
      return createPropertyRecord(
        values as Partial<TestPropertyRecord> &
          Pick<TestPropertyRecord, "companyId" | "customerId" | "addressLine1" | "city" | "state" | "zip">
      );
    case "assets":
      return createAssetRecord(
        values as Partial<TestAssetRecord> &
          Pick<TestAssetRecord, "companyId" | "customerId" | "propertyId" | "name" | "assetType">
      );
    case "jobs":
      return createJobRecord(values as Partial<TestJobRecord> & Pick<TestJobRecord, "companyId" | "customerId">);
    case "importSessions":
      return createImportSessionRecord(
        values as Partial<TestImportSessionRecord> &
          Pick<TestImportSessionRecord, "companyId" | "fileName" | "fileUrl">
      );
    case "importBundles":
      return seedImportBundle(
        values as Partial<Parameters<typeof seedImportBundle>[0]> &
          Pick<Parameters<typeof seedImportBundle>[0], "companyId">
      ) as unknown as AnyTestRecord;
    case "savedCardMigrations":
      return seedSavedCardMigration(
        values as Partial<Parameters<typeof seedSavedCardMigration>[0]> &
          Pick<Parameters<typeof seedSavedCardMigration>[0], "companyId" | "priorProcessorName">
      ) as unknown as AnyTestRecord;
    case "importChunkRuns":
      return createImportChunkRunRecord(
        values as Partial<TestImportChunkRunRecord> &
          Pick<
            TestImportChunkRunRecord,
            | "companyId"
            | "importSessionId"
            | "entityType"
            | "chunkIndex"
            | "chunksTotal"
            | "idempotencyKey"
          >
      );
    case "dataExportSessions":
      return createDataExportSessionRecord(
        values as Partial<TestDataExportSessionRecord> & Pick<TestDataExportSessionRecord, "companyId">
      );
    case "estimates":
      return createEstimateRecord(
        values as Partial<TestEstimateRecord> & Pick<TestEstimateRecord, "companyId" | "customerId">
      );
    case "estimateItems":
      return createEstimateItemRecord(
        values as Partial<TestEstimateItemRecord> &
          Pick<TestEstimateItemRecord, "companyId" | "estimateId" | "name">
      );
    case "invoices":
      return createInvoiceRecord(
        values as Partial<TestInvoiceRecord> & Pick<TestInvoiceRecord, "companyId" | "customerId">
      );
    case "invoiceItems":
      return createInvoiceItemRecord(
        values as Partial<TestInvoiceItemRecord> &
          Pick<TestInvoiceItemRecord, "companyId" | "invoiceId" | "name">
      );
    case "payments":
      return createPaymentRecord(
        values as Partial<TestPaymentRecord> &
          Pick<TestPaymentRecord, "companyId" | "invoiceId" | "customerId" | "amount">
      );
    case "jobNotes":
      return createJobNoteRecord(
        values as Partial<TestJobNoteRecord> & Pick<TestJobNoteRecord, "companyId" | "jobId" | "content">
      );
    case "customerNotes":
      return createCustomerNoteRecord(
        values as Partial<TestCustomerNoteRecord> &
          Pick<TestCustomerNoteRecord, "companyId" | "customerId" | "content">
      );
    case "jobPhotos":
      return createJobPhotoRecord(
        values as Partial<TestJobPhotoRecord> & Pick<TestJobPhotoRecord, "companyId" | "jobId" | "url">
      );
    case "serviceAgreementTemplates":
      return createServiceAgreementTemplateRecord(
        values as Partial<TestServiceAgreementTemplateRecord> &
          Pick<TestServiceAgreementTemplateRecord, "companyId" | "name" | "visitsPerYear" | "frequency">
      );
    case "maintenancePlans":
      return createMaintenancePlanRecord(
        values as Partial<TestMaintenancePlanRecord> & Pick<TestMaintenancePlanRecord, "companyId" | "customerId">
      );
    case "vipMembershipTiers": {
      const record: TestVipMembershipTierRecord = {
        id: randomUUID(),
        companyId: String(values.companyId),
        name: String(values.name ?? "VIP"),
        description: (values.description as string | null | undefined) ?? null,
        monthlyPrice: String(values.monthlyPrice ?? "0.00"),
        discountPercent: String(values.discountPercent ?? "0"),
        includedVisitsPerMonth: (values.includedVisitsPerMonth as number | null | undefined) ?? null,
        stripeMonthlyPriceId: (values.stripeMonthlyPriceId as string | null | undefined) ?? null,
        sortOrder: (values.sortOrder as number | null | undefined) ?? 0,
        isActive: (values.isActive as boolean | undefined) ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      };
      state.vipMembershipTiers.push(record);
      return record;
    }
    case "recurringVisitSeries":
      return createRecurringVisitSeriesRecord(
        values as Partial<TestRecurringVisitSeriesRecord> &
          Pick<TestRecurringVisitSeriesRecord, "companyId" | "customerId" | "timeZone" | "frequency" | "anchorLocalDate">
      );
    case "recurringVisitOccurrences":
      return createRecurringVisitOccurrenceRecord(
        values as Partial<TestRecurringVisitOccurrenceRecord> &
          Pick<
            TestRecurringVisitOccurrenceRecord,
            "companyId" | "seriesId" | "occurrenceIndex" | "scheduledLocalDate" | "scheduledAtUtc"
          >
      );
    case "maintenanceVisits":
      return createMaintenanceVisitRecord(
        values as Partial<TestMaintenanceVisitRecord> &
          Pick<TestMaintenanceVisitRecord, "companyId" | "maintenancePlanId">
      );
    case "automationRules":
      return createAutomationRuleRecord(
        values as Partial<TestAutomationRuleRecord> &
          Pick<TestAutomationRuleRecord, "companyId" | "ruleType">
      );
    case "aiRecommendations":
      return createAiRecommendationRecord(
        values as Partial<TestAiRecommendationRecord> &
          Pick<TestAiRecommendationRecord, "companyId" | "type" | "headline" | "body">
      );
    case "campaigns":
      return createCampaignRecord(
        values as Partial<TestCampaignRecord> &
          Pick<TestCampaignRecord, "companyId" | "type" | "name">
      );
    case "campaignRecipients":
      return createCampaignRecipientRecord(
        values as Partial<TestCampaignRecipientRecord> &
          Pick<TestCampaignRecipientRecord, "campaignId" | "customerId" | "companyId">
      );
    case "messageLogs":
      return createMessageLogRecord(
        values as Partial<TestMessageLogRecord> &
          Pick<TestMessageLogRecord, "companyId" | "channel" | "direction" | "toAddress" | "body">
      );
    case "stockLocations":
      return createStockLocationRecord(values as Partial<TestStockLocationRecord> & Pick<TestStockLocationRecord, "companyId" | "name" | "kind">);
    case "stockLevels":
      return createStockLevelRecord(values as Partial<TestStockLevelRecord> & Pick<TestStockLevelRecord, "companyId" | "locationId" | "productId">);
    case "callTrackingSettings":
      return createCallTrackingSettingsRecord(values as Partial<TestCallTrackingSettingsRecord> & Pick<TestCallTrackingSettingsRecord, "companyId">);
    case "callTrackingNumbers":
      return createCallTrackingNumberRecord(values as Partial<TestCallTrackingNumberRecord> & Pick<TestCallTrackingNumberRecord, "companyId" | "trackingNumber">);
    case "callRecords":
      return createCallRecordRecord(values as Partial<TestCallRecordRecord> & Pick<TestCallRecordRecord, "companyId" | "trackingNumberId" | "providerCallId">);
    case "growthCheckScans":
      return createGrowthCheckScanRecord(values as Partial<TestGrowthCheckScanRecord> & Pick<TestGrowthCheckScanRecord, "companyId">);
    case "growthCheckFindings":
      return createGrowthCheckFindingRecord(values as Partial<TestGrowthCheckFindingRecord> & Pick<TestGrowthCheckFindingRecord, "companyId" | "scanId">);
    case "growthCheckFindingRevisions":
      return createGrowthCheckFindingRevisionRecord(
        values as Partial<TestGrowthCheckFindingRevisionRecord> &
          Pick<TestGrowthCheckFindingRevisionRecord, "companyId" | "findingId" | "scanId" | "revision" | "action">
      );
    case "growthCheckReportDrafts":
      return createGrowthCheckReportDraftRecord(values as Partial<TestGrowthCheckReportDraftRecord> & Pick<TestGrowthCheckReportDraftRecord, "companyId" | "scanId" | "content">);
    case "growthCheckReportDraftRevisions":
      return createGrowthCheckReportDraftRevisionRecord(values as Partial<TestGrowthCheckReportDraftRevisionRecord> & Pick<TestGrowthCheckReportDraftRevisionRecord, "companyId" | "draftId" | "version" | "action" | "nextContent">);
    case "growthCheckReportShares":
      return createGrowthCheckReportShareRecord(values as Partial<TestGrowthCheckReportShareRecord> & Pick<TestGrowthCheckReportShareRecord, "companyId" | "draftId" | "draftVersion" | "contentHash" | "tokenHash">);
    case "stockMovements":
      return createStockMovementRecord(values as Partial<TestStockMovementRecord> & Pick<TestStockMovementRecord, "companyId" | "locationId" | "productId" | "kind" | "quantityDelta" | "quantityAfter">);
    case "productCatalog":
      return createProductCatalogRecord(
        values as Partial<TestProductCatalogRecord> &
          Pick<TestProductCatalogRecord, "companyId" | "name">
      );
    case "technicians":
      return createTechnicianRecord(
        values as Partial<TestTechnicianRecord> &
          Pick<TestTechnicianRecord, "companyId" | "firstName" | "lastName" | "phone">
      );
    case "jobTasks":
      return createJobTaskRecord(
        values as Partial<TestJobTaskRecord> &
          Pick<TestJobTaskRecord, "companyId" | "jobId" | "title">
      );
    case "jobProducts":
      return createJobProductRecord(
        values as Partial<TestJobProductRecord> &
          Pick<TestJobProductRecord, "companyId" | "jobId" | "name" | "unitPrice" | "total">
      );
    case "scheduleSlots":
      return createScheduleSlotRecord(
        values as Partial<TestScheduleSlotRecord> &
          Pick<TestScheduleSlotRecord, "companyId" | "technicianId" | "startTime" | "endTime">
      );
    case "activityEvents":
      return createActivityEventRecord(
        values as Partial<TestActivityEventRecord> &
          Pick<TestActivityEventRecord, "companyId" | "eventType" | "entityType" | "entityId" | "summary">
      );
    case "timesheets":
      return createTimesheetRecord(values as Partial<TestTimesheetRecord> & Pick<TestTimesheetRecord, "companyId" | "technicianId" | "periodStart" | "periodEnd">);
    case "timesheetAuditEvents":
      return createTimesheetAuditEventRecord(values as Partial<TestTimesheetAuditEventRecord> & Pick<TestTimesheetAuditEventRecord, "companyId" | "action">);
    case "technicianPayRates":
      return createTechnicianPayRateRecord(values as Partial<TestTechnicianPayRateRecord> & Pick<TestTechnicianPayRateRecord, "companyId" | "technicianId" | "hourlyRateCents" | "effectiveFrom">);
    case "timeEntries":
      return createTimeEntryRecord(
        values as Partial<TestTimeEntryRecord> &
          Pick<TestTimeEntryRecord, "companyId" | "jobId" | "technicianId" | "startedAt">
      );
    case "reviewRequests":
      return createReviewRequestRecord(
        values as Partial<TestReviewRequestRecord> &
          Pick<TestReviewRequestRecord, "companyId" | "customerId">
      );
    case "fileAttachments":
      return createFileAttachmentRecord(
        values as Partial<TestFileAttachmentRecord> &
          Pick<TestFileAttachmentRecord, "companyId" | "entityType" | "entityId" | "fileName" | "fileUrl">
      );
    case "onTheWayNotifications":
      return createOnTheWayNotificationRecord(
        values as Partial<TestOnTheWayNotificationRecord> &
          Pick<TestOnTheWayNotificationRecord, "companyId" | "jobId" | "technicianId" | "customerId">
      );
    case "bookingRequests":
      return createBookingRequestRecord(
        values as Partial<TestBookingRequestRecord> &
          Pick<
            TestBookingRequestRecord,
            "companyId" | "firstName" | "lastName" | "phone" | "addressLine1" | "city" | "state" | "zip"
          >
      );
    case "bookingSettings":
      return createBookingSettingsRecord(
        values as Partial<TestBookingSettingsRecord> & Pick<TestBookingSettingsRecord, "companyId">
      );
    case "serviceAreas": {
      const v = values as Partial<TestServiceAreaRecord> & Pick<TestServiceAreaRecord, "companyId" | "name">;
      return createServiceAreaRecord(v);
    }
    case "inquirySubmitIdempotency":
      return createInquirySubmitIdempotencyRecord(
        values as Partial<TestInquirySubmitIdempotencyRecord> &
          Pick<
            TestInquirySubmitIdempotencyRecord,
            "companyId" | "idempotencyKey" | "payloadHash" | "bookingRequestId" | "responseSnapshot" | "expiresAt"
          >
      );
    case "agentActions":
      return createAgentActionRecord(
        values as Partial<TestAgentActionRecord> &
          Pick<
            TestAgentActionRecord,
            | "companyId"
            | "agentProduct"
            | "actionType"
            | "target"
            | "idempotencyKey"
            | "payloadHash"
            | "policyVersion"
            | "requiresApproval"
            | "state"
            | "expiresAt"
          >
      );
    case "growthIntakeChecks":
      return createGrowthIntakeCheckRecord(
        values as Partial<TestGrowthIntakeCheckRecord> &
          Pick<TestGrowthIntakeCheckRecord, "companyId" | "ownerUserId" | "createdById" | "businessName">
      );
    case "growthIntakeIdentityCandidates":
      return createGrowthIntakeIdentityCandidateRecord(
        values as Partial<TestGrowthIntakeIdentityCandidateRecord> &
          Pick<TestGrowthIntakeIdentityCandidateRecord, "companyId" | "growthIntakeCheckId" | "displayName">
      );
    case "growthIntakeFindings":
      return createGrowthIntakeFindingRecord(
        values as Partial<TestGrowthIntakeFindingRecord> &
          Pick<TestGrowthIntakeFindingRecord, "companyId" | "growthIntakeCheckId" | "category" | "title">
      );
    case "growthIntakeAuditEvents":
      return createGrowthIntakeAuditEventRecord(
        values as Partial<TestGrowthIntakeAuditEventRecord> &
          Pick<TestGrowthIntakeAuditEventRecord, "companyId" | "entityType" | "entityId" | "action">
      );
    case "fieldSyncBatches":
      return createFieldSyncBatchRecord(
        values as Partial<TestFieldSyncBatchRecord> &
          Pick<TestFieldSyncBatchRecord, "companyId" | "userId" | "deviceId" | "batchClientId">
      );
    case "fieldSyncOperations":
      return createFieldSyncOperationRecord(
        values as Partial<TestFieldSyncOperationRecord> &
          Pick<
            TestFieldSyncOperationRecord,
            | "companyId"
            | "batchId"
            | "sequence"
            | "clientOperationId"
            | "jobId"
            | "operationType"
            | "requestPayload"
            | "outcome"
            | "payloadHash"
          >
      );
  }
}

function createSelectChain<T extends Record<string, unknown>>(rows: T[]) {
  let filteredRows = [...rows];

  const chain = {
    where(predicate: Predicate<T>) {
      filteredRows = filteredRows.filter(predicate);
      return chain;
    },
    orderBy(definition: OrderByDefinition, ...rest: OrderByDefinition[]) {
      filteredRows = sortRows(filteredRows, definition, ...rest);
      return chain;
    },
    limit(limitCount: number) {
      return Object.assign(Promise.resolve(filteredRows.slice(0, limitCount)), {
        offset: (offsetCount: number) => Promise.resolve(filteredRows.slice(offsetCount, offsetCount + limitCount))
      });
    },
    for(_lockStrength: string) {
      return chain;
    },
    then<TResult1 = T[], TResult2 = never>(
      onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) {
      return Promise.resolve(filteredRows).then(onfulfilled, onrejected);
    }
  };

  return chain;
}

/** Emulates the partial unique index time_entries_open_technician_idx (migration 0046). */
function assertOpenTimeEntryUnique(existingRows: AnyTestRecord[], incomingRows: AnyTestRecord[]): void {
  const existing = existingRows as unknown as Array<Record<string, unknown>>;
  const incoming = incomingRows as unknown as Array<Record<string, unknown>>;
  const isOpen = (row: Record<string, unknown>) => (row.endedAt === null || row.endedAt === undefined) && row.deletedAt == null;
  const keyOf = (row: Record<string, unknown>) => `${String(row.companyId)}:${String(row.technicianId)}`;
  const seen = new Set(existing.filter(isOpen).map(keyOf));
  for (const row of incoming) {
    if (!isOpen(row)) continue;
    const key = keyOf(row);
    if (seen.has(key)) {
      throw Object.assign(new Error('duplicate key value violates unique constraint "time_entries_open_technician_idx"'), {
        code: "23505",
        constraint: "time_entries_open_technician_idx"
      });
    }
    seen.add(key);
  }
}

function createInsertChain(tableName: TableName) {
  return {
    values(values: Record<string, unknown> | Array<Record<string, unknown>>) {
      const records = (Array.isArray(values) ? values : [values]).map((value) => createRow(tableName, value));
      const targetRows = getRows(tableName);
      if (tableName === "timeEntries") assertOpenTimeEntryUnique(targetRows, records);
      targetRows.push(...records);

      return {
        returning: () => Promise.resolve(records)
      };
    }
  };
}

function createUpdateChain<T extends Record<string, unknown>>(tableName: TableName) {
  return {
    set(values: Partial<T>) {
      return {
        where(predicate: Predicate<T>) {
          const rows = (getRows(tableName) as unknown as T[]).filter(predicate);

          for (const row of rows) {
            Object.assign(row, values);
          }

          return {
            returning: () => Promise.resolve(rows)
          };
        }
      };
    }
  };
}

const operators = {
  and<T>(...predicates: Array<Predicate<T>>): Predicate<T> {
    return (row: T) => predicates.every((predicate) => predicate(row));
  },
  eq<T>(field: keyof T, value: T[keyof T]): Predicate<T> {
    return (row: T) => row[field] === value;
  },
  isNull<T>(field: keyof T): Predicate<T> {
    return (row: T) => row[field] === null;
  }
};

type SelectFromChain = ReturnType<typeof createSelectChain<Record<string, unknown>>>;

function wrapSelectChainWithProjection<T extends Record<string, unknown>>(
  chain: ReturnType<typeof createSelectChain<T>>,
  projection: Record<string, unknown>
): SelectFromChain {
  const mapRows = (rows: T[]) => projectRows(rows, projection) as Array<Record<string, unknown>>;

  const wrapped: SelectFromChain = {
    where(predicate: Predicate<Record<string, unknown>>) {
      chain.where(predicate as Predicate<T>);
      return wrapped;
    },
    orderBy(definition: OrderByDefinition, ...rest: OrderByDefinition[]) {
      chain.orderBy(definition, ...rest);
      return wrapped;
    },
    limit(limitCount: number) {
      const limited = chain.limit(limitCount);
      return Object.assign(limited.then((rows) => mapRows(rows)), {
        offset: (offsetCount: number) => limited.offset(offsetCount).then((rows) => mapRows(rows))
      });
    },
    for(_lockStrength: string) {
      chain.for(_lockStrength);
      return wrapped;
    },
    then<TResult1 = Record<string, unknown>[], TResult2 = never>(
      onfulfilled?: ((value: Record<string, unknown>[]) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) {
      return chain.then((rows) => mapRows(rows)).then(onfulfilled, onrejected);
    }
  };

  return wrapped;
}

interface TestDb {
  select(projection?: Record<string, unknown>): {
    from(table: MockTable): SelectFromChain;
  };
  insert(table: MockTable): ReturnType<typeof createInsertChain>;
  update(table: MockTable): ReturnType<typeof createUpdateChain<Record<string, unknown>>>;
  transaction<T>(callback: (tx: TestDb) => Promise<T>): Promise<T>;
  query: {
    users: {
      findFirst(args: {
        where: (
          table: typeof usersTable,
          queryOperators: typeof operators
        ) => Predicate<TestUserRecord>;
      }): Promise<TestUserRecord | null>;
    };
    companies: {
      findFirst(args: {
        where: (
          table: typeof companiesTable,
          queryOperators: typeof operators
        ) => Predicate<TestCompanyRecord>;
      }): Promise<TestCompanyRecord | null>;
    };
    importSessions: {
      findFirst(args: {
        where: (
          table: typeof importSessionsTable,
          queryOperators: typeof operators
        ) => Predicate<TestImportSessionRecord>;
      }): Promise<TestImportSessionRecord | null>;
    };
    automationRules: {
      findFirst(args: {
        where: (
          table: typeof automationRulesTable,
          queryOperators: typeof operators
        ) => Predicate<TestAutomationRuleRecord>;
      }): Promise<TestAutomationRuleRecord | null>;
    };
  };
}

/** drizzle-orm `count()` in a select projection: collapses the matched rows into one `{ alias: n }` row. */
const COUNT_AGGREGATE_MARKER = { __aggregate: "count" } as const;

function projectRows<T extends Record<string, unknown>>(
  rows: T[],
  projection?: Record<string, unknown>
): Array<Record<string, unknown>> {
  if (!projection) {
    return rows;
  }

  const countAlias = Object.entries(projection).find(([, column]) => column === COUNT_AGGREGATE_MARKER)?.[0];
  if (countAlias) {
    return [{ [countAlias]: rows.length }];
  }

  return rows.map((row) => {
    const projected: Record<string, unknown> = {};

    for (const [alias, column] of Object.entries(projection)) {
      const fieldKey = resolveFieldKey(column);
      projected[alias] = row[fieldKey as keyof T];
    }

    return projected;
  });
}

export const db: TestDb = {
  select(projection?: Record<string, unknown>) {
    return {
      from(table: MockTable) {
        const chain = createSelectChain(getRows(table.__name) as unknown as Array<Record<string, unknown>>);

        if (!projection) {
          return chain;
        }

        return wrapSelectChainWithProjection(chain, projection);
      }
    };
  },
  insert(table: MockTable) {
    return createInsertChain(table.__name);
  },
  update(table: MockTable) {
    return createUpdateChain(table.__name);
  },
  async transaction<T>(callback: (tx: TestDb) => Promise<T>): Promise<T> {
    const snapshot = cloneState();

    try {
      return await callback(db);
    } catch (error) {
      restoreState(snapshot);
      throw error;
    }
  },
  query: {
    users: {
      async findFirst({
        where
      }: {
        where: (
          table: typeof usersTable,
          queryOperators: typeof operators
        ) => Predicate<TestUserRecord>;
      }): Promise<TestUserRecord | null> {
        const predicate = where(usersTable, operators);
        return state.users.find((row) => predicate(row)) ?? null;
      }
    },
    companies: {
      async findFirst({
        where
      }: {
        where: (
          table: typeof companiesTable,
          queryOperators: typeof operators
        ) => Predicate<TestCompanyRecord>;
      }): Promise<TestCompanyRecord | null> {
        const predicate = where(companiesTable, operators);
        return state.companies.find((row) => predicate(row)) ?? null;
      }
    },
    importSessions: {
      async findFirst({
        where
      }: {
        where: (
          table: typeof importSessionsTable,
          queryOperators: typeof operators
        ) => Predicate<TestImportSessionRecord>;
      }): Promise<TestImportSessionRecord | null> {
        const predicate = where(importSessionsTable, operators);
        return state.importSessions.find((row) => predicate(row)) ?? null;
      }
    },
    automationRules: {
      async findFirst({
        where
      }: {
        where: (
          table: typeof automationRulesTable,
          queryOperators: typeof operators
        ) => Predicate<TestAutomationRuleRecord>;
      }): Promise<TestAutomationRuleRecord | null> {
        const predicate = where(automationRulesTable, operators);
        return state.automationRules.find((row) => predicate(row)) ?? null;
      }
    }
  }
};

export const companies = companiesTable;
export const users = usersTable;
export const refreshTokens = refreshTokensTable;
export const customers = customersTable;
export const properties = propertiesTable;
export const assets = assetsTable;
export const jobs = jobsTable;
export const importSessions = importSessionsTable;
export const importBundles = importBundlesTable;
export const savedCardMigrations = savedCardMigrationsTable;
export const importChunkRuns = importChunkRunsTable;
export const dataExportSessions = dataExportSessionsTable;
export const estimates = estimatesTable;
export const estimateItems = estimateItemsTable;
export const invoices = invoicesTable;
export const invoiceItems = invoiceItemsTable;
export const payments = paymentsTable;
export const jobNotes = jobNotesTable;
export const customerNotes = customerNotesTable;
export const jobPhotos = jobPhotosTable;
export const serviceAgreementTemplates = serviceAgreementTemplatesTable;
export const maintenancePlans = maintenancePlansTable;
export const vipMembershipTiers = vipMembershipTiersTable;
export const maintenanceVisits = maintenanceVisitsTable;
export const recurringVisitSeries = recurringVisitSeriesTable;
export const recurringVisitOccurrences = recurringVisitOccurrencesTable;
export const automationRules = automationRulesTable;
export const aiRecommendations = aiRecommendationsTable;
export const campaigns = campaignsTable;
export const campaignRecipients = campaignRecipientsTable;
export const messageLogs = messageLogsTable;
export const productCatalog = productCatalogTable;
export const stockLocations = stockLocationsTable;
export const stockLevels = stockLevelsTable;
export const stockMovements = stockMovementsTable;
export const callTrackingSettings = callTrackingSettingsTable;
export const callTrackingNumbers = callTrackingNumbersTable;
export const callRecords = callRecordsTable;
export const growthCheckScans = growthCheckScansTable;
export const growthCheckFindings = growthCheckFindingsTable;
export const growthCheckFindingRevisions = growthCheckFindingRevisionsTable;
export const growthCheckReportDrafts = growthCheckReportDraftsTable;
export const growthCheckReportDraftRevisions = growthCheckReportDraftRevisionsTable;
export const growthCheckReportShares = growthCheckReportSharesTable;
export const technicians = techniciansTable;
export const jobTasks = jobTasksTable;
export const jobProducts = jobProductsTable;
export const scheduleSlots = scheduleSlotsTable;
export const activityEvents = activityEventsTable;
export const timeEntries = timeEntriesTable;
export const timesheets = timesheetsTable;
export const timesheetAuditEvents = timesheetAuditEventsTable;
export const technicianPayRates = technicianPayRatesTable;
export const reviewRequests = reviewRequestsTable;
export const fileAttachments = fileAttachmentsTable;
export const onTheWayNotifications = onTheWayNotificationsTable;
export const bookingRequests = bookingRequestsTable;
export const bookingSettings = bookingSettingsTable;
export const agentActions = agentActionsTable;
export const fieldSyncBatches = fieldSyncBatchesTable;
export const fieldSyncOperations = fieldSyncOperationsTable;
export const inquirySubmitIdempotency = inquirySubmitIdempotencyTable;
export const serviceAreas = serviceAreasTable;
export const growthIntakeChecks = growthIntakeChecksTable;
export const growthIntakeIdentityCandidates = growthIntakeIdentityCandidatesTable;
export const growthIntakeFindings = growthIntakeFindingsTable;
export const growthIntakeAuditEvents = growthIntakeAuditEventsTable;

export async function emitEvent(event: Omit<TestActivityEventRecord, "id" | "occurredAt"> & {
  occurredAt?: Date;
}): Promise<void> {
  state.activityEvents.push(createActivityEventRecord(event));
}

export async function emitEventWithExecutor(
  _executor: unknown,
  event: Omit<TestActivityEventRecord, "id" | "occurredAt"> & {
    occurredAt?: Date;
  }
): Promise<void> {
  state.activityEvents.push(createActivityEventRecord(event));
}

export async function markInvoiceOverdueIfNeeded(
  companyId: string,
  invoiceId: string
): Promise<TestInvoiceRecord | null> {
  const invoice =
    state.invoices.find(
      (row) => row.companyId === companyId && row.id === invoiceId && row.deletedAt === null
    ) ?? null;

  if (!invoice) {
    return null;
  }

  if (invoice.status !== "sent" || !invoice.dueAt || invoice.dueAt.getTime() > Date.now()) {
    return invoice;
  }

  invoice.status = "overdue";
  invoice.updatedAt = new Date();

  state.activityEvents.push(
    createActivityEventRecord({
      companyId: invoice.companyId,
      eventType: "invoice.overdue",
      actorType: "system",
      entityType: "invoice",
      entityId: invoice.id,
      customerId: invoice.customerId,
      invoiceId: invoice.id,
      ...(invoice.jobId ? { jobId: invoice.jobId } : {}),
      ...(invoice.estimateId ? { estimateId: invoice.estimateId } : {}),
      payload: {},
      summary: `Invoice ${invoice.invoiceNumber} overdue`
    })
  );

  return invoice;
}

export const REVENUE_SUMMARY_CACHE_TTL_SECONDS = 300;

export interface RevenueSummaryTopRecommendationRecord {
  id: string;
  headline: string;
  urgencyScore: number | null;
}

export interface RevenueSummaryCountBucketRecord {
  count: number;
  estimatedRevenue: string;
  topRecommendations: RevenueSummaryTopRecommendationRecord[];
}

export interface RevenueSummaryValueBucketRecord {
  count: number;
  totalValue: string;
  topRecommendations: RevenueSummaryTopRecommendationRecord[];
}

export interface RevenueSummaryCacheEntry {
  dormantCustomers: RevenueSummaryCountBucketRecord;
  unsoldEstimates: RevenueSummaryValueBucketRecord;
  unpaidInvoices: RevenueSummaryValueBucketRecord;
  agingAssets: RevenueSummaryCountBucketRecord;
  maintenancePlanOpportunities: RevenueSummaryCountBucketRecord;
  totalOpportunityValue: string;
  generatedAt: string;
}

export function buildRevenueSummaryCacheKey(companyId: string): string {
  return `revenue-summary:${companyId}`;
}

function toMoney(value: Decimal): string {
  return value.toFixed(2);
}

function isVisibleInRevenueDashboard(row: TestAiRecommendationRecord, now: Date): boolean {
  if (row.deletedAt !== null || row.status !== "pending") {
    return false;
  }

  return row.snoozedUntil === null || row.snoozedUntil.getTime() <= now.getTime();
}

function buildTopRecommendations(rows: TestAiRecommendationRecord[]): RevenueSummaryTopRecommendationRecord[] {
  return [...rows]
    .sort((left, right) => {
      const leftUrgency = left.urgencyScore ?? -1;
      const rightUrgency = right.urgencyScore ?? -1;

      if (rightUrgency !== leftUrgency) {
        return rightUrgency - leftUrgency;
      }

      return right.createdAt.getTime() - left.createdAt.getTime();
    })
    .slice(0, 5)
    .map((row) => ({
      id: row.id,
      headline: row.headline,
      urgencyScore: row.urgencyScore
    }));
}

function sumEstimatedRevenue(rows: TestAiRecommendationRecord[]): string {
  return toMoney(
    rows.reduce((sum, row) => sum.add(new Decimal(row.estimatedRevenue ?? "0")), new Decimal(0))
  );
}

function sumEstimateTotals(rows: TestAiRecommendationRecord[]): string {
  return toMoney(
    rows.reduce((sum, row) => {
      const estimateTotal =
        row.estimateId !== null
          ? state.estimates.find((estimate) => estimate.id === row.estimateId)?.total ?? null
          : null;

      return sum.add(new Decimal(estimateTotal ?? row.estimatedRevenue ?? "0"));
    }, new Decimal(0))
  );
}

function sumInvoiceBalances(rows: TestAiRecommendationRecord[]): string {
  return toMoney(
    rows.reduce((sum, row) => {
      const invoiceBalance =
        row.invoiceId !== null
          ? state.invoices.find((invoice) => invoice.id === row.invoiceId)?.balanceDue ?? null
          : null;

      return sum.add(new Decimal(invoiceBalance ?? row.estimatedRevenue ?? "0"));
    }, new Decimal(0))
  );
}

export async function computeRevenueSummarySnapshot(
  companyId: string,
  now: Date = new Date()
): Promise<RevenueSummaryCacheEntry> {
  const visibleRecommendations = state.aiRecommendations.filter(
    (row) => row.companyId === companyId && isVisibleInRevenueDashboard(row, now)
  );

  const dormantCustomers = visibleRecommendations.filter((row) => row.type === "reactivation");
  const unsoldEstimates = visibleRecommendations.filter((row) => row.type === "unsold_estimate");
  const unpaidInvoices = visibleRecommendations.filter((row) => row.type === "unpaid_invoice");
  const agingAssets = visibleRecommendations.filter((row) => row.type === "aging_asset");
  const maintenancePlanOpportunities = visibleRecommendations.filter(
    (row) => row.type === "maintenance_plan_offer"
  );

  const summary: RevenueSummaryCacheEntry = {
    dormantCustomers: {
      count: dormantCustomers.length,
      estimatedRevenue: sumEstimatedRevenue(dormantCustomers),
      topRecommendations: buildTopRecommendations(dormantCustomers)
    },
    unsoldEstimates: {
      count: unsoldEstimates.length,
      totalValue: sumEstimateTotals(unsoldEstimates),
      topRecommendations: buildTopRecommendations(unsoldEstimates)
    },
    unpaidInvoices: {
      count: unpaidInvoices.length,
      totalValue: sumInvoiceBalances(unpaidInvoices),
      topRecommendations: buildTopRecommendations(unpaidInvoices)
    },
    agingAssets: {
      count: agingAssets.length,
      estimatedRevenue: sumEstimatedRevenue(agingAssets),
      topRecommendations: buildTopRecommendations(agingAssets)
    },
    maintenancePlanOpportunities: {
      count: maintenancePlanOpportunities.length,
      estimatedRevenue: sumEstimatedRevenue(maintenancePlanOpportunities),
      topRecommendations: buildTopRecommendations(maintenancePlanOpportunities)
    },
    totalOpportunityValue: "0.00",
    generatedAt: now.toISOString()
  };

  summary.totalOpportunityValue = toMoney(
    new Decimal(summary.dormantCustomers.estimatedRevenue)
      .add(summary.unsoldEstimates.totalValue)
      .add(summary.unpaidInvoices.totalValue)
      .add(summary.agingAssets.estimatedRevenue)
      .add(summary.maintenancePlanOpportunities.estimatedRevenue)
  );

  return summary;
}

export async function listActiveCompanyIdsForRevenueSummary(
  since: Date,
  offset: number,
  limit: number
): Promise<string[]> {
  const activeCompanyIds = new Set(
    state.activityEvents
      .filter((row) => row.occurredAt.getTime() >= since.getTime())
      .map((row) => row.companyId)
  );

  const orderedCompanyIds = state.companies
    .filter((row) => row.deletedAt === null && activeCompanyIds.has(row.id))
    .map((row) => row.id);

  return orderedCompanyIds.slice(offset, offset + limit);
}

const JOB_ACTIVITY_AT_MARKER = { __jobActivityAt: true as const };

type TimelineAtMarker = { __timelineAt: string[] };

function isTimelineAtMarker(value: unknown): value is TimelineAtMarker {
  return Boolean(value && typeof value === "object" && "__timelineAt" in value);
}

function getTimelineAt(row: Record<string, unknown>, marker: TimelineAtMarker): Date | null {
  for (const field of marker.__timelineAt) {
    const value = row[field];
    if (value !== null && value !== undefined) {
      return value instanceof Date ? value : new Date(String(value));
    }
  }
  return null;
}

function compareTimelineAt(row: unknown, marker: TimelineAtMarker, value: unknown): number | null {
  const at = getTimelineAt(row as Record<string, unknown>, marker);
  if (!at) {
    return null;
  }
  return at.getTime() - new Date(value as Date).getTime();
}

function isJobActivityMarker(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && "__jobActivityAt" in value);
}

function getJobActivityAt(row: Record<string, unknown>): Date | null {
  const activity = row.scheduledStart ?? row.createdAt;

  if (!activity) {
    return null;
  }

  return activity instanceof Date ? activity : new Date(String(activity));
}

function resolveFieldKey(field: unknown): string {
  return typeof field === "string" ? field : String(field);
}

function readClerkOrganizationIdFromCompanySettings(settings: Record<string, unknown>): string | null {
  const clerk = settings.clerk;
  if (!clerk || typeof clerk !== "object" || Array.isArray(clerk)) {
    return null;
  }
  const orgId = (clerk as { organizationId?: unknown }).organizationId;
  return typeof orgId === "string" && orgId.length > 0 ? orgId : null;
}

export function createDrizzleModuleMock() {
  const sqlTag = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const template = strings.join("");

    if (template.includes("date_trunc")) {
      return { __timelineAt: values.map((value) => resolveFieldKey(value)) } satisfies TimelineAtMarker;
    }

    if (template.includes("::timestamptz")) {
      return new Date(String(values[0]));
    }

    if (template.includes("COALESCE")) {
      return JOB_ACTIVITY_AT_MARKER;
    }

    // Column-to-column "a is not null and b <= a" (e.g. inventory low-stock: threshold vs quantity).
    if (template.includes("is not null and") && template.includes("<=") && values.length === 3) {
      const limitKey = resolveFieldKey(values[0]);
      const valueKey = resolveFieldKey(values[1]);
      return (row: Record<string, unknown>) => {
        const bound = row[limitKey];
        const current = row[valueKey];
        return bound !== null && bound !== undefined && (current as number) <= (bound as number);
      };
    }

    if (template.includes("clerk") && template.includes("organizationId")) {
      const clerkOrganizationId = values.at(-1);
      if (typeof clerkOrganizationId !== "string") {
        return {};
      }
      return <T extends { settings?: Record<string, unknown> }>(row: T) => {
        const settings = row.settings ?? {};
        return readClerkOrganizationIdFromCompanySettings(settings) === clerkOrganizationId;
      };
    }

    return {};
  };

  return {
    and: <T>(...predicates: Array<Predicate<T> | undefined>): Predicate<T> => (row: T) =>
      predicates.every((predicate) => !predicate || predicate(row)),
    or: <T>(...predicates: Array<Predicate<T> | undefined>): Predicate<T> => (row: T) =>
      predicates.some((predicate) => predicate?.(row) ?? false),
    asc: <T>(field: keyof T): OrderByDefinition =>
      isTimelineAtMarker(field)
        ? { direction: "asc", field: "", expr: field }
        : { direction: "asc", field: String(field) },
    desc: <T>(field: keyof T): OrderByDefinition =>
      isTimelineAtMarker(field)
        ? { direction: "desc", field: "", expr: field }
        : { direction: "desc", field: String(field) },
    eq: <T>(field: keyof T, value: T[keyof T]): Predicate<T> => (row: T) =>
      isTimelineAtMarker(field)
        ? compareTimelineAt(row, field, value) === 0
        : row[resolveFieldKey(field) as keyof T] === value,
    gt: <T>(field: keyof T, value: T[keyof T]): Predicate<T> => (row: T) =>
      (row[resolveFieldKey(field) as keyof T] as string | number | Date) >
      (value as string | number | Date),
    gte: <T>(field: unknown, value: T[keyof T]): Predicate<T> => (row: T) => {
      if (isJobActivityMarker(field)) {
        const activity = getJobActivityAt(row as Record<string, unknown>);
        return activity !== null && activity.getTime() >= new Date(value as Date).getTime();
      }

      const key = resolveFieldKey(field) as keyof T;
      return (row[key] as string | number | Date) >= (value as string | number | Date);
    },
    lte: <T>(field: unknown, value: T[keyof T]): Predicate<T> => (row: T) => {
      if (isTimelineAtMarker(field)) {
        const diff = compareTimelineAt(row, field, value);
        return diff !== null && diff <= 0;
      }

      if (isJobActivityMarker(field)) {
        const activity = getJobActivityAt(row as Record<string, unknown>);
        return activity !== null && activity.getTime() <= new Date(value as Date).getTime();
      }

      const key = resolveFieldKey(field) as keyof T;
      return (row[key] as string | number | Date) <= (value as string | number | Date);
    },
    lt: <T>(field: unknown, value: T[keyof T]): Predicate<T> => (row: T) => {
      if (isTimelineAtMarker(field)) {
        const diff = compareTimelineAt(row, field, value);
        return diff !== null && diff < 0;
      }

      if (isJobActivityMarker(field)) {
        const activity = getJobActivityAt(row as Record<string, unknown>);
        return activity !== null && activity.getTime() < new Date(value as Date).getTime();
      }

      const key = resolveFieldKey(field) as keyof T;
      return (row[key] as string | number | Date) < (value as string | number | Date);
    },
    inArray: <T>(field: unknown, values: Array<T[keyof T]>): Predicate<T> => (row: T) =>
      values.includes(row[resolveFieldKey(field) as keyof T]),
    isNull: <T>(field: keyof T): Predicate<T> => (row: T) => row[resolveFieldKey(field) as keyof T] === null,
    sql: sqlTag,
    count: () => COUNT_AGGREGATE_MARKER
  };
}

async function runTransactionWithRetry<T>(callback: (tx: TestDb) => Promise<T>): Promise<T> {
  return db.transaction(callback);
}

async function runTransactionWithTenantSession<T>(
  _companyId: string,
  callback: (tx: TestDb) => Promise<T>
): Promise<T> {
  return db.transaction(callback);
}

export function createDbModuleMock() {
  return {
    db,
    runTransactionWithRetry,
    runTransactionWithTenantSession,
    companies,
    users,
    refreshTokens,
    customers,
    properties,
    assets,
    jobs,
    importSessions,
    importBundles,
    savedCardMigrations,
    importChunkRuns,
    dataExportSessions,
    estimates,
    estimateItems,
    invoices,
    invoiceItems,
    payments,
    jobNotes,
    customerNotes,
    jobPhotos,
    serviceAgreementTemplates,
    maintenancePlans,
    vipMembershipTiers,
    maintenanceVisits,
    recurringVisitSeries,
    recurringVisitOccurrences,
    automationRules,
    aiRecommendations,
    campaigns,
    campaignRecipients,
    messageLogs,
    productCatalog,
    stockLocations,
    stockLevels,
    stockMovements,
    callTrackingSettings,
    callTrackingNumbers,
    callRecords,
    growthCheckScans,
    growthCheckFindings,
    growthCheckFindingRevisions,
    growthCheckReportDrafts,
    growthCheckReportDraftRevisions,
    growthCheckReportShares,
    technicians,
    jobTasks,
    jobProducts,
    scheduleSlots,
    activityEvents,
    timeEntries,
    timesheets,
    timesheetAuditEvents,
    technicianPayRates,
    reviewRequests,
    fileAttachments,
    onTheWayNotifications,
    bookingRequests,
    bookingSettings,
    agentActions,
    fieldSyncBatches,
    fieldSyncOperations,
    inquirySubmitIdempotency,
    serviceAreas,
    growthIntakeChecks,
    growthIntakeIdentityCandidates,
    growthIntakeFindings,
    growthIntakeAuditEvents,
    emitEvent,
    emitEventWithExecutor,
    markInvoiceOverdueIfNeeded,
    REVENUE_SUMMARY_CACHE_TTL_SECONDS,
    buildRevenueSummaryCacheKey,
    computeRevenueSummarySnapshot,
    listActiveCompanyIdsForRevenueSummary
  };
}

export function resetTestState(): void {
  state.companies.length = 0;
  state.users.length = 0;
  state.refreshTokens.length = 0;
  state.customers.length = 0;
  state.properties.length = 0;
  state.assets.length = 0;
  state.jobs.length = 0;
  state.importSessions.length = 0;
  state.importBundles.length = 0;
  state.savedCardMigrations.length = 0;
  state.importChunkRuns.length = 0;
  state.dataExportSessions.length = 0;
  state.estimates.length = 0;
  state.estimateItems.length = 0;
  state.invoices.length = 0;
  state.invoiceItems.length = 0;
  state.payments.length = 0;
  state.jobNotes.length = 0;
  state.customerNotes.length = 0;
  state.jobPhotos.length = 0;
  state.serviceAgreementTemplates.length = 0;
  state.maintenancePlans.length = 0;
  state.vipMembershipTiers.length = 0;
  state.maintenanceVisits.length = 0;
  state.recurringVisitSeries.length = 0;
  state.recurringVisitOccurrences.length = 0;
  state.automationRules.length = 0;
  state.aiRecommendations.length = 0;
  state.campaigns.length = 0;
  state.campaignRecipients.length = 0;
  state.messageLogs.length = 0;
  state.productCatalog.length = 0;
  state.stockLocations.length = 0;
  state.stockLevels.length = 0;
  state.stockMovements.length = 0;
  state.callTrackingSettings.length = 0;
  state.callTrackingNumbers.length = 0;
  state.callRecords.length = 0;
  state.growthCheckScans.length = 0;
  state.growthCheckFindings.length = 0;
  state.growthCheckFindingRevisions.length = 0;
  state.growthCheckReportDrafts.length = 0;
  state.growthCheckReportDraftRevisions.length = 0;
  state.growthCheckReportShares.length = 0;
  state.technicians.length = 0;
  state.jobTasks.length = 0;
  state.jobProducts.length = 0;
  state.scheduleSlots.length = 0;
  state.activityEvents.length = 0;
  state.timeEntries.length = 0;
  state.timesheets.length = 0;
  state.timesheetAuditEvents.length = 0;
  state.technicianPayRates.length = 0;
  state.reviewRequests.length = 0;
  state.fileAttachments.length = 0;
  state.onTheWayNotifications.length = 0;
  state.bookingRequests.length = 0;
  state.bookingSettings.length = 0;
  state.agentActions.length = 0;
  state.fieldSyncBatches.length = 0;
  state.fieldSyncOperations.length = 0;
  state.inquirySubmitIdempotency.length = 0;
  state.serviceAreas.length = 0;
  state.growthIntakeChecks.length = 0;
  state.growthIntakeIdentityCandidates.length = 0;
  state.growthIntakeFindings.length = 0;
  state.growthIntakeAuditEvents.length = 0;
}

export const RENAVANI_INTERNAL_TEST_COMPANY_ID = "00000000-0000-4000-8000-000000000053";

export function seedCompany(
  values: Partial<TestCompanyRecord> & Pick<TestCompanyRecord, "name" | "slug">
): TestCompanyRecord {
  const record = createCompanyRecord(values);
  state.companies.push(record);
  return record;
}

export function seedUser(
  values: Partial<TestUserRecord> & Pick<TestUserRecord, "companyId" | "email" | "firstName" | "lastName">
): TestUserRecord {
  const record = createUserRecord(values);
  state.users.push(record);
  return record;
}

export function seedRefreshToken(
  values: Partial<TestRefreshTokenRecord> &
    Pick<TestRefreshTokenRecord, "companyId" | "userId" | "tokenHash" | "expiresAt">
): TestRefreshTokenRecord {
  const record = createRefreshTokenRecord(values);
  state.refreshTokens.push(record);
  return record;
}

export function seedCustomer(
  values: Partial<TestCustomerRecord> &
    Pick<TestCustomerRecord, "companyId" | "firstName" | "lastName">
): TestCustomerRecord {
  const record = createCustomerRecord(values);
  state.customers.push(record);
  return record;
}

export function seedProperty(
  values: Partial<TestPropertyRecord> &
    Pick<TestPropertyRecord, "companyId" | "customerId" | "addressLine1" | "city" | "state" | "zip">
): TestPropertyRecord {
  const record = createPropertyRecord(values);
  state.properties.push(record);
  return record;
}

export function seedAsset(
  values: Partial<TestAssetRecord> &
    Pick<TestAssetRecord, "companyId" | "customerId" | "propertyId" | "name" | "assetType">
): TestAssetRecord {
  const record = createAssetRecord(values);
  state.assets.push(record);
  return record;
}

export function seedJob(
  values: Partial<TestJobRecord> &
    Pick<TestJobRecord, "companyId" | "customerId">
): TestJobRecord {
  const record = createJobRecord(values);
  state.jobs.push(record);
  return record;
}

export function seedImportSession(
  values: Partial<TestImportSessionRecord> &
    Pick<TestImportSessionRecord, "companyId" | "fileName" | "fileUrl">
): TestImportSessionRecord {
  const record = createImportSessionRecord(values);
  state.importSessions.push(record);
  return record;
}

export function seedDataExportSession(
  values: Partial<TestDataExportSessionRecord> & Pick<TestDataExportSessionRecord, "companyId">
): TestDataExportSessionRecord {
  const record = createDataExportSessionRecord(values);
  state.dataExportSessions.push(record);
  return record;
}

export function seedEstimate(
  values: Partial<TestEstimateRecord> &
    Pick<TestEstimateRecord, "companyId" | "customerId">
): TestEstimateRecord {
  const record = createEstimateRecord(values);
  state.estimates.push(record);
  return record;
}

export function seedEstimateItem(
  values: Partial<TestEstimateItemRecord> &
    Pick<TestEstimateItemRecord, "companyId" | "estimateId" | "name">
): TestEstimateItemRecord {
  const record = createEstimateItemRecord(values);
  state.estimateItems.push(record);
  return record;
}

export function seedInvoice(
  values: Partial<TestInvoiceRecord> &
    Pick<TestInvoiceRecord, "companyId" | "customerId">
): TestInvoiceRecord {
  const record = createInvoiceRecord(values);
  state.invoices.push(record);
  return record;
}

export function seedInvoiceItem(
  values: Partial<TestInvoiceItemRecord> &
    Pick<TestInvoiceItemRecord, "companyId" | "invoiceId" | "name">
): TestInvoiceItemRecord {
  const record = createInvoiceItemRecord(values);
  state.invoiceItems.push(record);
  return record;
}

export function seedPayment(
  values: Partial<TestPaymentRecord> &
    Pick<TestPaymentRecord, "companyId" | "invoiceId" | "customerId" | "amount">
): TestPaymentRecord {
  const record = createPaymentRecord(values);
  state.payments.push(record);
  return record;
}

export function seedJobNote(
  values: Partial<TestJobNoteRecord> &
    Pick<TestJobNoteRecord, "companyId" | "jobId" | "content">
): TestJobNoteRecord {
  const record = createJobNoteRecord(values);
  state.jobNotes.push(record);
  return record;
}

export function seedCustomerNote(
  values: Partial<TestCustomerNoteRecord> &
    Pick<TestCustomerNoteRecord, "companyId" | "customerId" | "content">
): TestCustomerNoteRecord {
  const record = createCustomerNoteRecord(values);
  state.customerNotes.push(record);
  return record;
}

export function seedJobPhoto(
  values: Partial<TestJobPhotoRecord> &
    Pick<TestJobPhotoRecord, "companyId" | "jobId" | "url">
): TestJobPhotoRecord {
  const record = createJobPhotoRecord(values);
  state.jobPhotos.push(record);
  return record;
}

export function seedServiceAgreementTemplate(
  values: Partial<TestServiceAgreementTemplateRecord> &
    Pick<TestServiceAgreementTemplateRecord, "companyId" | "name" | "visitsPerYear" | "frequency">
): TestServiceAgreementTemplateRecord {
  const record = createServiceAgreementTemplateRecord(values);
  state.serviceAgreementTemplates.push(record);
  return record;
}

export function seedMaintenancePlan(
  values: Partial<TestMaintenancePlanRecord> &
    Pick<TestMaintenancePlanRecord, "companyId" | "customerId">
): TestMaintenancePlanRecord {
  const record = createMaintenancePlanRecord(values);
  state.maintenancePlans.push(record);
  return record;
}

export function seedMaintenanceVisit(
  values: Partial<TestMaintenanceVisitRecord> &
    Pick<TestMaintenanceVisitRecord, "companyId" | "maintenancePlanId">
): TestMaintenanceVisitRecord {
  const record = createMaintenanceVisitRecord(values);
  state.maintenanceVisits.push(record);
  return record;
}

export function seedAutomationRule(
  values: Partial<TestAutomationRuleRecord> &
    Pick<TestAutomationRuleRecord, "companyId" | "ruleType">
): TestAutomationRuleRecord {
  const record = createAutomationRuleRecord(values);
  state.automationRules.push(record);
  return record;
}

export function seedAiRecommendation(
  values: Partial<TestAiRecommendationRecord> &
    Pick<TestAiRecommendationRecord, "companyId" | "type" | "headline" | "body">
): TestAiRecommendationRecord {
  const record = createAiRecommendationRecord(values);
  state.aiRecommendations.push(record);
  return record;
}

export function seedCampaign(
  values: Partial<TestCampaignRecord> &
    Pick<TestCampaignRecord, "companyId" | "type" | "name">
): TestCampaignRecord {
  const record = createCampaignRecord(values);
  state.campaigns.push(record);
  return record;
}

export function seedCampaignRecipient(
  values: Partial<TestCampaignRecipientRecord> &
    Pick<TestCampaignRecipientRecord, "campaignId" | "customerId" | "companyId">
): TestCampaignRecipientRecord {
  const record = createCampaignRecipientRecord(values);
  state.campaignRecipients.push(record);
  return record;
}

export function seedMessageLog(
  values: Partial<TestMessageLogRecord> &
    Pick<TestMessageLogRecord, "companyId" | "channel" | "direction" | "toAddress" | "body">
): TestMessageLogRecord {
  const record = createMessageLogRecord(values);
  state.messageLogs.push(record);
  return record;
}

export function seedProductCatalog(
  values: Partial<TestProductCatalogRecord> &
    Pick<TestProductCatalogRecord, "companyId" | "name">
): TestProductCatalogRecord {
  const record = createProductCatalogRecord(values);
  state.productCatalog.push(record);
  return record;
}

export function seedTechnician(
  values: Partial<TestTechnicianRecord> &
    Pick<TestTechnicianRecord, "companyId" | "firstName" | "lastName" | "phone">
): TestTechnicianRecord {
  const record = createTechnicianRecord(values);
  state.technicians.push(record);
  return record;
}

export function seedJobTask(
  values: Partial<TestJobTaskRecord> &
    Pick<TestJobTaskRecord, "companyId" | "jobId" | "title">
): TestJobTaskRecord {
  const record = createJobTaskRecord(values);
  state.jobTasks.push(record);
  return record;
}

export function seedJobProduct(
  values: Partial<TestJobProductRecord> &
    Pick<TestJobProductRecord, "companyId" | "jobId" | "name" | "unitPrice" | "total">
): TestJobProductRecord {
  const record = createJobProductRecord(values);
  state.jobProducts.push(record);
  return record;
}

export function seedScheduleSlot(
  values: Partial<TestScheduleSlotRecord> &
    Pick<TestScheduleSlotRecord, "companyId" | "technicianId" | "startTime" | "endTime">
): TestScheduleSlotRecord {
  const record = createScheduleSlotRecord(values);
  state.scheduleSlots.push(record);
  return record;
}

export function seedActivityEvent(
  values: Partial<TestActivityEventRecord> &
    Pick<TestActivityEventRecord, "companyId" | "eventType" | "entityType" | "entityId" | "summary">
): TestActivityEventRecord {
  const record = createActivityEventRecord(values);
  state.activityEvents.push(record);
  return record;
}

export function seedTimeEntry(
  values: Partial<TestTimeEntryRecord> &
    Pick<TestTimeEntryRecord, "companyId" | "jobId" | "technicianId" | "startedAt">
): TestTimeEntryRecord {
  const record = createTimeEntryRecord(values);
  state.timeEntries.push(record);
  return record;
}

export function seedReviewRequest(
  values: Partial<TestReviewRequestRecord> &
    Pick<TestReviewRequestRecord, "companyId" | "customerId">
): TestReviewRequestRecord {
  const record = createReviewRequestRecord(values);
  state.reviewRequests.push(record);
  return record;
}

export function seedFileAttachment(
  values: Partial<TestFileAttachmentRecord> &
    Pick<TestFileAttachmentRecord, "companyId" | "entityType" | "entityId" | "fileName" | "fileUrl">
): TestFileAttachmentRecord {
  const record = createFileAttachmentRecord(values);
  state.fileAttachments.push(record);
  return record;
}

export function seedOnTheWayNotification(
  values: Partial<TestOnTheWayNotificationRecord> &
    Pick<TestOnTheWayNotificationRecord, "companyId" | "jobId" | "technicianId" | "customerId">
): TestOnTheWayNotificationRecord {
  const record = createOnTheWayNotificationRecord(values);
  state.onTheWayNotifications.push(record);
  return record;
}

export function seedBookingRequest(
  values: Partial<TestBookingRequestRecord> &
    Pick<
      TestBookingRequestRecord,
      "companyId" | "firstName" | "lastName" | "phone" | "addressLine1" | "city" | "state" | "zip"
    >
): TestBookingRequestRecord {
  const record = createBookingRequestRecord(values);
  state.bookingRequests.push(record);
  return record;
}

export function seedBookingSettings(
  values: Partial<TestBookingSettingsRecord> & Pick<TestBookingSettingsRecord, "companyId">
): TestBookingSettingsRecord {
  const record = createBookingSettingsRecord(values);
  state.bookingSettings.push(record);
  return record;
}

export function seedGrowthIntakeCheck(
  values: Partial<TestGrowthIntakeCheckRecord> &
    Pick<TestGrowthIntakeCheckRecord, "companyId" | "ownerUserId" | "createdById" | "businessName">
): TestGrowthIntakeCheckRecord {
  const record = createGrowthIntakeCheckRecord(values);
  state.growthIntakeChecks.push(record);
  return record;
}

export function seedAgentAction(
  values: Partial<TestAgentActionRecord> & Pick<TestAgentActionRecord, "companyId">
): TestAgentActionRecord {
  const record = createAgentActionRecord({
    agentProduct: "revenue",
    actionType: "message.send_proposed",
    idempotencyKey: `seed-agent-${nextId()}`,
    payloadHash: "test-payload-hash",
    policyVersion: "v1",
    requiresApproval: true,
    state: "awaiting_approval",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    target: {
      entityType: "booking_request",
      entityId: "booking-seed",
      recordVersion: "rv1:1",
      source: { channel: "web" }
    },
    ...values
  });
  state.agentActions.push(record);
  return record;
}

export function seedVipMembershipTier(
  values: Partial<TestVipMembershipTierRecord> & Pick<TestVipMembershipTierRecord, "companyId" | "name">
): TestVipMembershipTierRecord {
  const record: TestVipMembershipTierRecord = {
    id: values.id ?? randomUUID(),
    companyId: values.companyId,
    name: values.name,
    description: values.description ?? null,
    monthlyPrice: values.monthlyPrice ?? "29.00",
    discountPercent: values.discountPercent ?? "10",
    includedVisitsPerMonth: values.includedVisitsPerMonth ?? null,
    stripeMonthlyPriceId: values.stripeMonthlyPriceId ?? null,
    sortOrder: values.sortOrder ?? 0,
    isActive: values.isActive ?? true,
    createdAt: values.createdAt ?? new Date(),
    updatedAt: values.updatedAt ?? new Date(),
    deletedAt: values.deletedAt ?? null
  };
  state.vipMembershipTiers.push(record);
  return record;
}

export function seedSavedCardMigration(
  values: Partial<{
    id: string;
    companyId: string;
    importBundleId: string | null;
    createdById: string | null;
    status: string;
    priorProcessorName: string;
    stripeImportReference: string | null;
    mappingSummary: Record<string, unknown>;
    customerMappings: unknown[];
    lastError: string | null;
    fallbackEmailSentAt: Date | null;
    fallbackEmailCustomerIds: string[];
    offSessionConsentAcknowledgedAt: Date | null;
    offSessionConsentAcknowledgedById: string | null;
    offSessionConsentTextVersion: string | null;
    offSessionConsentBatchId: string | null;
    completedAt: Date | null;
  }> &
    Pick<{ companyId: string; priorProcessorName: string }, "companyId" | "priorProcessorName">
) {
  const now = new Date();
  const record = {
    id: values.id ?? randomUUID(),
    companyId: values.companyId,
    importBundleId: values.importBundleId ?? null,
    createdById: values.createdById ?? null,
    status: values.status ?? "requested",
    priorProcessorName: values.priorProcessorName,
    stripeImportReference: values.stripeImportReference ?? null,
    mappingSummary: values.mappingSummary ?? { matched: 0, unmatched: 0, failed: 0, total: 0 },
    customerMappings: values.customerMappings ?? [],
    lastError: values.lastError ?? null,
    fallbackEmailSentAt: values.fallbackEmailSentAt ?? null,
    fallbackEmailCustomerIds: values.fallbackEmailCustomerIds ?? [],
    offSessionConsentAcknowledgedAt: values.offSessionConsentAcknowledgedAt ?? null,
    offSessionConsentAcknowledgedById: values.offSessionConsentAcknowledgedById ?? null,
    offSessionConsentTextVersion: values.offSessionConsentTextVersion ?? null,
    offSessionConsentBatchId: values.offSessionConsentBatchId ?? null,
    completedAt: values.completedAt ?? null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  };
  state.savedCardMigrations.push(record);
  return record;
}

export function seedImportBundle(
  values: Partial<{
    id: string;
    companyId: string;
    createdById: string | null;
    sourceSystem: string;
    label: string | null;
    status: "active" | "committing" | "completed" | "abandoned";
    wizardStep: number;
    stepState: Record<string, unknown>;
    dedupeDecisions: Record<string, unknown>;
    completedAt: Date | null;
    abandonedAt: Date | null;
  }> &
    Pick<{ companyId: string }, "companyId">
): {
  id: string;
  companyId: string;
  createdById: string | null;
  sourceSystem: string;
  label: string | null;
  status: "active" | "committing" | "completed" | "abandoned";
  wizardStep: number;
  stepState: Record<string, unknown>;
  dedupeDecisions: Record<string, unknown>;
  completedAt: Date | null;
  abandonedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
} {
  const now = new Date();
  const record = {
    id: values.id ?? randomUUID(),
    companyId: values.companyId,
    createdById: values.createdById ?? null,
    sourceSystem: values.sourceSystem ?? "manual_csv",
    label: values.label ?? null,
    status: values.status ?? "active",
    wizardStep: values.wizardStep ?? 1,
    stepState: values.stepState ?? { files: [] },
    dedupeDecisions: values.dedupeDecisions ?? {},
    completedAt: values.completedAt ?? null,
    abandonedAt: values.abandonedAt ?? null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  };
  state.importBundles.push(record);
  return record;
}

export function getTestState(): TestState {
  return state;
}
