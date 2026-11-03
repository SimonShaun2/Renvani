/**
 * FS-168 customer portal API contract (v1).
 * All portal reads are scoped to the (companyId, customerId) pair carried in a signed portal token.
 */
export interface CustomerPortalLink {
  token: string;
  url: string;
  expiresAt: string;
}

export interface CustomerPortalAccount {
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string | null;
    email: string | null;
    phone: string | null;
  };
  company: {
    name: string;
  };
}

export interface CustomerPortalVisit {
  id: string;
  jobNumber: string;
  title: string;
  status: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  completedAt: string | null;
}

export interface CustomerPortalVisits {
  upcoming: CustomerPortalVisit[];
  past: CustomerPortalVisit[];
}

export interface CustomerPortalEstimate {
  id: string;
  estimateNumber: string;
  title: string | null;
  status: string;
  total: string;
  createdAt: string;
  /** Existing public estimate approval token (use with the public estimate routes). */
  approvalToken: string | null;
}

export interface CustomerPortalInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  total: string;
  amountPaid: string;
  balanceDue: string;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  /** Existing public pay token (use with /api/v1/public/pay/:token). */
  paymentToken: string | null;
}
