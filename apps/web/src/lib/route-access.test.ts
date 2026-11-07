import { describe, expect, it } from "vitest";

import { canRoleAccessPath, isPublicRoute } from "./route-access";

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
    expect(isPublicRoute("/portal")).toBe(true); // FS-179 customer portal (token in URL fragment)
    expect(isPublicRoute("/portal/agreements")).toBe(false);
    expect(isPublicRoute("/portal/settings/x")).toBe(false);
  });

  it("treats signup and login as public", () => {
    expect(isPublicRoute("/signup")).toBe(true);
    expect(isPublicRoute("/login")).toBe(true);
  });
});

describe("CMS and Studio route access", () => {
  it("treats /blog, /blog/:slug and /compare/:slug as public", () => {
    expect(isPublicRoute("/blog")).toBe(true);
    expect(isPublicRoute("/blog/booking-tips")).toBe(true);
    expect(isPublicRoute("/compare/switching-guide")).toBe(true);
    expect(isPublicRoute("/compare")).toBe(false);
    expect(isPublicRoute("/blog/a/b")).toBe(false);
    expect(isPublicRoute("/api/revalidate")).toBe(true);
  });

  it("keeps /studio private and allows only owner, admin and office", () => {
    expect(isPublicRoute("/studio")).toBe(false);
    expect(isPublicRoute("/studio/structure")).toBe(false);
    expect(canRoleAccessPath("owner", "/studio/structure")).toBe(true);
    expect(canRoleAccessPath("admin", "/studio")).toBe(true);
    expect(canRoleAccessPath("office", "/studio")).toBe(true);
    expect(canRoleAccessPath("dispatcher", "/studio")).toBe(false);
    expect(canRoleAccessPath("technician", "/studio")).toBe(false);
  });
});

  it("only treats known /media static extensions as public", () => {
    expect(isPublicRoute("/media/loops/x.webm")).toBe(true);
    expect(isPublicRoute("/media/loops/x.mp4")).toBe(true);
    expect(isPublicRoute("/media/why/poster.webp")).toBe(true);
    expect(isPublicRoute("/media/why/captions.vtt")).toBe(true);
    expect(isPublicRoute("/media/foo")).toBe(false);
    expect(isPublicRoute("/media/foo.exe")).toBe(false);
    expect(isPublicRoute("/media")).toBe(false);
  });

