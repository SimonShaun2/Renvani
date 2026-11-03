"use client";

import { useCallback, useMemo, useState } from "react";
import { ConnectAccountOnboarding, ConnectComponentsProvider } from "@stripe/react-connect-js";
import { loadConnectAndInitialize, type StripeConnectInstance } from "@stripe/connect-js";
import { buildConnectJsAppearance } from "@fsm/config/stripe-branding";

import { api } from "@/src/lib/api";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

interface StripeConnectEmbeddedProps {
  onComplete?: () => void;
}

export function StripeConnectEmbedded({ onComplete }: StripeConnectEmbeddedProps) {
  const [error, setError] = useState<string | null>(null);

  const fetchClientSecret = useCallback(async () => {
    try {
      const response = await api.post<{ clientSecret: string }>("/api/v1/stripe/connect/account-session", {
        components: ["account_onboarding", "payments", "payouts"]
      });
      return response.clientSecret;
    } catch {
      setError("Could not start embedded Stripe setup. Try again or use the redirect flow.");
      throw new Error("account_session_failed");
    }
  }, []);

  const connectInstance = useMemo((): StripeConnectInstance | null => {
    if (!publishableKey) {
      return null;
    }

    return loadConnectAndInitialize({
      publishableKey,
      fetchClientSecret,
      appearance: buildConnectJsAppearance()
    });
  }, [fetchClientSecret]);

  if (!publishableKey || !connectInstance) {
    return null;
  }

  return (
    <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <ConnectComponentsProvider connectInstance={connectInstance}>
        <ConnectAccountOnboarding
          onExit={() => {
            onComplete?.();
          }}
        />
      </ConnectComponentsProvider>
    </div>
  );
}
