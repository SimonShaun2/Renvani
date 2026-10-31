/**
 * Config for the post-sign-up "create your workspace" step (Clerk mode only).
 * The step list drives the progress UI; add a step here rather than in the component.
 */
export const WORKSPACE_SETUP_ROUTE = "/onboarding/workspace";
export const WORKSPACE_SETUP_NEXT_ROUTE = "/onboarding/import";
/** Lean authenticated endpoint that returns 401/403/404 until the Clerk org is linked to a company. */
export const WORKSPACE_READY_ENDPOINT = "/api/v1/company";
export const WORKSPACE_POLL_TIMEOUT_MS = 30_000;
export const WORKSPACE_POLL_INTERVAL_MS = 1_500;
export const WORKSPACE_NAME_MAX_LENGTH = 80;

/** Onboarding steps registry; the eyebrow ("STEP 1 OF 2") is derived from it. */
export const ONBOARDING_STEPS = [
  { key: "workspace", route: WORKSPACE_SETUP_ROUTE },
  { key: "import", route: WORKSPACE_SETUP_NEXT_ROUTE }
] as const;

export function onboardingStepLabel(key: (typeof ONBOARDING_STEPS)[number]["key"]): string {
  const index = ONBOARDING_STEPS.findIndex((step) => step.key === key);
  return `STEP ${index + 1} OF ${ONBOARDING_STEPS.length}`;
}

/** Copy from Figma frame 158:4946 "Onboarding / 00 Create your workspace". */
export const WORKSPACE_COPY = {
  eyebrow: onboardingStepLabel("workspace"),
  title: "Name your workspace",
  intro: "You can change this later in Settings.",
  nameLabel: "Company name",
  submit: "Create workspace",
  progress: "Setting up your workspace…",
  error: "We couldn't set up your workspace. Try again.",
  retry: "Try again",
  continue: "Continue",
  /** Secondary detail under the frame's error banner (not in the frame). */
  detailCompany: "Your company is still being set up on our side.",
  detailRole: "Your workspace exists, but owner access hasn't reached your session yet.",
  detailCreate: "The workspace couldn't be created. Check the name."
} as const;
