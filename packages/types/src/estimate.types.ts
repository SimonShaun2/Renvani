export type EstimateStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "approved"
  | "declined"
  | "expired"
  | "converted"
  | "revised";

export type EstimateItemType = "service" | "labor" | "material" | "fee";

export interface Estimate {
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
  isRecommended?: boolean;
  optionSetVersion?: number;
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

export interface EstimateItem {
  id: string;
  estimateId: string;
  companyId: string;
  priceBookItemId: string | null;
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

export interface EstimateCustomerSummary {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email?: string | null;
}

export interface EstimatePropertySummary {
  id: string;
  addressLine1: string;
  city: string;
  state: string;
}

export interface EstimateJobSummary {
  id: string;
  jobNumber: string;
  title: string;
}

export interface EstimateListItem {
  id: string;
  estimateNumber: string;
  title: string | null;
  status: EstimateStatus;
  tierLabel: string | null;
  tierGroupId: string | null;
  total: string;
  subtotal: string;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
  };
  sentAt: Date | null;
  expiresAt: Date | null;
  approvedAt: Date | null;
  declinedAt: Date | null;
  createdAt: Date;
}

export interface EstimateDetail extends Estimate {
  customer: EstimateCustomerSummary;
  property: EstimatePropertySummary | null;
  job: EstimateJobSummary | null;
  items: EstimateItem[];
}

export interface PublicEstimateView {
  estimateNumber: string;
  title: string | null;
  status: EstimateStatus;
  messageToCustomer: string | null;
  subtotal: string;
  taxRate: string | null;
  taxAmount: string | null;
  discountAmount: string | null;
  total: string;
  financingOffered: boolean | null;
  tierLabel: string | null;
  expiresAt: Date | null;
  tiers?: Array<{
    estimateNumber: string;
    title: string | null;
    tierLabel: string | null;
    subtotal: string;
    taxRate: string | null;
    taxAmount: string | null;
    discountAmount: string | null;
    total: string;
    /** FS-212: the business's recommended option in the set. */
    recommended?: boolean;
    items: Array<{
      name: string;
      description: string | null;
      quantity: string;
      unitPrice: string;
      total: string;
    }>;
  }>;
  /** FS-212: present only when a financing provider is ready; omitted while financing is disabled. */
  financing?: import("./estimate-options.types.js").EstimateFinancingSummary;
  items: Array<{
    name: string;
    description: string | null;
    quantity: string;
    unitPrice: string;
    total: string;
  }>;
}

/** Customer-safe scheduling context for post-approval in-platform booking (FS-21 web). */
export interface PublicEstimateSchedulingContext {
  companyName: string;
  bookingSlug: string;
  zip: string;
  customer: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
  };
  property: {
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    zip: string;
  } | null;
}

export interface CreateEstimateInput {
  customerId: string;
  jobId?: string;
  propertyId?: string;
  title?: string;
  messageToCustomer?: string;
  internalNotes?: string;
  taxRate?: number;
  discountAmount?: number;
  financingOffered?: boolean;
  tierLabel?: string;
  tierGroupId?: string;
  items?: AddEstimateItemInput[];
}

export interface UpdateEstimateInput {
  customerId?: string;
  jobId?: string;
  propertyId?: string;
  title?: string;
  messageToCustomer?: string;
  internalNotes?: string;
  taxRate?: number;
  discountAmount?: number;
  financingOffered?: boolean;
  tierLabel?: string;
  tierGroupId?: string;
}

export interface AddEstimateItemInput {
  name: string;
  description?: string;
  itemType?: EstimateItemType;
  quantity: number;
  unitPrice: number;
  isTaxable?: boolean;
  sortOrder?: number;
  priceBookItemId?: string;
}

export interface UpdateEstimateItemInput {
  name?: string;
  description?: string;
  itemType?: EstimateItemType;
  quantity?: number;
  unitPrice?: number;
  isTaxable?: boolean;
  sortOrder?: number;
  priceBookItemId?: string | null;
}

export interface ListEstimatesQuery {
  status?: EstimateStatus;
  customerId?: string;
  jobId?: string;
  tierGroupId?: string;
  search?: string;
  createdAfter?: string;
  createdBefore?: string;
  sortBy?: "createdAt" | "total" | "status";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}
