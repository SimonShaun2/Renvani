import { Decimal } from "decimal.js";
import Stripe from "stripe";

import { env } from "@fsm/config";
import { featureFlags } from "@fsm/config/feature-flags";
import {
  buildAgreementRetryPortalUrl,
  signAgreementPortalToken
} from "@fsm/config/agreement-portal-token";
import {
  buildCardStatementDescriptor,
  buildInvoicePaymentReturnUrl,
  buildStripeAccountBrandingPatch,
  RENVANI_STRIPE_BRAND
} from "@fsm/config/stripe-branding";
import {
  computeCheckoutFees,
  formatServiceFeeLineItemName,
  type RenvaniPlanId,
  SERVICE_FEE_RATE_BPS
} from "@fsm/config/stripe-pricing";

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export interface InvoiceCheckoutLineItem {
  name: string;
  description: string | null;
  quantity: string;
  total: string;
}

export const SERVICE_FEE_LINE_ITEM_NAME = formatServiceFeeLineItemName(SERVICE_FEE_RATE_BPS);

export interface CreateInvoiceCheckoutSessionInput {
  companyId: string;
  invoiceId: string;
  customerId: string;
  customerEmail: string | null;
  companyStripeAccountId: string;
  companyName: string;
  invoiceNumber: string;
  total: string;
  items: InvoiceCheckoutLineItem[];
  /** Public pay token — embedded Checkout return URL stays on Renvani. */
  paymentToken: string;
  /** Tenant's Renvani plan; Flat pays no Service Fee (no Service Fee line is sent to Stripe). */
  renvaniPlan: RenvaniPlanId | null;
  /** Force Stripe-hosted Checkout (public pay fallback) regardless of the embedded-checkout flag. */
  forceHosted?: boolean;
  /** Stripe idempotency key for the session create (concurrent identical requests reuse one session). */
  idempotencyKey?: string;
}

export interface InvoiceCheckoutSessionResult {
  id: string;
  /** Stripe-hosted URL; null when using embedded Checkout on Renvani. */
  url: string | null;
  clientSecret: string | null;
}

export interface CreateServiceAgreementPriceInput {
  companyId: string;
  templateId: string;
  name: string;
  amount: string;
  interval: "month" | "year";
  /** Stripe product display name; defaults to `name`. */
  productName?: string;
}

export interface CreateStripeCustomerInput {
  companyId: string;
  customerId: string;
  email: string | null;
  name: string;
}

export interface StripeCustomerResult {
  id: string;
}

export interface CreateServiceAgreementSubscriptionInput {
  companyId: string;
  planId: string;
  customerId: string;
  stripeCustomerId: string;
  stripePriceId: string;
  /** Recurring customer-paid Service Fee price ("Service Fee (2%)"); omitted on Flat. */
  stripePlatformFeePriceId?: string | null;
  companyStripeAccountId: string;
  /** Connect application fee % so Renvani keeps the Service Fee line; null when no fee. */
  applicationFeePercent: number | null;
}

export interface StripeSubscriptionResult {
  id: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

export interface ServiceAgreementSubscriptionSnapshotResult extends StripeSubscriptionResult {
  status: Stripe.Subscription.Status;
  paymentMethodLabel: string | null;
  retryPaymentUrl: string | null;
  latestInvoiceAmountDue: string | null;
  latestInvoiceDueDate: string | null;
}

export interface StripeConnectAccountSnapshot {
  id: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  accountName: string | null;
  payoutSchedule: string | null;
  lastPayoutAmount: string | null;
  lastPayoutAt: string | null;
}

function toCents(value: string): number {
  return new Decimal(value)
    .mul(100)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
}

function centsToCurrencyString(value: number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return new Decimal(value).div(100).toFixed(2);
}

function buildHostedDescription(item: InvoiceCheckoutLineItem): string | undefined {
  const parts = [`Quantity: ${item.quantity}`];

  if (item.description) {
    parts.push(item.description);
  }

  return parts.join(" • ");
}

function toSubscriptionResult(subscription: Stripe.Subscription): StripeSubscriptionResult {
  return {
    id: subscription.id,
    currentPeriodStart: subscription.current_period_start
      ? new Date(subscription.current_period_start * 1000)
      : null,
    currentPeriodEnd: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end
  };
}

function isExpandedPaymentMethod(value: unknown): value is Stripe.PaymentMethod {
  return typeof value === "object" && value !== null && "object" in value && value.object === "payment_method";
}

function getExpandedInvoice(value: unknown): Stripe.Invoice | null {
  return typeof value === "object" && value !== null && "object" in value && value.object === "invoice"
    ? (value as Stripe.Invoice)
    : null;
}

function buildPaymentMethodLabel(paymentMethod: Stripe.PaymentMethod | null): string | null {
  if (!paymentMethod || paymentMethod.type !== "card" || !paymentMethod.card) {
    return null;
  }

  const brand = paymentMethod.card.brand
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return `${brand} ending in ${paymentMethod.card.last4}`;
}

function formatPayoutSchedule(interval: string | null | undefined): string | null {
  if (!interval) {
    return null;
  }

  return interval.charAt(0).toUpperCase() + interval.slice(1);
}

export async function createInvoiceCheckoutSession(
  input: CreateInvoiceCheckoutSessionInput
): Promise<InvoiceCheckoutSessionResult> {
  const fees = computeCheckoutFees({ chargeCents: toCents(input.total), plan: input.renvaniPlan });
  const applicationFeeAmount = fees.serviceFeeCents;
  const appBaseUrl = env.APP_URL.replace(/\/$/, "");
  const statementDescriptor = buildCardStatementDescriptor(input.companyName);
  const useEmbeddedCheckout = featureFlags.stripeRenvaniEmbeddedCheckout;
  const paymentIntentData: Stripe.Checkout.SessionCreateParams.PaymentIntentData = {
    transfer_data: {
      destination: input.companyStripeAccountId
    },
    statement_descriptor: statementDescriptor,
    metadata: {
      companyId: input.companyId,
      invoiceId: input.invoiceId,
      customerId: input.customerId,
      renvaniReceiptChannel: "resend",
      invoiceAmountCents: String(fees.chargeCents),
      serviceFeeCents: String(fees.serviceFeeCents)
    }
  };

  if (applicationFeeAmount > 0) {
    paymentIntentData.application_fee_amount = applicationFeeAmount;
  }

  const serviceLineItems = input.items.map((item) => {
    const description = buildHostedDescription(item);

    return {
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: toCents(item.total),
        product_data: description ? { name: item.name, description } : { name: item.name }
      }
    };
  });

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [...serviceLineItems];

  if (fees.serviceFeeCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: fees.serviceFeeCents,
        product_data: {
          name: formatServiceFeeLineItemName(fees.serviceFeeRateBps),
          description: `${fees.serviceFeeRateBps / 100}% Service Fee (non-refundable). Your service provider receives the full invoice amount.`
        }
      }
    });
  }


  const sharedMetadata = {
    companyId: input.companyId,
    invoiceId: input.invoiceId,
    customerId: input.customerId,
    invoiceNumber: input.invoiceNumber
  };

  const embedded = useEmbeddedCheckout && input.forceHosted !== true;
  const session = await stripe.checkout.sessions.create(
    embedded
      ? {
          mode: "payment",
          ui_mode: "embedded",
          redirect_on_completion: "if_required",
          line_items: lineItems,
          payment_intent_data: paymentIntentData,
          return_url: buildInvoicePaymentReturnUrl(appBaseUrl, input.paymentToken),
          metadata: sharedMetadata,
          custom_text: {
            submit: {
              message: `Secure payment processed by ${RENVANI_STRIPE_BRAND.platformName}. Receipts are sent from Renvani, not Stripe.`
            }
          }
        }
      : {
          mode: "payment",
          line_items: lineItems,
          payment_intent_data: paymentIntentData,
          success_url: buildInvoicePaymentReturnUrl(appBaseUrl, input.paymentToken),
          cancel_url: `${appBaseUrl}/pay/${input.paymentToken}?status=cancelled`,
          metadata: sharedMetadata,
          custom_text: {
            submit: {
              message: `Secure payment processed by ${RENVANI_STRIPE_BRAND.platformName}.`
            }
          }
        },
    input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined
  );

  if (embedded) {
    if (!session.client_secret) {
      throw new Error("Stripe embedded checkout session did not return client_secret");
    }

    return {
      id: session.id,
      url: null,
      clientSecret: session.client_secret
    };
  }

  if (!session.url) {
    throw new Error("Stripe checkout session did not return a hosted URL");
  }

  return {
    id: session.id,
    url: session.url,
    clientSecret: null
  };
}

export async function retrieveInvoiceCheckoutClientSecret(sessionId: string): Promise<string | null> {
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.ui_mode === "embedded" && session.client_secret) {
    return session.client_secret;
  }

  return null;
}

export async function expireInvoiceCheckoutSession(sessionId: string): Promise<void> {
  await stripe.checkout.sessions.expire(sessionId);
}

export interface InvoiceCheckoutSessionSnapshot {
  id: string;
  uiMode: "hosted" | "embedded" | string | null;
  /** open | complete | expired */
  status: string | null;
  paymentStatus: string | null;
  url: string | null;
  expiresAt: Date | null;
  invoiceId: string | null;
  companyId: string | null;
}

export async function retrieveInvoiceCheckoutSession(sessionId: string): Promise<InvoiceCheckoutSessionSnapshot> {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return {
    id: session.id,
    uiMode: session.ui_mode ?? null,
    status: session.status ?? null,
    paymentStatus: session.payment_status ?? null,
    url: session.url ?? null,
    expiresAt: typeof session.expires_at === "number" ? new Date(session.expires_at * 1000) : null,
    invoiceId: session.metadata?.invoiceId ?? null,
    companyId: session.metadata?.companyId ?? null
  };
}

export async function createServiceAgreementPrice(
  input: CreateServiceAgreementPriceInput
): Promise<{ id: string }> {
  const price = await stripe.prices.create({
    currency: "usd",
    unit_amount: toCents(input.amount),
    recurring: {
      interval: input.interval
    },
    product_data: {
      name: input.productName ?? input.name,
      metadata: {
        companyId: input.companyId,
        templateId: input.templateId
      }
    }
  });

  return {
    id: price.id
  };
}

export async function archiveStripePrice(priceId: string): Promise<void> {
  await stripe.prices.update(priceId, {
    active: false
  });
}

export async function createStripeCustomer(input: CreateStripeCustomerInput): Promise<StripeCustomerResult> {
  const customer = await stripe.customers.create({
    ...(input.email ? { email: input.email } : {}),
    name: input.name,
    metadata: {
      companyId: input.companyId,
      customerId: input.customerId,
      renvaniTransactionalEmail: "true"
    },
    invoice_settings: {
      footer: `${RENVANI_STRIPE_BRAND.platformName} — invoice and receipts are delivered by your service provider via Renvani.`
    }
  });

  return {
    id: customer.id
  };
}

export async function createServiceAgreementSubscription(
  input: CreateServiceAgreementSubscriptionInput
): Promise<StripeSubscriptionResult> {
  const items: Stripe.SubscriptionCreateParams.Item[] = [{ price: input.stripePriceId }];

  if (input.stripePlatformFeePriceId) {
    items.push({ price: input.stripePlatformFeePriceId });
  }

  const subscriptionParams: Stripe.SubscriptionCreateParams = {
    customer: input.stripeCustomerId,
    items,
    collection_method: "charge_automatically",
    transfer_data: {
      destination: input.companyStripeAccountId
    },
    ...(input.applicationFeePercent && input.applicationFeePercent > 0
      ? { application_fee_percent: input.applicationFeePercent }
      : {}),
    metadata: {
      companyId: input.companyId,
      planId: input.planId,
      customerId: input.customerId,
      ...(input.stripePlatformFeePriceId
        ? { platformFeePriceId: input.stripePlatformFeePriceId }
        : {})
    }
  };

  const subscription = await stripe.subscriptions.create(subscriptionParams);

  return toSubscriptionResult(subscription);
}

export async function updateServiceAgreementSubscriptionCancelAtPeriodEnd(
  subscriptionId: string,
  cancelAtPeriodEnd: boolean
): Promise<StripeSubscriptionResult> {
  const subscription = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: cancelAtPeriodEnd
  });

  return toSubscriptionResult(subscription);
}

export async function cancelServiceAgreementSubscription(
  subscriptionId: string
): Promise<StripeSubscriptionResult> {
  const subscription = await stripe.subscriptions.cancel(subscriptionId);
  return toSubscriptionResult(subscription);
}

export async function pauseServiceAgreementSubscription(
  subscriptionId: string
): Promise<StripeSubscriptionResult> {
  const subscription = await stripe.subscriptions.update(subscriptionId, {
    pause_collection: {
      behavior: "void"
    }
  });

  return toSubscriptionResult(subscription);
}

export interface ServiceAgreementPortalContext {
  companyId: string;
  agreementId: string;
}

export async function retrieveServiceAgreementSubscriptionSnapshot(
  subscriptionId: string,
  portalContext?: ServiceAgreementPortalContext
): Promise<ServiceAgreementSubscriptionSnapshotResult> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["default_payment_method", "latest_invoice", "latest_invoice.default_payment_method"]
  });
  const latestInvoice = getExpandedInvoice(subscription.latest_invoice);
  const subscriptionPaymentMethod = isExpandedPaymentMethod(subscription.default_payment_method)
    ? subscription.default_payment_method
    : null;
  const invoicePaymentMethod = latestInvoice && isExpandedPaymentMethod(latestInvoice.default_payment_method)
    ? latestInvoice.default_payment_method
    : null;
  const paymentMethodLabel = buildPaymentMethodLabel(subscriptionPaymentMethod ?? invoicePaymentMethod);
  const appBaseUrl = env.APP_URL.replace(/\/$/, "");
  const openInvoice =
    latestInvoice?.status === "open" || latestInvoice?.status === "uncollectible";

  let retryPaymentUrl: string | null = null;
  if (featureFlags.stripeRenvaniPortalUrls && openInvoice && portalContext) {
    const portalToken = signAgreementPortalToken(portalContext.companyId, portalContext.agreementId);
    retryPaymentUrl = buildAgreementRetryPortalUrl(appBaseUrl, portalToken);
  } else if (!featureFlags.stripeRenvaniPortalUrls) {
    retryPaymentUrl = latestInvoice?.hosted_invoice_url ?? null;
  }

  return {
    ...toSubscriptionResult(subscription),
    status: subscription.status,
    paymentMethodLabel,
    retryPaymentUrl,
    latestInvoiceAmountDue: centsToCurrencyString(latestInvoice?.amount_due),
    latestInvoiceDueDate: latestInvoice?.due_date
      ? new Date(latestInvoice.due_date * 1000).toISOString().slice(0, 10)
      : null
  };
}

export async function createExpressConnectedAccount(companyId: string, companyName?: string): Promise<{ id: string }> {
  const appBaseUrl = env.APP_URL.replace(/\/$/, "");
  const statementDescriptor = buildCardStatementDescriptor(companyName);
  const brandingPatch = buildStripeAccountBrandingPatch();

  const account = await stripe.accounts.create({
    type: "express",
    metadata: {
      companyId
    },
    business_profile: {
      name: companyName ?? RENVANI_STRIPE_BRAND.platformName,
      support_url: appBaseUrl,
      url: appBaseUrl
    },
    settings: {
      branding: brandingPatch,
      payments: {
        statement_descriptor: statementDescriptor
      }
    }
  });

  return {
    id: account.id
  };
}

/**
 * Tester/dev-only: create a platform-onboarded Custom connected account in Stripe TEST mode with
 * Stripe's documented test identity data, so a tester company can take test payments without the
 * hosted onboarding form. Callers must gate on tier and an sk_test_ key; this refuses live keys too.
 */
export async function createTestProvisionedConnectedAccount(input: {
  companyId: string;
  companyName?: string | null;
  tosIp: string;
}): Promise<StripeConnectAccountSnapshot> {
  if (!env.STRIPE_SECRET_KEY.startsWith("sk_test_")) {
    throw new Error("Test provisioning requires a Stripe test secret key");
  }

  const appBaseUrl = env.APP_URL.replace(/\/$/, "");
  const account = await stripe.accounts.create(
    {
      type: "custom",
      country: "US",
      email: `stripe-test+${input.companyId}@example.com`,
      business_type: "individual",
      metadata: { companyId: input.companyId, renvaniTestProvisioned: "true" },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      },
      business_profile: {
        name: input.companyName ?? RENVANI_STRIPE_BRAND.platformName,
        mcc: "1711",
        product_description: "Field service (test account)",
        support_url: appBaseUrl,
        url: appBaseUrl
      },
      individual: {
        first_name: "Test",
        last_name: "Tester",
        email: `stripe-test+${input.companyId}@example.com`,
        phone: "+18885551234",
        dob: { day: 1, month: 1, year: 1901 },
        ssn_last_4: "0000",
        id_number: "000000000",
        address: {
          line1: "address_full_match",
          city: "Chicago",
          state: "IL",
          postal_code: "60601",
          country: "US"
        }
      },
      external_account: "btok_us_verified",
      tos_acceptance: {
        date: Math.floor(Date.now() / 1000),
        ip: input.tosIp
      },
      settings: {
        payments: { statement_descriptor: buildCardStatementDescriptor(input.companyName ?? undefined) }
      }
    },
    { idempotencyKey: `renvani-test-provision-${input.companyId}` }
  );

  return {
    id: account.id,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
    accountName: account.business_profile?.name ?? null,
    payoutSchedule: null,
    lastPayoutAmount: null,
    lastPayoutAt: null
  };
}

export async function applyConnectAccountBranding(accountId: string, companyName?: string | null): Promise<void> {
  const appBaseUrl = env.APP_URL.replace(/\/$/, "");
  const statementDescriptor = buildCardStatementDescriptor(companyName);
  const brandingPatch = buildStripeAccountBrandingPatch();

  await stripe.accounts.update(accountId, {
    business_profile: {
      ...(companyName ? { name: companyName } : {}),
      support_url: appBaseUrl,
      url: appBaseUrl
    },
    settings: {
      branding: brandingPatch,
      payments: {
        statement_descriptor: statementDescriptor
      }
    }
  });
}

export type ConnectEmbeddedComponent = "account_onboarding" | "payments" | "payouts";

export async function createConnectAccountSession(
  accountId: string,
  components: ConnectEmbeddedComponent[]
): Promise<{ clientSecret: string }> {
  const componentConfig: Stripe.AccountSessionCreateParams.Components = {};

  if (components.includes("account_onboarding")) {
    componentConfig.account_onboarding = { enabled: true };
  }
  if (components.includes("payments")) {
    componentConfig.payments = {
      enabled: true,
      features: {
        refund_management: true,
        dispute_management: true,
        capture_payments: true
      }
    };
  }
  if (components.includes("payouts")) {
    componentConfig.payouts = {
      enabled: true,
      features: {
        instant_payouts: true,
        standard_payouts: true
      }
    };
  }

  const session = await stripe.accountSessions.create({
    account: accountId,
    components: componentConfig
  });

  if (!session.client_secret) {
    throw new Error("Stripe Account Session missing client_secret");
  }

  return { clientSecret: session.client_secret };
}

export async function createConnectOnboardingLink(accountId: string): Promise<{ url: string }> {
  const appBaseUrl = env.APP_URL.replace(/\/$/, "");
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appBaseUrl}/settings/payments/onboard?refresh=true`,
    return_url: `${appBaseUrl}/settings/payments/onboard/return`,
    type: "account_onboarding"
  });

  return {
    url: accountLink.url
  };
}

export async function retrieveConnectedAccount(accountId: string): Promise<StripeConnectAccountSnapshot> {
  const [account, payouts] = await Promise.all([
    stripe.accounts.retrieve(accountId),
    stripe.payouts.list({ limit: 1 }, { stripeAccount: accountId })
  ]);
  const lastPayout = payouts.data[0];

  return {
    id: account.id,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
    accountName: account.business_profile?.name ?? account.company?.name ?? null,
    payoutSchedule: formatPayoutSchedule(account.settings?.payouts?.schedule?.interval),
    lastPayoutAmount: centsToCurrencyString(lastPayout?.amount ?? null),
    lastPayoutAt: lastPayout?.arrival_date
      ? new Date(lastPayout.arrival_date * 1000).toISOString()
      : null
  };
}

export async function createExpressDashboardLink(accountId: string): Promise<{ url: string }> {
  const loginLink = await stripe.accounts.createLoginLink(accountId);

  return {
    url: loginLink.url
  };
}

export interface CreatePlatformBillingCheckoutInput {
  companyId: string;
  stripeCustomerId: string;
  priceId: string;
  planTier: "flex" | "flat";
  customerEmail: string | null;
}

export interface PlatformBillingCheckoutResult {
  sessionId: string;
  url: string;
}

export async function createPlatformBillingCheckoutSession(
  input: CreatePlatformBillingCheckoutInput
): Promise<PlatformBillingCheckoutResult> {
  const appBaseUrl = env.APP_URL.replace(/\/$/, "");
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: input.stripeCustomerId,
    line_items: [{ price: input.priceId, quantity: 1 }],
    success_url: `${appBaseUrl}/settings/billing?checkout=success`,
    cancel_url: `${appBaseUrl}/settings/billing?checkout=cancel`,
    metadata: {
      companyId: input.companyId,
      billingKind: "platform_mvp",
      planTier: input.planTier
    },
    subscription_data: {
      metadata: {
        companyId: input.companyId,
        billingKind: "platform_mvp",
        planTier: input.planTier
      }
    },
    custom_text: {
      submit: {
        message: `${RENVANI_STRIPE_BRAND.platformName} subscription — billing notices come from Renvani.`
      }
    }
  });

  if (!session.url) {
    throw new Error("Stripe checkout session missing url");
  }

  return {
    sessionId: session.id,
    url: session.url
  };
}

export async function createStripePlatformCustomer(input: {
  companyId: string;
  email: string | null;
  name: string;
}): Promise<StripeCustomerResult> {
  const customer = await stripe.customers.create({
    ...(input.email ? { email: input.email } : {}),
    name: input.name,
    metadata: {
      companyId: input.companyId,
      billingKind: "platform_mvp"
    }
  });

  return { id: customer.id };
}

export interface CreateVipMembershipCheckoutSessionInput {
  companyId: string;
  companyName: string;
  companyStripeAccountId: string;
  customerId: string;
  customerEmail: string | null;
  stripeCustomerId: string;
  vipTierId: string;
  tierName: string;
  planId: string;
  stripeTierPriceId: string;
  stripePlatformFeePriceId?: string | null;
  /** Connect application fee % so Renvani keeps the Service Fee line; null when no fee. */
  applicationFeePercent: number | null;
  joinToken: string;
}

export interface VipMembershipCheckoutSessionResult {
  sessionId: string;
  url: string;
}

export async function createVipMembershipCheckoutSession(
  input: CreateVipMembershipCheckoutSessionInput
): Promise<VipMembershipCheckoutSessionResult> {
  const appBaseUrl = env.APP_URL.replace(/\/$/, "");
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: input.stripeTierPriceId, quantity: 1 }
  ];

  if (input.stripePlatformFeePriceId) {
    lineItems.push({ price: input.stripePlatformFeePriceId, quantity: 1 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: input.stripeCustomerId,
    line_items: lineItems,
    success_url: `${appBaseUrl}/vip/join/${input.joinToken}?status=success`,
    cancel_url: `${appBaseUrl}/vip/join/${input.joinToken}?status=cancel`,
    metadata: {
      companyId: input.companyId,
      customerId: input.customerId,
      vipTierId: input.vipTierId,
      planId: input.planId,
      billingKind: "vip_membership"
    },
    subscription_data: {
      transfer_data: {
        destination: input.companyStripeAccountId
      },
      ...(input.applicationFeePercent && input.applicationFeePercent > 0
        ? { application_fee_percent: input.applicationFeePercent }
        : {}),
      metadata: {
        companyId: input.companyId,
        customerId: input.customerId,
        vipTierId: input.vipTierId,
        planId: input.planId,
        billingKind: "vip_membership",
        ...(input.stripePlatformFeePriceId
          ? { platformFeePriceId: input.stripePlatformFeePriceId }
          : {})
      }
    },
    custom_text: {
      submit: {
        message: `${RENVANI_STRIPE_BRAND.platformName} membership — ${input.tierName} at ${input.companyName}. Receipts and billing notices come from Renvani.`
      }
    }
  });

  if (!session.url) {
    throw new Error("Stripe VIP checkout session missing url");
  }

  return {
    sessionId: session.id,
    url: session.url
  };
}

/** FS-199: read-only payout views for a tenant's Express (Connect) account. */
export interface ConnectedAccountPayout {
  id: string;
  amount: string;
  currency: string;
  status: string;
  arrivalDate: string | null;
  createdAt: string;
  method: string | null;
  type: string | null;
  description: string | null;
  failureCode: string | null;
}

function mapConnectedAccountPayout(payout: Stripe.Payout): ConnectedAccountPayout {
  return {
    id: payout.id,
    amount: centsToCurrencyString(payout.amount) ?? "0.00",
    currency: payout.currency,
    status: payout.status,
    arrivalDate: payout.arrival_date ? new Date(payout.arrival_date * 1000).toISOString() : null,
    createdAt: new Date(payout.created * 1000).toISOString(),
    method: payout.method ?? null,
    type: payout.type ?? null,
    description: payout.description ?? null,
    failureCode: payout.failure_code ?? null
  };
}

export async function listConnectedAccountPayouts(
  accountId: string,
  query: { limit: number; startingAfter?: string }
): Promise<{ data: ConnectedAccountPayout[]; hasMore: boolean }> {
  const page = await stripe.payouts.list(
    { limit: query.limit, ...(query.startingAfter ? { starting_after: query.startingAfter } : {}) },
    { stripeAccount: accountId }
  );
  return { data: page.data.map(mapConnectedAccountPayout), hasMore: page.has_more };
}

export async function retrieveConnectedAccountPayout(
  accountId: string,
  payoutId: string
): Promise<ConnectedAccountPayout | null> {
  try {
    return mapConnectedAccountPayout(await stripe.payouts.retrieve(payoutId, {}, { stripeAccount: accountId }));
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode === 404) return null;
    throw error;
  }
}
