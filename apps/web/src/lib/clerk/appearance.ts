/** Clerk appearance built from src/styles/tokens.css (keep hex values in sync with the CSS variables). */
export const RENVANI_CLERK_TOKENS = {
  brandPrimary: "#102163",
  brandAccent: "#257afa",
  neutral900: "#131521",
  neutral200: "#edeff2",
  error: "#ef414c",
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
} as const;

export const RENVANI_GROWTH_TAGLINE = "Grow your shop. Renvani runs the rest.";

export const renvaniClerkAppearance = {
  layout: {
    logoPlacement: "inside" as const,
    socialButtonsPlacement: "bottom" as const
  },
  variables: {
    colorPrimary: RENVANI_CLERK_TOKENS.brandAccent,
    colorText: RENVANI_CLERK_TOKENS.neutral900,
    colorDanger: RENVANI_CLERK_TOKENS.error,
    colorInputBackground: RENVANI_CLERK_TOKENS.neutral200,
    fontFamily: RENVANI_CLERK_TOKENS.fontFamily,
    borderRadius: "1rem"
  },
  elements: {
    card: "shadow-none border border-neutral-200",
    formButtonPrimary: "bg-brand-accent hover:bg-brand-primary text-white",
    headerTitle: "text-neutral-900",
    footerActionLink: "text-brand-accent hover:text-brand-primary"
  }
};
