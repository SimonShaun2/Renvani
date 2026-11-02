// Build-time guard for the API origin. NEXT_PUBLIC_API_URL (and API_URL) are inlined at build time;
// without NEXT_PUBLIC_API_URL the /api/v1/public rewrite and every client fetch point at http://localhost:3001.
// Fails Vercel production and preview builds; local dev, tests and CI (no VERCEL_ENV) are untouched.
// Escape hatch: SKIP_ENV_GUARD=1.

export type ApiUrlEnvCheck = { level: "ok" } | { level: "error"; message: string };

export function checkApiUrlEnv(env: Record<string, string | undefined>): ApiUrlEnvCheck {
  if (env.SKIP_ENV_GUARD === "1") return { level: "ok" };
  const vercelEnv = env.VERCEL_ENV;
  if (vercelEnv !== "production" && vercelEnv !== "preview") return { level: "ok" };

  // API_URL alone is not enough: client fetches only read NEXT_PUBLIC_API_URL.
  const hasUrl = Boolean(env.NEXT_PUBLIC_API_URL?.trim());
  if (hasUrl) return { level: "ok" };

  const message =
    "NEXT_PUBLIC_API_URL is not set. Set NEXT_PUBLIC_API_URL to the API origin " +
    "(e.g. the Render api URL) in the Vercel web project env and redeploy; otherwise the app and the " +
    "/api/v1/public rewrite call http://localhost:3001. Set SKIP_ENV_GUARD=1 to bypass.";
  return { level: "error", message };
}
