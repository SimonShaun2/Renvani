import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));

const clerk = vi.hoisted(() => ({
  orgId: null as string | null,
  userId: "user_1",
  getToken: vi.fn(),
  getOrganizationMemberships: vi.fn(),
  createOrganization: vi.fn(),
  setActive: vi.fn()
}));
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ getToken: clerk.getToken, orgId: clerk.orgId, userId: clerk.userId }),
  useUser: () => ({ user: { getOrganizationMemberships: clerk.getOrganizationMemberships } }),
  useOrganizationList: () => ({ isLoaded: true, createOrganization: clerk.createOrganization, setActive: clerk.setActive })
}));

const wait = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("./wait-for-workspace", () => ({ waitForWorkspace: wait.fn }));

import { CreateWorkspaceStep } from "./CreateWorkspaceStep";

describe("CreateWorkspaceStep", () => {
  beforeEach(() => {
    sessionStorage.clear();
    clerk.orgId = null;
    clerk.userId = "user_1";
    clerk.createOrganization.mockReset();
    clerk.getOrganizationMemberships.mockReset();
    clerk.getOrganizationMemberships.mockResolvedValue({ data: [], total_count: 0 });
    clerk.setActive.mockReset();
    clerk.createOrganization.mockResolvedValue({ id: "org_1" });
    clerk.setActive.mockResolvedValue(undefined);
    wait.fn.mockReset();
    replace.mockReset();
  });
  afterEach(() => cleanup());

  async function submit(name: string) {
    fireEvent.change(screen.getByLabelText("Company name"), { target: { value: name } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));
    });
  }

  it("creates and activates the org, waits, then redirects to import", async () => {
    wait.fn.mockResolvedValue({ ok: true, role: "owner" });
    render(<CreateWorkspaceStep />);
    await submit("  Acme Plumbing ");
    expect(clerk.createOrganization).toHaveBeenCalledWith({ name: "Acme Plumbing" });
    expect(clerk.setActive).toHaveBeenCalledWith({ organization: "org_1" });
    expect(wait.fn).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/onboarding/import");
  });

  it("shows a timeout error with Retry that re-polls without re-creating the org", async () => {
    wait.fn.mockResolvedValueOnce({ ok: false, reason: "company" }).mockResolvedValueOnce({ ok: true, role: "owner" });
    render(<CreateWorkspaceStep />);
    await submit("Acme");
    expect(screen.getByRole("alert").textContent).toContain("We couldn't set up your workspace. Try again.");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    expect(clerk.createOrganization).toHaveBeenCalledTimes(1);
    expect(wait.fn).toHaveBeenCalledTimes(2);
    expect(replace).toHaveBeenCalledWith("/onboarding/import");
  });

  it("shows the create error and keeps the form when Clerk rejects", async () => {
    clerk.createOrganization.mockRejectedValue(new Error("not allowed"));
    render(<CreateWorkspaceStep />);
    await submit("Acme");
    expect(screen.getByRole("alert").textContent).toContain("couldn't be created");
    expect(screen.getByLabelText("Company name")).toBeTruthy();
    expect(wait.fn).not.toHaveBeenCalled();
  });

  it("retries activation of the created organization without creating another", async () => {
    clerk.setActive.mockRejectedValueOnce(new Error("session unavailable"));
    wait.fn.mockResolvedValue({ ok: true, role: "owner" });
    render(<CreateWorkspaceStep />);
    await submit("Acme Plumbing");

    expect(screen.getByRole("alert").textContent).toContain("workspace was created");
    expect(screen.queryByLabelText("Company name")).toBeNull();
    expect(wait.fn).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    expect(clerk.createOrganization).toHaveBeenCalledTimes(1);
    expect(clerk.setActive).toHaveBeenNthCalledWith(2, { organization: "org_1" });
    expect(wait.fn).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/onboarding/import");
  });

  it("recovers a created organization after remount before retrying activation", async () => {
    clerk.setActive.mockRejectedValueOnce(new Error("session unavailable"));
    wait.fn.mockResolvedValue({ ok: true, role: "owner" });
    const first = render(<CreateWorkspaceStep />);
    await submit("Acme Plumbing");
    first.unmount();

    render(<CreateWorkspaceStep />);
    expect(screen.queryByLabelText("Company name")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));
    });
    expect(clerk.createOrganization).toHaveBeenCalledTimes(1);
    expect(clerk.setActive).toHaveBeenNthCalledWith(2, { organization: "org_1" });
    expect(replace).toHaveBeenCalledWith("/onboarding/import");
  });

  it("finds the created organization from Clerk when a new tab has no session storage", async () => {
    clerk.setActive.mockRejectedValueOnce(new Error("session unavailable"));
    wait.fn.mockResolvedValue({ ok: true, role: "owner" });
    const first = render(<CreateWorkspaceStep />);
    await submit("Acme Plumbing");
    first.unmount();
    sessionStorage.clear();
    clerk.getOrganizationMemberships.mockResolvedValue({
      data: [{ organization: { id: "org_1", name: "Acme Plumbing" } }],
      total_count: 1
    });

    render(<CreateWorkspaceStep />);
    await submit("Acme Plumbing");
    expect(clerk.createOrganization).toHaveBeenCalledTimes(1);
    expect(clerk.setActive).toHaveBeenNthCalledWith(2, { organization: "org_1" });
    expect(replace).toHaveBeenCalledWith("/onboarding/import");
  });

  it("does not create an organization when the membership lookup fails", async () => {
    clerk.getOrganizationMemberships.mockRejectedValue(new Error("network unavailable"));
    render(<CreateWorkspaceStep />);
    await submit("Acme Plumbing");
    expect(screen.getByRole("alert").textContent).toContain("couldn't check your existing workspaces");
    expect(clerk.createOrganization).not.toHaveBeenCalled();
    expect(clerk.setActive).not.toHaveBeenCalled();
  });

  it("clears prior account retry state when the signed-in user changes", async () => {
    clerk.setActive.mockRejectedValueOnce(new Error("session unavailable"));
    const view = render(<CreateWorkspaceStep />);
    await submit("Acme Plumbing");
    expect(screen.queryByLabelText("Company name")).toBeNull();

    clerk.userId = "user_2";
    view.rerender(<CreateWorkspaceStep />);
    expect(screen.getByLabelText("Company name")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Create workspace" })).toBeTruthy();
    expect(clerk.createOrganization).toHaveBeenCalledTimes(1);
    clerk.createOrganization.mockResolvedValueOnce({ id: "org_2" });
    wait.fn.mockResolvedValue({ ok: true, role: "owner" });
    await submit("New Electric");
    expect(clerk.createOrganization).toHaveBeenCalledTimes(2);
    expect(clerk.setActive).toHaveBeenNthCalledWith(2, { organization: "org_2" });
  });

  it("shows the frame copy and a disabled progress button while waiting", async () => {
    wait.fn.mockReturnValue(new Promise(() => {}));
    render(<CreateWorkspaceStep />);
    expect(screen.getByText("STEP 1 OF 2")).toBeTruthy();
    expect(screen.getByText("Name your workspace")).toBeTruthy();
    expect(screen.getByText("You can change this later in Settings.")).toBeTruthy();
    await submit("Acme");
    const button = screen.getByRole("button", { name: /Setting up your workspace/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByRole("progressbar")).toBeTruthy();
  });

  it("skips creation when an org is already active", async () => {
    clerk.orgId = "org_existing";
    wait.fn.mockResolvedValue({ ok: false, reason: "role" });
    render(<CreateWorkspaceStep />);
    expect(screen.queryByLabelText("Company name")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    });
    expect(clerk.createOrganization).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("owner access");
  });
});
