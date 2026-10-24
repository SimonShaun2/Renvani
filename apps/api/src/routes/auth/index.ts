import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

import { checkAuthRegisterIpRateLimit } from "../../lib/public-booking-rate-limit.js";

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

async function registerRateLimit(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const allowed = await checkAuthRegisterIpRateLimit(request.ip);

  if (!allowed) {
    await reply.status(429).send({
      error: "RATE_LIMITED",
      message: "Too many sign-up attempts. Please try again later.",
      requestId: request.id
    });
  }
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/register", { onRequest: [registerRateLimit], preValidation: [registerValidation], schema: registerRouteSchema }, registerHandler);
  fastify.post("/login", { preValidation: [loginValidation], schema: loginRouteSchema }, loginHandler);
  fastify.post("/refresh", { preValidation: [refreshValidation], schema: refreshRouteSchema }, refreshHandler);
  fastify.post("/logout", { preValidation: [logoutValidation], schema: logoutRouteSchema }, logoutHandler);
  fastify.post(
    "/forgot-password",
    { preValidation: [forgotPasswordValidation], schema: forgotPasswordRouteSchema },
    forgotPasswordHandler
  );
  fastify.post(
    "/reset-password",
    { preValidation: [resetPasswordValidation], schema: resetPasswordRouteSchema },
    resetPasswordHandler
  );
};

export default authRoutes;
