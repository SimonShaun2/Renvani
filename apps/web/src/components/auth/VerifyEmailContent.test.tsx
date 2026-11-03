import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const nav = vi.hoisted(() => ({ query: "token=tok_1" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(nav.query),
}));
vi.mock("@/src/stores/auth.store", () => ({
  useAuthStore: (sel: (s: { setAuth: () => void }) => unknown) => sel({ setAuth: vi.fn() }),
}));

import { VerifyEmailContent } from "./VerifyEmailContent";

describe("VerifyEmailContent", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    nav.query = "token=tok_1";
    replace.mockReset();
    window.history.replaceState(null, "", "/verify-email?token=tok_1");
    fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "UNAUTHORIZED", message: "x" }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("does not verify on load and strips the token from the URL", () => {
    render(<VerifyEmailContent />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.location.search).not.toContain("token");
    expect(screen.getByRole("button", { name: "Confirm email" })).toBeTruthy();
  });

  it("posts only on click and shows the invalid message with a /login link on 401", async () => {
    render(<VerifyEmailContent />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirm email" }));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ token: "tok_1" });
    expect((await screen.findByRole("alert")).textContent).toBe("This link is invalid or expired");
    expect(screen.getByRole("link", { name: /Go to sign in/ }).getAttribute("href")).toBe("/login");
    expect(replace).not.toHaveBeenCalled();
  });

  it.each([
    ["a network error", () => Promise.reject(new TypeError("Failed to fetch"))],
    ["a 429", () => Promise.resolve(new Response("{}", { status: 429 }))],
    ["a 500", () => Promise.resolve(new Response("{}", { status: 500 }))],
  ])("after %s shows the retry message and lets the user try again", async (_label, first) => {
    fetchMock.mockReset();
    fetchMock.mockImplementationOnce(first).mockResolvedValueOnce(new Response("{}", { status: 400 }));
    render(<VerifyEmailContent />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirm email" }));
    });
    expect((await screen.findByRole("alert")).textContent).toBe("Something went wrong, try again");
    expect(screen.queryByText("This link is invalid or expired")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).toEqual({ token: "tok_1" });
    expect((await screen.findByRole("alert")).textContent).toBe("This link is invalid or expired");
  });

  it("does not allow a retry after an invalid-link response", async () => {
    render(<VerifyEmailContent />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirm email" }));
    });
    await screen.findByRole("alert");
    expect(screen.queryByRole("button")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["", "token=", "token=%20"])("with no token (%s) shows the invalid-link state, not the button", (query) => {
    nav.query = query;
    window.history.replaceState(null, "", "/verify-email");
    render(<VerifyEmailContent />);
    expect(screen.getByRole("alert").textContent).toBe("This link is invalid or expired");
    expect(screen.queryByRole("button", { name: "Confirm email" })).toBeNull();
    expect(screen.getByRole("link", { name: /Go to sign in/ }).getAttribute("href")).toBe("/login");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
