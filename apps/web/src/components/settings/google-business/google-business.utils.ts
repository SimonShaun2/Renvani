import type { GoogleBusinessProfileStatus } from "@/src/hooks/google-business-profile.hooks";

/** Same roles as the API (apps/api/src/routes/google-business-profile/index.ts). */
export function canManageGoogleBusinessProfile(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export type GbpConnectionView = { key: "connected" | "not_connected"; label: string; detail: string };

export function describeConnection(s: GoogleBusinessProfileStatus): GbpConnectionView {
  if (s.configured) {
    return { key: "connected", label: "Provider connected", detail: "Renvani can read your Google Business Profile once you opt in." };
  }
  return {
    key: "not_connected",
    label: "Not connected yet",
    detail: "Renvani's Google connection isn't switched on yet, so no profile details or Google reviews show here. Opting in now records your choice for when it is."
  };
}

export function describeOptIn(s: GoogleBusinessProfileStatus): { label: string; on: boolean } {
  return s.optIn ? { label: "Opted in", on: true } : { label: "Not opted in", on: false };
}

export function formatUpdatedAt(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
