import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ require: vi.fn(), redirect: vi.fn<(href: string) => never>() }));
vi.mock("@/src/lib/server-session", () => ({ requireServerSession: session.require }));
vi.mock("next/navigation", () => ({ redirect: session.redirect }));
import DashboardPage from "./page";

// A returned mock function is treated by Vitest as an after-test cleanup.
// Reset inside a block so the guard is never invoked again during teardown.
beforeEach(() => {
  session.require.mockReset();
  session.redirect.mockReset().mockImplementation((href) => { throw new Error(`REDIRECT:${href}`); });
});
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
    const denied = new Error("REDIRECT:/login");
    session.require.mockRejectedValue(denied);
    await expect(DashboardPage()).rejects.toBe(denied);
    expect(session.require).toHaveBeenCalledTimes(1);
    expect(session.redirect).not.toHaveBeenCalled();
  });
  it("waits for the session guard before routing", async () => {
    let grant: ((value: { role: string }) => void) | undefined;
    session.require.mockReturnValue(new Promise<{ role: string }>((resolve) => { grant = resolve; }));
    const result = DashboardPage();
    expect(session.redirect).not.toHaveBeenCalled();
    grant?.({ role: "owner" });
    await expect(result).rejects.toThrow("REDIRECT:/command-center");
    expect(session.require).toHaveBeenCalledTimes(1);
    expect(session.redirect).toHaveBeenCalledExactlyOnceWith("/command-center");
  });

});
