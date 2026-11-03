import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ role: "owner", require: vi.fn() }));
vi.mock("@/src/lib/server-session", () => ({ requireServerSession: session.require }));
vi.mock("next/navigation", () => ({ redirect: (href: string): never => { throw new Error(`REDIRECT:${href}`); } }));
import DashboardPage from "./page";

beforeEach(() => session.require.mockReset());
describe("protected owner dashboard alias", () => {
  it.each(["owner", "admin"])("redirects %s to the canonical Command Center", async (role) => {
    session.require.mockResolvedValue({ role });
    await expect(DashboardPage()).rejects.toThrow("REDIRECT:/command-center");
    expect(session.require).toHaveBeenCalledTimes(1);
  });
  it("retains technician routing rather than granting owner access", async () => {
    session.require.mockResolvedValue({ role: "technician" });
    await expect(DashboardPage()).rejects.toThrow("REDIRECT:/mobile/jobs");
  });
  it("does not redirect an unauthenticated request around the session guard", async () => {
    session.require.mockRejectedValue(new Error("REDIRECT:/login"));
    await expect(DashboardPage()).rejects.toThrow("REDIRECT:/login");
  });
});
