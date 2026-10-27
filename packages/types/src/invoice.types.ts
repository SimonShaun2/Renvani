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
  /** $1.99 online-booking fee collected at checkout (separate line; not in total/tax/balance). */
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
  /** $1.99 online-booking fee on this payment ("0.00" unless it paid an online-booked invoice at checkout). */
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
}

export interface UpdateInvoiceItemInput {
  name?: string;
  description?: string;
  itemType?: InvoiceItemType;
  quantity?: number;
  unitPrice?: number;
  isTaxable?: boolean;
  sortOrder?: number;
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
  /** Legacy alias: total customer-paid fees (serviceFeeAmount + bookingFeeAmount). */
  platformFeeAmount: string;
  /** invoiceAmount + serviceFeeAmount + bookingFeeAmount. */
  totalDue: string;
  /** 2% Service Fee, separate line, non-refundable. */
  serviceFeeAmount: string;
  /** $1.99 online-booking fee when the invoice came from online booking; else "0.00". */
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
