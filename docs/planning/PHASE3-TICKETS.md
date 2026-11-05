# ServiceRev — Phase 3 Tickets

**Prerequisites:** Phase 2 complete (v2.0.0 · commit 96ee91c)
**Figma:** figma.com/design/LNTOsgJ7D4blaFaTepQt3J
**Repo:** SimonShaun2/Renvani (formerly FSM-Platform)

---

## Context Files — Every Session

```
1. AGENTS.md
2. CODEX.md
3. WORKFLOW.md
4. PHASE2-MASTER-PLAN.md
5. Ticket file (this document — paste relevant ticket)
6. fsm-schema.ts
7. Figma PNGs (Agent 2 only — listed per ticket)
```

---

# TICKET-033: AI Dispatch Intelligence

**Phase:** 3
**Assigned:** Agent 1 (Backend) + Agent 2 (Frontend)
**Auditor:** Agent 4
**Priority:** P0 — Core product differentiator. Stub replaced with real engine.
**Dependencies:** 60 days of production data recommended. Can build now, improves with data.

---

## Agent Prompts

### Agent 1 — Read This First
You are Agent 1 building the real AI Dispatch Intelligence engine.
The auto-fit stub at `POST /api/v1/dispatch/auto-fit` currently returns
501. Replace it with a real scoring engine that ranks available technicians
and time slots for a given job. No external AI API calls — this is
deterministic scoring logic. Follow AGENTS.md, CODEX.md, WORKFLOW.md.
Tests required. Commit and push. Output TASK COMPLETE when done.

### Agent 2 — Read This First
Wire the auto-fit response into the dispatch board UI. The "Auto-Fit"
button on the Next Best Jobs queue currently calls the stub. Make it
display the suggestion overlay with tech + slot + reasoning, and allow
one-click acceptance. Follow AGENTS.md, CODEX.md, WORKFLOW.md.
Output TASK COMPLETE when done.

---

## Figma Reference (Agent 2)

**Export from figma.com/design/LNTOsgJ7D4blaFaTepQt3J:**
- 🚀 Dispatch Board — Auto-Fit suggestion overlay state

---

## Objective

Replace the dispatch auto-fit stub with a real scoring engine that:
1. Scores all available technicians against the job requirements
2. Finds the best open slot in their schedule for that day
3. Returns a ranked suggestion with reasoning text
4. Frontend shows the suggestion with one-click confirm

---

## Acceptance Criteria

### Agent 1
- [ ] `POST /api/v1/dispatch/auto-fit` returns real suggestions
- [ ] Scoring factors: zip code match, skills match, utilization (prefer
      less-loaded techs), travel distance proxy (zip proximity), time gap fit
- [ ] Returns top 3 suggestions ranked by score
- [ ] Each suggestion: technicianId, technicianName, scheduledStart,
      scheduledEnd, score (0–100), reasoningText
- [ ] Reasoning text is plain English: "Maria covers this zip, has 2h gap
      at 2pm, and is at 60% utilization today"
- [ ] Falls back gracefully if no techs available: returns empty array
      with `message` explaining why
- [ ] Unit tests for scoring logic
- [ ] Integration test for the endpoint

### Agent 2
- [ ] Auto-Fit button shows loading state while API call in flight
- [ ] Suggestion overlay appears over the Gantt grid
- [ ] Overlay shows: tech avatar + name, suggested time slot, score
      bar (visual), reasoning text
- [ ] "Accept" button → calls `PATCH /api/v1/jobs/:id` to schedule
- [ ] "Decline" closes overlay, no changes made
- [ ] "See other options" → cycles through top 3 suggestions
- [ ] Accepted suggestion animates job block onto the Gantt grid

---

## Agent 1 Owns

### Scoring engine
**File:** `apps/api/src/services/dispatch-intelligence.service.ts`

```typescript
interface AutoFitInput {
  companyId: string;
  jobId: string;
  date: string; // YYYY-MM-DD
}

interface AutoFitSuggestion {
  technicianId: string;
  technicianName: string;
  scheduledStart: string; // ISO
  scheduledEnd: string;   // ISO
  score: number;          // 0–100
  scoreBreakdown: {
    zipMatch: number;       // 0 or 25
    skillsMatch: number;    // 0–25
    utilizationScore: number; // 0–25 (lower util = higher score)
    gapFitScore: number;    // 0–25 (slot duration fits job duration)
  };
  reasoningText: string;
}

async function getAutoFitSuggestions(input: AutoFitInput): Promise<AutoFitSuggestion[]>
```

**Scoring logic:**

```typescript
// 1. Get job: required service type, estimated duration, zip code
// 2. Get all active techs for company
// 3. For each tech:
//    a. zipMatch: serviceZipCodes includes job zip → +25 points
//    b. skillsMatch: tech skills overlap with job service type → +0–25
//    c. utilizationScore: (1 - scheduledMinutes/availableMinutes) * 25
//    d. gapFitScore: find gaps in schedule that fit job duration → +0–25
//       (exact fit = 25, gap ≥ 2x job duration = 10, no fit = 0)
// 4. Sort by total score descending
// 5. Return top 3 with best open slot per tech
```

### Route update
**File:** `apps/api/src/routes/dispatch/index.ts`

Remove 501 stub. Call `dispatchIntelligenceService.getAutoFitSuggestions`.

### Tests
- Score 0 when zip doesn't match and no skills match
- Score > 75 for tech with zip match + low utilization + exact gap fit
- Returns empty array when no techs available
- Integration: endpoint returns 200 with suggestions array

---

## Agent 2 Owns

### Auto-Fit suggestion overlay
**File:** `apps/web/src/components/dispatch/AutoFitOverlay.tsx`

```typescript
interface AutoFitOverlayProps {
  jobId: string;
  suggestions: AutoFitSuggestion[];
  onAccept: (suggestion: AutoFitSuggestion) => void;
  onDecline: () => void;
  isLoading: boolean;
}
```

Renders as a modal overlay centered on the Gantt grid.
Loading state: spinner + "Finding best match…"
Suggestion display: tech name + avatar initials, slot time,
score bar (0–100 filled blue), reasoning text (italic).
Prev/Next buttons if multiple suggestions.
Accept → green button → calls scheduleJob mutation.
Decline → close overlay.

### Hook update
**File:** `apps/web/src/hooks/dispatch.hooks.ts`

```typescript
export function useAutoFit(jobId: string) {
  return useMutation({
    mutationFn: (date: string) =>
      api.post<AutoFitSuggestion[]>('/api/v1/dispatch/auto-fit', { jobId, date }),
  });
}
```

---

## Agent 4 Audit Checklist

- [ ] `pnpm build` passes clean
- [ ] No `any` types
- [ ] Scoring factors sum to max 100
- [ ] Zip match checked against `technicians.serviceZipCodes` array
- [ ] Reasoning text is plain English (no JSON or codes)
- [ ] Empty array returned (not error) when no techs available
- [ ] Overlay shows loading state correctly
- [ ] Accept calls correct PATCH endpoint
- [ ] Job block animates onto grid after accept
- [ ] Unit tests for all 4 scoring factors

---

## Notes
- Git commit: "TICKET-033: AI Dispatch Intelligence"

---

# TICKET-034: Advanced Reporting

**Phase:** 3
**Assigned:** Agent 2
**Auditor:** Agent 4
**Priority:** P1
**Dependencies:** TICKET-033 APPROVED

---

## Agent Prompts

### Agent 2
Extend the reporting dashboard with advanced views: revenue forecasting,
per-technician performance deep dive, and booking source attribution.
These are new tabs added to the existing `/reporting` page.
Read the Figma design attached. Follow all rules. Commit and push.
Output TASK COMPLETE when done.

---

## Figma Reference

**Export from figma.com/design/LNTOsgJ7D4blaFaTepQt3J:**
- 📊 Basic Reporting — existing page (for reference)

No new Figma screens for this ticket — extend the existing reporting
design with new tabs following the established visual language.

---

## Acceptance Criteria

- [ ] New tab: "Revenue Forecast" — 90-day projection line chart
- [ ] New tab: "Tech Performance" — per-tech deep dive table
- [ ] New tab: "Booking Sources" — Google/Facebook/Instagram attribution
- [ ] Existing "Overview" tab unchanged
- [ ] All tabs respect the period selector
- [ ] Export to CSV works for all tabs

---

## Agent 2 Owns

### Revenue Forecast tab
**File:** `apps/web/src/components/reporting/RevenueForecastTab.tsx`

90-day line chart using Recharts LineChart.
Two lines: Actual (solid blue) + Projected (dashed blue).
Projection = trailing 30-day average extended forward.
Confidence band: shaded area ±15% around projection.
Key milestones: current MRR × 12 annualized run rate label.

API: `GET /api/v1/reporting/revenue?period=90d&includeProjection=true`
If endpoint doesn't exist yet — use existing jobs/invoices endpoints
and compute projection client-side.

### Tech Performance tab
**File:** `apps/web/src/components/reporting/TechPerformanceTab.tsx`

Table columns: Tech | Jobs | Revenue | Avg Ticket | Utilization % |
Estimate Conversion % | Avg Rating | Reviews.
Sortable on all columns.
Click row → expands inline detail: daily job count chart for the period,
top 3 job types, top 3 customers.

### Booking Sources tab
**File:** `apps/web/src/components/reporting/BookingSourcesTab.tsx`

Pie chart: bookings by source (Google/Facebook/Instagram/Direct/Yelp).
Table: Source | Bookings | Confirmation Rate | Revenue | Avg Ticket.
Trend vs prior period per source.

API: `GET /api/v1/booking-requests/stats?days=30`

### CSV export
Extend existing export to support all tabs.
Tab-specific export includes the full data for that tab.

---

## Agent 4 Audit Checklist

- [ ] `pnpm build` passes clean
- [ ] No `any` types
- [ ] Forecast projection doesn't crash with < 7 days of data
- [ ] Tech table sorts correctly on all columns
- [ ] Tech detail expansion loads without extra page navigation
- [ ] Booking sources tab handles 0 bookings gracefully
- [ ] CSV export includes correct data for each tab
- [ ] Period selector affects all new tabs

---

## Notes
- Git commit: "TICKET-034: Advanced Reporting"

---

# TICKET-035: Agency Multi-Tenant

**Phase:** 3
**Assigned:** Agent 1 (Backend) + Agent 2 (Frontend)
**Auditor:** Agent 4
**Priority:** P1 — Unlocks agency distribution channel.
**Dependencies:** TICKET-034 APPROVED

---

## Agent Prompts

### Agent 1
Build the agency multi-tenant layer. An agency account can manage
multiple company accounts from a single login. Agencies see a company
switcher and can access any of their client companies without separate
logins. Follow AGENTS.md, CODEX.md, WORKFLOW.md. Tests required.
Output TASK COMPLETE when done.

### Agent 2
Build the agency dashboard and company switcher UI.
Output TASK COMPLETE when done.

---

## Figma Reference (Agent 2)

No Figma designs exist for this feature yet — build following the
established ServiceRev design language (tokens, components, patterns
from TICKET-014).

---

## Acceptance Criteria

### Agent 1
- [ ] New `agency_memberships` table: agencyUserId, companyId, role
- [ ] `GET /api/v1/agency/companies` — list companies the agency manages
- [ ] `POST /api/v1/agency/switch/:companyId` — get a scoped JWT for
      that company (same auth flow, different companyId in token)
- [ ] `GET /api/v1/agency/dashboard` — aggregate stats across all
      managed companies
- [ ] Agency users see all companies in switcher
- [ ] Switching company updates companyId in JWT without re-login
- [ ] Existing per-company auth unchanged for non-agency users

### Agent 2
- [ ] Company switcher in sidebar header (dropdown)
- [ ] Agency dashboard at `/agency` — cards per managed company
- [ ] Each card: company name, active jobs, open invoices, MRR,
      last activity, "Open →" link
- [ ] "Open →" switches to that company context
- [ ] Breadcrumb shows current company name when switched
- [ ] "← All Companies" link in sidebar when viewing a client company

---

## Agent 1 Owns

### Schema addition
Add to `fsm-schema.ts`:

```typescript
export const agencyMemberships = pgTable('agency_memberships', {
  id: id(),
  agencyUserId: uuid('agency_user_id').notNull().references(() => users.id),
  companyId: companyId(),
  role: varchar('role', { length: 30 }).default('manager'),
  ...timestamps,
}, (t) => ({
  agencyUserIdx: index('agency_memberships_user_idx').on(t.agencyUserId),
  companyIdx: index('agency_memberships_company_idx').on(t.companyId),
  uniqueMembership: unique().on(t.agencyUserId, t.companyId),
}));
```

### Agency service
`apps/api/src/services/agency.service.ts`

```typescript
listManagedCompanies(agencyUserId: string): Promise<Company[]>
switchCompany(agencyUserId: string, companyId: string): Promise<{ token: string }>
getAgencyDashboard(agencyUserId: string): Promise<AgencyDashboard>
```

`switchCompany`: validates membership exists, issues new JWT with
`companyId` claim set to the target company, `agencyUserId` claim
preserved for audit trail.

### Routes
```
GET  /api/v1/agency/companies
POST /api/v1/agency/switch/:companyId
GET  /api/v1/agency/dashboard
```

### Tests
- Can only switch to companies in membership list
- Switched JWT has correct companyId
- Dashboard aggregates correctly across companies
- Non-agency user cannot access /agency routes

---

## Agent 2 Owns

### Company switcher
`apps/web/src/components/layout/CompanySwitcher.tsx`

Rendered in Sidebar above nav items when user has agency access.
Shows current company name + chevron.
Dropdown: list of managed companies + "All Companies" link.
Click company → calls `POST /api/v1/agency/switch/:companyId` →
updates auth store token → refreshes current page data.

### Agency dashboard
`apps/web/src/app/(app)/agency/page.tsx`

Grid of company cards. Each: company name (bold), city/state,
4 metrics (active jobs / open invoices / MRR / last activity),
"Open Company →" button.

### Auth store update
`apps/web/src/stores/auth.store.ts`

Add `switchCompany(companyId: string)` action:
1. Call switch endpoint
2. Replace token in store
3. Invalidate all React Query cache
4. Navigate to /dashboard

---

## Agent 4 Audit Checklist

- [ ] `pnpm build` passes clean
- [ ] No `any` types
- [ ] Migration generated for `agency_memberships`
- [ ] Non-agency users don't see company switcher
- [ ] Switch validates membership before issuing token
- [ ] All React Query cache invalidated on company switch
- [ ] "← All Companies" link only shows when in switched context
- [ ] Agency routes return 403 for non-agency users

---

## Notes
- Git commit: "TICKET-035: Agency Multi-Tenant"

---

# TICKET-036: Marketing Landing Page

**Phase:** 3
**Assigned:** Agent 2
**Auditor:** Agent 4
**Priority:** P1 — Public-facing. SEO and conversion matter.
**Dependencies:** TICKET-035 APPROVED

---

## Agent Prompts

### Agent 2
Build the ServiceRev marketing landing page as a Next.js page at the
root `/` route. The design is in a separate Figma file — export the
full landing page design as PNGs and attach to this session.
This is a public-facing marketing page. No auth required.
Follow all rules. Commit and push. Output TASK COMPLETE when done.

---

## Figma Reference

**Canonical file (product + marketing):** [FSM Agent – Product Design](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-%E2%80%93-Product-Design) — **Marketing site** section. (Retired: `tAteqeUfdi4GCtZVeaF4DJ`.)
- 🏠 Landing Page — Desktop (full page)

Export all sections as individual PNGs:
- Nav
- Hero (with AI widget)
- Problem Section
- Solution Section
- Workflow Strip
- Features Grid
- Onboarding Section
- Final CTA + Footer

---

## Acceptance Criteria

- [ ] `/` route renders the marketing landing page
- [ ] Authenticated users redirected to `/dashboard` from `/`
- [ ] Nav: logo, links, Sign In, Get Started (links to /login and /signup)
- [ ] Hero: headline, sub, dual CTAs, social proof stats, AI widget
- [ ] AI widget: animated 3-state sequence (processing → reveal → actions)
- [ ] Problem section: 6 problem cards
- [ ] Solution section: 3 feature columns
- [ ] Workflow strip: dark bg, 9-step connected flow
- [ ] Features grid: 16 feature tiles
- [ ] Onboarding section: copy + CSV import mockup
- [ ] Final CTA: "Get Started" + "Book a Demo"
- [ ] Footer: links, copyright
- [ ] Fully responsive: mobile (390px), tablet (768px), desktop (1440px)
- [ ] Page title + meta description for SEO
- [ ] Core Web Vitals: LCP < 2.5s (no heavy images — CSS only)

---

## Agent 2 Owns

### Route
`apps/web/src/app/(public)/page.tsx` or `apps/web/src/app/page.tsx`

Check: if user is authenticated, redirect to /dashboard.
Otherwise render landing page.

### Landing page component
`apps/web/src/components/landing/LandingPage.tsx`

Sub-components:
```
LandingNav.tsx          — sticky top nav
HeroSection.tsx         — hero + AI widget
AIWidget.tsx            — animated 3-state widget
ProblemSection.tsx      — 6 problem cards
SolutionSection.tsx     — 3 columns
WorkflowStrip.tsx       — dark bg, connected flow
FeaturesGrid.tsx        — 16 tiles
OnboardingSection.tsx   — copy + mockup
FinalCTA.tsx            — dark bg CTA section
LandingFooter.tsx       — footer
```

### AI Widget animation
`apps/web/src/components/landing/AIWidget.tsx`

Three states managed with useState + useEffect timer:
1. `processing` (0–2.5s): checklist items appear one by one
2. `reveal` (2.5s–5s): revenue opportunity rows fade in
3. `actions` (5s+): action buttons appear, loops back to processing after 8s

Use CSS transitions (opacity + translateY) — no heavy animation library.
Auto-loops: processing → reveal → actions → processing.

```typescript
const STATES = ['processing', 'reveal', 'actions'] as const;
// Transition timings: 2500ms, 2500ms, 3000ms
```

### SEO
`apps/web/src/app/layout.tsx` or page-level metadata:

```typescript
export const metadata = {
  title: 'ServiceRev — AI-Powered Field Service Management',
  description: 'Find the revenue your service business is missing. Dispatch, jobs, estimates, invoices, and AI revenue intelligence for HVAC, plumbing, and electrical shops.',
  openGraph: {
    title: 'ServiceRev — Find the revenue you\'re missing',
    description: '...',
    type: 'website',
  },
};
```

### Responsive breakpoints
- Mobile (< 768px): single column, stacked sections
- Tablet (768–1199px): 2-column grids where applicable
- Desktop (≥ 1200px): full layout per Figma

---

## Agent 4 Audit Checklist

- [ ] `pnpm build` passes clean
- [ ] No `any` types
- [ ] Authenticated users redirected to /dashboard
- [ ] AI widget cycles through all 3 states and loops
- [ ] No layout shift on widget state transitions
- [ ] All CTAs link to correct routes (/login, /signup)
- [ ] Mobile layout: no horizontal scroll at 390px
- [ ] Tablet layout: readable at 768px
- [ ] Page metadata present (title + description)
- [ ] No images — all visuals are CSS/SVG
- [ ] `pnpm build` output: landing page is statically rendered (SSG)

---

## Notes
- Git commit: "TICKET-036: Marketing Landing Page"

---

# TICKET-037: Mobile Push Notifications

**Phase:** 3
**Assigned:** Agent 1 (Backend) + Agent 2 (Frontend)
**Auditor:** Agent 4
**Priority:** P1 — Technicians need real-time alerts on their phone.
**Dependencies:** TICKET-036 APPROVED

---

## Agent Prompts

### Agent 1
Implement push notification delivery for technicians.
Use web push (VAPID) — works on iOS Safari 16.4+ and all Android browsers
via PWA. No native app required. Follow all rules. Tests required.
Output TASK COMPLETE when done.

### Agent 2
Implement PWA manifest + service worker for push notification support,
and the notification permission request flow in the tech mobile app.
Output TASK COMPLETE when done.

---

## Figma Reference (Agent 2)

No new Figma screens — notification permission prompt follows standard
iOS/Android system UI. Show a simple in-app prompt before the browser
prompt per best practice.

---

## Acceptance Criteria

### Agent 1
- [ ] VAPID keys generated and stored in env config
- [ ] `push_subscriptions` table: userId, endpoint, keys (p256dh, auth)
- [ ] `POST /api/v1/push/subscribe` — save subscription
- [ ] `DELETE /api/v1/push/subscribe` — remove subscription
- [ ] Push notification sent on these events:
  - `job.assigned` → "New job assigned: [Customer] at [Time]"
  - `technician.on_the_way` → (to customer — future, stub for now)
  - `booking.confirmed` → "Booking confirmed: [Customer] on [Date]"
  - `invoice.paid` → "Payment received: $[Amount] from [Customer]"
- [ ] Push worker processor: `send-push-notification` on `fsm:notifications`
- [ ] Graceful failure: expired/invalid subscriptions auto-removed
- [ ] Unit tests for notification payload formatting
- [ ] Integration test for subscribe/unsubscribe

### Agent 2
- [ ] PWA manifest at `/manifest.json`
- [ ] Service worker registered on /mobile/* routes
- [ ] In-app permission prompt (before browser prompt):
      "Get notified when jobs are assigned to you"
      Enable / Not Now
- [ ] On "Enable": request browser permission → if granted, subscribe via API
- [ ] Notification permission status shown in tech profile settings
- [ ] "Disable notifications" option in profile → calls unsubscribe API

---

## Agent 1 Owns

### Schema addition
```typescript
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id),
  companyId: companyId(),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userAgent: text('user_agent'),
  ...timestamps,
}, (t) => ({
  userIdx: index('push_subscriptions_user_idx').on(t.userId),
  endpointIdx: uniqueIndex('push_subscriptions_endpoint_idx').on(t.endpoint),
}));
```

### Push service
`apps/api/src/services/push.service.ts`

Use `web-push` npm package.
```typescript
saveSubscription(userId: string, companyId: string, subscription: PushSubscription): Promise<void>
removeSubscription(endpoint: string): Promise<void>
sendNotification(userId: string, payload: PushPayload): Promise<void>
```

`sendNotification`: finds all subscriptions for user, sends via web-push,
removes any that return 410 (Gone — subscription expired).

### Worker processor
`apps/worker/src/processors/push-notification.processor.ts`

Listens on `send-push-notification` queue.
Formats payload by notification type:
```typescript
const NOTIFICATION_TEMPLATES = {
  'job.assigned': (data) => ({
    title: 'New Job Assigned',
    body: `${data.customerName} at ${data.scheduledTime}`,
    url: `/mobile/jobs/${data.jobId}`,
  }),
  'booking.confirmed': (data) => ({
    title: 'Booking Confirmed',
    body: `${data.customerName} on ${data.preferredDate}`,
    url: `/dispatch?date=${data.preferredDate}`,
  }),
  'invoice.paid': (data) => ({
    title: 'Payment Received',
    body: `$${data.amount} from ${data.customerName}`,
    url: `/invoices/${data.invoiceId}`,
  }),
};
```

### Emit push events
Add `enqueue send-push-notification` calls to:
- `job.service.ts` on `assignedTechnicianId` set
- `booking.service.ts` on booking confirmed
- `invoice.service.ts` on payment recorded

---

## Agent 2 Owns

### PWA manifest
`apps/web/public/manifest.json`

```json
{
  "name": "ServiceRev",
  "short_name": "ServiceRev",
  "start_url": "/mobile/jobs",
  "display": "standalone",
  "background_color": "#131521",
  "theme_color": "#257AFA",
  "icons": [...]
}
```

### Service worker
`apps/web/public/sw.js`

Handles `push` event: shows notification with title/body from payload.
Handles `notificationclick`: opens the `url` from payload data.

```javascript
self.addEventListener('push', (event) => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      data: { url: data.url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```

### Permission prompt component
`apps/web/src/components/mobile/PushPermissionPrompt.tsx`

Shown once after first login on mobile, if permission not yet requested.
Soft prompt card at bottom of screen (above nav).
"Enable" → `Notification.requestPermission()` → if granted:
- Get VAPID public key from env
- `navigator.serviceWorker.ready` → `pushManager.subscribe`
- POST subscription to `/api/v1/push/subscribe`

### Hook
`apps/web/src/hooks/push.hooks.ts`

```typescript
export function usePushSubscription()
export function useSubscribePush()
export function useUnsubscribePush()
```

---

## Agent 4 Audit Checklist

- [ ] `pnpm build` passes clean
- [ ] No `any` types
- [ ] VAPID keys in env config, not hardcoded
- [ ] Migration generated for `push_subscriptions`
- [ ] 410 responses auto-remove subscription
- [ ] Service worker registered only on /mobile/* routes
- [ ] Permission prompt only shown once (persisted in localStorage)
- [ ] Unsubscribe correctly removes from DB and browser
- [ ] Notification click opens correct URL
- [ ] Push events emitted in job/booking/invoice services

---

## Notes
- Add `web-push` to `apps/api/package.json`
- VAPID keys: `npx web-push generate-vapid-keys`
- Store in `@fsm/config` as `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`
- Git commit: "TICKET-037: Mobile Push Notifications"

---

# TICKET-038: Customer Portal

**Phase:** 3
**Assigned:** Agent 1 (Backend) + Agent 2 (Frontend)
**Auditor:** Agent 4
**Priority:** P1 — Reduces inbound support calls. Customers self-serve.
**Dependencies:** TICKET-037 APPROVED

---

## Agent Prompts

### Agent 1
Build the customer portal backend. Customers get a magic-link login
(no password) to view their own invoices, service history, agreements,
and assets. Token-based auth separate from the main app JWT.
Follow all rules. Tests required. Output TASK COMPLETE when done.

### Agent 2
Build the customer-facing portal UI at `/portal/*`.
Clean, simple, mobile-first. Branded with the company logo.
No dispatch or AI features — customers only see their own data.
Output TASK COMPLETE when done.

---

## Figma Reference (Agent 2)

No Figma designs exist for this feature yet — build following the
ServiceRev design language but simplified for customer context.
Reference the public booking page (`📅 Online Booking — Public Page`)
for the tone and white-label branding pattern.

---

## Acceptance Criteria

### Agent 1
- [ ] `customer_portal_sessions` table: customerId, token, expiresAt
- [ ] `POST /api/v1/public/portal/request-access` — send magic link
      to customer email/SMS
- [ ] `GET /api/v1/public/portal/verify/:token` — verify + return
      portal JWT (24h expiry)
- [ ] Portal JWT contains: customerId, companyId, scope: "customer_portal"
- [ ] `GET /api/v1/portal/me` — customer profile (name, phone, email)
- [ ] `GET /api/v1/portal/invoices` — customer's invoices
- [ ] `GET /api/v1/portal/jobs` — customer's job history
- [ ] `GET /api/v1/portal/agreements` — customer's service agreements
- [ ] `GET /api/v1/portal/assets` — customer's assets
- [ ] All portal routes validate scope: "customer_portal" in JWT
- [ ] Company logo + name fetched via companyId (no auth required)
- [ ] Magic link expires after 15 minutes, portal session after 24h

### Agent 2
- [ ] `/portal/login` — magic link request form (email or phone)
- [ ] `/portal/verify/:token` — verify landing page
- [ ] `/portal` — customer home (recent invoices, upcoming jobs)
- [ ] `/portal/invoices` — invoice list with pay button
- [ ] `/portal/invoices/:id` — invoice detail
- [ ] `/portal/jobs` — job history
- [ ] `/portal/agreements` — active service plans
- [ ] `/portal/assets` — registered assets
- [ ] Company branding in header (logo + name, from companyId)
- [ ] Fully mobile-first (390px primary)
- [ ] "Pay Invoice" → Stripe payment link redirect

---

## Agent 1 Owns

### Schema addition
```typescript
export const customerPortalSessions = pgTable('customer_portal_sessions', {
  id: id(),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  companyId: companyId(),
  token: varchar('token', { length: 128 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  ...timestamps,
}, (t) => ({
  tokenIdx: uniqueIndex('portal_sessions_token_idx').on(t.token),
  customerIdx: index('portal_sessions_customer_idx').on(t.customerId),
}));
```

### Portal auth service
`apps/api/src/services/customer-portal.service.ts`

```typescript
requestAccess(companyId: string, emailOrPhone: string): Promise<void>
// Finds customer by email or phone, generates token, sends SMS/email
// with magic link: servicerev.app/portal/verify/:token

verifyToken(token: string): Promise<{ portalJwt: string }>
// Validates token not expired, not used, marks usedAt
// Issues portal JWT: { customerId, companyId, scope: 'customer_portal', exp: +24h }
```

### Portal middleware
`apps/api/src/middleware/portal-auth.ts`

Validates portal JWT (same secret, different scope check).
Attaches `req.customerId` and `req.companyId` to request.
Rejects tokens without `scope: 'customer_portal'`.

### Portal routes
```
POST /api/v1/public/portal/request-access
GET  /api/v1/public/portal/verify/:token

GET  /api/v1/portal/me
GET  /api/v1/portal/invoices
GET  /api/v1/portal/jobs
GET  /api/v1/portal/agreements
GET  /api/v1/portal/assets
```

All `/portal/*` routes (non-public) use `portalAuthMiddleware`.
Responses filtered to only include data belonging to `req.customerId`.

### Tests
- Magic link expires after 15 minutes
- Token can only be used once
- Portal JWT rejected on main app routes
- Main app JWT rejected on portal routes
- Customer can only see their own data

---

## Agent 2 Owns

### Portal layout
`apps/web/src/app/(portal)/layout.tsx`

Clean white layout. No sidebar, no bottom nav.
Header: company logo + company name (fetched from companyId in portal JWT).
Footer: "Powered by ServiceRev" (subtle).

### Portal auth store
`apps/web/src/stores/portal-auth.store.ts`

```typescript
interface PortalAuthStore {
  portalToken: string | null;
  customerId: string | null;
  companyId: string | null;
  setPortalAuth: (token: string) => void;
  clearPortalAuth: () => void;
}
```

### Pages

**`/portal/login`:**
`apps/web/src/app/(portal)/portal/login/page.tsx`
Input: email or phone number.
"Send me a link" button.
Success state: "Check your messages — we sent you a link."

**`/portal/verify/[token]`:**
Calls `GET /api/v1/public/portal/verify/:token`.
On success: stores portal JWT → redirects to /portal.
On failure: "This link has expired. Request a new one."

**`/portal`:**
Customer home. Greeting: "Hi [firstName]".
2 cards: Open Invoices (with total owed) + Upcoming Jobs.
Quick links: All Invoices / Job History / My Plans.

**`/portal/invoices`:**
List: invoice # | date | total | status | action.
Status: Paid (green) / Unpaid (orange) / Overdue (red).
"Pay Now" → redirect to Stripe link.

**`/portal/invoices/[id]`:**
Invoice detail. Line items. Total. Status.
"Pay Now" button if unpaid.

**`/portal/jobs`:**
Job history list: date | type | tech | status.
Read-only. No actions.

**`/portal/agreements`:**
Active service plans: plan name | renewal date | coverage.
"View Details" per plan.

**`/portal/assets`:**
Asset list: make/model | install date | condition badge.
Last service date.

### Portal API client
`apps/web/src/lib/portal-api.ts`

Separate from main `api.ts`. Uses portal JWT from portal auth store.
Base path: `/api/v1/portal/`.

---

## Agent 4 Audit Checklist

- [ ] `pnpm build` passes clean
- [ ] No `any` types
- [ ] Migration generated for `customer_portal_sessions`
- [ ] Magic link token 128-char random, not UUID
- [ ] Token single-use (usedAt set on verify)
- [ ] Portal JWT rejected on non-portal routes
- [ ] Main JWT rejected on portal routes
- [ ] Customer can only see their own invoices/jobs/assets
- [ ] Pay Now redirects to Stripe payment link URL
- [ ] Portal layout shows company branding (not ServiceRev branding)
- [ ] Mobile-first: all portal pages work at 390px
- [ ] Login page handles "no customer found" gracefully
- [ ] Expired link shows helpful message with re-request option

---

## Notes
- Magic link URL format: `{APP_URL}/portal/verify/{token}`
- Send via existing SMS/email workers (Twilio + SendGrid)
- Portal is white-labeled — customers see their HVAC company branding
- Git commit: "TICKET-038: Customer Portal"
