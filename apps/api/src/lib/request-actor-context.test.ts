import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";

import { getRequestActorOrgContext } from "./request-actor-context.js";

describe("getRequestActorOrgContext", () => {
  it("returns null actor/org fields when request is unauthenticated", () => {
    const request = {} as FastifyRequest;
    expect(getRequestActorOrgContext(request)).toEqual({
      userId: null,
      companyId: null,
      role: null,
      authProvider: null
    });
  });

  it("returns server-derived user, company, role, and auth provider", () => {
    const request = {
      user: {
        id: "user-1",
        email: "o@test.com",
        firstName: "O",
        lastName: "wner",
        role: "owner"
      },
      company: {
        id: "company-1",
        name: "Co",
        slug: "co",
        timezone: "America/Chicago"
      },
      authProvider: "jwt"
    } as FastifyRequest;

    expect(getRequestActorOrgContext(request)).toEqual({
      userId: "user-1",
      companyId: "company-1",
      role: "owner",
      authProvider: "jwt"
    });
  });
});
