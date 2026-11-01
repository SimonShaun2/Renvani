"use client";

import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useMemo } from "react";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

/**
 * Embedded checkout needs both a session client secret (from the API) and the publishable key.
 * When either is missing, callers must render the hosted "Pay" link fallback instead.
 */
export function isEmbeddedCheckoutAvailable(clientSecret: string | null | undefined, key: string = publishableKey): boolean {
  return Boolean(clientSecret) && key.trim().length > 0;
}

export function StripeEmbeddedInvoiceCheckout({ clientSecret }: { clientSecret: string }) {
  const stripePromise = useMemo(() => (publishableKey ? loadStripe(publishableKey) : null), []);

  if (!stripePromise) {
    return null;
  }

  return (
    <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
      <EmbeddedCheckout />
    </EmbeddedCheckoutProvider>
  );
}
