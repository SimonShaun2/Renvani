import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

import {
  checkAuthForgotPasswordIpRateLimit,
  checkAuthLoginRateLimit,
  checkAuthRefreshIpRateLimit,
  checkAuthRegisterIpRateLimit
} from "../../lib/public-booking-rate-limit.js";

import {
  forgotPasswordHandler,
  loginHandler,
  logoutHandler,
  refreshHandler,
  registerHandler,
  resetPasswordHandler
} from "./handlers.js";
import {
  forgotPasswordRouteSchema,
  forgotPasswordValidation,
  loginRouteSchema,
  loginValidation,
  logoutRouteSchema,
  logoutValidation,
  refreshRouteSchema,
  refreshValidation,
  registerRouteSchema,
  registerValidation,
  resetPasswordRouteSchema,
  resetPasswordValidation
} from "./schemas.js";

async function sendRateLimited(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await reply.status(429).send({
    error: "RATE_LIMITED",
    message: "Too many attempts. Please try again later.",
    requestId: request.id
  });
}

async function registerRateLimit(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!(await checkAuthRegisterIpRateLimit(request.ip))) {
    await sendRateLimited(request, reply);
  }
}

async function loginRateLimit(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = request.body as { email?: unknown } | undefined;
  const email = typeof body?.email === "string" ? body.email : "";
  if (!(await checkAuthLoginRateLimit(request.ip, email))) {
    await sendRateLimited(request, reply);
  }
}

async function refreshRateLimit(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!(await checkAuthRefreshIpRateLimit(request.ip))) {
    await sendRateLimited(request, reply);
  }
}

async function forgotPasswordRateLimit(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!(await checkAuthForgotPasswordIpRateLimit(request.ip))) {
    await sendRateLimited(request, reply);
  }
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/register", { onRequest: [registerRateLimit], preValidation: [registerValidation], schema: registerRouteSchema }, registerHandler);
  fastify.post("/login", { preValidation: [loginRateLimit, loginValidation], schema: loginRouteSchema }, loginHandler);
  fastify.post("/refresh", { onRequest: [refreshRateLimit], preValidation: [refreshValidation], schema: refreshRouteSchema }, refreshHandler);
  fastify.post("/logout", { preValidation: [logoutValidation], schema: logoutRouteSchema }, logoutHandler);
  fastify.post(
    "/forgot-password",
    { onRequest: [forgotPasswordRateLimit], preValidation: [forgotPasswordValidation], schema: forgotPasswordRouteSchema },
    forgotPasswordHandler
  );
  fastify.post(
    "/reset-password",
    { preValidation: [resetPasswordValidation], schema: resetPasswordRouteSchema },
    resetPasswordHandler
  );
};

export default authRoutes;
