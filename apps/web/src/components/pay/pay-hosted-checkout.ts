import { ApiError } from "@/src/lib/api";
import { publicApi } from "@/src/lib/public-api";

/** POST /api/v1/public/pay/:token/hosted-checkout (#292). No body; server sends Cache-Control: no-store. */
export interface HostedCheckoutResponse {
  mode: "hosted";
  checkoutUrl: string;
  expiresAt: string | null;
  reused: boolean;
}

export function startHostedCheckout(token: string): Promise<HostedCheckoutResponse> {
  return publicApi.post<HostedCheckoutResponse>(`/api/v1/public/pay/${encodeURIComponent(token)}/hosted-checkout`, undefined);
}

export type HostedCheckoutErrorKind = "paid" | "processing" | "unpayable" | "retry" | "rate_limited" | "invalid" | "temporary";

export interface HostedCheckoutError {
  kind: HostedCheckoutErrorKind;
  message: string;
  /** Pay now stays enabled. */
  canRetry: boolean;
  /** Refetch the pay view (e.g. it may now be paid). */
  refresh: boolean;
}

/** Maps the API's 400/404/409/429 messages (hosted-checkout.service.ts) to customer copy. */
export function classifyHostedCheckoutError(error: unknown): HostedCheckoutError {
  if (error instanceof ApiError) {
    const msg = error.payload?.message ?? "";
    if (error.status === 400 || error.status === 404) {
      return { kind: "invalid", message: "This payment link isn't valid. Contact your service provider for a new link.", canRetry: false, refresh: false };
    }
    if (error.status === 429) {
      return { kind: "rate_limited", message: "Too many checkout attempts. Please wait a minute and try again.", canRetry: true, refresh: false };
    }
    if (error.status === 409) {
      if (/already paid/i.test(msg)) return { kind: "paid", message: "This invoice is already paid.", canRetry: false, refresh: true };
      if (/already processing/i.test(msg)) {
        return { kind: "processing", message: "A payment for this invoice is already processing. Check back shortly.", canRetry: false, refresh: true };
      }
      if (/not payable|link is unavailable/i.test(msg)) {
        return { kind: "unpayable", message: "This invoice can't be paid online right now. Contact your service provider.", canRetry: false, refresh: true };
      }
      // "Checkout changed while preparing; please retry" / "temporarily unavailable; please retry in a moment"
      return { kind: "retry", message: "Checkout needs a moment. Please try again.", canRetry: true, refresh: false };
    }
  }
  return { kind: "temporary", message: "We couldn't start checkout. Please try again.", canRetry: true, refresh: false };
}
