import { describe, expect, it, vi } from "vitest";

import { submitSignup } from "./signup-submit";

describe("submitSignup", () => {
  it("treats a 202 Check-your-email response as check-email and sends the payload", async () => {
    const post = vi.fn().mockResolvedValue({ message: "Check your email" });
    await expect(submitSignup(post, { email: "a@b.co" })).resolves.toEqual({ status: "check-email" });
    expect(post).toHaveBeenCalledWith("/api/v1/auth/register", { email: "a@b.co" });
  });

  it("maps any failure to the generic error", async () => {
    const post = vi.fn().mockRejectedValue(Object.assign(new Error("x"), { status: 409 }));
    await expect(submitSignup(post, {})).resolves.toEqual({ status: "error" });
  });
});
