/** Public, side-effect-free payment presentation values. No server environment import. */
export const SERVICE_FEE_RATE_BPS = 200;

export function formatServiceFeeLineItemName(rateBps: number = SERVICE_FEE_RATE_BPS): string {
  const pct = Number((rateBps / 100).toFixed(2));
  return `Service Fee (${pct}%)`;
}

export const RENVANI_STRIPE_BRAND = {
  platformName: "Renvani",
  defaultStatementPrefix: "RENVANI",
  primaryColor: "#2563eb",
  secondaryColor: "#102163"
} as const;

export function buildConnectJsAppearance(): {
  overlays: "dialog";
  variables: { colorPrimary: string; colorText: string; fontFamily: string };
} {
  return {
    overlays: "dialog",
    variables: {
      colorPrimary: RENVANI_STRIPE_BRAND.primaryColor,
      colorText: RENVANI_STRIPE_BRAND.secondaryColor,
      fontFamily: "Inter, system-ui, sans-serif"
    }
  };
}
