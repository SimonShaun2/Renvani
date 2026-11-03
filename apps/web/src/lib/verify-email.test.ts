import { describe, expect, it, vi } from "vitest";

import type { AuthResponse, AuthSessionSnapshot } from "./auth";
import { isPublicRoute } from "./route-access";
import {
  VERIFY_EMAIL_INVALID_MESSAGE,
  verifyEmailAndSignIn,
} from "./verify-email";

const response: AuthResponse = {
  user: {
    id: "u1",
    email: "a@b.co",
    firstName: "A",
    lastName: "B",
    role: "owner",
  },
  company: { id: "c1", name: "Acme" },
  tokens: { accessToken: "acc", refreshToken: "ref", expiresIn: 900 },
};
const session: AuthSessionSnapshot = {
  user: { ...response.user, role: "owner" },
  company: response.company,
  role: "owner",
};

function deps(post: ReturnType<typeof vi.fn>) {
  return {
    post,
    setAuth: vi.fn(),
    redirect: vi.fn(),
    setSession: vi.fn().mockReturnValue(session),
  };
}

describe("verify-email", () => {
  it("is a public route", () => {
    expect(isPublicRoute("/verify-email")).toBe(true);
  });

  it("on success sets the session like login and redirects to the dashboard", async () => {
    const d = deps(vi.fn().mockResolvedValue(response));
    await expect(verifyEmailAndSignIn("tok", d)).resolves.toEqual({
      status: "ok",
    });
    expect(d.post).toHaveBeenCalledWith("/api/v1/auth/verify-email", {
      token: "tok",
    });
    expect(d.setSession).toHaveBeenCalledWith(response);
    expect(d.setAuth).toHaveBeenCalledWith(
      session.user,
      session.company,
      "acc",
    );
    expect(d.redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("on failure or missing token returns invalid with generic copy and no session", async () => {
    const d = deps(
      vi.fn().mockRejectedValue(Object.assign(new Error("x"), { status: 400 })),
    );
    await expect(verifyEmailAndSignIn("bad", d)).resolves.toEqual({
      status: "invalid",
    });
    await expect(verifyEmailAndSignIn(null, d)).resolves.toEqual({
      status: "invalid",
    });
    expect(d.post).toHaveBeenCalledTimes(1);
    expect(d.setSession).not.toHaveBeenCalled();
    expect(d.redirect).not.toHaveBeenCalled();
    expect(VERIFY_EMAIL_INVALID_MESSAGE).toBe(
      "This link is invalid or expired",
    );
  });
});
