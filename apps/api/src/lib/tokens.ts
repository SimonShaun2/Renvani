import { compare, hash } from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { apiEnv as env } from "@fsm/config/runtime-env";
import { AppError, ErrorCode } from "@fsm/types";

const accessTokenPayloadSchema = z.object({
  userId: z.string().uuid(),
  companyId: z.string().uuid(),
  role: z.string().min(1),
  tokenType: z.literal("access")
});

const refreshTokenPayloadSchema = z.object({
  userId: z.string().uuid(),
  companyId: z.string().uuid(),
  tokenType: z.literal("refresh")
});

const resetTokenPayloadSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  tokenType: z.literal("reset"),
  iat: z.number().int()
});

export interface AccessTokenPayload {
  userId: string;
  companyId: string;
  role: string;
}

export interface RefreshTokenPayload {
  userId: string;
  companyId: string;
}

export interface ResetTokenInput {
  userId: string;
  email: string;
}

export interface ResetTokenPayload {
  userId: string;
  email: string;
  issuedAt: number;
}

function signToken(payload: object, secret: string, expiresInSeconds: number): string {
  return jwt.sign(payload, secret, {
    expiresIn: expiresInSeconds
  });
}

function verifyToken<T>(token: string, secret: string, schema: z.ZodSchema<T>, message: string): T {
  try {
    const decoded = jwt.verify(token, secret);
    return schema.parse(decoded);
  } catch {
    throw new AppError(ErrorCode.UNAUTHORIZED, message);
  }
}

export function generateAccessToken(payload: AccessTokenPayload): string {
  return signToken(
    {
      ...payload,
      tokenType: "access"
    },
    env.JWT_SECRET,
    env.ACCESS_TOKEN_TTL_SECONDS
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = verifyToken(
    token,
    env.JWT_SECRET,
    accessTokenPayloadSchema,
    "Invalid or expired access token"
  );

  return {
    userId: payload.userId,
    companyId: payload.companyId,
    role: payload.role
  };
}

export function generateRefreshToken(payload: RefreshTokenPayload): string {
  return signToken(
    {
      ...payload,
      tokenType: "refresh"
    },
    env.JWT_REFRESH_SECRET,
    env.REFRESH_TOKEN_TTL_SECONDS
  );
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = verifyToken(
    token,
    env.JWT_REFRESH_SECRET,
    refreshTokenPayloadSchema,
    "Invalid or expired refresh token"
  );

  return {
    userId: payload.userId,
    companyId: payload.companyId
  };
}

export function generateResetToken(payload: ResetTokenInput): string {
  return signToken(
    {
      ...payload,
      tokenType: "reset"
    },
    env.JWT_SECRET,
    env.RESET_TOKEN_TTL_SECONDS
  );
}

export function verifyResetToken(token: string): ResetTokenPayload {
  const payload = verifyToken(
    token,
    env.JWT_SECRET,
    resetTokenPayloadSchema,
    "Invalid or expired reset token"
  );

  return {
    userId: payload.userId,
    email: payload.email,
    issuedAt: payload.iat
  };
}

export async function hashToken(token: string): Promise<string> {
  return hash(token, 10);
}

export async function compareToken(token: string, tokenHash: string): Promise<boolean> {
  return compare(token, tokenHash);
}
