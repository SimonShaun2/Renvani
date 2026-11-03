export interface CustomerNote {
  id: string;
  companyId: string;
  customerId: string;
  authorId: string | null;
  content: string;
  isInternal: boolean;
  notedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface Customer {
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
  importSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface Property {
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

export interface Asset {
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

export interface PropertyWithAssets extends Property {
  assets: Asset[];
}

export interface CustomerWithGraph extends Customer {
  properties: PropertyWithAssets[];
}

export interface AssetWithJobCount extends Asset {
  jobCount: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateCustomerInput {
  firstName: string;
  lastName: string;
  displayName?: string;
  email?: string;
  phone?: string;
  altPhone?: string;
  leadSource?: string;
  tags?: string[];
  internalNotes?: string;
  prefersSms?: boolean;
  prefersEmail?: boolean;
  doNotContact?: boolean;
}

export interface UpdateCustomerInput {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  altPhone?: string;
  leadSource?: string;
  tags?: string[];
  internalNotes?: string;
  prefersSms?: boolean;
  prefersEmail?: boolean;
  doNotContact?: boolean;
}

export interface CreatePropertyInput {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
  type?: "residential" | "commercial" | "industrial" | "multi_family";
  sqft?: number;
  yearBuilt?: number;
  accessNotes?: string;
  notes?: string;
  isPrimary?: boolean;
}

export interface UpdatePropertyInput {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  type?: "residential" | "commercial" | "industrial" | "multi_family";
  sqft?: number;
  yearBuilt?: number;
  accessNotes?: string;
  notes?: string;
  isPrimary?: boolean;
}

export interface CreateAssetInput {
  name: string;
  assetType: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  installDate?: string;
  warrantyExpiration?: string;
  condition?: "excellent" | "good" | "fair" | "poor" | "failed";
  conditionNotes?: string;
  notes?: string;
}

export interface UpdateAssetInput {
  name?: string;
  assetType?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  installDate?: string;
  warrantyExpiration?: string;
  condition?: "excellent" | "good" | "fair" | "poor" | "failed";
  conditionNotes?: string;
  notes?: string;
  lastServiceDate?: string;
  nextServiceDate?: string;
  photoUrls?: string[];
}

export interface ListCustomersQuery {
  search?: string;
  tags?: string[];
  status?: "active" | "dormant";
  hasActiveMaintenancePlan?: boolean;
  hasOverdueInvoice?: boolean;
  sortBy?: "lastName" | "lastServiceDate" | "lifetimeValue" | "createdAt";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}
