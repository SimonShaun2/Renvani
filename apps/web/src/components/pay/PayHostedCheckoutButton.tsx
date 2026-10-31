"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { classifyHostedCheckoutError, startHostedCheckout, type HostedCheckoutError } from "./pay-hosted-checkout";

/**
 * Hosted Stripe Checkout fallback when embedded checkout can't render (no publishable key or no clientSecret).
 * Replaces the payment fields in 53:43; button styled as 53:72.
 */
export function PayHostedCheckoutButton({
  token,
  label = "Pay now",
  redirect = (url: string) => window.location.assign(url)
}: {
  token: string;
  label?: string;
  redirect?: (url: string) => void;
}) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<HostedCheckoutError | null>(null);

  const onClick = async () => {
    setPending(true);
    setError(null);
    try {
      const result = await startHostedCheckout(token);
      redirect(result.checkoutUrl);
    } catch (err) {
      const classified = classifyHostedCheckoutError(err);
      setError(classified);
      setPending(false);
      if (classified.refresh) void queryClient.invalidateQueries({ queryKey: ["invoices", "public-pay", token] });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p role="alert" data-error-kind={error.kind} className="rounded-lg bg-[#fbe3dc] p-3.5 text-[13px] font-medium text-[#b42318]">
          {error.message}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={pending || (error !== null && !error.canRetry)}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#f6b400] px-[18px] text-sm font-semibold text-[#0f1530] transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden /> : null}
        {pending ? "Opening secure checkout…" : label}
      </button>
    </div>
  );
}
