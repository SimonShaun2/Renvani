// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/src/lib/api", async (orig) => {
  const actual = await orig<typeof import("@/src/lib/api")>();
  return { ...actual, api: { get: vi.fn(), post: m.post, patch: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

import { ApiError } from "@/src/lib/api";
import { readQueue } from "@/src/lib/field-work-queue";
import { useAuthStore } from "@/src/stores/auth.store";

import { MobileJobNoteComposer } from "./MobileJobNoteComposer";

const JOB = "11111111-1111-4111-8111-111111111111";
const OWNER = { userId: "u-1", companyId: "c-1" };

function renderComposer() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MobileJobNoteComposer jobId={JOB} />
    </QueryClientProvider>
  );
}

function addNote(text: string) {
  fireEvent.change(screen.getByLabelText("Add a note"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Save note" }));
}

beforeEach(() => {
  window.localStorage.clear();
  m.post.mockReset();
  useAuthStore.getState().setAuth(
    { id: "u-1", email: "t@x.test", firstName: "T", lastName: "X" } as never,
    { id: "c-1", name: "Co" },
    "tok"
  );
});
afterEach(cleanup);

describe("MobileJobNoteComposer", () => {
  it("keeps the note queued on a network failure", async () => {
    m.post.mockRejectedValue(new TypeError("Failed to fetch"));
    renderComposer();
    addNote("Gas off");
    expect(await screen.findByText(/Can't reach the server/)).toBeTruthy();
    expect(readQueue(OWNER)).toHaveLength(1);
  });

  it("drops a permanently rejected note instead of calling it offline", async () => {
    m.post.mockRejectedValue(new ApiError(403, { error: "FORBIDDEN", message: "Not your job" } as never));
    renderComposer();
    addNote("Not mine");
    expect(await screen.findByText("1 note could not be saved.")).toBeTruthy();
    expect(screen.queryByText(/Can't reach the server/)).toBeNull();
    await waitFor(() => expect(readQueue(OWNER)).toHaveLength(0));
  });

  it("clears the queue on sign-out", () => {
    m.post.mockRejectedValue(new TypeError("Failed to fetch"));
    renderComposer();
    addNote("pending");
    expect(readQueue(OWNER)).toHaveLength(1);
    useAuthStore.getState().clearAuth();
    expect(readQueue(OWNER)).toHaveLength(0);
  });
});
