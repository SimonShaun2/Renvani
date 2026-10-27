import Stripe from "stripe";

import { env } from "@fsm/config";
import { AppError, ErrorCode } from "@fsm/types";

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

/** FS-138: production PAN import requires founder approval; enforce test keys only. */
export function assertStripeTestModeForCardMigration(): void {
  if (!env.STRIPE_SECRET_KEY.startsWith("sk_test_")) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Saved card migration is only available in Stripe test mode until production approval"
    );
  }
}

export const RENVANI_STRIPE_PAN_IMPORT_DOCS_URL =
  "https://docs.stripe.com/payments/account/statement-descriptors";

export interface AttachImportedPaymentMethodInput {
  stripeConnectAccountId: string;
  stripeCustomerId: string;
  stripePaymentMethodId: string;
  renvaniCustomerId: string;
  companyId: string;
  /** Owner acknowledgment (FS-138) that customers consented to off-session charges; required. */
  offSessionConsentAcknowledgedAt: Date | null;
}

export interface AttachImportedPaymentMethodResult {
  paymentMethodLabel: string | null;
}

function buildCardLabel(paymentMethod: Stripe.PaymentMethod): string | null {
  if (paymentMethod.type !== "card" || !paymentMethod.card) {
    return null;
  }
  const brand = paymentMethod.card.brand.toUpperCase();
  return `${brand} ending in ${paymentMethod.card.last4}`;
}

export async function attachImportedPaymentMethodToCustomer(
  input: AttachImportedPaymentMethodInput
): Promise<AttachImportedPaymentMethodResult> {
  assertStripeTestModeForCardMigration();
  if (!input.offSessionConsentAcknowledgedAt) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Owner acknowledgment of off-session charge consent is required"
    );
  }

  const paymentMethod = await stripe.paymentMethods.retrieve(
    input.stripePaymentMethodId,
    { stripeAccount: input.stripeConnectAccountId }
  );

  if (paymentMethod.customer && paymentMethod.customer !== input.stripeCustomerId) {
    throw new AppError(ErrorCode.CONFLICT, "Payment method is already attached to another Stripe customer");
  }

  if (!paymentMethod.customer) {
    await stripe.paymentMethods.attach(
      input.stripePaymentMethodId,
      { customer: input.stripeCustomerId },
      { stripeAccount: input.stripeConnectAccountId }
    );
  }

  await stripe.customers.update(
    input.stripeCustomerId,
    {
      invoice_settings: { default_payment_method: input.stripePaymentMethodId },
      metadata: {
        companyId: input.companyId,
        renvaniCustomerId: input.renvaniCustomerId
      }
    },
    { stripeAccount: input.stripeConnectAccountId }
  );

  return { paymentMethodLabel: buildCardLabel(paymentMethod) };
}
