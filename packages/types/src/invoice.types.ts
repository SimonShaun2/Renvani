export type InvoiceStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "void"
  | "written_off";

export type PaymentMethod = "card" | "ach" | "cash" | "check" | "financing" | "other";
export type ManualPaymentMethod = "cash" | "check" | "other";
export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded" | "disputed";
export type InvoiceItemType = "service" | "labor" | "material" | "fee";

export interface Invoice {
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
  /** Customer-paid 2% Service Fee collected at checkout (separate line; not in total/tax/balance). */
  serviceFeeAmount: string;
  /** @deprecated Legacy online-booking fee (removed 2026-10-27). Historical value only; never charged now ("0.00"). */
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
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  companyId: string;
  priceBookItemId: string | null;
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

export interface Payment {
  id: string;
  companyId: string;
  invoiceId: string;
  customerId: string;
  collectedById: string | null;
  /** Invoice portion applied to the balance (excludes fees). */
  amount: string;
  /** Customer-paid 2% Service Fee on this payment ("0.00" for manual/non-checkout payments). */
  serviceFeeAmount: string;
  /** @deprecated Legacy online-booking fee recorded on this payment before removal (2026-10-27); "0.00" for new payments. */
  bookingFeeAmount: string;
  /** Always false: Service Fee and booking fee are non-refundable. */
  feeRefundable: boolean;
  /** Refunded portion of `amount` (fees are never refunded). */
  amountRefunded: string;
  /** Max still refundable = amount - amountRefunded (fees excluded). */
  refundableAmount: string;
  method: PaymentMethod;
  status: PaymentStatus;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  checkNumber: string | null;
  referenceNumber: string | null;
  notes: string | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface InvoiceCustomerSummary {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
}

export interface InvoiceJobSummary {
  id: string;
  jobNumber: string;
  title: string;
}

export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  title: string | null;
  status: InvoiceStatus;
  total: string;
  amountPaid: string;
  balanceDue: string;
  /** Customer-paid fees collected at checkout (separate from total). */
  serviceFeeAmount?: string;
  /** @deprecated Legacy online-booking fee (removed 2026-10-27); historical totals only. */
  bookingFeeAmount?: string;
  dueAt: Date | null;
  paidAt: Date | null;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: Date;
}

export interface InvoicePaymentSummary {
  id: string;
  amount: string;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt: Date | null;
  stripePaymentIntentId: string | null;
  serviceFeeAmount: string;
  bookingFeeAmount: string;
  feeRefundable: boolean;
}

export interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  title: string | null;
  status: InvoiceStatus;
  subtotal: string;
  taxRate: string | null;
  taxAmount: string | null;
  discountAmount: string | null;
  total: string;
  amountPaid: string;
  balanceDue: string;
  serviceFeeAmount?: string;
  /** @deprecated Legacy online-booking fee (removed 2026-10-27); historical totals only. */
  bookingFeeAmount?: string;
  issuedAt: Date | null;
  sentAt: Date | null;
  dueAt: Date | null;
  paidAt: Date | null;
  stripePaymentLinkUrl: string | null;
  paymentToken: string | null;
  messageToCustomer: string | null;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string | null;
  };
  job: InvoiceJobSummary | null;
  items: InvoiceItem[];
  payments: InvoicePaymentSummary[];
  createdAt: Date;
}

export interface CreateInvoiceInput {
  customerId: string;
  jobId?: string;
  estimateId?: string;
  fromJobId?: string;
  fromEstimateId?: string;
  title?: string;
  messageToCustomer?: string;
  internalNotes?: string;
  taxRate?: number;
  discountAmount?: number;
  dueAt?: string;
  items?: AddInvoiceItemInput[];
}

export interface UpdateInvoiceInput {
  customerId?: string;
  jobId?: string;
  estimateId?: string;
  title?: string;
  messageToCustomer?: string;
  internalNotes?: string;
  taxRate?: number;
  discountAmount?: number;
  dueAt?: string;
}

export interface AddInvoiceItemInput {
  name: string;
  description?: string;
  itemType?: InvoiceItemType;
  quantity: number;
  unitPrice: number;
  isTaxable?: boolean;
  sortOrder?: number;
  priceBookItemId?: string;
}

export interface UpdateInvoiceItemInput {
  name?: string;
  description?: string;
  itemType?: InvoiceItemType;
  quantity?: number;
  unitPrice?: number;
  isTaxable?: boolean;
  sortOrder?: number;
  priceBookItemId?: string | null;
}

export interface RecordPaymentInput {
  amount: number;
  method: ManualPaymentMethod;
  checkNumber?: string;
  referenceNumber?: string;
  notes?: string;
  paidAt?: string;
}

export interface ListInvoicesQuery {
  status?: InvoiceStatus;
  customerId?: string;
  jobId?: string;
  search?: string;
  dueBefore?: string;
  dueAfter?: string;
  createdAfter?: string;
  createdBefore?: string;
  sortBy?: "createdAt" | "dueAt" | "total" | "status";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface ListPaymentsQuery {
  invoiceId?: string;
  customerId?: string;
  method?: PaymentMethod;
  status?: PaymentStatus;
  createdAfter?: string;
  createdBefore?: string;
  sortBy?: "createdAt" | "amount";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

/** Public customer payment page (token link); payment completes on Renvani when embedded Checkout is enabled. */
export interface PublicInvoicePaymentLink {
  invoiceNumber: string;
  /** Renvani-hosted pay page URL (not a Stripe-hosted redirect). */
  paymentLinkUrl: string;
  /** Present when invoice Checkout uses embedded UI on the pay page. */
  checkoutClientSecret: string | null;
  invoiceAmount: string;
  /** Legacy alias: total customer-paid fees (the Service Fee). */
  platformFeeAmount: string;
  /** invoiceAmount + serviceFeeAmount. */
  totalDue: string;
  /** 2% Service Fee, separate line, non-refundable. */
  serviceFeeAmount: string;
  /** @deprecated Online-booking fee removed 2026-10-27; always "0.00". Kept for payload compatibility. */
  bookingFeeAmount: string;
  invoiceAmountCents: number;
  serviceFeeCents: number;
  bookingFeeCents: number;
  totalDueCents: number;
  /** Always false. */
  feeRefundable: boolean;
  /** Service Fee percent (2); kept for back-compat with the old Flex-only fee. */
  platformFeePercent: number | null;
  platformFeePaidByCustomer: boolean;
  /** Optional disclosure from `CUSTOMER_PLATFORM_FEE_DISCLOSURE` (empty = omit). */
  platformFeeDisclosure: string | null;
}

/** Public pay link response: legacy keys plus additive payer-safe display keys. */
export type PublicInvoicePaymentLinkView = PublicInvoicePaymentLink & PublicPayViewFields;

/** Payer-safe line item on the public pay page (no internal ids). */
export interface PublicPayLineItem {
  description: string;
  quantity: string;
  /** Unit price, 2-decimal money string. */
  unit: string;
  total: string;
}

/**
 * Additive, payer-safe top-level keys on GET /public/pay/:token and /receipt (Figma 53:3–53:465).
 * Never carries tenant ids, row ids, Stripe ids or internal notes. Extend by adding a key here,
 * a builder in apps/api/src/lib/public-pay-view.ts and the key in the route response allowlist.
 */
export interface PublicPayViewFields {
  shopName: string | null;
  shopLogoUrl: string | null;
  shopUrl: string | null;
  statementDescriptor: string | null;
  /** First + last (or display) name, as the frame header shows. */
  customerName: string | null;
  /** Street line only (frame: "1840 Grape St · Service on Oct 20"). */
  serviceAddress: string | null;
  serviceDate: string | null;
  dueAt: string | null;
  lineItems: PublicPayLineItem[];
  invoiceStatus: string;
  paymentStatus: string | null;
  paidAmount: string | null;
  paidAt: string | null;
  /** Masked (first character of the local part kept). */
  receiptEmail: string | null;
  /** True once the invoice is fully paid. */
  paid: boolean;
  /** True when a Renvani receipt email is sent for the latest succeeded payment (address on file, not opted out). */
  receiptEmailed: boolean;
  plan: "flex" | "flat" | null;
}

/** Receipt-only fee split (Service Fee + legacy booking fee on old payments). Fees are never refundable. */
export interface PublicPayReceiptFees {
  serviceFeeLabel: string | null;
  serviceFeeAmount: string;
  serviceFeeCents: number;
  /** @deprecated Legacy online-booking fee (removed 2026-10-27): non-zero only on payments recorded before removal. */
  bookingFeeAmount: string;
  /** @deprecated See bookingFeeAmount. */
  bookingFeeCents: number;
  feeRefundable: false;
}

/** Web client name for the GET /public/pay/:token response (apps/api routes/public/pay/schemas.ts). */
export type PublicPaymentLinkResponse = PublicInvoicePaymentLinkView;

/** GET /public/pay/:token/receipt response: legacy receipt keys + view keys + fee split. */
export interface PublicInvoiceReceiptResponse extends PublicPayViewFields, PublicPayReceiptFees {
  invoiceNumber: string;
  totalDue: string;
  invoiceAmount: string;
  platformFeeAmount: string;
  receiptPortalUrl: string;
  pdfDownloadUrl: string;
  brandName: string;
}
