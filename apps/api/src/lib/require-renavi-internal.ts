import type { FastifyRequest, preHandlerHookHandler } from "fastify";

import { apiEnv as env } from "@fsm/config/runtime-env";
import { AppError, ErrorCode, type UserRole } from "@fsm/types";

import { requireRole } from "./authorize.js";

const INTERNAL_STAFF_ROLES: UserRole[] = ["owner", "admin", "dispatcher", "office"];

export const requireRenaviInternalStaff: preHandlerHookHandler[] = [
  requireRole(INTERNAL_STAFF_ROLES),
  async (request: FastifyRequest) => {
    if (request.company.id !== env.RENVANI_INTERNAL_COMPANY_ID) {
      throw new AppError(ErrorCode.FORBIDDEN, "Growth Check is only available to Renvani internal staff");
    }
  }
];
