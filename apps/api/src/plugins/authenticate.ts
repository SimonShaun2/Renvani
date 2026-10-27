import type { FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

import { db } from "@fsm/db";
import { AppError, ErrorCode, type UserRole } from "@fsm/types";

import { isClerkParallelAuthAvailable, verifyClerkBearerToken } from "../lib/clerk-auth.js";
import { verifyAccessToken } from "../lib/tokens.js";
import {
  findCompanyByClerkOrganizationId,
  resolveStaffUserForClerkSession
} from "../services/clerk-tenant.service.js";

interface AuthenticatedRequestUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

interface AuthenticatedRequestCompany {
  id: string;
  name: string;
  slug: string;
  timezone: string;
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    user: AuthenticatedRequestUser;
    company: AuthenticatedRequestCompany;
    authProvider?: "jwt" | "clerk";
    /** Role claim from the Clerk session token (`metadata.role`); null for legacy JWT or when absent. */
    sessionRole: UserRole | null;
  }
}

function attachRequestIdentity(
  request: FastifyRequest,
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  },
  company: { id: string; name: string; slug: string; timezone: string },
  authProvider: "jwt" | "clerk"
): void {
  request.authProvider = authProvider;
  request.sessionRole = null;
  request.user = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role
  };
  request.company = {
    id: company.id,
    name: company.name,
    slug: company.slug,
    timezone: company.timezone
  };
}

async function authenticateWithInRepoJwt(accessToken: string, request: FastifyRequest): Promise<boolean> {
  let verifiedToken: { userId: string; companyId: string; role: string };

  try {
    verifiedToken = verifyAccessToken(accessToken);
  } catch {
    return false;
  }

  const [user, company] = await Promise.all([
    db.query.users.findFirst({
      where: (userTable, operators) =>
        operators.and(
          operators.eq(userTable.id, verifiedToken.userId),
          operators.isNull(userTable.deletedAt)
        )
    }),
    db.query.companies.findFirst({
      where: (companyTable, operators) =>
        operators.and(
          operators.eq(companyTable.id, verifiedToken.companyId),
          operators.isNull(companyTable.deletedAt)
        )
    })
  ]);

  if (!user || !company) {
    return false;
  }

  if (!user.isActive) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "User account is inactive");
  }

  if (user.companyId !== verifiedToken.companyId) {
    throw new AppError(ErrorCode.FORBIDDEN, "Token company does not match user company");
  }

  if (user.companyId !== company.id) {
    throw new AppError(ErrorCode.FORBIDDEN, "User membership does not match company context");
  }

  attachRequestIdentity(request, user, company, "jwt");
  return true;
}

async function authenticateWithClerk(accessToken: string, request: FastifyRequest): Promise<void> {
  const session = await verifyClerkBearerToken(accessToken);
  const company = await findCompanyByClerkOrganizationId(session.clerkOrganizationId);

  if (!company) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Clerk organization is not linked to a company");
  }

  const user = await resolveStaffUserForClerkSession(company.id, session);
  attachRequestIdentity(request, user, company, "clerk");
  request.sessionRole = session.role;
}

/** preHandler factory: gate a staff route on the DB role (authoritative), after authenticate. */
export function requireStaffRole(...allowed: UserRole[]) {
  return async (request: FastifyRequest): Promise<void> => {
    if (!request.user || !allowed.includes(request.user.role)) {
      throw new AppError(ErrorCode.FORBIDDEN, "Insufficient role");
    }
  };
}

const authenticatePlugin = fp(async (fastify) => {
  fastify.decorateRequest("user", null as unknown as AuthenticatedRequestUser);
  fastify.decorateRequest("company", null as unknown as AuthenticatedRequestCompany);
  fastify.decorateRequest("authProvider", undefined);
  fastify.decorateRequest("sessionRole", null);

  fastify.decorate("authenticate", async (request: FastifyRequest) => {
    const authorizationHeader = request.headers.authorization;

    if (!authorizationHeader) {
      throw new AppError(ErrorCode.UNAUTHORIZED, "Missing access token");
    }

    const [scheme, accessToken] = authorizationHeader.split(" ");

    if (scheme !== "Bearer" || !accessToken) {
      throw new AppError(ErrorCode.UNAUTHORIZED, "Malformed access token");
    }

    const jwtOk = await authenticateWithInRepoJwt(accessToken, request);
    if (jwtOk) {
      return;
    }

    if (isClerkParallelAuthAvailable()) {
      await authenticateWithClerk(accessToken, request);
      return;
    }

    throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid or expired access token");
  });
});

export default authenticatePlugin;
