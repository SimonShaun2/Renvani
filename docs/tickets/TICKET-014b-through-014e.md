> **Historical instruction snapshot — clarified 2026-11-05 UTC.** The original text below is retained for traceability, including retired brand/Figma references, agent assignments, schema snapshots and milestone claims. It is not the current build queue or design authority. Current work follows [AGENTS.md](../../AGENTS.md), [TEAM.md](../../TEAM.md), the FS board, and the [Renvani Figma parity contract](../design/RENVANI_FIGMA_PARITY.md). Use canonical Figma file `jiGHTNUJNltWbHA4Il3hk7` and `packages/db/src/schema.ts`; do not implement old copy, use stale `fsm-schema.ts`, or rename persisted keys from this historical text.

# TICKET-014b: Time Tracking + On-The-Way API

**Phase:** 2A
**Assigned:** Agent 1
**Dependencies:** TICKET-014a APPROVED (parallel)
**Figma:** ⏱ Time Tracking, 🚗 On The Way pages

## Objective
Implement time tracking (clock in/out) and on-the-way notifications.

## Routes

```
POST   /api/v1/jobs/:id/time/start         Clock in — creates time_entry
POST   /api/v1/jobs/:id/time/stop          Clock out — sets endedAt, computes duration
GET    /api/v1/jobs/:id/time               List time entries for job
PATCH  /api/v1/time/:entryId               Edit time entry (admin/owner only)
GET    /api/v1/technicians/:id/time        Time entries for tech (date range filter)

POST   /api/v1/jobs/:id/on-the-way         Send OTW notification to customer
GET    /api/v1/jobs/:id/on-the-way         Get OTW notification status for job
```

## Key Logic

**Clock in (start):**
- Checks tech doesn't already have an open entry for this job
- Creates time_entry with `startedAt = now`, `entryType` from body
- Sets job status to `in_progress` if currently `scheduled`
- Emits `job.time_started`

**Clock out (stop):**
- Finds open entry (endedAt IS NULL) for this job + tech
- Sets `endedAt = now`
- Computes `durationMinutes = ROUND((endedAt - startedAt) / 60)`
- Emits `job.time_stopped`

**OTW notification:**
- Creates `on_the_way_notifications` record
- Enqueues `send-otw-notification` on `fsm:notifications`:
  ```
  data: { companyId, jobId, customerId, technicianId, estimatedArrivalMinutes }
  ```
- The notifications worker sends SMS to customer via Twilio
- Emits `technician.on_the_way`
- Only one OTW per job (throws CONFLICT if already sent today)

## Activity Events
`job.time_started`, `job.time_stopped`, `technician.on_the_way`

## Tests
- Start/stop creates correct duration
- Cannot start twice without stopping
- OTW enqueues SMS job
- OTW idempotent (once per day per job)

## Notes
- Add `time-entry.types.ts` to `@fsm/types`
- Git commit: "TICKET-014b: Time Tracking + OTW API"

---

# TICKET-014c: Review Requests + File Attachments API

**Phase:** 2A
**Assigned:** Agent 1
**Dependencies:** TICKET-014b APPROVED (parallel)
**Figma:** ⭐ Review Requests, 📎 File Attachments pages

## Objective
Implement review request sending and unified file attachment uploads.

## Routes

**Review Requests:**
```
POST   /api/v1/jobs/:id/review-request     Send review request post-job
GET    /api/v1/review-requests             List for company (funnel stats)
PATCH  /api/v1/review-requests/:id         Update (mark completed)
GET    /api/v1/public/reviews/:token       Public review landing (no auth)
POST   /api/v1/public/reviews/:token/complete  Customer submits rating
```

**File Attachments:**
```
POST   /api/v1/attachments                 Upload file (multipart)
GET    /api/v1/attachments?entityType=&entityId=   List for entity
DELETE /api/v1/attachments/:id             Soft delete
```

## Key Logic

**Review request creation:**
- Called after `job.completed` (automation rule: `review_request`)
- Creates `review_requests` record
- Generates token (UUID stored as referenceId)
- Enqueues `send-review-request` on `fsm:notifications`
- SMS includes: `servicerev.app/review/{token}`
- Emits `review_request.sent`

**Public review landing:**
- No auth required — token-based
- Returns company name, tech name, review links
- POST /complete records rating + updates status

**File uploads:**
- Uses `@fastify/multipart` (already installed)
- Validates: max 50MB, allowed mime types
- Uploads to R2 via `packages/config/src/storage.ts`
- Creates `file_attachments` record with entityType + entityId
- If `photoType` is before/after: stored with label
- Returns `{ id, fileUrl, thumbnailUrl, fileName }`

**Thumbnail generation:**
- For image uploads (jpg/png/webp): generate 400px thumbnail
- Use `sharp` npm package
- Upload both original + thumbnail to R2

## Tests
Standard unit + integration coverage.

## Notes
- Add `sharp` to `apps/api/package.json`
- Add `review-request.types.ts`, `file-attachment.types.ts` to `@fsm/types`
- Git commit: "TICKET-014c: Review Requests + File Attachments API"

---

# TICKET-014d: Dispatch View Endpoints

**Phase:** 2A
**Assigned:** Agent 1
**Dependencies:** TICKET-014c APPROVED (parallel)
**Figma:** 🚀 Dispatch Board page

## Objective
The dispatch board needs view-specific endpoints that aggregate data
the frontend can't efficiently assemble from individual CRUD endpoints.

## Routes

```
GET    /api/v1/dispatch?date=YYYY-MM-DD    Full dispatch view for a day
GET    /api/v1/dispatch/workload?date=YYYY-MM-DD  Tech utilization per day
GET    /api/v1/jobs/unscheduled            Unscheduled jobs queue
GET    /api/v1/estimates/approved-unconverted  Approved estimates not yet converted
POST   /api/v1/dispatch/auto-fit           AI slot suggestion (stub — TICKET-020)
```

**`GET /dispatch?date=`:**
Returns everything needed for the Gantt board in one call:
```typescript
{
  date: string;
  technicians: Array<{
    id: string;
    name: string;
    avatarUrl: string | null;
    serviceAreaIds: string[];
    utilization: number;  // 0-100
    hoursAvailable: number;
    hoursScheduled: number;
    jobs: Array<{
      id: string;
      jobNumber: string;
      title: string;
      status: string;
      scheduledStart: string;
      scheduledEnd: string;
      customer: { id: string; firstName: string; lastName: string };
      property: { addressLine1: string; city: string };
      estimatedValue: string | null;
    }>;
    gaps: Array<{
      start: string;
      end: string;
      durationMinutes: number;
    }>;
  }>;
  nextBestJobs: Array<{
    jobId: string;
    jobNumber: string;
    customer: string;
    estimatedValue: string | null;
    urgencyScore: number;
    suggestedTechId: string | null;
    reasoningText: string;
  }>;
}
```

**`GET /dispatch/workload?date=`:**
Per-tech utilization numbers for the utilization bar in Dispatch Board.

**`GET /jobs/unscheduled`:**
Jobs with status `lead` or `unscheduled` — shown in Dispatch queue.

**`GET /estimates/approved-unconverted`:**
Estimates with status `approved` that have no linked job yet.

**`POST /dispatch/auto-fit`:**
V1 stub — returns `{ message: "Auto-fit coming in TICKET-020" }` with 501.

## Caching
The dispatch view query is expensive. Cache with Redis:
- Key: `dispatch:{companyId}:{date}`
- TTL: 60 seconds
- Invalidate on: job schedule change, job status change

## Tests
- Dispatch view returns correct structure
- Gaps computed correctly between jobs
- Utilization = scheduledMinutes / availableMinutes
- Redis cache hit returns cached value

## Notes
- These are read-only aggregation endpoints — no mutations
- Git commit: "TICKET-014d: Dispatch View Endpoints"

---

# TICKET-014e: Online Booking API + Public Routes

**Phase:** 2A
**Assigned:** Agent 1
**Dependencies:** TICKET-014d APPROVED
**Figma:** 📅 Online Booking — Public Page, Admin Settings, Dispatch Queue

## Objective
Implement the full online booking backend. Customers book via public URLs
that feed into the dispatch queue as booking requests.

## Routes

**Public (no auth):**
```
GET    /api/v1/public/booking/:slug                    Company + settings
POST   /api/v1/public/booking/:slug/check-zip          Verify zip + find techs
GET    /api/v1/public/booking/:slug/availability        Available slots for zip
POST   /api/v1/public/booking/:slug/submit             Submit booking request
GET    /api/v1/public/booking/:slug/confirmation/:ref  Booking confirmation page
```

**Authenticated (dispatcher/owner):**
```
GET    /api/v1/booking-requests                Get all requests for company
GET    /api/v1/booking-requests/:id            Single request detail
POST   /api/v1/booking-requests/:id/confirm    Confirm + create job
POST   /api/v1/booking-requests/:id/decline    Decline + notify customer
GET    /api/v1/booking-settings                Get company booking settings
PATCH  /api/v1/booking-settings                Update booking settings
PATCH  /api/v1/technicians/:id/service-areas   Update tech zip codes
```

## Key Logic

**POST /check-zip:**
```typescript
// Input: { zip: string }
// 1. Find technicians where serviceZipCodes @> ARRAY[zip]
// 2. If none + allowZipOverflow = false: return { covered: false }
// 3. If covered: return { covered: true, techCount: n }
```

**GET /availability:**
```typescript
// Input: ?zip=74133&date=2026-04-30
// 1. Get techs covering that zip
// 2. For each tech, get their schedule_slots for the week
// 3. Build available windows (morning 8-12, afternoon 12-5)
// 4. Exclude slots that already have jobs booked
// 5. Return available windows for next 14 days
```

**POST /submit:**
```typescript
// 1. Create booking_request record
// 2. Generate reference number: BK-YYYYMMDD-XXXX
// 3. Check if customer exists by phone/email — link if found
// 4. If autoConfirm = false: notify dispatcher via SMS + create activity event
// 5. If autoConfirm = true: create job + assign tech + send confirmation
// 6. Send confirmation SMS to customer
// 7. Emit booking.requested
```

**POST /confirm:**
```typescript
// Dispatcher confirms a pending request
// 1. Update booking_request.status = confirmed
// 2. Create customer if not exists
// 3. Create job with linked booking_request_id
// 4. Assign technician
// 5. Send confirmation SMS to customer
// 6. Emit booking.confirmed
```

## Booking Source Tracking
The `?src=` query param is stored on `booking_requests.source`.
Valid values: google, facebook, instagram, yelp, direct, website, qr_code.
Default: direct if no param.

## Tests
- Check-zip returns covered/uncovered correctly
- Availability excludes already-booked slots
- Submit creates booking_request with correct source
- Confirm creates job and customer, sends SMS
- Decline sends decline SMS to customer

## Notes
- Add `booking-request.types.ts`, `booking-settings.types.ts` to `@fsm/types`
- Migration already in schema — run `db:generate`
- The `/public/booking/*` routes have NO rate limiting exceptions — add
  rate limiting middleware: 10 submissions per IP per hour
- Git commit: "TICKET-014e: Online Booking API + Public Routes"
