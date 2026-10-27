import { describe, expect, it } from "vitest";

import { isPublicRoute } from "./route-access";

describe("isPublicRoute", () => {
  it("treats the marketing home page as public", () => {
    expect(isPublicRoute("/")).toBe(true);
  });

  it("treats customer estimate approval paths as public", () => {
    expect(isPublicRoute("/approve/some-approval-token")).toBe(true);
  });

  it("treats branded growth storefront paths as public", () => {
    expect(isPublicRoute("/site/sparkle-co")).toBe(true);
    expect(isPublicRoute("/site/sparkle-co/inquire")).toBe(true);
  });

  it("does not treat authenticated estimate detail paths as public", () => {
    expect(isPublicRoute("/estimates/550e8400-e29b-41d4-a716-446655440000")).toBe(false);
    expect(isPublicRoute("/estimates/new")).toBe(false);
    // Legacy public URL shape — must stay private (staff route + login), not redirected in middleware.
    expect(isPublicRoute("/estimates/legacy-approval-token-base64url")).toBe(false);
  });

  it("treats public booking flow paths as public", () => {
    expect(isPublicRoute("/book/sparkle-co")).toBe(true);
    expect(isPublicRoute("/book/sparkle-co/schedule")).toBe(true);
    expect(isPublicRoute("/book/sparkle-co/confirmed")).toBe(true);
    expect(isPublicRoute("/book")).toBe(false);
  });

  it("treats pay and pay receipt paths as public", () => {
    expect(isPublicRoute("/pay/tok_123")).toBe(true);
    expect(isPublicRoute("/pay/tok_123/receipt")).toBe(true);
    expect(isPublicRoute("/pay/tok_123/other")).toBe(false);
    expect(isPublicRoute("/pay")).toBe(false);
  });

  it("treats VIP join and customer portal agreement paths as public", () => {
    expect(isPublicRoute("/vip/join/tok_abc")).toBe(true);
    expect(isPublicRoute("/portal/agreements/tok_abc")).toBe(true);
    expect(isPublicRoute("/vip")).toBe(false);
    expect(isPublicRoute("/vip/join")).toBe(false);
    expect(isPublicRoute("/portal")).toBe(false);
    expect(isPublicRoute("/portal/agreements")).toBe(false);
    expect(isPublicRoute("/portal/settings/x")).toBe(false);
  });

  it("treats signup and login as public", () => {
    expect(isPublicRoute("/signup")).toBe(true);
    expect(isPublicRoute("/login")).toBe(true);
  });
});
