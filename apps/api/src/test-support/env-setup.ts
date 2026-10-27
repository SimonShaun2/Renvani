import { resetEnvCacheForTests } from "@fsm/config";

import { vi } from "vitest";

const TEST_ENV_VALUES = {
  NODE_ENV: "test",
  API_PORT: "3001",
  WEBHOOK_PORT: "3002",
  DATABASE_URL: "postgres://postgres:postgres@localhost:5432/fsm",
  REDIS_URL: "redis://localhost:6379",
  STRIPE_SECRET_KEY: "sk_test_dummy",
  STRIPE_WEBHOOK_SECRET: "whsec_dummy",
  STRIPE_CONNECT_CLIENT_ID: "ca_test_dummy",
  STRIPE_PLATFORM_FEE_PERCENT: "0.05",
  OPENAI_API_KEY: "openai_dummy",
  TWILIO_ACCOUNT_SID: "twilio_sid",
  TWILIO_AUTH_TOKEN: "twilio_token",
  TWILIO_FROM_NUMBER: "+15555555555",
  RESEND_API_KEY: "",
  SENDGRID_API_KEY: "sendgrid_dummy",
  SENDGRID_FROM_EMAIL: "noreply@example.com",
  R2_ACCOUNT_ID: "r2_account",
  R2_ACCESS_KEY_ID: "r2_access",
  R2_SECRET_ACCESS_KEY: "r2_secret",
  R2_BUCKET_NAME: "fsm-bucket",
  OBJECT_STORAGE_PROVIDER: "memory",
  MEDIA_SIGNED_URL_TTL_SECONDS: "900",
  APP_URL: "http://localhost:3000",
  JWT_SECRET: "jwt_secret",
  JWT_REFRESH_SECRET: "jwt_refresh_secret",
  BOOKING_HOLD_TOKEN_SECRET: "booking_hold_token_secret",
  ACCESS_TOKEN_TTL_SECONDS: "900",
  REFRESH_TOKEN_TTL_SECONDS: "2592000",
  RESET_TOKEN_TTL_SECONDS: "3600",
  ESTIMATE_EXPIRY_DAYS: "30",
  INVOICE_DUE_DAYS: "30",
  NEXT_PUBLIC_API_URL: "http://localhost:3001",
  RENVANI_INTERNAL_COMPANY_ID: "00000000-0000-4000-8000-000000000053",
  STRIPE_PLATFORM_BILLING_PRICE_ID: "",
  CLERK_SECRET_KEY: "",
  QUICKBOOKS_CLIENT_ID: "qbo_test_client",
  QUICKBOOKS_CLIENT_SECRET: "qbo_test_secret",
  QUICKBOOKS_REDIRECT_URI: "http://localhost:3001/api/v1/quickbooks-online/connect/callback",
  QUICKBOOKS_ENVIRONMENT: "sandbox"
} as const;

export function setupTestEnv(): void {
  for (const [key, value] of Object.entries(TEST_ENV_VALUES)) {
    process.env[key] = value;
    vi.stubEnv(key, value);
  }

  resetEnvCacheForTests();
}
