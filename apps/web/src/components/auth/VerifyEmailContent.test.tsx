import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams("token=tok_1"),
}));
vi.mock("@/src/stores/auth.store", () => ({
  useAuthStore: (sel: (s: { setAuth: () => void }) => unknown) => sel({ setAuth: vi.fn() }),
}));

import { VerifyEmailContent } from "./VerifyEmailContent";

describe("VerifyEmailContent", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
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
});
