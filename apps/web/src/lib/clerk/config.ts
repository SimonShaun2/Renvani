/**
 * Clerk env/config module (mirrors the Stripe pattern: keys only from env, no values in code).
 * NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY — browser + middleware. CLERK_SECRET_KEY — server only (read by @clerk/nextjs).
 * When the publishable key is absent, Clerk is disabled and the legacy in-repo JWT auth stays active.
 */
export const CLERK_SIGN_IN_PATH = "/login";
export const CLERK_SIGN_UP_PATH = "/signup";

export function getClerkPublishableKey(env: Record<string, string | undefined> = process.env): string {
  return env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? "";
}

export function isClerkEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return getClerkPublishableKey(env).length > 0;
}
