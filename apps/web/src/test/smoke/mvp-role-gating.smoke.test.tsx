import { afterEach, describe, expect, it, vi } from "vitest";

import { canRoleAccessPath, getDefaultRouteForRole, type UserRole } from "@/src/lib/route-access";

const s = vi.hoisted(() => ({ role: "owner" as string | null }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (_name: string) => undefined
  })
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error(`REDIRECT:${to}`), { to });
  },
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/"
}));
vi.mock("@/src/lib/auth", async (orig) => ({
  ...(await orig<typeof import("@/src/lib/auth")>()),
  readServerAuthSession: () => (s.role ? { role: s.role } : null)
}));
vi.mock("@/src/components/reporting/ReportingDashboardClient", () => ({ ReportingDashboardClient: () => null }));
vi.mock("@/src/components/migrate-onboarding/MigrateOnboardingWizardClient", () => ({ MigrateOnboardingWizardClient: () => null }));

import ReportingPage from "@/app/(app)/reporting/page";
import SettingsMigratePage from "@/app/(app)/settings/migrate/page";

const MVP = ["/dispatch", "/jobs", "/customers", "/estimates", "/invoices"];

afterEach(() => {
  s.role = "owner";
});

describe("MVP smoke: route access", () => {
  it("technician cannot reach any staff MVP screen and lands on /mobile/jobs", () => {
    for (const path of [...MVP, "/reporting", "/settings/migrate"]) {
      expect(canRoleAccessPath("technician", path)).toBe(false);
    }
    expect(getDefaultRouteForRole("technician")).toBe("/mobile/jobs");
  });

  it.each<UserRole>(["dispatcher", "office"])("%s reaches staff MVP screens but not reports", (role) => {
    for (const path of MVP) expect(canRoleAccessPath(role, path)).toBe(true);
    expect(canRoleAccessPath(role, "/reporting")).toBe(false);
  });

  it.each<UserRole>(["owner", "admin"])("%s reaches every MVP screen", (role) => {
    for (const path of [...MVP, "/reporting", "/settings/migrate"]) expect(canRoleAccessPath(role, path)).toBe(true);
  });
});

describe.each([
  ["reporting", ReportingPage],
  ["settings/migrate", SettingsMigratePage]
] as const)("MVP smoke: %s page server gate", (_name, Page) => {
  it.each(["technician", "dispatcher", "office"])("redirects %s to its default route", async (role) => {
    s.role = role;
    await expect(Page()).rejects.toThrow(`REDIRECT:${getDefaultRouteForRole(role as UserRole)}`);
  });
  it.each(["owner", "admin"])("renders for %s", async (role) => {
    s.role = role;
    await expect(Page()).resolves.toBeTruthy();
  });
  it("redirects signed-out users to /login", async () => {
    s.role = null;
    await expect(Page()).rejects.toThrow("REDIRECT:/login");
  });
});
