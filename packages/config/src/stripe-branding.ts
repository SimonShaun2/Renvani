import { paymentEnv as env } from "./runtime-env.js";
import { RENVANI_STRIPE_BRAND } from "./stripe-public.js";

export { RENVANI_STRIPE_BRAND, buildConnectJsAppearance } from "./stripe-public.js";

const STATEMENT_DESCRIPTOR_MAX = 22;
const STATEMENT_PREFIX_MAX = 10;

function normalizeDescriptorPart(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9* .]/g, "").trim();
}

function sanitizeDescriptorPart(value: string): string {
  return normalizeDescriptorPart(value).slice(0, STATEMENT_DESCRIPTOR_MAX);
}

/**
 * Card statement text: prefer shop name when short enough; otherwise RENVANI prefix + suffix.
 * Live-mode descriptor approval remains with founder (Stripe dashboard / support).
 */
export function buildCardStatementDescriptor(shopName?: string | null): string {
  const configuredPrefix = env.STRIPE_RENVANI_STATEMENT_PREFIX.trim() || RENVANI_STRIPE_BRAND.defaultStatementPrefix;
  const prefix = sanitizeDescriptorPart(configuredPrefix).slice(0, STATEMENT_PREFIX_MAX);

  if (shopName) {
    const shopNormalized = normalizeDescriptorPart(shopName);
    if (shopNormalized.length >= 3 && shopNormalized.length <= STATEMENT_DESCRIPTOR_MAX) {
      return shopNormalized;
    }
    const suffixMax = Math.max(STATEMENT_DESCRIPTOR_MAX - prefix.length - 1, 4);
    const suffix = shopNormalized.replace(/\s+/g, "").slice(0, suffixMax);
    return sanitizeDescriptorPart(`${prefix} ${suffix}`);
  }

  return prefix;
}

export function resolveStripeBrandingLogoUrl(): string | undefined {
  const url = env.STRIPE_BRANDING_LOGO_URL.trim();
  return url.length > 0 ? url : undefined;
}

export function resolveStripeBrandingIconUrl(): string | undefined {
  const url = env.STRIPE_BRANDING_ICON_URL.trim();
  return url.length > 0 ? url : undefined;
}

export function buildStripeAccountBrandingPatch(): {
  primary_color: string;
  secondary_color: string;
  logo?: string;
  icon?: string;
} {
  const logo = resolveStripeBrandingLogoUrl();
  const icon = resolveStripeBrandingIconUrl();

  return {
    primary_color: RENVANI_STRIPE_BRAND.primaryColor,
    secondary_color: RENVANI_STRIPE_BRAND.secondaryColor,
    ...(logo ? { logo } : {}),
    ...(icon ? { icon } : {})
  };
}

/** Renvani-hosted pay return path (embedded Checkout completes in-app). */
export function buildInvoicePaymentReturnUrl(appBaseUrl: string, paymentToken: string): string {
  const base = appBaseUrl.replace(/\/$/, "");
  return `${base}/pay/${paymentToken}?status=success`;
}
