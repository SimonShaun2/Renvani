/**
 * STACK-12 — Render API region must match Neon PostgreSQL region.
 */
export const RENDER_NEON_REGION_POLICY = {
  databaseProvider: "neon",
  anchorRenderService: "api",
  connectionEnvVar: "DATABASE_URL"
} as const;

export type RenderNeonRegionPolicy = typeof RENDER_NEON_REGION_POLICY;
