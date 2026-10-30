# FS-191: SMS provider, two-way SMS / unified inbox, missed-call text-back (plan)

Status: **PLAN ONLY.** This note adds no code, no migration and no live sending. Card: https://app.notion.com/p/406317b92d1581f3aacffff7715a156e (P0, Risk: Tenant/Consent).

## What exists on dev today
- `packages/comms`: the `OutboundSmsChannel` interface and `createDisabledSmsChannel()` (inert stub). The feature flag `outboundSmsEnabled` is `false`.
- `apps/webhook`: a Twilio inbound handler with `twilio-verify.ts`, which checks the HMAC-SHA1 `X-Twilio-Signature` with a timing-safe compare. Inbound messages are written to `message_logs`.
- `message_logs` (channel and direction are pgEnums, kept as they are), `customers.prefers_sms`, `booking_requests.sms_consent_*`, and `on_the_way_notifications`.

## 1. Provider registry (packages/comms)
```ts
interface SmsProvider {
  id: string;                                      // "disabled" (default), "twilio", ...
  send(msg: { from: string; to: string; body: string; idempotencyKey: string }): Promise<{ providerMessageId: string; status: string }>;
  verifyInbound(req: { url: string; headers: Record<string,string>; params: Record<string,string> }): boolean;
  parseInbound(params): { from: string; to: string; body: string; providerMessageId: string; kind: "message" | "status" | "missed_call" };
}
registerSmsProvider(p); getSmsProvider(env.SMS_PROVIDER)   // boot-validated like GEO_PROVIDER
```
- Default `SMS_PROVIDER=disabled` uses the existing stub.
- The **Twilio adapter is a stub**: `send()` refuses (returns `blocked:not_enabled`) unless *all* of these hold: `SMS_PROVIDER=twilio`, `featureFlags.outboundSmsEnabled`, `SMS_LIVE_SEND_ACK=true`, and the tenant has a verified sending number.
- Nothing in CI or tests can reach the network: the adapter takes an injected `fetch`, and tests pass a fake.

## 2. Data model sketch (text columns plus app-level registries, no pgEnums)
- `sms_numbers` (tenant): `e164`, `provider`, `provider_number_id`, `purpose` (text: `main|missed_call`), `status`. Partial unique `(e164) WHERE deleted_at IS NULL`; inbound routing keys on the `To` number, which replaces today's single-company fallback.
- `inbox_threads` (tenant): `customer_id?`, `counterpart_e164`, `channel` (text: `sms|call`), `status` (text: `open|snoozed|closed`), `assigned_user_id?`, `last_message_at`, `unread_count`, `version`. Partial unique `(company_id, channel, counterpart_e164) WHERE deleted_at IS NULL`.
- `inbox_messages` (tenant): `thread_id`, `direction` (text), `body` (capped at 1600 chars), `provider_message_id`, `status` (text: `queued|blocked|sent|delivered|failed|received`), `blocked_reason`, `idempotency_key`. Partial unique `(company_id, idempotency_key)` and `(provider, provider_message_id)` for inbound dedupe.
- `sms_consents` (tenant): `e164`, `customer_id?`, `scope` (text: `transactional|marketing`), `state` (text: `opted_in|opted_out`), `source` (text: `booking_form|staff_attested|keyword|import`), `evidence` jsonb (form version and the wording hash), `changed_at`. Append-only history, with the current state taken from the latest row per `(e164, scope)`.
- Missed calls go in as `inbox_messages` rows with `kind=missed_call` on the thread. The text-back is a normal outbound send that passes through every gate.

## 3. Consent / opt-out
- Every outbound send passes one function, `canSend(companyId, e164, scope, now)`. It checks consent state for the scope, the opt-out (which always wins), quiet hours, and the provider being enabled.
- Blocked sends are still stored, as `status=blocked` with a reason, so the inbox shows why.
- Transactional texts (OTW, reminders) need `transactional` consent. Marketing needs a separate `marketing` consent and is out of MVP scope.
- Missed-call text-back is treated as transactional and needs consent or an existing relationship. Exact rule: **Legal/Shaun decision**.

## 4. Keywords (inbound, before threading side effects)
- Normalize the body: trim, uppercase, first token.
- `STOP|STOPALL|UNSUBSCRIBE|CANCEL|END|QUIT` → opt out of all scopes, plus one confirmation reply that bypasses consent but not the provider gate.
- `START|UNSTOP|YES` → re-opt-in to transactional.
- `HELP|INFO` → help text (business name, contact, "Reply STOP to opt out").
- The keyword list and reply texts live in a config registry (`registerSmsKeyword`), so carrier or provider changes don't need code.
- Keywords are processed idempotently per `provider_message_id`.

## 5. Quiet hours
- Per-tenant config (default 8:00–21:00 in the company time zone), evaluated in the recipient's time zone when it is known, otherwise the company's.
- Outbound sends outside the window are **deferred** to the next window by a queued job; they are not dropped.
- STOP/HELP confirmations are exempt. Per-category exemptions are an open question.

## 6. Inbound webhook
- Reuse `twilio-verify.ts`, behind the provider's `verifyInbound`. Reject unsigned or invalid requests with 403 and no body echo.
- Use the exact public URL from config when computing the signature, because of proxies.
- Idempotent: `INSERT … ON CONFLICT (provider, provider_message_id) DO NOTHING`.
- Resolve the tenant from the `To` number via `sms_numbers` using a narrow SECURITY DEFINER lookup or the service role, then run every write in `runTransactionWithTenantSession(companyId)`.
- Unknown numbers get a 200 with empty TwiML and are not stored.
- Never log message bodies or phone numbers, only hashes and ids.

## 7. Tenant RLS
- Every new table gets `company_id`, ENABLE + FORCE RLS and `tenant_isolation_<table>` on `app.current_company_id`. DDL is guarded (IF NOT EXISTS, DROP POLICY IF EXISTS, DO blocks).
- Partial unique indexes match the `.where` in `schema.ts`.
- Tests: a live cross-tenant RLS integration test per table, plus a webhook test where tenant A's number can't write into tenant B.

## 8. API (Fastify, strict zod with size caps)
- `GET /inbox/threads`, `GET /inbox/threads/:id/messages` (cursor-paged): owner, admin, dispatcher, office.
- `POST /inbox/threads/:id/messages`: `Idempotency-Key` plus the thread `version`. It goes through `canSend`; with the stub it ends `blocked:not_enabled` or `sent(stub)`.
- `PATCH /inbox/threads/:id` (assign, status): optimistic `version`.
- `PUT /customers/:id/sms-consent`: owner or admin, staff-attested, with evidence.

## 9. Extension points
- `registerSmsProvider` (Twilio, Bird, Telnyx), `registerSmsKeyword`, an inbox channel registry (email or webchat later), a thread `kind` registry, and a quiet-hours policy hook.
- OTW and reminder texts call `sendTransactionalSms(...)` instead of the stub directly.

## 10. Delivery slices (each its own PR)
1. Registry, Twilio stub and `canSend` (no DB).
2. Migration: the tables above plus RLS.
3. Inbound webhook threading and keywords.
4. Inbox API.
5. Missed-call text-back (rule-gated).

**Migration idx is assigned at merge time** (next free idx on dev; journal contiguity is enforced by migration-safety). The migrations are additive and safe to re-run.

## Decisions needed from Shaun (blocking live use; slices 1–4 can be built inert before them)
1. **Provider choice:** Twilio (current default assumption) vs Bird or Telnyx.
2. **A2P 10DLC:** brand and campaign registration spend, and who registers (platform-level ISV brand vs per-tenant brands); campaign use-case wording.
3. **Number provisioning spend:** a platform pool vs a number per tenant, monthly per-number cost, and who pays (pass-through or bundled in the plan).
4. **Consent wording and evidence standard (owner: Legal agent):** opt-in copy on booking and portal forms, whether staff-attested consent is allowed, whether missed-call text-back counts as transactional, STOP/HELP reply copy, and quiet-hours policy and exemptions (TCPA and state laws).
5. **Live-send go-live gate:** who flips `outboundSmsEnabled` / `SMS_LIVE_SEND_ACK`, and the per-tenant rate and spend caps.
