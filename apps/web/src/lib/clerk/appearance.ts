/** Shared Clerk appearance. The canonical sign-in design has a scoped override below. */
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

/**
 * Figma 388:4218 (desktop), 388:4269 (tablet), 388:4320 (mobile).
 * Style Clerk's real controls; never substitute non-functional mock inputs,
 * social-provider buttons, or password-reset links.
 */
export const renvaniClerkSignInAppearance = {
  ...renvaniClerkAppearance,
  variables: {
    ...renvaniClerkAppearance.variables,
    colorPrimary: "#f6b400",
    colorBackground: "#ffffff",
    colorText: "#0f1530",
    colorTextSecondary: "#5e6684",
    colorInputBackground: "#ffffff",
    colorInputText: "#0f1530",
    fontFamily: "var(--font-mkt-sans), Geist, ui-sans-serif, system-ui, sans-serif",
    borderRadius: "0.75rem"
  },
  elements: {
    ...renvaniClerkAppearance.elements,
    rootBox: "!w-full",
    cardBox: "!w-full !max-w-[440px] !shadow-none",
    card: "!w-full !overflow-hidden !rounded-2xl !border !border-[#e6dccb] !bg-white !shadow-none",
    header: "!px-5 !pt-8 !pb-4 !text-center sm:!px-7",
    headerTitle: "!text-center !text-2xl !font-semibold !text-[#0f1530]",
    headerSubtitle: "!text-center !text-sm !text-[#5e6684]",
    main: "!px-5 !pb-8 sm:!px-7",
    formFieldLabel: "!text-[13px] !font-medium !text-[#0f1530]",
    formFieldInput: "!h-[52px] !rounded-xl !border-[#e6dccb] !bg-white !px-4 !text-sm !text-[#0f1530] focus:!border-[#f6b400]",
    formFieldAction: "!text-[#2a3360]",
    formButtonPrimary: "!h-12 !rounded-full !bg-[#f6b400] !font-medium !text-[#0f1530] !shadow-none hover:!bg-[#e9aa00]",
    socialButtonsBlockButton: "!h-12 !rounded-full !border !border-[#e6dccb] !bg-white !text-[#0f1530] !shadow-none hover:!bg-[#fbf6ef]",
    dividerLine: "!bg-[#e6dccb]",
    dividerText: "!text-[#5e6684]",
    footer: "!border-t !border-[#e6dccb] !bg-[#fbf6ef] !px-5 !py-4 sm:!px-7",
    footerActionText: "!text-[#2a3360]",
    footerActionLink: "!font-semibold !text-[#0f1530] !underline hover:!text-[#2a3360]"
  }
};
