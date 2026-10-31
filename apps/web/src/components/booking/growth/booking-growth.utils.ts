/** Public booking (Growth PR 3): ZIP check + emergency toggle. Figma jiGHTNUJNltWbHA4Il3hk7 310:121 / 310:250. */

export const ZIP_CHECK_COPY = {
  title: "Do we serve your ZIP?",
  intro: (companyName: string) => `Enter your ZIP code to see if ${companyName} can book a visit.`,
  check: "Check ZIP",
  checking: "Checking…",
  servedTitle: (zip: string) => `✓ Yes, we serve ${zip}`,
  servedBody: "HVAC, plumbing and electrical jobs are available in your area.",
  continue: "Continue to booking",
  outTitle: (zip: string) => `We don't serve ${zip} yet`,
  outBody: "Email us and we'll let you know when we do.",
  emailPlaceholder: "you@example.com",
  emailCta: "Email me when you do",
  emailSaved: "Thanks, we'll email you when we serve your area.",
  error: "We couldn't check that ZIP. Try again.",
  invalid: "Enter a 5-digit ZIP code.",
  retry: "Retry"
} as const;

export const EMERGENCY_COPY = {
  label: "This is an emergency (no heat, burst pipe, power out)",
  helpOff: "Turn this on if you need help right away.",
  helpOn: "Emergency requests are flagged and shown first to the team.",
  badge: "EMERGENCY",
  priorityLabel: "Priority",
  priorityValue: "Emergency · shown first",
  downgraded: "Emergency service isn't available right now, so we sent this as a regular request."
} as const;

export type ZipCheckState = "idle" | "checking" | "in_area" | "out_of_area" | "error";

/** Same rule as the API's UsZipSchema: 5 digits or ZIP+4, normalized to 5 digits. Null when invalid. */
export function normalizeUsZip(value: string): string | null {
  const trimmed = value.trim();
  return /^\d{5}(?:-?\d{4})?$/u.test(trimmed) ? trimmed.slice(0, 5) : null;
}

/** Emergency toggle shows only when the shop's public booking settings say 24/7 emergency is on. */
export function emergencyAvailable(settings: object | undefined): boolean {
  return (settings as { emergencyService?: { enabled?: unknown } | null } | undefined)?.emergencyService?.enabled === true;
}

/** Submit fields for the emergency choice (API #320 accepts `emergency` and/or `urgency: "emergency"`). */
export function emergencySubmitFields(
  emergency: boolean,
  urgency: "emergency" | "this_week" | "flexible"
): { urgency: "emergency" | "this_week" | "flexible"; emergency?: true } {
  if (emergency) return { urgency: "emergency", emergency: true };
  return { urgency: urgency === "emergency" ? "this_week" : urgency };
}

export function emergencyWasDowngraded(response: unknown): boolean {
  const e = (response as { emergency?: { downgraded?: unknown } } | null)?.emergency;
  return e?.downgraded === true;
}
