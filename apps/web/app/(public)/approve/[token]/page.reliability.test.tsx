// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(), approve: vi.fn(), decline: vi.fn(), refetch: vi.fn(), params: { token: "first" }
}));
vi.mock("next/navigation", () => ({ useParams: () => mocks.params }));
vi.mock("@/src/hooks/estimates.hooks", () => ({
  usePublicEstimate: mocks.query,
  usePublicApproveEstimate: () => ({ mutateAsync: mocks.approve, isPending: false }),
  usePublicDeclineEstimate: () => ({ mutateAsync: mocks.decline, isPending: false })
}));
vi.mock("@/src/components/estimates/CustomerEstimateView", async () => {
  const { useState } = await import("react");
  return { CustomerEstimateView: function TestView(props: {
    approvedState: boolean; isSubmitting: boolean;
    onApprove: (input: { approvedByName: string }) => Promise<void>;
    onDecline: (reason?: string) => Promise<void>;
  }) {
    const [name, setName] = useState("");
    const [reason, setReason] = useState("");
    if (props.approvedState) return <p>Approved view</p>;
    return <div>
      <input aria-label="Your name" value={name} onChange={(event) => setName(event.target.value)} />
      <input aria-label="Decline reason" value={reason} onChange={(event) => setReason(event.target.value)} />
      <button disabled={props.isSubmitting} onClick={() => void props.onApprove({ approvedByName: name })}>Approve</button>
      <button disabled={props.isSubmitting} onClick={() => void props.onDecline(reason)}>Decline</button>
    </div>;
  } };
});
vi.mock("@/src/components/estimates/CustomerEstimateSlotStep", () => ({
  CustomerEstimateSlotStep: ({ onRequested }: { onRequested: (value: { referenceNumber: string }) => void }) => <button onClick={() => onRequested({ referenceNumber: "R-1" })}>Request visit</button>
}));

import PublicEstimatePage from "./page";

function queryState(status = "sent", withScheduling = false) {
  return {
    data: { estimate: { status, estimateNumber: "EST-1", title: "Service estimate", items: [], tiers: null }, scheduling: withScheduling ? { companyName: "Test business", property: { city: "Test" } } : null },
    isLoading: false, isFetching: false, isError: false, refetch: mocks.refetch
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.params.token = "first";
  mocks.query.mockReturnValue(queryState());
  mocks.approve.mockResolvedValue({ success: true });
  mocks.decline.mockResolvedValue({ success: true });
  mocks.refetch.mockResolvedValue({ data: queryState("approved").data, isError: false });
});
afterEach(cleanup);

describe("public estimate response recovery", () => {
  it("preserves the customer's name and requires a status check before retrying an unconfirmed write", async () => {
    mocks.approve.mockRejectedValue(new Error("Network failed"));
    render(<PublicEstimatePage />);
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Customer name" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("could not confirm your approval"));
    expect((screen.getByLabelText("Your name") as HTMLInputElement).value).toBe("Customer name");
    expect(mocks.refetch).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Approve" }) as HTMLButtonElement).disabled).toBe(true);
    mocks.refetch.mockResolvedValue({ data: queryState("sent").data, isError: false });
    fireEvent.click(screen.getByRole("button", { name: "Check latest status" }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Approve" }) as HTMLButtonElement).disabled).toBe(false));
    expect(mocks.approve).toHaveBeenCalledOnce();
  });

  it("preserves a declined response's note after a failed write", async () => {
    mocks.decline.mockRejectedValue(new Error("Network failed"));
    render(<PublicEstimatePage />);
    fireEvent.change(screen.getByLabelText("Decline reason"), { target: { value: "Please revise scope" } });
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("could not confirm your decline"));
    expect((screen.getByLabelText("Decline reason") as HTMLInputElement).value).toBe("Please revise scope");
  });

  it("keeps acknowledgement and retries only GET after approval succeeds and refresh fails", async () => {
    mocks.refetch.mockRejectedValueOnce(new Error("Read unavailable"));
    render(<PublicEstimatePage />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Approval recorded" })).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Check latest status" }));
    await waitFor(() => expect(mocks.refetch).toHaveBeenCalledTimes(2));
    expect(mocks.approve).toHaveBeenCalledOnce();
    expect(mocks.decline).not.toHaveBeenCalled();
  });

  it("does not show approval controls after a confirmed decline", async () => {
    render(<PublicEstimatePage />);
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Decline recorded" })).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });

  it("blocks a second write until the first attempt settles", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    mocks.approve.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<PublicEstimatePage />);
    const button = screen.getByRole("button", { name: "Approve" });
    fireEvent.click(button); fireEvent.click(button);
    expect(mocks.approve).toHaveBeenCalledOnce();
    expect((screen.getByRole("button", { name: "Decline" }) as HTMLButtonElement).disabled).toBe(true);
    resolve({ success: true });
    await waitFor(() => expect(screen.getByText("Approved view")).toBeTruthy());
  });

  it.each(["draft", "declined", "expired", "converted", "revised"])("does not offer a fresh decision for %s", (status) => {
    mocks.query.mockReturnValue(queryState(status));
    render(<PublicEstimatePage />);
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Decline" })).toBeNull();
  });

  it("does not carry an acknowledgement into a different token", async () => {
    const rendered = render(<PublicEstimatePage />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(screen.getByText("Approved view")).toBeTruthy());
    mocks.params.token = "second";
    rendered.rerender(<PublicEstimatePage />);
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
  });

  it("preserves request-received rather than jumping back to slot selection on rerender", async () => {
    mocks.query.mockReturnValue(queryState("approved", true));
    const rendered = render(<PublicEstimatePage />);
    fireEvent.click(await screen.findByRole("button", { name: "Request visit" }));
    expect(screen.getByRole("heading", { name: "Request received" })).toBeTruthy();
    mocks.query.mockReturnValue(queryState("approved", true));
    rendered.rerender(<PublicEstimatePage />);
    expect(screen.getByRole("heading", { name: "Request received" })).toBeTruthy();
    expect(screen.getByText(/once the visit is scheduled/)).toBeTruthy();
  });
});
