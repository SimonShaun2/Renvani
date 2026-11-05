import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/components/marketing/site/fonts", () => ({
  geist: { className: "geist", variable: "geist-variable" },
  newsreader: { className: "newsreader", variable: "newsreader-variable" }
}));

import { AuthShell } from "./AuthShell";

afterEach(cleanup);

describe("Renvani sign-in shell", () => {
  it("keeps the real authentication slot and one canonical brand/tagline", () => {
    render(<AuthShell variant="sign-in"><div data-testid="clerk-sign-in">Clerk form</div></AuthShell>);
    expect(screen.getByTestId("renvani-sign-in-shell")).toBeTruthy();
    expect(screen.getByText("Renvani")).toBeTruthy();
    expect(screen.getAllByText("Grow your shop. Renvani runs the rest.")).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Sign in to Renvani" })).toBeTruthy();
    expect(screen.getByTestId("clerk-sign-in")).toBeTruthy();
  });
  it("preserves the non-login slot for existing auth surfaces", () => {
    render(<AuthShell><div data-testid="signup-form">Existing signup</div></AuthShell>);
    expect(screen.queryByTestId("renvani-sign-in-shell")).toBeNull();
    expect(screen.getByTestId("signup-form")).toBeTruthy();
  });
});
