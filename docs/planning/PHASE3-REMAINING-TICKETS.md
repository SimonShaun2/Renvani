# ServiceRev — Phase 3 Remaining Tickets (035–038)

**Prerequisites:** Phase 2 complete (v2.0.0) · TICKET-033 approved · TICKET-034 approved
**Repo:** SimonShaun2/Renvani (formerly FSM-Platform)

---

## Context Files — Every Session

```
1. AGENTS.md
2. CODEX.md
3. WORKFLOW.md
4. PHASE2-MASTER-PLAN.md
5. This file (paste relevant ticket section)
6. fsm-schema.ts
7. Figma PNGs (listed per ticket)
```

---

# TICKET-035: Agency Multi-Tenant

**Phase:** 3
**Agent 1:** Backend — agency auth + API
**Agent 2:** Frontend — company switcher + agency dashboard
**Auditor:** Agent 4
**Priority:** P1
**Dependencies:** TICKET-034 APPROVED
**Run:** Agent 1 and Agent 2 in parallel

---

## Agent 1 Prompt
You are Agent 1. Build the agency multi-tenant backend. An agency user
can manage multiple company accounts from one login. They switch between
companies without re-authenticating. A new `agency_memberships` table
tracks which companies each agency user manages. Switching issues a new
scoped JWT with the target company's ID. Follow AGENTS.md, CODEX.md,
WORKFLOW.md. Tests required. No commit — output TASK COMPLETE when done.

## Agent 2 Prompt
You are Agent 2. Build the agency dashboard UI and company switcher.
No Figma designs exist — follow the existing ServiceRev design language
(tokens and patterns from TICKET-014). Follow AGENTS.md, CODEX.md,
WORKFLOW.md. No commit — output TASK COMPLETE when done.

---

## Figma Reference
None. Use existing design system tokens and component patterns.

---

## Acceptance Criteria

### Agent 1
- [ ] `agency_memberships` table migrated
- [ ] `POST /api/v1/agency/switch/:companyId` — validates membership,
      issues new JWT with target companyId, preserves agencyUserId for audit
- [ ] `GET /api/v1/agency/companies` — list all companies the agency manages
- [ ] `GET /api/v1/agency/dashboard` — aggregate stats across all companies:
      per-company active jobs, open invoices, MRR, last activity
- [ ] Agency routes return 403 for non-agency users
- [ ] Switch endpoint returns 403 if companyId not in membership list
- [ ] Unit tests: switch validates membership, wrong company returns 403,
      dashboard aggregates correctly
- [ ] Integration tests for all 3 routes
- [ ] `pnpm build` + `pnpm test` clean

### Agent 2
- [ ] Company switcher dropdown in Sidebar (shows when user has agency access)
- [ ] Displays current company name + chevron
- [ ] Dropdown lists all managed companies + "All Companies" link
- [ ] Selecting company calls `POST /api/v1/agency/switch/:companyId`,
      updates auth store token, invalidates all React Query cache
- [ ] Agency dashboard at `/agency` — grid of company cards
- [ ] Each card: company name, city/state, 4 metrics (active jobs /
      open invoices / MRR / last activity), "Open Company →" button
- [ ] Breadcrumb shows current company name when switched into a client
- [ ] "← All Companies" link in sidebar when viewing a client company
- [ ] Switcher hidden for non-agency users
- [ ] `pnpm build` clean

---

## Agent 1 Owns

### Schema addition
Add to `packages/db/src/schema.ts`:

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

Run `pnpm --filter @fsm/db db:generate` to produce the migration.

### Agency service
`apps/api/src/services/agency.service.ts`

```typescript
listManagedCompanies(agencyUserId: string): Promise<Company[]>
// Query agency_memberships WHERE agencyUserId = :id, JOIN companies

switchCompany(agencyUserId: string, targetCompanyId: string): Promise<{ token: string }>
// 1. Verify membership exists — throw 403 if not
// 2. Issue new JWT: { userId, companyId: targetCompanyId, agencyUserId, role }
// 3. Return { token }

getAgencyDashboard(agencyUserId: string): Promise<AgencyDashboard>
// For each managed company aggregate:
// activeJobs: count jobs WHERE status IN ('scheduled','in_progress')
// openInvoices: count invoices WHERE status = 'sent'
// mrr: sum service_agreements.amount WHERE status = 'active'
// lastActivity: max activity_events.createdAt
```

### Routes
`apps/api/src/routes/agency/index.ts`

```
GET  /api/v1/agency/companies        requireRole(['owner','admin','agency'])
POST /api/v1/agency/switch/:companyId requireRole(['agency'])
GET  /api/v1/agency/dashboard        requireRole(['agency'])
```

Add `agency` to the role enum in `@fsm/types` if not already present.

### Tests
`apps/api/src/routes/agency/agency.test.ts`
- Switch with valid membership returns new token with correct companyId
- Switch with invalid membership returns 403
- Dashboard returns correct structure
- Non-agency user gets 403 on all agency routes

---

## Agent 2 Owns

### Auth store update
`apps/web/src/stores/auth.store.ts`

Add:
```typescript
isAgency: boolean;  // derived from role === 'agency'
managedCompanies: Company[];
currentCompanyId: string | null;

switchCompany: async (companyId: string) => {
  const { token } = await api.post('/api/v1/agency/switch/' + companyId, {});
  // Update token in store
  // Invalidate all React Query cache via queryClient.clear()
  // Navigate to /dashboard
}
```

### Company switcher
`apps/web/src/components/layout/CompanySwitcher.tsx`

Renders between logo and nav items in Sidebar, only when `isAgency`.
Current company name + "∨" chevron.
Popover/dropdown on click:
- List of `managedCompanies` with click → `switchCompany(id)`
- Divider + "← All Companies" link → navigate to /agency

### Agency dashboard
`apps/web/src/app/(app)/agency/page.tsx`

Header: "All Companies" + count badge.
Responsive grid of company cards (3 cols desktop, 2 tablet, 1 mobile).
Each card:
```
Company name (bold)
City, State (muted)
──────────────────────
Active Jobs   12     Open Invoices  $4,200
MRR          $2,800  Last Activity  2h ago
──────────────────────
[Open Company →]
```
"Open Company →" calls `switchCompany(companyId)`.

### Sidebar breadcrumb
`apps/web/src/components/layout/Sidebar.tsx`

When `currentCompanyId !== null` (switched into a client):
Show above nav items:
```
← All Companies
Viewing: Mercy Clinic
```
"← All Companies" calls `switchCompany(agencyHomeCompanyId)` or navigates to /agency.

---

## Agent 4 Audit Checklist

- [ ] `pnpm build` passes clean
- [ ] No `any` types
- [ ] Migration generated for `agency_memberships`
- [ ] Switch validates membership before issuing token
- [ ] Switched JWT has correct companyId claim
- [ ] React Query cache fully cleared on company switch
- [ ] Company switcher hidden for non-agency users
- [ ] "← All Companies" only shows when in switched context
- [ ] Agency routes return 403 for non-agency JWT
- [ ] Dashboard aggregates correct per-company stats
- [ ] Unit + integration tests present and passing

---

## Push instructions (after both agents complete)
```
git add .
git commit -m "TICKET-035: Agency Multi-Tenant"
git push origin main
```

---

# TICKET-036: Marketing Landing Page

**Phase:** 3
**Agent 2:** Frontend only
**Auditor:** Agent 4
**Priority:** P1
**Dependencies:** TICKET-035 APPROVED

---

## Agent 2 Prompt
You are Agent 2. Build the ServiceRev marketing landing page as a
Next.js page at the root `/` route. The design is in a separate Figma
file — attach exported PNGs from that file to this session. This is
a public-facing page. No auth required. Authenticated users redirect
to /dashboard. The AI widget must animate through 3 states in a loop.
Follow AGENTS.md, CODEX.md, WORKFLOW.md.
No commit — output TASK COMPLETE when done.

---

## Figma Reference

**Canonical Figma (Marketing site section):** https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-%E2%80%93-Product-Design (retired: `tAteqeUfdi4GCtZVeaF4DJ`)
Export the full landing page as individual PNGs per section:
- Nav
- Hero (with AI widget)
- Problem Section
- Solution Section
- Workflow Strip
- Features Grid
- Onboarding Section
- Final CTA
- Footer

---

## Acceptance Criteria

- [ ] `/` renders landing page for unauthenticated visitors
- [ ] Authenticated users redirected to `/dashboard` from `/`
- [ ] Nav: logo, Product/Pricing/For Agencies/Blog links, Sign In + Get Started
- [ ] Hero: headline, subheadline, dual CTAs, 3 social proof stats, AI widget
- [ ] AI widget animates: processing (checklist) → reveal (revenue rows) →
      actions (CTA buttons) → loops back. Each state ~2.5–3s.
- [ ] Problem section: 6 problem cards in 3×2 grid
- [ ] Solution section: 3 feature columns with colored accent cards
- [ ] Workflow strip: dark navy bg, 9-step connected horizontal flow
- [ ] Features grid: 16 feature tiles in 4 columns
- [ ] Onboarding section: left copy + right CSV import mockup
- [ ] Final CTA: navy bg, two buttons
- [ ] Footer: logo, links, copyright
- [ ] Fully responsive: 390px / 768px / 1440px
- [ ] SEO metadata: title + description + Open Graph
- [ ] No images — all CSS/SVG visuals
- [ ] Statically rendered (SSG) — `pnpm build` output shows static `/`

---

## Agent 2 Owns

### Route
`apps/web/src/app/page.tsx`

```typescript
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth-server'; // or equivalent
import LandingPage from '@/components/landing/LandingPage';

export default async function HomePage() {
  const session = await getServerSession();
  if (session) redirect('/dashboard');
  return <LandingPage />;
}

export const metadata = {
  title: 'ServiceRev — AI-Powered Field Service Management',
  description: 'Find the revenue your service business is missing. Dispatch, jobs, estimates, payments, and AI revenue intelligence for HVAC, plumbing, and electrical shops.',
  openGraph: {
    title: "ServiceRev — Find the revenue you're missing",
    description: 'AI-powered FSM for HVAC, plumbing, and electrical service businesses.',
    type: 'website',
  },
};
```

### Component structure
```
apps/web/src/components/landing/
  LandingPage.tsx        — root, renders all sections
  LandingNav.tsx         — sticky nav, Sign In + Get Started links
  HeroSection.tsx        — left copy + right AI widget
  AIWidget.tsx           — animated 3-state widget (CSS transitions only)
  ProblemSection.tsx     — light gray bg, 6 problem cards
  SolutionSection.tsx    — white bg, 3 feature columns
  WorkflowStrip.tsx      — dark navy bg, 9-step horizontal flow
  FeaturesGrid.tsx       — white bg, 16 feature tiles
  OnboardingSection.tsx  — light bg, copy + CSV mockup
  FinalCTA.tsx           — deep navy bg, 2 CTAs
  LandingFooter.tsx      — dark bg, links + copyright
```

### AIWidget animation
`apps/web/src/components/landing/AIWidget.tsx`

3 states with useState + useEffect interval. Pure CSS transitions — no Framer Motion.

```typescript
type WidgetState = 'processing' | 'reveal' | 'actions';

const TIMING = { processing: 2500, reveal: 2500, actions: 3000 };
const STATE_ORDER: WidgetState[] = ['processing', 'reveal', 'actions'];

// On mount: start at 'processing'
// After TIMING[currentState]ms: advance to next state
// After 'actions': loop back to 'processing'
```

Processing state: 4 checklist items appear sequentially (staggered 400ms each)
with opacity: 0→1 + translateY: 8px→0.
Reveal state: 4 revenue rows fade in staggered.
Actions state: action buttons fade in, widget CTA appears.

### Responsive breakpoints

```css
/* Mobile < 768px */
Hero: single column, AI widget below copy, widget width 100%
Problems: 1 column
Solutions: 1 column
Workflow: horizontal scroll
Features: 2 columns

/* Tablet 768–1199px */
Hero: 2 column (copy left, widget right)
Problems: 2 columns
Solutions: 3 columns
Features: 3 columns

/* Desktop >= 1200px */
Full layout per Figma design
```

### Design tokens to use
```css
/* From TICKET-014 tokens — reuse CSS variables */
Primary navy: #102163
Accent blue:  #257AFA
Success:      #0FA570
Warning:      #F7A91E
Error:        #EF414C
AI purple:    #7A37F2
Text dark:    #0F172A
Muted:        #64748B
Background:   #F8FAFC
Border:       #E5E7EB
```

---

## Agent 4 Audit Checklist

- [ ] `pnpm build` passes clean, `/` is statically rendered
- [ ] No `any` types
- [ ] Authenticated users redirect to /dashboard (server-side)
- [ ] AI widget cycles all 3 states and loops indefinitely
- [ ] No layout shift during widget state transitions
- [ ] All 9 nav sections render correctly
- [ ] Mobile: no horizontal scroll at 390px
- [ ] Tablet: readable at 768px
- [ ] Desktop: matches Figma layout at 1440px
- [ ] SEO metadata present (title + description + OG)
- [ ] Zero `<img>` tags — all visuals are CSS/Tailwind/SVG
- [ ] "Get Started" links to /signup, "Sign In" links to /login

---

## Push instructions
```
git add .
git commit -m "TICKET-036: Marketing Landing Page"
git push origin main
```

---

# TICKET-037: Mobile Push Notifications

**Phase:** 3
**Agent 1:** Backend — VAPID push service + worker processor
**Agent 2:** Frontend — PWA manifest + service worker + permission flow
**Auditor:** Agent 4
**Priority:** P1
**Dependencies:** TICKET-036 APPROVED
**Run:** Agent 1 and Agent 2 in parallel

---

## Agent 1 Prompt
You are Agent 1. Implement web push notifications using VAPID.
Technicians receive push alerts on their phone when a job is assigned,
a booking is confirmed, or a payment is received. Use the `web-push`
npm package. Add `push_subscriptions` table, subscribe/unsubscribe
endpoints, and a BullMQ processor that delivers push payloads.
Emit push events from job, booking, and invoice services.
Follow AGENTS.md, CODEX.md, WORKFLOW.md. Tests required.
No commit — output TASK COMPLETE when done.

## Agent 2 Prompt
You are Agent 2. Add PWA support and push notification permission flow
to the tech mobile app. Register a service worker, show an in-app
soft prompt before the browser permission dialog, and wire subscribe/
unsubscribe to the API. No Figma designs — follow existing mobile UI
patterns. Follow AGENTS.md, CODEX.md, WORKFLOW.md.
No commit — output TASK COMPLETE when done.

---

## Figma Reference
None. Service worker notification UI is OS-native.

---

## Acceptance Criteria

### Agent 1
- [ ] VAPID keys in `@fsm/config` as `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`
- [ ] `push_subscriptions` table migrated
- [ ] `POST /api/v1/push/subscribe` — save subscription for current user
- [ ] `DELETE /api/v1/push/subscribe` — remove subscription by endpoint
- [ ] `send-push-notification` processor on `fsm:notifications` queue
- [ ] Push sent on `job.assigned` (to assigned tech)
- [ ] Push sent on `booking.confirmed` (to dispatcher)
- [ ] Push sent on `invoice.paid` (to owner)
- [ ] 410 responses auto-remove expired subscriptions
- [ ] Unit tests: payload formatting for all 3 event types
- [ ] Integration tests: subscribe, unsubscribe, 410 cleanup
- [ ] `pnpm build` + `pnpm test` clean

### Agent 2
- [ ] `public/manifest.json` — PWA manifest
- [ ] `public/sw.js` — service worker with push + notificationclick handlers
- [ ] Service worker registered in `/mobile/*` layout
- [ ] In-app soft prompt card (shown once after first mobile login):
      "Get notified when jobs are assigned to you" · Enable / Not Now
- [ ] "Enable" → `Notification.requestPermission()` → if granted →
      subscribe via `pushManager.subscribe` → POST to API
- [ ] "Not Now" persists dismissal in localStorage, never shows again
- [ ] Notification permission status shown in `/mobile/profile`
- [ ] "Disable notifications" in profile → calls DELETE subscribe API
- [ ] `pnpm build` clean

---

## Agent 1 Owns

### Schema addition
Add to `packages/db/src/schema.ts`:

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
  userIdx: index('push_subs_user_idx').on(t.userId),
  endpointIdx: uniqueIndex('push_subs_endpoint_idx').on(t.endpoint),
}));
```

Run `pnpm --filter @fsm/db db:generate`.

### Push service
`apps/api/src/services/push.service.ts`

```typescript
import webpush from 'web-push';

// Configure once on startup with VAPID keys from @fsm/config

async saveSubscription(userId, companyId, sub: {endpoint, keys: {p256dh, auth}}): Promise<void>
// Upsert on endpoint (conflict → update keys)

async removeSubscription(endpoint: string): Promise<void>

async sendToUser(userId: string, payload: PushPayload): Promise<void>
// Find all subscriptions for user
// For each: webpush.sendNotification(sub, JSON.stringify(payload))
// Catch 410: call removeSubscription(endpoint)
// Catch other errors: log, don't throw
```

### Worker processor
`apps/worker/src/processors/push-notification.processor.ts`

```typescript
const TEMPLATES = {
  'job.assigned': (data) => ({
    title: 'New Job Assigned',
    body: `${data.customerName} · ${data.scheduledTime}`,
    url: `/mobile/jobs/${data.jobId}`,
    icon: '/icons/icon-192.png',
  }),
  'booking.confirmed': (data) => ({
    title: 'New Booking Confirmed',
    body: `${data.customerName} on ${data.preferredDate}`,
    url: `/dispatch`,
    icon: '/icons/icon-192.png',
  }),
  'invoice.paid': (data) => ({
    title: 'Payment Received',
    body: `$${data.amount} from ${data.customerName}`,
    url: `/invoices/${data.invoiceId}`,
    icon: '/icons/icon-192.png',
  }),
};
```

### Emit push events in existing services
In `job.service.ts` when `assignedTechnicianId` is set:
```typescript
await jobsQueue.add('send-push-notification', {
  type: 'job.assigned',
  userId: assignedTechnicianId,
  data: { jobId, customerName, scheduledTime },
});
```

Same pattern for `booking.service.ts` (booking.confirmed → dispatcher userId)
and `invoice.service.ts` (invoice.paid → owner userId).

### Routes
```
POST   /api/v1/push/subscribe    (authenticate required)
DELETE /api/v1/push/subscribe    (authenticate required)
```

### Install dependency
```
pnpm --filter @fsm/api add web-push
pnpm --filter @fsm/api add -D @types/web-push
```

---

## Agent 2 Owns

### PWA manifest
`apps/web/public/manifest.json`

```json
{
  "name": "ServiceRev",
  "short_name": "ServiceRev",
  "description": "AI-powered field service management",
  "start_url": "/mobile/jobs",
  "display": "standalone",
  "background_color": "#131521",
  "theme_color": "#257AFA",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Add `<link rel="manifest" href="/manifest.json" />` to root layout.
Create placeholder icon PNGs (solid blue squares) at those paths.

### Service worker
`apps/web/public/sw.js`

```javascript
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'ServiceRev', {
      body: data.body ?? '',
      icon: data.icon ?? '/icons/icon-192.png',
      data: { url: data.url ?? '/mobile/jobs' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(event.notification.data.url);
          return client.focus();
        }
      }
      return clients.openWindow(event.notification.data.url);
    })
  );
});
```

### Register service worker
`apps/web/src/app/(mobile)/layout.tsx`

```typescript
useEffect(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
  }
}, []);
```

### Push hooks
`apps/web/src/hooks/push.hooks.ts`

```typescript
export function usePushPermission()
// Returns: { status: 'default'|'granted'|'denied', subscribe, unsubscribe }

async function subscribe() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
  });
  await api.post('/api/v1/push/subscribe', sub.toJSON());
}

async function unsubscribe() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await sub.unsubscribe();
    await api.delete('/api/v1/push/subscribe');
  }
}
```

### Soft prompt component
`apps/web/src/components/mobile/PushPermissionPrompt.tsx`

Shown once, first time tech opens app after login.
Persisted in localStorage key: `servicerev_push_prompted`.
Card fixed above bottom nav:
```
🔔 Stay in the loop
Get notified when jobs are assigned to you.
[Enable Notifications]  [Not Now]
```
"Enable" → request permission → subscribe.
"Not Now" → set localStorage flag, hide forever.

### Profile notifications setting
In `/mobile/profile` page, add a "Notifications" row:
- Status: Enabled (green dot) / Disabled (gray)
- Tap → toggle: if enabled → unsubscribe + update. If disabled → re-prompt.

---

## Agent 4 Audit Checklist

- [ ] `pnpm build` passes clean
- [ ] No `any` types
- [ ] VAPID keys loaded from `@fsm/config`, not hardcoded
- [ ] Migration generated for `push_subscriptions`
- [ ] 410 responses auto-remove subscription from DB
- [ ] Processor handles all 3 event types with correct payloads
- [ ] Push emitted from job/booking/invoice services correctly
- [ ] Soft prompt only shown once (localStorage flag set)
- [ ] Service worker registered only in /mobile layout
- [ ] Notification click opens correct URL
- [ ] Unsubscribe removes from both browser and DB
- [ ] Profile notification status reflects actual permission state

---

## Push instructions (after both agents complete)
```
git add .
git commit -m "TICKET-037: Mobile Push Notifications"
git push origin main
```

---

# TICKET-038: Customer Portal

**Phase:** 3
**Agent 1:** Backend — portal auth + scoped API routes
**Agent 2:** Frontend — portal UI at /portal/*
**Auditor:** Agent 4
**Priority:** P1
**Dependencies:** TICKET-037 APPROVED
**Run:** Agent 1 and Agent 2 in parallel

---

## Agent 1 Prompt
You are Agent 1. Build the customer portal backend. Customers receive
a magic link (no password) and get a portal-scoped JWT giving them
read-only access to their own invoices, jobs, agreements, and assets.
The portal JWT uses a different scope claim than the main app JWT so
the two are mutually exclusive. Follow AGENTS.md, CODEX.md, WORKFLOW.md.
Tests required. No commit — output TASK COMPLETE when done.

## Agent 2 Prompt
You are Agent 2. Build the customer portal UI at `/portal/*`. This is
a white-labeled, mobile-first experience that customers see after
clicking their magic link. It shows their invoices, job history,
service agreements, and assets. Company-branded — shows the HVAC
company logo, not ServiceRev. No Figma designs — use the booking page
(`📅 Online Booking — Public Page`) as a reference for the branding
and layout pattern. Follow AGENTS.md, CODEX.md, WORKFLOW.md.
No commit — output TASK COMPLETE when done.

---

## Figma Reference (Agent 2)
**Export from figma.com/design/LNTOsgJ7D4blaFaTepQt3J:**
- 📅 Online Booking — Public Page (reference for white-label branding pattern only)

---

## Acceptance Criteria

### Agent 1
- [ ] `customer_portal_sessions` table migrated
- [ ] `POST /api/v1/public/portal/request-access` — finds customer by
      email or phone, generates 128-char token, enqueues SMS/email with
      magic link `{APP_URL}/portal/verify/{token}`, token expires 15min
- [ ] `GET /api/v1/public/portal/verify/:token` — validates token not
      expired and not already used, marks `usedAt`, returns portal JWT
      `{ customerId, companyId, scope: 'customer_portal', exp: now+24h }`
- [ ] Portal middleware validates scope = 'customer_portal' — rejects
      main app JWTs on portal routes, rejects portal JWTs on main routes
- [ ] `GET /api/v1/portal/me` — customer name, phone, email
- [ ] `GET /api/v1/portal/invoices` — invoices for this customer only
- [ ] `GET /api/v1/portal/jobs` — job history for this customer only
- [ ] `GET /api/v1/portal/agreements` — service agreements for this customer
- [ ] `GET /api/v1/portal/assets` — assets for this customer
- [ ] All portal routes use `portalAuthMiddleware` (not `authenticate`)
- [ ] All responses filtered strictly to `req.customerId`
- [ ] Tests: token expires after 15min, single-use, cross-scope rejection,
      customer data isolation

### Agent 2
- [ ] `/portal/login` — email or phone input, "Send me a link" button,
      success state: "Check your messages — we sent you a link"
- [ ] `/portal/verify/[token]` — calls verify endpoint, stores portal JWT,
      redirects to /portal. Shows "Link expired" with re-request option on failure.
- [ ] `/portal` — home: "Hi [firstName]", open invoices card (total owed),
      upcoming jobs card, quick links
- [ ] `/portal/invoices` — list: #, date, total, status badge, Pay Now button
- [ ] `/portal/invoices/[id]` — detail: line items, total, Pay Now if unpaid
- [ ] `/portal/jobs` — read-only job history: date, type, tech name, status
- [ ] `/portal/agreements` — active plans: name, renewal date, coverage
- [ ] `/portal/assets` — assets: make/model, install date, condition badge,
      last service date
- [ ] Company branding in header: company logo + company name (from portal JWT companyId)
- [ ] "Powered by ServiceRev" in footer (subtle, small)
- [ ] Mobile-first: all pages optimized for 390px
- [ ] "Pay Now" redirects to Stripe payment link URL
- [ ] Portal uses separate API client (`portal-api.ts`) with portal JWT
- [ ] Unauthenticated portal routes redirect to /portal/login

---

## Agent 1 Owns

### Schema addition
Add to `packages/db/src/schema.ts`:

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

Run `pnpm --filter @fsm/db db:generate`.

### Customer portal service
`apps/api/src/services/customer-portal.service.ts`

```typescript
async requestAccess(companyId: string, emailOrPhone: string): Promise<void>
// 1. Find customer by email OR phone within this company
// 2. If not found: return silently (security — don't reveal existence)
// 3. Generate token: crypto.randomBytes(64).toString('hex') — 128 hex chars
// 4. Insert customer_portal_sessions { customerId, companyId, token,
//    expiresAt: now + 15min }
// 5. Build magic link: `${config.APP_URL}/portal/verify/${token}`
// 6. Enqueue send-sms or send-email with magic link text

async verifyToken(token: string): Promise<{ portalJwt: string }>
// 1. Find session WHERE token = :token AND usedAt IS NULL
//    AND expiresAt > NOW()
// 2. If not found: throw 401 'Token invalid or expired'
// 3. Set usedAt = NOW()
// 4. Sign JWT: { sub: customerId, companyId, scope: 'customer_portal',
//    iat: now, exp: now + 24h }
// 5. Return { portalJwt }
```

### Portal middleware
`apps/api/src/middleware/portal-auth.ts`

```typescript
export async function portalAuth(request, reply) {
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!token) return reply.code(401).send({ error: 'No token' });
  const payload = verifyJwt(token); // same secret, different scope
  if (payload.scope !== 'customer_portal') {
    return reply.code(403).send({ error: 'Invalid token scope' });
  }
  request.customerId = payload.sub;
  request.companyId = payload.companyId;
}
```

Also update `authenticate` middleware to reject tokens with
`scope: 'customer_portal'` — returns 403 "Portal tokens cannot access this resource".

### Routes
```
// Public (no auth)
POST /api/v1/public/portal/request-access
GET  /api/v1/public/portal/verify/:token

// Portal-scoped (portalAuth middleware)
GET  /api/v1/portal/me
GET  /api/v1/portal/invoices
GET  /api/v1/portal/invoices/:id
GET  /api/v1/portal/jobs
GET  /api/v1/portal/agreements
GET  /api/v1/portal/assets
```

All `/portal/*` authenticated routes use `portalAuth` preHandler.
Each handler filters: `WHERE customerId = request.customerId`.

### Tests
`apps/api/src/routes/portal/portal.test.ts`
- Token expires after 15 minutes (mock clock)
- Token single-use: second verify returns 401
- Portal JWT rejected on main app routes
- Main app JWT rejected on portal routes
- Customer A cannot see Customer B's invoices (data isolation)
- request-access returns 200 even when customer not found (security)

---

## Agent 2 Owns

### Portal layout
`apps/web/src/app/(portal)/layout.tsx`

Fetches company branding from `/api/v1/public/portal/company/:companyId`
(public endpoint — returns name + logoUrl only).
Header: company logo (or initials fallback) + company name.
No sidebar, no bottom nav.
Footer: subtle "Powered by ServiceRev" text.

### Portal auth store
`apps/web/src/stores/portal-auth.store.ts`

```typescript
interface PortalAuthStore {
  portalToken: string | null;
  customerId: string | null;
  companyId: string | null;
  isAuthenticated: boolean;
  setPortalAuth: (token: string) => void;
  clearPortalAuth: () => void;
}
```

Persisted to localStorage under `servicerev_portal_token`.

### Portal API client
`apps/web/src/lib/portal-api.ts`

Separate from main `api.ts`. Uses portal JWT from portal auth store.
All requests to `/api/v1/portal/*`.

```typescript
export const portalApi = {
  get: <T>(path: string) => portalFetch<T>('/api/v1/portal' + path),
};
```

### Portal middleware (client-side)
`apps/web/src/app/(portal)/layout.tsx`

If no portal token in store → redirect to `/portal/login`.
If token present → render children.

### Pages

`/portal/login`:
Clean centered card. Company logo in card header (fetched by slug or
from URL param `?company=companyId`).
Input: email or phone (auto-detect format).
"Send me a link" → POST request-access → show success state.
Success: "📱 Check your messages — we sent you a secure link."

`/portal/verify/[token]`:
On mount: call GET verify/:token.
Success: store portal JWT → redirect to /portal.
Failure: show "This link has expired." + "Send me a new link →" button.

`/portal`:
Greeting: "Hi [firstName] 👋"
2 summary cards:
- Open Invoices: count + total owed + "View All →"
- Upcoming Jobs: next scheduled job date + "View All →"
Quick links row: Invoices / Job History / My Plans / My Assets.

`/portal/invoices`:
Table: Invoice # | Date | Total | Status | Action.
Status badges: Paid (green) / Unpaid (orange) / Overdue (red).
"Pay Now" → fetch Stripe URL from invoice → window.open(url).

`/portal/invoices/[id]`:
Invoice header + line items table + totals.
Payment status banner (same pattern as main app).
"Pay Now" button if unpaid/overdue.

`/portal/jobs`:
List: Date | Job Type | Technician | Status.
Read-only. No actions. Status badges.

`/portal/agreements`:
Cards: Plan name | Status badge | Billing | Next renewal | Covered assets.
"Contact Us" link for questions.

`/portal/assets`:
List: make/model icon | Name | Install date | Condition badge | Last service.
Condition badge colors match main app: Healthy/Aging/At Risk/Critical.

---

## Agent 4 Audit Checklist

- [ ] `pnpm build` passes clean
- [ ] No `any` types
- [ ] Migration generated for `customer_portal_sessions`
- [ ] Token is 128 hex chars (crypto.randomBytes(64))
- [ ] Token single-use — second verify returns 401
- [ ] Token expires 15 min after creation
- [ ] Portal JWT rejected on main app routes (403)
- [ ] Main app JWT rejected on portal routes (403)
- [ ] Customer data isolation: each portal endpoint filters by customerId
- [ ] request-access returns 200 even when customer not found
- [ ] Portal layout shows company branding, not ServiceRev branding
- [ ] "Powered by ServiceRev" present in footer
- [ ] All portal pages optimized for 390px mobile
- [ ] Pay Now opens Stripe URL in new tab
- [ ] Portal token persisted in localStorage, cleared on 401
- [ ] Unauthenticated portal visits redirect to /portal/login

---

## Push instructions (after both agents complete)
```
git add .
git commit -m "TICKET-038: Customer Portal"
git push origin main

git tag -a v3.0.0 -m "Phase 3 complete — AI dispatch, advanced reporting, agency multi-tenant, landing page, push notifications, customer portal"
git push origin v3.0.0
```
