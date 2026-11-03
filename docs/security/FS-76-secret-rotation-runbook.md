# FS-76 — Secret rotation & revocation runbook

**Ticket:** [FS-76](https://app.notion.com/p/401317b92d1581c49195d4cff55672fe)  
**Owner map:** `FS-76-secret-owner-map.md`  
**Status:** Draft — procedural only. **Do not** paste secret values into tickets, PRs, or chat.

## Scope

- **In scope:** Documented steps for **non-production** rotation drills and production **process** (executed by Shaun).
- **Out of scope:** Creating or rotating **production** credentials in this ticket; automated host secret sync. The FS-76 scanner is included only in an authorized batch CI run.

**Injection (official stack):** Vercel web, Render API/worker/webhook and Key Value, Neon PostgreSQL, Clerk development identity for tester tier, Cloudflare R2 — see the [owner map](./FS-76-secret-owner-map.md#fs-93--official-stack-injection-model-documentation-only).

## Preconditions

1. FS-76 env inventory current (`FS-76-secrets-env-inventory.md`).
2. Approved maintenance window for auth secrets (JWT) — rotation logs out all users.
3. Security notified for drills touching Stripe, Twilio, or auth.

## General rotation pattern

```text
1. Issue new credential in provider console (Shaun for prod; Platform for the exact approved staging target, with founder access only when provider administration requires it).
2. Write new value to approved secret store for target environment — never to git.
3. Redeploy only the scoped consumers; order depends on the credential class.
4. Verify: health checks, send test SMS/email in staging only, Stripe test webhook, login smoke.
5. Revoke old credential at provider after verification window.
6. Record: date, env, credential class, executor (name), ticket link — no secret values.
```

## Per-class notes

| Credential | Blast radius | Rotation notes |
| --- | --- | --- |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | All sessions invalid | Schedule operator comms; deploy all API instances together. |
| `BOOKING_HOLD_TOKEN_SECRET` | In-flight slot holds invalid | API-only deploy; no staff logout. |
| `STRIPE_WEBHOOK_SECRET` | Webhooks fail until endpoint updated | Update Stripe dashboard endpoint + deploy webhook service same window. |
| `STRIPE_SECRET_KEY` | Payments API | Prefer restricted keys; rotate in staging with test mode first. |
| `TWILIO_AUTH_TOKEN` | SMS/voice | Update token in store; replay failed outbox after deploy (FS-15). |
| `SENDGRID_API_KEY` | Email | Invalidate old key after queue drain. |
| `OPENAI_API_KEY` | AI jobs fail | Pause or drain `fsm:ai` queue during swap. |
| `R2_SECRET_ACCESS_KEY` | Uploads/imports | Create second key if provider supports; swap then delete old. |
| `DATABASE_URL` | Total outage | Password rotate via host; connection pool recycle. |
| `REDIS_URL` | Queues/cache | Drain workers briefly; ensure no password in logs. |

## Non-production drill (acceptance evidence for FS-76)

**Goal:** Demonstrate rotation **process** without production impact.

1. **Staging only** (or local): the authorized Platform owner issues a **new** test credential for one scoped class after target-specific approval.
2. Platform updates only its actual staging consumers in approved **Render** or **Vercel** secret settings; Neon, Render Key Value, Clerk and Cloudflare R2 are touched only when that class requires them.
3. Redeploy the scoped service; confirm startup passes its `@fsm/config/runtime-env` view and enabled adapter checks.
4. Run smoke: API `GET /health` (if present), one queued notification job in **test** mode.
5. Revoke previous staging key.
6. Attach evidence to FS-76 Notion: executor, timestamp, env, class rotated — **no values**.

## Incident — exposed credential

1. **Contain:** Revoke compromised credential at provider immediately (**Shaun** for prod).
2. **Rotate:** Issue replacement; inject via secret store; deploy all consumers.
3. **Audit:** Git history, approved CI scanner logs and recent PRs for accidental commit.
4. **Notify:** Security + E.. CoS; FS-8 threat model cross-reference.
5. **Post-incident:** Update inventory and owner map if scope changed.

## Logging & redaction

- Do not log env vars at `info` or above.
- Error messages must not echo `DATABASE_URL`, tokens, or webhook payloads with secrets.
- See AGENTS.md logging rules and FS-8 matrix for PII.

## Checklist (copy for each rotation)

- [ ] Environment identified (not prod unless Shaun-approved window)
- [ ] Owner map consulted
- [ ] New secret in store only
- [ ] All dependent services redeployed
- [ ] Verification completed
- [ ] Old secret revoked
- [ ] Evidence recorded without values
