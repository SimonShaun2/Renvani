import type { FastifyRequest } from "fastify";

import type { UserRole } from "@fsm/types";

/**
 * Server-derived actor + organization scope for API request tracing (FS-10 / FS-42).
 * Never read organization id from the request body or query for authorization.
 */
export interface RequestActorOrgContext {
  userId: string | null;
  companyId: string | null;
  role: UserRole | null;
  authProvider: "jwt" | "clerk" | null;
}

export function getRequestActorOrgContext(request: FastifyRequest): RequestActorOrgContext {
  return {
    userId: request.user?.id ?? null,
    companyId: request.company?.id ?? null,
    role: request.user?.role ?? null,
    authProvider: request.authProvider ?? null
  };
}

/** Binds actor/org fields on the request logger after authenticate succeeds. */
export function bindRequestActorOrgLogContext(request: FastifyRequest): void {
  const context = getRequestActorOrgContext(request);
  if (!context.companyId || !context.userId) {
    return;
  }

  if (typeof request.log?.child === "function") {
    request.log = request.log.child({
      companyId: context.companyId,
      userId: context.userId,
      role: context.role,
      authProvider: context.authProvider
    });
  }
}
