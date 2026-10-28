import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));

const clerk = vi.hoisted(() => ({
  orgId: null as string | null,
  getToken: vi.fn(),
  createOrganization: vi.fn(),
  setActive: vi.fn()
}));
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ getToken: clerk.getToken, orgId: clerk.orgId }),
  useOrganizationList: () => ({ isLoaded: true, createOrganization: clerk.createOrganization, setActive: clerk.setActive })
}));

const wait = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("./wait-for-workspace", () => ({ waitForWorkspace: wait.fn }));

import { CreateWorkspaceStep } from "./CreateWorkspaceStep";

describe("CreateWorkspaceStep", () => {
  beforeEach(() => {
    clerk.orgId = null;
    clerk.createOrganization.mockReset();
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
    expect(screen.getByRole("alert").textContent).toContain("couldn't finish setting up");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    });
    expect(clerk.createOrganization).toHaveBeenCalledTimes(1);
    expect(wait.fn).toHaveBeenCalledTimes(2);
    expect(replace).toHaveBeenCalledWith("/onboarding/import");
  });

  it("shows the create error and keeps the form when Clerk rejects", async () => {
    clerk.createOrganization.mockRejectedValue(new Error("not allowed"));
    render(<CreateWorkspaceStep />);
    await submit("Acme");
    expect(screen.getByRole("alert").textContent).toContain("couldn't create the workspace");
    expect(screen.getByLabelText("Company name")).toBeTruthy();
    expect(wait.fn).not.toHaveBeenCalled();
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
