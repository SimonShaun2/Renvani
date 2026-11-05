> **Historical instruction snapshot — clarified 2026-11-05 UTC.** The original text below is retained for traceability, including retired brand/Figma references, agent assignments, schema snapshots and milestone claims. It is not the current build queue or design authority. Current work follows [AGENTS.md](../../AGENTS.md), [TEAM.md](../../TEAM.md), the FS board, and the [Renvani Figma parity contract](../design/RENVANI_FIGMA_PARITY.md). Use canonical Figma file `jiGHTNUJNltWbHA4Il3hk7` and `packages/db/src/schema.ts`; do not implement old copy, use stale `fsm-schema.ts`, or rename persisted keys from this historical text.

# ServiceRev — Phase 2 Master Plan
**Status:** Ready to build
**Backend:** Phase 1 complete (13 tickets, 234 tests)
**Figma:** figma.com/design/LNTOsgJ7D4blaFaTepQt3J
**Repo:** SimonShaun2/Renvani (formerly FSM-Platform)

---

## Context Files — Every Session

Every Codex session in Phase 2 requires ALL of these:

```
1. AGENTS.md          — architecture rules
2. CODEX.md           — execution rules
3. WORKFLOW.md        — product workflow
4. Ticket file        — what to build
5. fsm-schema.ts      — database schema (23 tables)
6. Figma file key: LNTOsgJ7D4blaFaTepQt3J  (Agent 2 reads via Figma MCP)
```

Agent 2 must have the Figma MCP connected.
Agent 2 reads designs by calling: `get_design_context(fileKey: 'LNTOsgJ7D4blaFaTepQt3J', nodeId: ...)`

---

## Figma File Structure

All designs live at: `figma.com/design/LNTOsgJ7D4blaFaTepQt3J`

Pages in the file:
| Page | Screens |
|---|---|
| 🎨 Design System | Colors, typography, tokens |
| 📊 Dashboard | Owner dashboard, AI right rail |
| 🚀 Dispatch Board | 3-panel Gantt, Next Best Jobs |
| 👥 Customer Profile | Properties, assets, AI suggestions |
| 🔧 Job Detail | Context cards, tasks, checklist, AI |
| 📋 Estimates | List + Good/Better/Best builder |
| 💳 Invoices | List + detail + payment link |
| 📱 Mobile Phone — Full App | 10 screens (login → profile) |
| 📟 Tablet — Full App | 5 screens (dashboard → signature) |
| 📟 Tablet — Tech App | 3 screens (jobs, detail, estimate) |
| 💰 Tech Estimate → Payment Flow | 8-step flow |
| 📷 Photo Upload — Tech App | 5 screens |
| 📅 Online Booking — Public Page | 8 screens (zip→service→schedule→confirm) |
| 📅 Online Booking — Admin Settings | Settings + service areas |
| 📅 Online Booking — Dispatch Queue | Booking requests table |
| ✅ Job Tasks + Products | Job detail with tasks and products panel |
| ⏱ Time Tracking | Mobile + desktop panels |
| 🚗 On The Way | Mobile send + desktop status |
| ✍️ E-Signature (Mobile) | Signature capture |
| ⭐ Review Requests | Dashboard + review links |
| 📎 File Attachments | Gallery panel |
| 👤 Technician Profile | Full profile screen |
| 📊 Basic Reporting | V1 dashboard |
| 📦 Product Catalog | List + add/edit |
| 🛡 Service Agreements | Plans + templates |
| 💡 AI Revenue Center | Recommendations feed |
| ⚙️ Settings + Onboarding | Company profile |
| 🔐 Login + Signup | Split panel login |
| 📂 CSV Import Wizard | 7-step wizard |

---

## Phase 2 Ticket Map

### Phase 2A — Foundation (runs first, parallel)
```
TICKET-014   Design System + Layout Shell          Agent 2
TICKET-014a  Product Catalog API                   Agent 1
TICKET-014b  Job Tasks + Products API              Agent 1
TICKET-014c  Time Tracking + OTW API               Agent 1
TICKET-014d  Review Requests + File Attachments    Agent 1
TICKET-014e  Dispatch View Endpoints               Agent 1
TICKET-014f  Online Booking API + Public Routes    Agent 1
```

### Phase 2B — Core Screens (after 014 approved)
```
TICKET-015   Dashboard + AI Revenue Center        Agent 2
TICKET-016   Dispatch Board                        Agent 2
TICKET-017   Customer + Property + Asset           Agent 2
TICKET-018   Job Detail (full — tasks/products/time/files) Agent 2
TICKET-019   Estimates + Invoice Flows             Agent 2
```

### Phase 2C — Mobile + New Features (parallel with 2B)
```
TICKET-020   Mobile Tech App — Full                Agent 2
TICKET-021   Tablet Tech App                       Agent 2
TICKET-022   Photo Upload — Camera + Gallery       Agent 2
TICKET-023   Estimate → Payment Flow (8 steps)     Agent 2
TICKET-024   Online Booking — Public Page          Agent 2
TICKET-025   Online Booking — Admin + Dispatch     Agent 2
```

### Phase 2D — Management Screens
```
TICKET-026   Product Catalog Screens               Agent 2
TICKET-027   Service Agreements UI                 Agent 2
TICKET-028   Review Requests Dashboard             Agent 2
TICKET-029   Technician Profiles                   Agent 2
TICKET-030   Basic Reporting Dashboard             Agent 2
TICKET-031   Settings (all tabs)                   Agent 2
TICKET-032   CSV Import Wizard UI                  Agent 2
```

---

## Schema Status

**Tables added for Phase 2 (schema v2 — 1,626 lines, 23 table groups):**
- `product_catalog` — service items, labor, materials
- `job_tasks` — checklist items per job
- `job_products` — catalog items used on a job
- `time_entries` — tech clock in/out
- `review_requests` — post-job review flow
- `file_attachments` — unified attachments (all entities)
- `on_the_way_notifications` — OTW tracking
- `booking_requests` — online booking submissions
- `booking_settings` — per-company booking config
- `technicians.serviceZipCodes` — zip routing for bookings

**New activity events added:**
- `booking.requested`, `booking.confirmed`, `booking.cancelled`, `booking.completed`
- `review_request.sent`, `review_request.completed`
- `job.task_completed`, `job.product_added`, `job.upsell_approved`
- `technician.on_the_way`, `job.time_started`, `job.time_stopped`

---

## Tech Stack for Phase 2

**Frontend (Agent 2):**
- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- shadcn/ui components
- TanStack Query for data fetching
- Zustand for client state
- React Hook Form + Zod for forms
- Framer Motion for transitions

**New dependencies needed:**
- `@tanstack/react-query` — server state
- `zustand` — client state
- `react-hook-form` — forms
- `@radix-ui/*` via shadcn — components
- `framer-motion` — animations
- `react-signature-canvas` — e-signature capture
- `react-camera-pro` — camera access on mobile
- `@dnd-kit/core` — drag and drop (Dispatch Board)
- `date-fns` — already in api, add to frontend
- `recharts` — charts for reporting

---

## Frontend Routes

```
/login
/signup (→ CSV import wizard)

/dashboard                          Owner landing
/dispatch                           Dispatcher landing
/dispatch/bookings                  Booking requests sub-tab

/customers
/customers/[id]
/customers/[id]/properties/[propId]
/customers/[id]/assets/[assetId]

/jobs
/jobs/[id]
/jobs/[id]/tasks
/jobs/[id]/products
/jobs/[id]/time
/jobs/[id]/files

/estimates
/estimates/new
/estimates/[id]

/invoices
/invoices/[id]

/products                           Product catalog
/products/new
/products/[id]

/service-agreements
/service-agreements/[id]

/ai-revenue-center
/review-requests
/reporting

/settings
/settings/general
/settings/payments
/settings/automation
/settings/users
/settings/booking
/settings/booking/links
/settings/booking/service-areas
/settings/review-links

/mobile/jobs                        Technician landing
/mobile/jobs/[id]
/mobile/jobs/[id]/tasks
/mobile/jobs/[id]/products
/mobile/jobs/[id]/photos
/mobile/jobs/[id]/complete
/mobile/signature
/mobile/otw/[jobId]

/book/[slug]                        PUBLIC — online booking
/book/[slug]/service
/book/[slug]/schedule
/book/[slug]/contact
/book/[slug]/confirm
/book/[slug]/confirmed

/estimates/[token]                  PUBLIC — customer estimate approval
/pay/[token]                        PUBLIC — Stripe payment page
/review/[token]                     PUBLIC — review request landing
```

---

## Design System Tokens (from Figma)

```
Colors:
  Brand Primary:   #102163  (deep navy)
  Brand Accent:    #257AFA  (electric blue)
  Accent Light:    #DEEBff

  Neutral 900:     #131521
  Neutral 800:     #1E222A
  Neutral 700:     #313641
  Neutral 600:     #565E6D
  Neutral 500:     #7F8897
  Neutral 400:     #AFB6C2
  Neutral 300:     #D6DAE1
  Neutral 200:     #EDEFF2
  Neutral 100:     #F6F7F9
  White:           #FFFFFF

  Success:         #0FA570
  Warning:         #F7A91E
  Error:           #EF414C
  AI Purple:       #7A37F2

  Sidebar BG:      #131521

Typography:
  Family: Inter
  Scale: 11 / 12 / 13 / 14 / 15 / 16 / 18 / 20 / 22 / 24 / 28 / 32 / 36
  Weights: Regular / Medium / Semi Bold / Bold

Spacing: 4px base grid
Border radius: 6 / 8 / 10 / 12 / 16 / 24px
```

---

## Role-Based Routing

```typescript
// Middleware: apps/web/src/middleware.ts
const ROLE_DEFAULT_ROUTES = {
  owner:       '/dashboard',
  admin:       '/dashboard',
  dispatcher:  '/dispatch',
  technician:  '/mobile/jobs',
}
```

---

## Booking ZIP Routing Logic

```typescript
// When customer submits zip code:
// 1. Query technicians where serviceZipCodes @> ARRAY[zipCode]
// 2. If no techs found: check allowZipOverflow setting
// 3. If overflow allowed: find nearest tech by service area proximity
// 4. Build availability calendar from matched tech schedule_slots
// 5. Show only slots where matched tech is available

// Booking confirmation:
// 1. Create booking_request record
// 2. If autoConfirm = false: notify dispatcher (SMS + in-app)
// 3. If autoConfirm = true: create job immediately, assign tech
// 4. Send confirmation SMS to customer
```

---

## Notes for Agent 2

1. **Read Figma designs before writing any component.** Call `get_design_context` with the file key and node ID for every screen you're building.

2. **Mobile-first for /mobile/* routes.** These render on tech's phone. Max width 390px, touch targets minimum 44px, no hover states.

3. **Tablet layouts use persistent sidebar** not bottom nav. Breakpoint: 768px+.

4. **The dispatch board uses @dnd-kit** for drag-and-drop. Not HTML5 native drag — doesn't work well on touch.

5. **Camera access requires HTTPS.** The photo capture feature only works on secure contexts. Configure Next.js for HTTPS in dev if testing on device.

6. **Public booking page (/book/[slug]) has no auth.** No session, no cookies. Fully public. Company data fetched by slug only.

7. **E-signature uses react-signature-canvas.** Captures as base64 PNG, uploaded to R2 via the file attachments API.

8. **All monetary values are strings from the API** (decimal.js on backend). Parse with parseFloat only for display formatting, never for arithmetic.

9. **Activity events are read-only from frontend.** Never write to activity_events directly — they're emitted by the backend on state changes.

10. **Git commit after every approved ticket.** Include ticket number in commit message.
