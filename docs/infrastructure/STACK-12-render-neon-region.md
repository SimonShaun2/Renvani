# STACK-12 — Render + Neon region alignment (Iris)

**Status:** Runbook (no live provisioning)  
**Pairs with:** STACK-01 (Neon URLs), STACK-11 (staging matrix), FS-93 Render blueprint

## Rule

Neon PostgreSQL must be provisioned in the **same cloud region** as the Render **API** web service. Worker and webhook services should use the same Neon project/branch connection strings as the API unless a future ADR splits read replicas.

## Checklist (staging / prod)

1. Render region is Ohio `ohio` (Neon project is US East (Ohio)); all four Blueprint entries use it.
2. Create or select Neon project in the matching region.
3. Set `DATABASE_URL` on Render API, worker, and webhook from Neon (prefer pooler endpoint for web/worker).
4. Set Vercel `NEXT_PUBLIC_API_URL` to the Render API hostname for that environment.
5. Run migrations once per environment from CI or approved deploy job.
6. Validate FS-79 `/health` and `/health/ready` on API before cutover.

## Per-PR previews

When `batch-ci` uses Neon **per-PR branches**, preview Render services (if any) must point at the matching ephemeral branch URL — not shared dev.

## Blueprint reference (not applied)

- Draft: [`render-blueprint.render.yaml`](./render-blueprint.render.yaml) — API, worker, webhook, and Key Value (`noeviction`); `DATABASE_URL` from Neon only.
- Contract tests: `@fsm/config/fs93-render-blueprint` (`validateFs93RenderBlueprintYaml`).

## Related

- [FS-93 Render runbook](../platform/FS-93-render-runbook.md)
- [OFFICIAL-OPERATIONAL-STACK.md](../OFFICIAL-OPERATIONAL-STACK.md)
- [OFFICIAL-STACK-GAP-ANALYSIS.md](../platform/OFFICIAL-STACK-GAP-ANALYSIS.md)

**Blueprint:** canonical file is `/render.yaml` (identical reference copy: `docs/infrastructure/render-blueprint.render.yaml`). Apply steps: `docs/infrastructure/RENDER-DEPLOY-RUNBOOK.md` (FS-93).
