# Google Business Profile sync (Growth): disabled adapter

Status: **disabled**. No keys, no network calls. Every read returns
`{ status: "not_configured", provider: "disabled", reason: "adapter_disabled" }`.

## API (owner/admin, tenant scoped)

- `GET  /api/v1/integrations/google-business-profile`: status `{ optIn, provider, configured, updatedAt }`
- `PUT  /api/v1/integrations/google-business-profile/opt-in`: body `{ "optIn": boolean }` (strict)
- `GET  /api/v1/integrations/google-business-profile/:resource`: `profile | hours | services | reviews`.
  Returns `not_opted_in` until the shop opts in, then the adapter result.

Opt-in lives in `companies.settings.googleBusinessProfile` (JSON). No migration.

## Env vars Shaun adds later (names only)

- `GOOGLE_BUSINESS_PROFILE_CLIENT_ID`
- `GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET`
- `GOOGLE_BUSINESS_PROFILE_REDIRECT_URI`

Do not commit values. Add them through the deployment's secret store only.

## Swapping in a real adapter

1. Implement `GbpProvider` (`apps/api/src/services/growth/gbp-provider.registry.ts`) in a new file,
   e.g. `google-gbp.provider.ts`, with a text id such as `google`. Read the env vars above there,
   and store per-shop OAuth tokens encrypted (that storage is out of scope here).
2. Call `registerGbpProvider(googleGbpProvider)` at boot.
3. Change `activeGbpProviderId()` to return `google` when the env vars are present (keep `disabled` otherwise).
4. Add adapter tests with mocked HTTP. No live calls in CI.
