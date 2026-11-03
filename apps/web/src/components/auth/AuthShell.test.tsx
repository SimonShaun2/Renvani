import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/components/marketing/site/fonts", () => ({
  geist: { className: "geist", variable: "geist-variable" },
  newsreader: { className: "newsreader", variable: "newsreader-variable" }
}));

import { AuthShell } from "./AuthShell";

afterEach(cleanup);

describe("Renvani sign-in shell", () => {
  it("uses the canonical cream canvas and a responsive Renvani sign-in layout", () => {
    render(
      <AuthShell variant="sign-in">
        <div data-testid="clerk-sign-in">Clerk form</div>
      </AuthShell>
    );

    const shell = screen.getByTestId("renvani-sign-in-shell");
    expect(shell.className).toContain("bg-[#fbf6ef]");
    expect(shell.className).toContain("sm:py-20");
    expect(screen.getByText("Renvani")).toBeTruthy();
    expect(screen.getByText("Grow your shop. Renvani runs the rest.")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Sign in to Renvani" })).toBeTruthy();
    expect(screen.getByTestId("clerk-sign-in")).toBeTruthy();
    expect(shell.textContent).not.toContain("ServiceRev");
  });
});
