import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));

const clerk = vi.hoisted(() => ({
  orgId: null as string | null,
  userId: "user_1" as string | null,
  getToken: vi.fn(),
  createOrganization: vi.fn(),
  setActive: vi.fn()
}));
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ getToken: clerk.getToken, orgId: clerk.orgId, userId: clerk.userId }),
  useOrganizationList: () => ({ isLoaded: true, createOrganization: clerk.createOrganization, setActive: clerk.setActive })
}));

const readiness = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("./wait-for-workspace", () => ({ waitForWorkspace: readiness.fn }));

const intent = vi.hoisted(() => ({ get: vi.fn(), wait: vi.fn() }));
vi.mock("./workspace-intent", () => ({ getWorkspaceIntent: intent.get, waitForWorkspaceIntent: intent.wait }));

import { CreateWorkspaceStep } from "./CreateWorkspaceStep";

describe("CreateWorkspaceStep", () => {
  beforeEach(() => {
    sessionStorage.clear();
    clerk.orgId = null;
    clerk.userId = "user_1";
    clerk.getToken.mockReset();
    clerk.getToken.mockResolvedValue("token");
    clerk.createOrganization.mockReset();
    clerk.setActive.mockReset();
    clerk.setActive.mockResolvedValue(undefined);
    intent.get.mockReset();
    intent.get.mockResolvedValue(null);
    intent.wait.mockReset();
    intent.wait.mockResolvedValue({ ok: true, organizationId: "org_1", requestedName: "Acme Plumbing" });
    readiness.fn.mockReset();
    replace.mockReset();
  });
  afterEach(() => cleanup());

  async function submit(name: string) {
    fireEvent.change(screen.getByLabelText("Company name"), { target: { value: name } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Create workspace" })); });
  }

  it("reserves the authoritative intent, activates its org, then redirects to import", async () => {
    readiness.fn.mockResolvedValue({ ok: true, role: "owner" });
    render(<CreateWorkspaceStep />);
    await submit("  Acme Plumbing ");
    expect(intent.wait).toHaveBeenCalledWith(expect.objectContaining({ name: "Acme Plumbing" }));
    expect(clerk.createOrganization).not.toHaveBeenCalled();
    expect(clerk.setActive).toHaveBeenCalledWith({ organization: "org_1" });
    expect(readiness.fn).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/onboarding/import");
  });

  it("re-polls company readiness without submitting a second intent", async () => {
    readiness.fn.mockResolvedValueOnce({ ok: false, reason: "company" }).mockResolvedValueOnce({ ok: true, role: "owner" });
    render(<CreateWorkspaceStep />);
    await submit("Acme");
    expect(screen.getByRole("alert").textContent).toContain("We couldn't set up your workspace. Try again.");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Try again" })); });
    expect(intent.wait).toHaveBeenCalledTimes(1);
    expect(readiness.fn).toHaveBeenCalledTimes(2);
    expect(replace).toHaveBeenCalledWith("/onboarding/import");
  });

  it("shows a retryable error when the intent request fails and never creates in Clerk directly", async () => {
    intent.wait.mockResolvedValue({ ok: false, reason: "request" });
    render(<CreateWorkspaceStep />);
    await submit("Acme");
    expect(screen.getByRole("alert").textContent).toContain("couldn't be created");
    expect(screen.getByLabelText("Company name")).toBeTruthy();
    expect(clerk.createOrganization).not.toHaveBeenCalled();
    expect(clerk.setActive).not.toHaveBeenCalled();
    expect(readiness.fn).not.toHaveBeenCalled();
  });

  it("retries activation of the reconciled organization without resubmitting the intent", async () => {
    clerk.setActive.mockRejectedValueOnce(new Error("session unavailable"));
    readiness.fn.mockResolvedValue({ ok: true, role: "owner" });
    render(<CreateWorkspaceStep />);
    await submit("Acme Plumbing");
    expect(screen.getByRole("alert").textContent).toContain("workspace was created");
    expect(screen.queryByLabelText("Company name")).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Try again" })); });
    expect(intent.wait).toHaveBeenCalledTimes(1);
    expect(clerk.setActive).toHaveBeenNthCalledWith(2, { organization: "org_1" });
    expect(replace).toHaveBeenCalledWith("/onboarding/import");
  });

  it("recovers a reconciled intent after browser state is lost", async () => {
    clerk.setActive.mockRejectedValueOnce(new Error("session unavailable"));
    readiness.fn.mockResolvedValue({ ok: true, role: "owner" });
    const first = render(<CreateWorkspaceStep />);
    await submit("Acme Plumbing");
    first.unmount();
    sessionStorage.clear();
    intent.get.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000001",
      requestedName: "Acme Plumbing",
      status: "reconciled",
      createdAt: new Date().toISOString(),
      organizationId: "org_1"
    });
    render(<CreateWorkspaceStep />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByLabelText("Company name")).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Create workspace" })); });
    expect(intent.wait).toHaveBeenCalledTimes(1);
    expect(clerk.setActive).toHaveBeenNthCalledWith(2, { organization: "org_1" });
  });

  it("ignores an intent result from the previous account after a user switch", async () => {
    let finishIntent: (() => void) = () => {};
    intent.wait.mockImplementation((args: { isCurrent: () => boolean }) => new Promise((resolve) => {
      finishIntent = () => resolve(args.isCurrent()
        ? { ok: true, organizationId: "org_1", requestedName: "Acme" }
        : { ok: false, reason: "cancelled" });
    }));
    const view = render(<CreateWorkspaceStep />);
    fireEvent.change(screen.getByLabelText("Company name"), { target: { value: "Acme Plumbing" } });
    act(() => { fireEvent.click(screen.getByRole("button", { name: "Create workspace" })); });
    await act(async () => { await Promise.resolve(); });
    clerk.userId = "user_2";
    view.rerender(<CreateWorkspaceStep />);
    await act(async () => { finishIntent(); await Promise.resolve(); });
    expect(clerk.setActive).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("Company name")).toBeTruthy();
  });

  it("ignores a readiness result from the previous account after a user switch", async () => {
    clerk.orgId = "org_1";
    let finishPoll: (result: { ok: true; role: "owner" }) => void = () => {};
    readiness.fn.mockReturnValue(new Promise((resolve) => { finishPoll = resolve; }));
    const view = render(<CreateWorkspaceStep />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Continue" })); });
    clerk.userId = "user_2";
    clerk.orgId = null;
    view.rerender(<CreateWorkspaceStep />);
    await act(async () => { finishPoll({ ok: true, role: "owner" }); });
    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("Company name")).toBeTruthy();
  });

  it("shows the frame copy and a disabled progress button while waiting", async () => {
    intent.wait.mockReturnValue(new Promise(() => {}));
    render(<CreateWorkspaceStep />);
    expect(screen.getByText("STEP 1 OF 2")).toBeTruthy();
    expect(screen.getByText("Name your workspace")).toBeTruthy();
    expect(screen.getByText("You can change this later in Settings.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Company name"), { target: { value: "Acme" } });
    act(() => { fireEvent.click(screen.getByRole("button", { name: "Create workspace" })); });
    const button = screen.getByRole("button", { name: /Setting up your workspace/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByRole("progressbar")).toBeTruthy();
  });

  it("skips intent creation when an org is already active", async () => {
    clerk.orgId = "org_existing";
    readiness.fn.mockResolvedValue({ ok: false, reason: "role" });
    render(<CreateWorkspaceStep />);
    expect(screen.queryByLabelText("Company name")).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Continue" })); });
    expect(intent.wait).not.toHaveBeenCalled();
    expect(clerk.createOrganization).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("owner access");
  });
});
