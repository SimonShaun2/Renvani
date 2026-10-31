import type { ErrorCode } from "@fsm/types";

import { getDefaultRouteForRole, normalizeUserRole, type UserRole } from "./route-access";

export const AUTH_TOKEN_COOKIE_NAME = "fsm_auth_token";
export const AUTH_REFRESH_COOKIE_NAME = "fsm_refresh_token";
export const AUTH_SESSION_COOKIE_NAME = "fsm_auth_session";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface AuthCompany {
  id: string;
  name: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthSessionSnapshot {
  user: AuthUser;
  company: AuthCompany;
  role: UserRole;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
  company: AuthCompany;
  tokens: AuthTokens;
}

export interface ApiErrorPayload {
  error: ErrorCode | "NOT_IMPLEMENTED";
  message: string;
  requestId?: string;
  fields?: Record<string, string> | null;
}

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

interface JwtPayload {
  role?: string;
  exp?: number;
}

function decodeBase64Url(value: string): string | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");

    if (typeof atob === "function") {
      return atob(padded);
    }

    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function parseJwtPayload(token: string): JwtPayload | null {
  const [, payload] = token.split(".");

  if (!payload) {
    return null;
  }

  const decoded = decodeBase64Url(payload);

  if (!decoded) {
    return null;
  }

  try {
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

function getCookieValue(name: string, cookieSource: string): string | null {
  const cookies = cookieSource.split(";").map((entry) => entry.trim());

  for (const cookie of cookies) {
    if (cookie.startsWith(`${name}=`)) {
      return decodeURIComponent(cookie.slice(name.length + 1));
    }
  }

  return null;
}

function createCookie(name: string, value: string, maxAgeSeconds: number): string {
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";

  return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax${secure}`;
}

function createExpiredCookie(name: string): string {
  return `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function buildSessionSnapshot(response: AuthResponse): AuthSessionSnapshot | null {
  const role = normalizeUserRole(response.user.role);

  if (!role) {
    return null;
  }

  return {
    user: {
      id: response.user.id,
      email: response.user.email,
      firstName: response.user.firstName,
      lastName: response.user.lastName,
      role
    },
    company: response.company,
    role
  };
}

function parseSessionCookie(value: string | null): AuthSessionSnapshot | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as {
      user?: {
        id?: string;
        email?: string;
        firstName?: string;
        lastName?: string;
        role?: string;
      };
      company?: {
        id?: string;
        name?: string;
      };
      role?: string;
    };

    const role = normalizeUserRole(parsed.role ?? parsed.user?.role);

    if (
      !role ||
      !parsed.user?.id ||
      !parsed.user.email ||
      !parsed.user.firstName ||
      !parsed.user.lastName ||
      !parsed.company?.id ||
      !parsed.company.name
    ) {
      return null;
    }

    return {
      user: {
        id: parsed.user.id,
        email: parsed.user.email,
        firstName: parsed.user.firstName,
        lastName: parsed.user.lastName,
        role
      },
      company: {
        id: parsed.company.id,
        name: parsed.company.name
      },
      role
    };
  } catch {
    return null;
  }
}

export function getAuthToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  return getCookieValue(AUTH_TOKEN_COOKIE_NAME, document.cookie);
}

export function getRefreshToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  return getCookieValue(AUTH_REFRESH_COOKIE_NAME, document.cookie);
}

export function getStoredSession(): AuthSessionSnapshot | null {
  if (typeof document === "undefined") {
    return null;
  }

  return parseSessionCookie(getCookieValue(AUTH_SESSION_COOKIE_NAME, document.cookie));
}

export function clearBrowserAuthSession(): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = createExpiredCookie(AUTH_TOKEN_COOKIE_NAME);
  document.cookie = createExpiredCookie(AUTH_REFRESH_COOKIE_NAME);
  document.cookie = createExpiredCookie(AUTH_SESSION_COOKIE_NAME);
}

export function setBrowserAuthSession(response: AuthResponse): AuthSessionSnapshot {
  const session = buildSessionSnapshot(response);

  if (!session) {
    throw new Error("Unsupported user role returned from login");
  }

  if (typeof document !== "undefined") {
    const tokenPayload = parseJwtPayload(response.tokens.accessToken);
    const maxAgeSeconds =
      typeof tokenPayload?.exp === "number"
        ? Math.max(tokenPayload.exp - Math.floor(Date.now() / 1000), 0)
        : response.tokens.expiresIn;
    const refreshMaxAge = Math.max(response.tokens.expiresIn * 7, response.tokens.expiresIn);

    document.cookie = createCookie(AUTH_TOKEN_COOKIE_NAME, response.tokens.accessToken, maxAgeSeconds);
    document.cookie = createCookie(AUTH_REFRESH_COOKIE_NAME, response.tokens.refreshToken, refreshMaxAge);
    document.cookie = createCookie(AUTH_SESSION_COOKIE_NAME, JSON.stringify(session), refreshMaxAge);
  }

  return session;
}

export function getLoginRedirectPath(role: UserRole): string {
  return getDefaultRouteForRole(role);
}

export function readServerAuthSession(cookieReader: CookieReader): AuthSessionSnapshot | null {
  const token = cookieReader.get(AUTH_TOKEN_COOKIE_NAME)?.value;
  const tokenPayload = token ? parseJwtPayload(token) : null;
  const role = normalizeUserRole(tokenPayload?.role);
  const isExpired = typeof tokenPayload?.exp === "number" && tokenPayload.exp <= Math.floor(Date.now() / 1000);

  if (!role || isExpired) {
    return null;
  }

  const sessionFromCookie = parseSessionCookie(cookieReader.get(AUTH_SESSION_COOKIE_NAME)?.value ?? null);

  if (sessionFromCookie) {
    return sessionFromCookie;
  }

  return {
    user: {
      id: "unknown",
      email: "",
      firstName: "Renvani",
      lastName: "User",
      role
    },
    company: {
      id: "unknown",
      name: "Renvani"
    },
    role
  };
}
