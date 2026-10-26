import { randomBytes } from "node:crypto";

import { compare as comparePassword, hash as hashPassword } from "bcryptjs";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import pino from "pino";

import { env } from "@fsm/config";
import {
  companies,
  db,
  emitEventWithExecutor,
  refreshTokens,
  users
} from "@fsm/db";
import { AppError, ErrorCode } from "@fsm/types";

import {
  compareToken,
  generateAccessToken,
  generateRefreshToken,
  generateResetToken,
  hashToken,
  verifyRefreshToken,
  verifyResetToken
} from "../lib/tokens.js";

type CompanyRecord = typeof companies.$inferSelect;
type UserRecord = typeof users.$inferSelect;
type RefreshTokenRecord = typeof refreshTokens.$inferSelect;
type InsertExecutor = Pick<typeof db, "insert">;

interface RegisterInput {
  companyName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string | undefined;
  timezone?: string | undefined;
}

interface LoginInput {
  email: string;
  password: string;
}

const logger = pino({
  name: "auth-service"
});

const DEFAULT_COMPANY_TIMEZONE = "America/Chicago";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

function requireResult<T>(value: T | undefined, message: string): T {
  if (!value) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, message);
  }

  return value;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

function buildActorName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

function slugifyCompanyName(name: string): string {
  const baseSlug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (baseSlug.length > 0) {
    return baseSlug;
  }

  return `company-${randomBytes(3).toString("hex")}`;
}

async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1);

  return user ?? null;
}

async function findUserById(userId: string): Promise<UserRecord | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  return user ?? null;
}

async function findCompanyBySlug(slug: string): Promise<CompanyRecord | null> {
  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.slug, slug), isNull(companies.deletedAt)))
    .limit(1);

  return company ?? null;
}

export async function generateUniqueCompanySlug(companyName: string): Promise<string> {
  const baseSlug = slugifyCompanyName(companyName);
  let candidate = baseSlug;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const existingCompany = await findCompanyBySlug(candidate);

    if (!existingCompany) {
      return candidate;
    }

    candidate = `${baseSlug}-${randomBytes(2).toString("hex")}`;
  }

  return `${baseSlug}-${randomBytes(4).toString("hex")}`;
}

async function findActiveRefreshTokenMatch(
  userId: string,
  companyId: string,
  refreshTokenValue: string
): Promise<RefreshTokenRecord | null> {
  const candidates = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.userId, userId),
        eq(refreshTokens.companyId, companyId),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date())
      )
    )
    .orderBy(desc(refreshTokens.createdAt));

  for (const candidate of candidates) {
    const isMatch = await compareToken(refreshTokenValue, candidate.tokenHash);

    if (isMatch) {
      return candidate;
    }
  }

  return null;
}

async function issueTokenPair(executor: InsertExecutor, user: UserRecord): Promise<TokenPair> {
  const accessToken = generateAccessToken({
    userId: user.id,
    companyId: user.companyId,
    role: user.role
  });
  const refreshTokenValue = generateRefreshToken({
    userId: user.id,
    companyId: user.companyId
  });
  const refreshTokenHash = await hashToken(refreshTokenValue);

  await executor.insert(refreshTokens).values({
    companyId: user.companyId,
    userId: user.id,
    tokenHash: refreshTokenHash,
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_SECONDS * 1000)
  });

  return {
    accessToken,
    refreshToken: refreshTokenValue,
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS
  };
}

export async function register(
  input: RegisterInput
): Promise<{ status: "created"; company: CompanyRecord; user: UserRecord } | { status: "existing" }> {
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedCompanyName = input.companyName.trim();
  const normalizedFirstName = input.firstName.trim();
  const normalizedLastName = input.lastName.trim();
  const normalizedPhone = normalizeOptionalString(input.phone);
  const normalizedTimezone = normalizeOptionalString(input.timezone) ?? DEFAULT_COMPANY_TIMEZONE;
  const existingUser = await findUserByEmail(normalizedEmail);

  if (existingUser) {
    // No account enumeration: caller returns the same 202 as a new sign-up.
    // TODO: notify the existing account owner ("someone tried to sign up with your email") once an
    // email template for it exists in lib/email.ts (no matching template is wired up today).
    // Dummy hash at the same cost so response timing matches the new-email path.
    await hashPassword(input.password, 12);
    return { status: "existing" };
  }

  const companySlug = await generateUniqueCompanySlug(normalizedCompanyName);
  const passwordHashValue = await hashPassword(input.password, 12);
  const now = new Date();

  return db.transaction(async (tx) => {
    const insertedCompanies = await tx
      .insert(companies)
      .values({
        name: normalizedCompanyName,
        slug: companySlug,
        phone: normalizedPhone ?? null,
        email: normalizedEmail,
        timezone: normalizedTimezone
      })
      .returning();
    const company = requireResult(insertedCompanies[0], "Failed to create company during registration");

    const insertedUsers = await tx
      .insert(users)
      .values({
        companyId: company.id,
        email: normalizedEmail,
        passwordHash: passwordHashValue,
        passwordChangedAt: null,
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        phone: normalizedPhone ?? null,
        role: "owner",
        lastLoginAt: now
      })
      .returning();
    const user = requireResult(insertedUsers[0], "Failed to create user during registration");

    // Tokens are issued at login; register returns a generic 202 (no enumeration).
    const actorName = buildActorName(user.firstName, user.lastName);

    await emitEventWithExecutor(tx, {
      companyId: company.id,
      eventType: "company.created",
      actorId: user.id,
      actorName,
      entityType: "company",
      entityId: company.id,
      summary: `${company.name} company profile created`
    });

    await emitEventWithExecutor(tx, {
      companyId: company.id,
      eventType: "user.registered",
      actorId: user.id,
      actorName,
      entityType: "user",
      entityId: user.id,
      summary: `${actorName} registered the owner account`
    });

    return { status: "created" as const, company, user };
  });
}

export async function login(input: LoginInput): Promise<{ user: UserRecord; tokens: TokenPair }> {
  const normalizedEmail = normalizeEmail(input.email);
  const invalidCredentialsError = new AppError(ErrorCode.UNAUTHORIZED, "Invalid email or password");
  const user = await findUserByEmail(normalizedEmail);

  if (!user || !user.passwordHash || !user.isActive) {
    throw invalidCredentialsError;
  }

  const passwordMatches = await comparePassword(input.password, user.passwordHash);

  if (!passwordMatches) {
    throw invalidCredentialsError;
  }

  return db.transaction(async (tx) => {
    const now = new Date();
    const updatedUsers = await tx
      .update(users)
      .set({
        lastLoginAt: now,
        updatedAt: now
      })
      .where(eq(users.id, user.id))
      .returning();
    const persistedUser = requireResult(updatedUsers[0], "Failed to update user during login");
    const tokens = await issueTokenPair(tx, persistedUser);

    await emitEventWithExecutor(tx, {
      companyId: persistedUser.companyId,
      eventType: "user.login",
      actorId: persistedUser.id,
      actorName: buildActorName(persistedUser.firstName, persistedUser.lastName),
      entityType: "user",
      entityId: persistedUser.id,
      summary: `${persistedUser.firstName} ${persistedUser.lastName} logged in`
    });

    return {
      user: persistedUser,
      tokens
    };
  });
}

export async function refresh(refreshTokenValue: string): Promise<{ tokens: TokenPair }> {
  const verified = verifyRefreshToken(refreshTokenValue);
  const user = await findUserById(verified.userId);

  if (!user || !user.isActive || user.companyId !== verified.companyId) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid or expired refresh token");
  }

  const existingRefreshToken = await findActiveRefreshTokenMatch(
    verified.userId,
    verified.companyId,
    refreshTokenValue
  );

  if (!existingRefreshToken) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid or expired refresh token");
  }

  return db.transaction(async (tx) => {
    await tx.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, existingRefreshToken.id));
    const tokens = await issueTokenPair(tx, user);

    return { tokens };
  });
}

export async function logout(refreshTokenValue: string): Promise<void> {
  const verified = verifyRefreshToken(refreshTokenValue);
  const user = await findUserById(verified.userId);

  if (!user || user.companyId !== verified.companyId) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid or expired refresh token");
  }

  const existingRefreshToken = await findActiveRefreshTokenMatch(
    verified.userId,
    verified.companyId,
    refreshTokenValue
  );

  if (!existingRefreshToken) {
    return;
  }

  await db.transaction(async (tx) => {
    await tx.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, existingRefreshToken.id));

    await emitEventWithExecutor(tx, {
      companyId: user.companyId,
      eventType: "user.logout",
      actorId: user.id,
      actorName: buildActorName(user.firstName, user.lastName),
      entityType: "user",
      entityId: user.id,
      summary: `${user.firstName} ${user.lastName} logged out`
    });
  });
}

export async function forgotPassword(email: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  const user = await findUserByEmail(normalizedEmail);

  if (!user || !user.isActive) {
    return;
  }

  const resetToken = generateResetToken({
    userId: user.id,
    email: user.email
  });
  const resetUrl = `${env.APP_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;

  try {
    const { notificationsQueue } = await import("@fsm/jobs");
    await notificationsQueue.add("send-password-reset-email", {
      companyId: user.companyId,
      toEmail: user.email,
      firstName: user.firstName,
      resetUrl
    });
  } catch (error) {
    logger.debug(
      {
        err: error,
        userId: user.id,
        companyId: user.companyId,
        recipient: "[redacted]"
      },
      "Password reset email enqueue failed"
    );
  }
}

export async function resetPassword(resetTokenValue: string, newPassword: string): Promise<void> {
  const verified = verifyResetToken(resetTokenValue);
  const user = await findUserById(verified.userId);

  if (!user || !user.isActive || normalizeEmail(user.email) !== normalizeEmail(verified.email)) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid or expired reset token");
  }

  if (
    user.passwordChangedAt &&
    verified.issuedAt <= Math.floor(user.passwordChangedAt.getTime() / 1000)
  ) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid or expired reset token");
  }

  const passwordHashValue = await hashPassword(newPassword, 12);
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        passwordHash: passwordHashValue,
        passwordChangedAt: now,
        updatedAt: now
      })
      .where(eq(users.id, user.id));

    await tx
      .update(refreshTokens)
      .set({
        revokedAt: now
      })
      .where(and(eq(refreshTokens.userId, user.id), isNull(refreshTokens.revokedAt)));

    await emitEventWithExecutor(tx, {
      companyId: user.companyId,
      eventType: "user.password_reset",
      actorId: user.id,
      actorName: buildActorName(user.firstName, user.lastName),
      entityType: "user",
      entityId: user.id,
      summary: `${user.firstName} ${user.lastName} reset their password`
    });
  });
}
