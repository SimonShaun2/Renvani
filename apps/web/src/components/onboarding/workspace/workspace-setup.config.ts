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

export type WorkspaceStepKey = "name" | "create" | "provision" | "role";

export interface WorkspaceStep {
  key: WorkspaceStepKey;
  label: string;
}

export const WORKSPACE_STEPS: readonly WorkspaceStep[] = [
  { key: "name", label: "Name your company" },
  { key: "create", label: "Create workspace" },
  { key: "provision", label: "Set up your company" },
  { key: "role", label: "Grant owner access" }
] as const;

export const WORKSPACE_COPY = {
  title: "Create your workspace",
  intro: "Add your company name. You'll be the owner and can invite your team later.",
  nameLabel: "Company name",
  submit: "Create workspace",
  retry: "Retry",
  timeoutCompany: "We couldn't finish setting up your company. This can take a moment. Try again.",
  timeoutRole: "Your workspace exists, but owner access hasn't reached your session yet. Try again.",
  createFailed: "We couldn't create the workspace. Check the name and try again."
} as const;
