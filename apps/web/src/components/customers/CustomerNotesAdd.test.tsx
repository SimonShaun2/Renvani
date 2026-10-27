import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn();
const apiPost = vi.fn();
vi.mock("@/src/lib/api", () => ({
  api: { get: (path: string) => apiGet(path), post: (path: string, body: unknown) => apiPost(path, body) }
}));

import { useAuthStore } from "@/src/stores/auth.store";
import { validateCustomerNote } from "@/src/hooks/customer-crm.hooks";

import { CustomerNotesPanel } from "./CustomerNotesPanel";

const CID = "11111111-1111-4111-8111-111111111111";
const note = (id: string, content: string) => ({
  id, customerId: CID, authorId: null, content, isInternal: false, notedAt: null, createdAt: "2026-10-01T00:00:00.000Z"
});

function signIn(role: string) {
  useAuthStore.getState().setAuth({ id: "u", email: "a@b.c", firstName: "A", lastName: "B", role } as never, { id: "c", name: "Co" }, "t");
}

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CustomerNotesPanel customerId={CID} />
    </QueryClientProvider>
  );
}

function type(text: string) {
  fireEvent.change(screen.getByLabelText("New note"), { target: { value: text } });
}

beforeEach(() => {
  apiGet.mockReset();
  apiPost.mockReset();
  apiGet.mockResolvedValue({ notes: [] });
  signIn("office");
});
afterEach(() => {
  cleanup();
  useAuthStore.getState().clearAuth();
});

describe("CustomerNotesPanel add note", () => {
  it("validates content: non-empty after trim and at most 10,000 chars", () => {
    expect(validateCustomerNote("   ")).toMatch(/Write a note/);
    expect(validateCustomerNote("x".repeat(10_001))).toMatch(/up to 10,000/);
    expect(validateCustomerNote("  ok  ")).toBeNull();
  });

  it("blocks an empty note without calling the API", async () => {
    renderPanel();
    type("   ");
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Write a note/);
    expect(apiPost).not.toHaveBeenCalled();
  });

  it("posts trimmed content with isInternal, then refetches notes and clears the form", async () => {
    apiPost.mockResolvedValue({ note: note("n1", "Gate code 2290") });
    renderPanel();
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1));
    apiGet.mockResolvedValue({ notes: [note("n1", "Gate code 2290")] });
    type("  Gate code 2290  ");
    fireEvent.click(screen.getByLabelText("Internal note"));
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    await screen.findByText("Gate code 2290");
    expect(apiPost).toHaveBeenCalledWith(`/api/v1/customers/${CID}/notes`, { content: "Gate code 2290", isInternal: true });
    expect((screen.getByLabelText("New note") as HTMLTextAreaElement).value).toBe("");
  });

  it("shows an inline error with Retry, and Retry resends", async () => {
    apiPost.mockRejectedValueOnce(new Error("Server unavailable")).mockResolvedValueOnce({ note: note("n2", "Call first") });
    renderPanel();
    type("Call first");
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Server unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("hides the form for roles the API does not allow (technician)", async () => {
    signIn("technician");
    renderPanel();
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    expect(screen.queryByRole("form", { name: "Add a customer note" })).toBeNull();
    expect(screen.queryByLabelText("New note")).toBeNull();
  });
});
