import type { HomeServiceTrade } from "@fsm/types";

/** Copy from Figma 309:3333 / 309:3498. */
export const TRADE_PICKER_COPY = {
  pageTitle: "Company settings",
  cardTitle: "Your trade",
  cardBody: "Sets up your job types, price book and technician skills.",
  save: "Save changes",
  saving: "Saving…",
  saved: "✓ Trade saved",
  error: "We couldn't save your trade. Try again.",
  retry: "Retry",
  describeLabel: "Describe your trade *",
  describePlaceholder: "Example: Garage door service",
  describeHelp: "Required. We use this to set up your job types. Example: Garage door service.",
  describeError: "Tell us your trade to continue."
} as const;

export const TRADE_OPTIONS: ReadonlyArray<{ value: HomeServiceTrade; label: string; description: string }> = [
  { value: "hvac", label: "HVAC", description: "Heating, cooling and air quality" },
  { value: "plumbing", label: "Plumbing", description: "Pipes, water heaters and drains" },
  { value: "electrical", label: "Electrical", description: "Panels, wiring and lighting" },
  { value: "other", label: "Other", description: "Describe your trade" }
];
