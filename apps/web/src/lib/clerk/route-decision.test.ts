import { describe, expect, it } from "vitest";

import { getClerkPublishableKey, isClerkEnabled } from "./config";
import { resolveClerkRouteDecision } from "./route-decision";

const PUBLIC_TOKEN_ROUTES = [
  "/",
  "/pay/tok_1/receipt",
  "/pay/tok_1",
  "/vip/join/tok_1",
  "/portal/agreements/tok_1",
  "/book/sparkle-co",
  "/book/sparkle-co/schedule",
  "/approve/tok_1",
  "/review/tok_1",
  "/site/sparkle-co"
];

describe("resolveClerkRouteDecision", () => {
  it.each(PUBLIC_TOKEN_ROUTES)("keeps %s public for signed-out visitors", (path) => {
    expect(resolveClerkRouteDecision(path, null)).toEqual({ action: "next" });
  });

  it("lets Clerk sign-in/sign-up sub-steps through when signed out", () => {
    expect(resolveClerkRouteDecision("/login", null)).toEqual({ action: "next" });
    expect(resolveClerkRouteDecision("/login/factor-one", null)).toEqual({ action: "next" });
    expect(resolveClerkRouteDecision("/signup/verify-email-address", null)).toEqual({ action: "next" });
  });

  it("redirects signed-out visitors on staff routes to /login", () => {
    expect(resolveClerkRouteDecision("/dashboard", null)).toEqual({ action: "redirect", to: "/login" });
    expect(resolveClerkRouteDecision("/portal", null)).toEqual({ action: "redirect", to: "/login" });
  });

  it("sends signed-in users away from auth pages and lets them reach the app", () => {
    expect(resolveClerkRouteDecision("/login", "user_1")).toEqual({ action: "redirect", to: "/dashboard" });
    expect(resolveClerkRouteDecision("/dashboard", "user_1")).toEqual({ action: "next" });
    expect(resolveClerkRouteDecision("/pay/tok_1/receipt", "user_1")).toEqual({ action: "next" });
  });
});

describe("clerk config", () => {
  it("is disabled without a publishable key and enabled with one", () => {
    expect(isClerkEnabled({})).toBe(false);
    expect(isClerkEnabled({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "  " })).toBe(false);
    expect(isClerkEnabled({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_x" })).toBe(true);
    expect(getClerkPublishableKey({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: " pk_test_x " })).toBe("pk_test_x");
  });
});
