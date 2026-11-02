import { describe, expect, it, vi } from "vitest";

import {
  SIGNUP_CHECK_EMAIL_MESSAGE,
  SIGNUP_GENERIC_ERROR,
  SIGNUP_NETWORK_ERROR,
  SIGNUP_RATE_LIMIT_ERROR,
  SIGNUP_SERVER_ERROR,
  submitSignup
} from "./signup-submit";

const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

describe("submitSignup", () => {
  it("treats a 202 Check-your-email response as check-email and sends the payload", async () => {
    const post = vi.fn().mockResolvedValue({ message: "Check your email" });
    await expect(submitSignup(post, { email: "a@b.co" })).resolves.toEqual({ status: "check-email" });
    expect(post).toHaveBeenCalledWith("/api/v1/auth/register", { email: "a@b.co" });
  });

  it("maps a fetch failure (no HTTP status) to the connection message", async () => {
    const post = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(submitSignup(post, {})).resolves.toEqual({ status: "error", message: SIGNUP_NETWORK_ERROR });
  });

  it("maps 429 to the rate-limit message", async () => {
    const post = vi.fn().mockRejectedValue(httpError(429));
    await expect(submitSignup(post, {})).resolves.toEqual({ status: "error", message: SIGNUP_RATE_LIMIT_ERROR });
  });

  it.each([500, 502, 503])("maps %i to the server message", async (status) => {
    const post = vi.fn().mockRejectedValue(httpError(status));
    await expect(submitSignup(post, {})).resolves.toEqual({ status: "error", message: SIGNUP_SERVER_ERROR });
  });

  it.each([400, 409])("keeps the generic account message for %i (non-enumerating)", async (status) => {
    const post = vi.fn().mockRejectedValue(httpError(status));
    await expect(submitSignup(post, {})).resolves.toEqual({ status: "error", message: SIGNUP_GENERIC_ERROR });
  });

  it("pins the user-facing copy", () => {
    expect(SIGNUP_NETWORK_ERROR).toBe("We couldn't reach Renvani. Check your connection and try again.");
    expect(SIGNUP_RATE_LIMIT_ERROR).toBe("Too many attempts, try again in a few minutes.");
    expect(SIGNUP_SERVER_ERROR).toBe("Something went wrong on our side. Try again.");
  });

  it("uses the neutral success copy", () => {
    expect(SIGNUP_CHECK_EMAIL_MESSAGE).toBe("Thanks! If this is a new account, you can sign in now.");
  });
});
