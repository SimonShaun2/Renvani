# FS-29 Owner Command Center: backend API shapes

> **Status:** implemented (API only) in the FS-29 PR. E.. CoS decisions from 2026-10-31 are applied below and summarised in §9; where the original scoping text differs from §9, §9 and the shipped types (`packages/types/src/command-center.types.ts`) win.

Scoped 2026-10-31 against dev `7c756555`. Inputs:
- Figma `jiGHTNUJNltWbHA4Il3hk7`, read-only. Frame 10:2 is desktop "01 Command Center"; frame 266:1165 is mobile owner "Today".
- Notion FS-29 "Owner Command Center: daily business brief and agent control" (Field Service Build Board; Backlog, P1, Pair 5, Risk Architecture). Its acceptance rule: "every recommendation cites underlying records and confidence; the brief is reproducible, tenant-scoped, and distinguishes facts from suggestions".

## 1. What the designs need

**Frame 10:2 (desktop)**
- **Header:** greeting, date, and "7 approvals waiting · 1 exception".
- **Four KPI cards**, each with a value, a delta or detail, and a "Source:" line:
  - Direct inquiries ("46, +11 vs Sep", source "Your branded site + app")
  - Inquiry → booked ("41%, 19 of 46", source "Revenue Agent handoffs")
  - First → recurring ("58%, 11 of 19", source "Retention offers accepted")
  - Marketing revenue ("$4,860, 26 rebookings · 3 campaigns", source "Automations + win-back")
- **"Needs you" list** with Approvals and Exceptions counts. Each item has:
  - a state chip: Needs approval, Escalated or Stale version;
  - the agent name, a title and a reason;
  - **source links** (for example "Web inquiry #4182 · price book v3 · email opt-in ✓" or "Draft v2 → record v3 · approval invalidated");
  - a primary action.
- **"This month's loop":** Discover inquiries 46 → Book confirmed 19 → Tune-up completed 17 → Rebook recurring 11.
- **"Today's crews":** each crew's jobs, its next time, and a status (On route / Exception / Off).

**Frame 266:1165 (mobile)**
- "Jobs today 2 (HVAC + Plumbing)" and "Needs you 1".
- One featured approval card.
- A **Connected record** chain: INQ-1043 Captured → EST-1043 Approved $238 → J-4519 Scope review.

## 2. Reusable API pieces (already on dev)

| Piece | Where | Reuse for |
|---|---|---|
| Direct demand (`DirectDemandSummary`: jobs and paid revenue by `utm_source`/referrer) | `GET /api/v1/reporting/direct-demand` → `getDirectDemandSummary(companyId, tz, {startDate,endDate})` in `services/job-source-reporting.service.ts:375` (#347/#357) | Direct-inquiries KPI source split; marketing attribution |
| Job sources | `GET /reporting/job-sources` (owner/admin), `resolveReportingPeriod` + `assertJobSourceReportingPeriodAllowed` (366-day cap, company IANA tz) | Shared period/timezone semantics |
| Revenue outcomes (`RevenueOutcomesSummary`: funnel inquiries→qualified→estimates→confirmed→completed→repeat, segments new/repeat and agent-assisted/manual, profit) | `GET /reporting/revenue-outcomes` → `getRevenueOutcomesSummary` in `services/revenue-outcomes.service.ts:167` (#344, FS-22) | Inquiry→booked KPI, loop (Discover/Book/Complete/Rebook), repeat revenue |
| Call tracking (`callRecords` table, `listCallRecords`) | `services/growth/call-tracking.service.ts` (#347 lineage, #379) | Phone inquiries count as Direct inquiries (source kind `call_record`) |
| Operator inbox | `countOperatorInbox` (per-state counts), `listOperatorInbox`, `getOperatorInboxItem`, `getOperatorInboxTimeline`, `GET /operator/jobs/:jobId/provenance` (`services/operator-inbox.service.ts`) | "Needs you" list and counts, escalations, provenance chain |
| Agent-action receipts / delivery states | `AgentActionDeliveryStateV1Schema` = `queued \| provider_accepted \| delivered \| failed`; receipt `outcome` = `succeeded \| queued \| failed \| dry_run` (#380, #395) | Exceptions: `failed` actions and delivery failures; "queued" is not "sent" |
| Stale version | `version` on inbox items and the TE-STALE compare-and-set (#370/#381) | "Stale version" chip (record changed after the draft) |
| Crews | `GET /crews` (`routes/crews/index.ts:126`), dispatch routes | Today's crews (jobs count, next start, exception) |
| Web placeholders | `apps/web/src/components/command-center/command-center.config.ts:26-33` `pending = () => null` for the 4 KPIs (audit doc §5) | The endpoint below replaces these (Dev C wires it) |

## 3. Proposed endpoint

`GET /api/v1/command-center/brief`
- **Auth:** `onRequest: [fastify.authenticate, requireRole(["owner","admin"])]`. Auth runs before validation, matching the TE-AUTH pattern from #382; validation goes in `preValidation`/`preHandler`.
  - A dispatcher (and technician) gets 403, even with an invalid query (decision 1).
- **Tenant:** `companyId` comes only from the auth context, never from the query. All queries filter on `company_id`.
- **Query** (zod `commandCenterBriefQuerySchema`, `.strict()`):
  - `date` — optional `YYYY-MM-DD`, the owner's "today". Defaults to today in the timezone.
  - `timeZone` — optional IANA name. Defaults to the company timezone; it is validated with `Intl.DateTimeFormat` and returns 400 if invalid.
  - `period` — optional, `month` only (the default; the calendar month containing `date`). The comparison period is the previous calendar month (decision 6). `last_30_days` was dropped from v1 to keep one period model; it returns 400.
  - Bad or unknown params return 400, but only after auth.
- **Response:** `200 CommandCenterBrief`. Unknown company settings fall back to defaults.

```ts
type CommandCenterSourceKind =
  | "booking_request" | "call_record" | "job" | "invoice" | "customer"
  | "agent_action" | "maintenance_plan" | "crew" | "campaign";

interface CommandCenterSource {
  kind: CommandCenterSourceKind;
  id: string;                 // record id (or report key for kind "report")
  label: string;              // e.g. "INQ-1043", "EST-1043", "Web inquiry #4182" — no customer contact details
  route: string;              // web route, e.g. "/inquiries/<id>", "/approvals/<id>", "/reporting/revenue-outcomes?..."
  occurredAt: string | null;  // ISO instant of the fact the source backs
}

interface CommandCenterBrief {
  generatedAt: string;                       // ISO; reproducible given same data + params (no LLM, no provider calls)
  period: { date: string; period: "month"; startDate: string; endDate: string; timeZone: string; compareStartDate: string; compareEndDate: string };
  header: { approvalsWaiting: number; exceptions: number };
  kpis: Array<{
    key: "direct_inquiries" | "inquiry_to_booked" | "first_to_recurring" | "marketing_revenue";
    label: string;
    value: number | string | null;            // count, percent (0-100, 2dp), or money decimal string; null = no data
    unit: "count" | "percent" | "money";
    numerator?: number; denominator?: number; // "19 of 46"
    previousValue: number | string | null;    // delta "vs Sep"
    detail: string | null;                    // deterministic template, e.g. "26 rebookings · 3 campaigns"
    sourceLabel: string;                      // "Your branded site + app"
    definition: string;                       // registry text (like REVENUE_FUNNEL_STAGE_REGISTRY)
    sources: CommandCenterSource[];           // capped (e.g. 20) + sourcesTruncated
    sourcesTruncated: boolean;
  }>;
  needsYou: {
    counts: { approvals: number; exceptions: number };
    items: Array<{
      kind: "fact" | "suggestion";            // FS-29: distinguish facts from suggestions
      state: "awaiting_approval" | "escalated" | "execution_failed" | "delivery_failed"   // stale_version deferred: not reliably known in v1;
      agentProduct: string;                   // revenue | service | scheduling | retention
      actionId: string; actionType: string;
      version: number;                        // updatedAt ms, for approve/execute with expectedVersion
      title: string;                          // "<Action type> · <state>", never a customer name
      primaryAction: "approve" | "review" | "open";
      sources: CommandCenterSource[];         // provenance chain (inquiry → estimate → job)
      occurredAt: string;
    }>;                                       // newest first; limit 20
    truncated: boolean;
  };
  loop: Array<{ stage: "discover" | "book" | "complete" | "rebook"; label: string; count: number; sources: CommandCenterSource[]; sourcesTruncated: boolean }>;
  crewsToday: Array<{ crewId: string; name: string; jobCount: number; nextStartAt: string | null;
                      status: "on_route" | "exception" | "off" | "scheduled"; sources: CommandCenterSource[] }>;
  today: { jobsToday: number; sources: CommandCenterSource[] };   // mobile 266:1165 uses the same endpoint (decision 7)
  emptyStates: { hasAnyData: boolean; missing: Array<"inquiries" | "jobs" | "agent_actions" | "crews"> };
}
```

### Deterministic composition (no LLM or provider calls)

| Section | How it is computed |
|---|---|
| `direct_inquiries` | Count of `booking_requests` created in the period with a direct source (site, app, booking page), plus inbound `callRecords` from tracked numbers if counted (open question 2). The previous period is computed the same way. Sources are the request and call ids. |
| `inquiry_to_booked` | `getRevenueOutcomesSummary` funnel: `jobs_confirmed` ÷ `inquiries`, restricted to requests converted to jobs. Sources are the converted request→job pairs. |
| `first_to_recurring` | Customers whose first booked job falls in the period ÷ those of them with an active `maintenance_plans` / agreement / VIP row or a later booked job. Sources are customer and plan ids. |
| `marketing_revenue` | Paid invoices whose job is tied to a campaign or automation (`campaigns`, `automation_rules`, `lead_attribution`). Detail is "N rebookings · M campaigns". Sources are invoice and campaign ids. |
| Needs you | `listOperatorInbox` covers `awaiting_approval`, escalated and `failed`, plus receipts with `deliveryState: "failed"`. Stale is when the proposal's base version is behind the target record. Sources come from the `/operator/jobs/:jobId/provenance` logic and the action targets. |
| Loop | The revenue-outcomes funnel stages mapped as inquiries → `jobs_confirmed` → `jobs_completed` → `repeat_jobs`. |
| Crews today | `crews` joined to jobs scheduled on `date` in the timezone. `exception` means an escalated or failed action targets one of the crew's jobs today. |

Run the queries in parallel inside a single tenant-scoped read. The 366-day cap is not needed because the period is at most about 31 days.

## 4. Empty and no-data states
- A new tenant gets 200 with `value: null` (not 0) where the denominator is 0, empty arrays, and `emptyStates.hasAnyData=false` plus a `missing[]` list, so the web can show "—" with a definition instead of a fake 0.
- A percent is null when the denominator is 0. Money uses `"0.00"` only when the denominator exists.

## 5. Caching, idempotency and migration
- **Caching:** none server-side in v1; it is computed live. Send `Cache-Control: private, no-store`, since this is tenant data and approvals change. The web can use react-query staleTime of about 30s. A precomputed nightly brief belongs to a later FS-29 slice.
- **Idempotency:** N/A. This is a read-only GET with no writes and no audit event (decision 4).
- **Migration:** none. Everything comes from existing tables (booking_requests, call_records, estimates, jobs, invoices, maintenance_plans, campaigns, automation_rules, agent_actions, activity_events, crews). An index might be needed later if p95 is slow.

## 6. Files

**Create**
- `packages/types/src/command-center.types.ts`: zod query schema, `CommandCenterBrief`, `CommandCenterSource`, and the KPI registry (key, label, definition, sourceLabel). Export it from the `packages/types/src/index.ts` barrel.
- `apps/api/src/services/command-center/command-center-brief.service.ts`: `getCommandCenterBrief(companyId, query)`, which composes the existing services.
- `apps/api/src/services/command-center/command-center-sources.ts`: pure builders for source labels and routes, unit tested.
- `apps/api/src/routes/command-center/{index,handlers,schemas}.ts`: the route, plus a JSON response schema with `additionalProperties:false`.
- Tests: `routes/command-center/command-center-brief.test.ts` (fake-db) and `services/command-center/command-center-brief.service.test.ts`. Optionally a Postgres integration test in `packages/db` or `api` behind `NEON_CI_DATABASE_URL`.

**Edit**
- The route registration (app/routes index).
- `docs/architecture/TRUSTED_EXECUTION_AUDIT.md` §5: point it at the new endpoint.
- Small exported helpers only if needed, e.g. reusing the period resolver from `job-source-reporting.service.ts` and the provenance builder from `operator-inbox.service.ts`. No behaviour change to existing endpoints.

**Not in this PR:** `apps/web`. Dev C swaps `pending()` in `command-center.config.ts` for this endpoint.

## 7. Tests (planned)
1. 401 without a token. 403 for technician and dispatcher. Auth runs before validation: a bad `timeZone` without a token gets 401.
2. 400 for a bad date, timezone or period, and for an unknown param.
3. **Tenant isolation:** company B data never appears in A's counts or sources, and ids from B never show up.
4. **KPI math with fixtures:** 46 inquiries / 19 booked gives 41.30%. The previous-period delta. Denominator 0 gives null.
5. **Timezone boundary:** an inquiry at 23:30 local on the last day of the month is in the period.
6. Every KPI, needs-you item, loop stage and crew has at least one `sources[]` entry when its count is above 0. Every source has kind, id, label and route. No email or phone appears in labels.
7. **Needs-you ordering and states:** a failed delivery is an exception; a stale version shows when the target was updated after the draft; `kind` is fact vs suggestion.
8. **Determinism:** same data and params give a deep-equal response, apart from `generatedAt`.
9. **No writes:** spy on `db.insert`/`update`/`delete` and expect 0 calls. No provider or LLM module is imported (mocked to throw).
10. Empty tenant gives `hasAnyData=false`.

## 8. Risks
- **KPI definitions are product decisions.** "Direct", "recurring" and "marketing revenue" could double-count across direct-demand, revenue-outcomes and the campaign definitions. Mitigation: one registry with definition text, plus tests that pin the math.
- **Performance:** about 8 queries per load. Keep it to the period and LIMIT the source lists. Measure on the Neon CI branch.
- **Leaking PII through labels:** use record numbers only (INQ-/EST-/J-), never names or phones. Note that the Figma shows "Dana Whitfield" in titles, which needs a decision (question 5).
- **Stale detection** depends on the proposal storing its target base version. If older proposals lack it, return `stale_version` only when it is known.
- **Crew "On route"** needs a live ETA/status signal. Use job status only (`en_route` if present); otherwise use `scheduled`.

## 9. Decisions (E.. CoS, 2026-10-31) — resolved
1. **Roles:** owner/admin only. Dispatcher and technician get 403 (role check in `onRequest`, before validation).
2. **Calls:** tracked-number inbound calls count as direct inquiries, deduped against a booking request from the same caller (booking phone normalised to E.164 and hashed with `hashCallerNumber`) within ±24h.
3. **Recurring:** an active maintenance plan / agreement / VIP row (`maintenance_plans.status = active`), or a later booked job for the same customer.
4. **Audit:** no audit or activity event when the brief is viewed.
5. **Names:** no customer names (or phones/emails) in any label or title. Labels are record numbers (`J-…`, `INV-…`, booking reference) or a prefix plus 8 id characters (`INQ-`, `CALL-`, `CUST-`, `PLAN-`, `ACT-`, `CREW-`).
6. **Period:** calendar month containing `date`, compared with the previous calendar month. `last_30_days` dropped from v1 (not cheap to support cleanly alongside the month comparison; returns 400).
7. **Mobile:** uses the same endpoint (`today` + `needsYou`).
8. **Confidence:** not in v1. Items carry `kind: "fact" | "suggestion"` only.

## 10. Shipped v1 notes
- Response sends `Cache-Control: private, no-store`.
- Reads run in one `runTransactionWithTenantSession` transaction (RLS) with explicit `company_id` filters; aggregation is in memory. The tenant's job list is read once (needed for first-booked-job and rebooking history); revisit with SQL aggregation if p95 is slow.
- Booked job statuses: estimate_approved, scheduled, dispatched, in_progress, on_hold, completed, invoiced, paid, closed. Completed: completed, invoiced, paid, closed (with `actualEnd` in the period).
- Marketing revenue: invoices with status `paid` and `paidAt` in the period whose job has `maintenancePlanId`, is a repeat booking for the customer, or has `leadAttribution.utm_campaign`; summed in cents.
- Crew status: `exception` if any of the crew's jobs today is `on_hold`; `on_route` if any is dispatched/in_progress; `off` if none today; else `scheduled`.
- Needs you: `awaiting_approval` (suggestion), `failed` → execution_failed, `escalated`, and `succeeded` with receipt `deliveryState: "failed"` → delivery_failed (facts). `stale_version` deferred.
