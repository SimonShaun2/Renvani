import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../../test-support/env-setup.js";

const JWT_SECRET = "jwt_secret";
const JWT_REFRESH_SECRET = "jwt_refresh_secret";
const notificationsQueueAddMock = vi.hoisted(() => vi.fn());

setupTestEnv();

vi.mock("drizzle-orm", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("@fsm/jobs", () => ({
  aiQueue: {
    add: vi.fn()
  },
  notificationsQueue: {
    add: notificationsQueueAddMock
  }
}));

type BuildAppModule = typeof import("../../app.js");
type FakeDbModule = typeof import("../../test-support/fake-db.js");
type TokensModule = typeof import("../../lib/tokens.js");
type AppInstance = Awaited<ReturnType<BuildAppModule["buildApp"]>>;
type ResetTokenInput = Parameters<TokensModule["generateResetToken"]>[0];

let buildAppModule: BuildAppModule;
let fakeDb: FakeDbModule;
let tokens: TokensModule;
let app: AppInstance;

beforeAll(async () => {
  buildAppModule = await import("../../app.js");
  fakeDb = await import("../../test-support/fake-db.js");
  tokens = await import("../../lib/tokens.js");
});

beforeEach(async () => {
  const { resetPublicBookingRateLimitStateForTests } = await import("../../lib/public-booking-rate-limit.js");
  resetPublicBookingRateLimitStateForTests();
  fakeDb.resetTestState();
  notificationsQueueAddMock.mockReset();
  app = await buildAppModule.buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

async function registerUser() {
  const response = await request(app.server).post("/api/v1/auth/register").send({
    companyName: "Tulsa HVAC Pro",
    firstName: "Ava",
    lastName: "Stone",
    email: "owner@example.com",
    password: "password123",
    phone: "555-0100"
  });

  expect(response.status).toBe(202);
  const loginResponse = await request(app.server)
    .post("/api/v1/auth/login")
    .send({ email: "owner@example.com", password: "password123" });
  expect(loginResponse.status).toBe(200);
  return loginResponse.body as {
    user: { id: string };
    company: { id: string; name: string; slug: string };
    tokens: { accessToken: string; refreshToken: string; expiresIn: number };
  };
}

describe("auth and company routes", () => {
  it("POST /auth/register returns 202 on success and creates the account", async () => {
    const response = await request(app.server).post("/api/v1/auth/register").send({
      companyName: "Tulsa HVAC Pro",
      firstName: "Ava",
      lastName: "Stone",
      email: "owner@example.com",
      password: "password123"
    });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ message: "Check your email" });
    const loginResponse = await request(app.server)
      .post("/api/v1/auth/login")
      .send({ email: "owner@example.com", password: "password123" });
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.company.name).toBe("Tulsa HVAC Pro");
  });

  it("POST /auth/register returns 400 on validation failure", async () => {
    const response = await request(app.server).post("/api/v1/auth/register").send({
      companyName: "A",
      firstName: "Ava",
      lastName: "Stone",
      email: "not-an-email",
      password: "short"
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("VALIDATION_ERROR");
  });

  it("POST /auth/register returns the same 202 for an existing email (no enumeration)", async () => {
    await registerUser();

    const response = await request(app.server).post("/api/v1/auth/register").send({
      companyName: "Another Co",
      firstName: "Ava",
      lastName: "Stone",
      email: "owner@example.com",
      password: "password123"
    });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ message: "Check your email" });
  });

  it("POST /auth/login returns 200 on success", async () => {
    await registerUser();

    const response = await request(app.server).post("/api/v1/auth/login").send({
      email: "owner@example.com",
      password: "password123"
    });

    expect(response.status).toBe(200);
    expect(response.body.tokens.refreshToken).toBeTruthy();
  });

  it("POST /auth/login returns 401 for wrong credentials", async () => {
    await registerUser();

    const response = await request(app.server).post("/api/v1/auth/login").send({
      email: "owner@example.com",
      password: "wrong-password"
    });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("UNAUTHORIZED");
  });

  it("POST /auth/refresh succeeds with a valid token", async () => {
    const registerResponse = await registerUser();

    const response = await request(app.server).post("/api/v1/auth/refresh").send({
      refreshToken: registerResponse.tokens.refreshToken
    });

    expect(response.status).toBe(200);
    expect(response.body.tokens.accessToken).toBeTruthy();
  });

  it("POST /auth/refresh returns 401 for expired or revoked tokens", async () => {
    const registerResponse = await registerUser();

    await request(app.server).post("/api/v1/auth/logout").send({
      refreshToken: registerResponse.tokens.refreshToken
    });

    const revokedResponse = await request(app.server).post("/api/v1/auth/refresh").send({
      refreshToken: registerResponse.tokens.refreshToken
    });

    const expiredToken = jwt.sign(
      {
        userId: registerResponse.user.id,
        companyId: registerResponse.company.id,
        tokenType: "refresh"
      },
      JWT_REFRESH_SECRET,
      { expiresIn: -1 }
    );

    const expiredResponse = await request(app.server).post("/api/v1/auth/refresh").send({
      refreshToken: expiredToken
    });

    expect(revokedResponse.status).toBe(401);
    expect(expiredResponse.status).toBe(401);
  });

  it("POST /auth/logout returns 204 even if already logged out", async () => {
    const registerResponse = await registerUser();

    const firstResponse = await request(app.server).post("/api/v1/auth/logout").send({
      refreshToken: registerResponse.tokens.refreshToken
    });
    const secondResponse = await request(app.server).post("/api/v1/auth/logout").send({
      refreshToken: registerResponse.tokens.refreshToken
    });

    expect(firstResponse.status).toBe(204);
    expect(secondResponse.status).toBe(204);
  });

  it("POST /auth/forgot-password returns 200 for existing and nonexistent email", async () => {
    await registerUser();
    notificationsQueueAddMock.mockRejectedValueOnce(new Error("Redis down"));

    const existingResponse = await request(app.server).post("/api/v1/auth/forgot-password").send({
      email: "owner@example.com"
    });
    const missingResponse = await request(app.server).post("/api/v1/auth/forgot-password").send({
      email: "missing@example.com"
    });

    expect(existingResponse.status).toBe(200);
    expect(missingResponse.status).toBe(200);
    expect(existingResponse.body.message).toBe(missingResponse.body.message);
  });

  it("POST /auth/reset-password succeeds, rejects replay, and rejects expired tokens", async () => {
    const registerResponse = await registerUser();
    const resetToken = tokens.generateResetToken({
      userId: registerResponse.user.id,
      email: "owner@example.com"
    } satisfies ResetTokenInput);

    const successResponse = await request(app.server).post("/api/v1/auth/reset-password").send({
      resetToken,
      newPassword: "new-password123"
    });
    const replayResponse = await request(app.server).post("/api/v1/auth/reset-password").send({
      resetToken,
      newPassword: "another-password123"
    });

    const expiredToken = jwt.sign(
      {
        userId: registerResponse.user.id,
        email: "owner@example.com",
        tokenType: "reset"
      },
      JWT_SECRET,
      { expiresIn: -1 }
    );

    const expiredResponse = await request(app.server).post("/api/v1/auth/reset-password").send({
      resetToken: expiredToken,
      newPassword: "another-password123"
    });

    expect(successResponse.status).toBe(200);
    expect(replayResponse.status).toBe(401);
    expect(expiredResponse.status).toBe(401);
  });

  it("GET /company returns 403 when access token companyId does not match user membership", async () => {
    const firstUser = await registerUser();
    const secondUser = await request(app.server).post("/api/v1/auth/register").send({
      companyName: "Other HVAC Co",
      firstName: "Ben",
      lastName: "Lee",
      email: "owner-b@example.com",
      password: "password123"
    });

    expect(secondUser.status).toBe(202);
    const secondLogin = await request(app.server)
      .post("/api/v1/auth/login")
      .send({ email: "owner-b@example.com", password: "password123" });

    const mismatchedAccessToken = jwt.sign(
      {
        userId: firstUser.user.id,
        companyId: secondLogin.body.company.id,
        role: "owner",
        tokenType: "access"
      },
      JWT_SECRET,
      { expiresIn: 3600 }
    );

    const response = await request(app.server)
      .get("/api/v1/company")
      .set("Authorization", `Bearer ${mismatchedAccessToken}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("FORBIDDEN");
  });

  it("GET /company returns 401 when the user account is inactive", async () => {
    const registerResponse = await registerUser();
    const state = fakeDb.getTestState();
    const storedUser = state.users.find((user) => user.id === registerResponse.user.id);

    expect(storedUser).toBeDefined();
    if (storedUser) {
      storedUser.isActive = false;
    }

    const response = await request(app.server)
      .get("/api/v1/company")
      .set("Authorization", `Bearer ${registerResponse.tokens.accessToken}`);

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("UNAUTHORIZED");
  });

  it("GET /company succeeds with a token and returns 401 without one", async () => {
    const registerResponse = await registerUser();

    const successResponse = await request(app.server)
      .get("/api/v1/company")
      .set("Authorization", `Bearer ${registerResponse.tokens.accessToken}`);
    const unauthorizedResponse = await request(app.server).get("/api/v1/company");

    expect(successResponse.status).toBe(200);
    expect(successResponse.body.company.slug).toBe("tulsa-hvac-pro");
    expect(unauthorizedResponse.status).toBe(401);
  });

  it("PATCH /company succeeds, validates input, and returns 401 without a token", async () => {
    const registerResponse = await registerUser();

    const successResponse = await request(app.server)
      .patch("/api/v1/company")
      .set("Authorization", `Bearer ${registerResponse.tokens.accessToken}`)
      .send({
        name: "Updated HVAC Co",
        website: "https://example.com",
        settings: {
          tradingName: "Updated Trade Name",
          currency: "USD",
          notifications: {
            bookingRequest: {
              email: true,
              sms: false
            }
          }
        }
      });
    const validationResponse = await request(app.server)
      .patch("/api/v1/company")
      .set("Authorization", `Bearer ${registerResponse.tokens.accessToken}`)
      .send({
        website: "not-a-url"
      });
    const unauthorizedResponse = await request(app.server)
      .patch("/api/v1/company")
      .send({
        name: "Unauthorized Update"
      });

    expect(successResponse.status).toBe(200);
    expect(successResponse.body.company.name).toBe("Updated HVAC Co");
    expect(successResponse.body.company.settings.tradingName).toBe("Updated Trade Name");
    expect(successResponse.body.company.settings.notifications.bookingRequest.email).toBe(true);
    expect(validationResponse.status).toBe(400);
    expect(unauthorizedResponse.status).toBe(401);
  });
});
