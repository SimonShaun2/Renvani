import type { FastifyRequest, preHandlerHookHandler } from "fastify";

import { env } from "@fsm/config";
import { AppError, ErrorCode, type UserRole } from "@fsm/types";

import { requireRole } from "./authorize.js";

const INTERNAL_ADMIN_ROLES: UserRole[] = ["owner", "admin"];

export const requireRenaviInternalAdmin: preHandlerHookHandler[] = [
  requireRole(INTERNAL_ADMIN_ROLES),
  async (request: FastifyRequest) => {
    if (request.company.id !== env.RENVANI_INTERNAL_COMPANY_ID) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        "Platform queue monitoring is only available to Renvani internal administrators"
      );
    }
  }
];
