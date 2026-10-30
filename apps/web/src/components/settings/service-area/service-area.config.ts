/** Copy from Figma 309:3613 (Settings / Service area & emergency). */
export const SERVICE_AREA_COPY = {
  pageTitle: "Service area & emergency",
  save: "Save changes",
  saving: "Saving…",
  areaTitle: "Service area",
  areaBody: "Customers outside these ZIP codes and radius see an email option instead of booking.",
  addPlaceholder: "Add ZIP code",
  add: "Add ZIP",
  remove: (zip: string) => `Remove ${zip}`,
  radiusLabel: (zip: string | undefined) => (zip ? `Travel radius from ${zip}` : "Travel radius"),
  miles: (n: number) => `${n} miles`,
  invalidZip: "Enter a 5-digit ZIP code.",
  saveError: "We couldn't add that ZIP. Check it and try again.",
  retry: "Retry",
  emergencyTitle: "Emergency service (24/7)",
  on: "On",
  off: "Off",
  emergencyOnHelp: "Emergency requests are flagged and shown first to your team.",
  emergencyOffHelp: "Off: customers will not see the emergency option when booking."
} as const;

export const RADIUS_STEP = 5;
export const DEFAULT_RADIUS_MILES = 25;
