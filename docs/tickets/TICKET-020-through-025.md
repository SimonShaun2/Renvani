> **Historical instruction snapshot — clarified 2026-11-05 UTC.** The original text below is retained for traceability, including retired brand/Figma references, agent assignments, schema snapshots and milestone claims. It is not the current build queue or design authority. Current work follows [AGENTS.md](../../AGENTS.md), [TEAM.md](../../TEAM.md), the FS board, and the [Renvani Figma parity contract](../design/RENVANI_FIGMA_PARITY.md). Use canonical Figma file `jiGHTNUJNltWbHA4Il3hk7` and `packages/db/src/schema.ts`; do not implement old copy, use stale `fsm-schema.ts`, or rename persisted keys from this historical text.

# TICKET-020: Mobile Tech App — Full

**Phase:** 2C
**Assigned:** Agent 2 (Frontend Engineer)
**Auditor:** Agent 4 (QA & Standards)
**Priority:** P0 — Technicians use this every day.
**Dependencies:** TICKET-018 APPROVED (runs parallel with 2B completion)

---

## Agent Prompts

### Agent 2
Build the complete mobile technician app. This runs on `/mobile/*`
routes and renders at 390px viewport width on technician phones.
All touch targets minimum 44px. No hover states. Persistent
bottom navigation. Read ALL attached Figma designs carefully —
this is the most-used surface for end users.
Follow AGENTS.md, CODEX.md, WORKFLOW.md. Commit and push.
Output TASK COMPLETE when done.

### Agent 4
Run the full audit. Output TICKET-020 AUDIT: APPROVED or CHANGES REQUIRED.

---

## Figma Reference

**Export from figma.com/design/LNTOsgJ7D4blaFaTepQt3J:**
- 📱 Mobile Phone — Full App (all 10 screens)

---

## Acceptance Criteria

- [ ] Login screen renders correctly at 390px
- [ ] Today's Jobs: timeline view, job cards, status badges
- [ ] Job Detail mobile: tabs (Details / Tasks / Products / Files)
- [ ] Tasks checklist: tap to complete, required badge, progress bar
- [ ] Add Products: search catalog, category chips, AI suggestions, + button
- [ ] Photos: capture, gallery, before/after labels (see TICKET-022)
- [ ] OTW: message preview, ETA picker, send button
- [ ] Messages: conversation list, unread badges
- [ ] Tech Profile: stats, menu items
- [ ] Bottom navigation: 4 tabs, active state, badge counts
- [ ] All touch targets ≥ 44px height
- [ ] No horizontal scroll at 390px
- [ ] Sticky job action bar on Job Detail (bottom of screen)

---

## Agent 2 Owns

### Route structure (mobile)
All under `apps/web/src/app/(mobile)/`:
```
mobile/
  jobs/
    page.tsx              Today's Jobs
    [id]/
      page.tsx            Job Detail (tabs)
      tasks/page.tsx      Tasks tab (if deep-linked)
      products/page.tsx   Products tab
      photos/page.tsx     Photos tab (→ TICKET-022)
      complete/page.tsx   Complete flow (→ TICKET-023)
  otw/
    [jobId]/page.tsx      On The Way send
  messages/
    page.tsx              Conversation list
    [customerId]/page.tsx Thread view
  profile/
    page.tsx              Tech profile
```

### Mobile layout wrapper
`apps/web/src/app/(mobile)/layout.tsx`

Max-width: 100vw. No sidebar.
Bottom nav: fixed, 56px, white bg, 1px top border.
Content area: height = 100vh - 44px (status) - 56px (nav).
Overflow-y: scroll.

### Mobile bottom nav
`apps/web/src/components/mobile/MobileBottomNav.tsx`

4 tabs: Home | Jobs | Messages | Profile
Active: blue icon + label + 3px blue top border.
Messages tab: unread badge count (red circle).

### Screen 1: Login
Reuse the login page from TICKET-014.
The `/login` route is shared — same component, responsive.
Mobile renders the form full-screen (no split panel).

### Screen 2: Today's Jobs (`/mobile/jobs`)
`apps/web/src/components/mobile/TodayJobsList.tsx`

Header: "Today's Jobs" + date + avatar
Weather/status bar (optional — stub with static "3 jobs today")
Timeline: vertical line with dot per job
Job cards: status badge, time, customer name, address, value,
action buttons (Continue / Navigate / OTW)
Active job (in_progress): blue top border, "Continue →" button

### Screen 3: Job Detail (`/mobile/jobs/[id]`)
`apps/web/src/components/mobile/MobileJobDetail.tsx`

Navy header bar: back arrow, job title, status badge, "⋯" menu
4 tab strip: Details | Tasks | Products | Files

**Details tab:**
Customer card (name, phone, call button, map button)
Asset card (with condition badge)
Notes (read-only with "✎ Edit" link)
Time tracking card (active timer or "Start" button)
AI suggestion card (purple)
Sticky action bar at bottom: "✓ Complete Job"

**Tasks tab:**
Reuses TaskChecklist from TICKET-018, mobile-optimized.
Tap checkbox = complete. 44px row height.
Add task: bottom input, keyboard pushes up.

**Products tab:**
Reuses product list.
"+ Add from Catalog" → full-screen search sheet.
"+ Add Custom" → inline form.
Totals at bottom.

**Files tab:**
Photo grid + documents list.
Camera button (opens native camera).
See TICKET-022 for full implementation.

### Sticky action bar
`apps/web/src/components/mobile/JobActionBar.tsx`

Fixed to bottom above nav (z-index: 10).
Buttons change by status:
- `scheduled` → [OTW] [Start Job]
- `in_progress` → [Complete Job] (full width, blue)
- `completed` → [Create Invoice]

### Screen 4: OTW (`/mobile/otw/[jobId]`)
`apps/web/src/components/mobile/OTWScreen.tsx`

Job card summary at top.
Message preview (editable).
ETA dropdown (5/10/15/20/30/45/60 min).
"🚗 Send On My Way" button (full width, blue).
Navigate + Call Customer secondary buttons.
Past notifications list.

### Screen 5: Messages (`/mobile/messages`)
List of customer conversations.
Conversation row: avatar initials, name, preview, time, unread badge.
`/mobile/messages/[customerId]` → SMS thread view (read-only V1).

### Screen 6: Profile (`/mobile/profile`)
Avatar + name + role + active badge.
Stats row: Jobs this month / Rating / Utilization.
Menu list: Skills, Schedule, Service Areas, Time Entries,
Reviews, Notifications, Change Password, Sign Out.

---

## Agent 4 Audit Checklist

- [ ] `pnpm build` passes clean
- [ ] No `any` types
- [ ] All interactive elements ≥ 44px height
- [ ] No horizontal scroll at 390px
- [ ] Bottom nav active state works on all routes
- [ ] Messages unread count comes from API
- [ ] Today's Jobs sorted by scheduled time
- [ ] Job tabs maintain scroll position when switching
- [ ] OTW send disables button while mutation is pending
- [ ] Sticky action bar does not overlap content
- [ ] Complete Job navigates to `/mobile/jobs/[id]/complete`
- [ ] Profile sign out clears auth store + redirects to /login

---

## Notes
- Technician role middleware redirects to `/mobile/jobs` not `/dashboard`
- Mobile routes should 404 for non-technician roles
- Git commit: "TICKET-020: Mobile Tech App Full"

---

# TICKET-021: Tablet Tech App

**Phase:** 2C
**Assigned:** Agent 2
**Auditor:** Agent 4
**Priority:** P1
**Dependencies:** TICKET-020 APPROVED

---

## Figma Reference

**Export from figma.com/design/LNTOsgJ7D4blaFaTepQt3J:**
- 📟 Tablet — Tech App (all 3 screens)

---

## Acceptance Criteria

- [ ] Persistent left sidebar (280px) — not bottom nav
- [ ] 3-panel Job Detail: left context | center tasks | right products+actions
- [ ] Create Estimate split view: left catalog picker | right builder
- [ ] All panels scroll independently
- [ ] Breakpoint: sidebar appears at ≥ 768px

---

## Agent 2 Owns

### Tablet layout detection
`apps/web/src/hooks/useBreakpoint.ts`

```typescript
export function useBreakpoint() {
  const [isTablet, setIsTablet] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setIsTablet(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsTablet(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return { isTablet };
}
```

### Tablet-specific layouts

**Today's Jobs tablet:**
`apps/web/src/components/mobile/tablet/TabletJobsList.tsx`
Side-by-side 2-column job card grid (instead of timeline).
Day progress stepper at top.

**3-panel Job Detail:**
`apps/web/src/components/mobile/tablet/TabletJobDetail.tsx`
CSS Grid: `grid-template-columns: 248px 248px 280px`
Left: customer/asset context + AI suggestion
Center: task checklist
Right: products + timer + complete CTA

**Create Estimate split:**
`apps/web/src/components/mobile/tablet/TabletEstimateBuilder.tsx`
Left: product catalog with AI suggestions
Right: estimate builder with G/B/B toggle

### Sidebar tech nav
`apps/web/src/components/mobile/tablet/TechSidebar.tsx`
Same dark navy sidebar as desktop but with tech-only nav items:
My Jobs | Job Detail | Tasks | Products | Estimates | Files | Time | Messages
Tech profile card at bottom.

---

## Agent 4 Audit Checklist

- [ ] `pnpm build` passes clean
- [ ] Sidebar renders at 768px+, hidden below
- [ ] 3-panel layout no horizontal overflow
- [ ] Each panel scrolls independently
- [ ] Tablet estimate builder left/right panels sync correctly

---

## Notes
- Git commit: "TICKET-021: Tablet Tech App"

---

# TICKET-022: Photo Upload — Camera + Gallery

**Phase:** 2C
**Assigned:** Agent 2
**Auditor:** Agent 4
**Priority:** P1
**Dependencies:** TICKET-020 APPROVED

---

## Figma Reference

**Export from figma.com/design/LNTOsgJ7D4blaFaTepQt3J:**
- 📷 Photo Upload — Tech App (all 5 screens)

---

## Acceptance Criteria

- [ ] Native camera capture (mobile: `capture="environment"`)
- [ ] Photo review screen: label, type selector, tag to asset
- [ ] AI auto-label (stub: uses filename/asset context, calls `/api/v1/ai/label-photo`)
- [ ] Before/After/General/Document type selector
- [ ] Before/After comparison view with drag slider
- [ ] Photo gallery: filter tabs (All/Before/After/Docs)
- [ ] 3-column photo grid on mobile
- [ ] Photo detail: full screen, tag display, edit/share/delete
- [ ] Share via SMS (attaches to OTW or message)
- [ ] Document upload (PDF, any file type)
- [ ] Upload progress indicator
- [ ] Max 50MB file size validation

---

## Agent 2 Owns

### Camera capture
`apps/web/src/components/photos/CameraCapture.tsx`

```typescript
// Mobile: uses native camera
<input
  type="file"
  accept="image/*"
  capture="environment"
  onChange={handleCapture}
  className="hidden"
  ref={inputRef}
/>

// Desktop: standard file picker
<input type="file" accept="image/*,application/pdf" onChange={handleSelect} />
```

After capture: navigate to photo review screen.

### Photo review
`apps/web/src/components/photos/PhotoReview.tsx`

Shows captured image full-width.
Controls below:
- AI label (editable text input, pre-filled from API)
- Type selector: Before | After | General | Document (pill buttons)
- Tag to asset: multi-select chips (assets for this job)
- Retake | Use Photo buttons

### Photo gallery
`apps/web/src/components/photos/PhotoGallery.tsx`

Filter tabs. "Take Photo" + "Upload File" buttons.
Before section: red label badge on each photo.
After section: green label badge.
3-column CSS grid, gap: 4px.

### Photo detail
`apps/web/src/components/photos/PhotoDetail.tsx`

Full screen overlay (dark bg). Swipe left/right between photos.
Bottom panel: caption, tags, actions (edit/save/share/delete).

### Before/After comparison
`apps/web/src/components/photos/BeforeAfterComparison.tsx`

Two photos side by side.
Drag handle in center adjusts reveal amount.
Labels: BEFORE (red badge) / AFTER (green badge).
Share button at top right.

### Upload service
`apps/web/src/lib/upload.ts`

```typescript
async function uploadFile(
  file: File,
  options: { entityType: string; entityId: string; photoType?: string; caption?: string }
): Promise<Attachment> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('entityType', options.entityType);
  formData.append('entityId', options.entityId);
  if (options.photoType) formData.append('photoType', options.photoType);
  if (options.caption) formData.append('caption', options.caption);

  // Use XMLHttpRequest for progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    // ... rest of XHR
  });
}
```

---

## Agent 4 Audit Checklist

- [ ] `pnpm build` passes clean
- [ ] Mobile camera uses `capture="environment"` attribute
- [ ] File size validated client-side before upload (max 50MB)
- [ ] Upload progress displayed correctly
- [ ] AI label is editable before saving
- [ ] Before/After drag slider works on touch (touchmove event)
- [ ] Photo gallery filter tabs filter correctly
- [ ] Delete photo shows confirmation dialog
- [ ] Photos linked to correct entityType/entityId

---

## Notes
- AI label endpoint: `POST /api/v1/ai/label-photo` (stub OK in V1)
- Git commit: "TICKET-022: Photo Upload Camera + Gallery"

---

# TICKET-023: Estimate → Payment Flow (8 Steps)

**Phase:** 2C
**Assigned:** Agent 2
**Auditor:** Agent 4
**Priority:** P0 — Primary revenue capture flow. Demo critical.
**Dependencies:** TICKET-019 APPROVED, TICKET-020 APPROVED

---

## Figma Reference

**Export from figma.com/design/LNTOsgJ7D4blaFaTepQt3J:**
- 💰 Tech Estimate → Payment Flow (all 8 steps + flow diagram)

---

## Acceptance Criteria

All 8 steps work end-to-end:
- [ ] Step 1: Create Estimate — AI pre-filled suggestions, add from catalog
- [ ] Step 2: Build Quote — Single or Good/Better/Best mode
- [ ] Step 3: Customer Approves — hand device mode, approval captured
- [ ] Step 4: Upsell — AI surfaces add-ons, each independently addable
- [ ] Step 5: Service Agreement — plan tier + billing cycle selection
- [ ] Step 6: E-Signature — covers job + plan, single signature
- [ ] Step 7: Invoice Created — auto-generated, send options
- [ ] Step 8: Payment — Stripe link, cash, check
- [ ] Step progress bar persists across all steps
- [ ] Back button works at every step
- [ ] Step state preserved if app backgrounded (Zustand persist)
- [ ] Completion redirects to Today's Jobs with success toast

---

## Agent 2 Owns

### Flow state store
`apps/web/src/stores/estimate-flow.store.ts`

```typescript
interface EstimateFlowStore {
  jobId: string | null;
  estimateId: string | null;
  currentStep: number;
  lineItems: LineItem[];
  quoteMode: 'single' | 'good_better_best';
  selectedTier: 'good' | 'better' | 'best' | null;
  approvalTimestamp: string | null;
  addedUpsells: string[];
  selectedPlanId: string | null;
  billingCycle: 'monthly' | 'annual';
  signatureDataUrl: string | null;
  invoiceId: string | null;
  // Actions
  setStep: (step: number) => void;
  setJobId: (id: string) => void;
  reset: () => void;
}
```

Persist to localStorage so state survives page refresh.

### Flow router
`apps/web/src/app/(mobile)/mobile/jobs/[id]/complete/page.tsx`

Reads `currentStep` from store, renders the correct step component.
Step progress bar at top: 8 segments, colored by completion.

### Step 1: Create Estimate
`apps/web/src/components/estimate-flow/Step1CreateEstimate.tsx`

Job context card (customer + asset).
AI suggestion banner (purple).
Catalog search with AI-filtered results at top.
Tap "+" on item → adds to estimate.
Shows running total at bottom.
"Next: Build Quote →" advances to step 2.

### Step 2: Build Quote
`apps/web/src/components/estimate-flow/Step2BuildQuote.tsx`

Toggle: Single / Good-Better-Best
Single: shows line items, message field.
G/B/B: three tier cards (navy highlight on Better).
Prices calculated from items in each tier.
"Show Customer →" advances to step 3.

### Step 3: Customer Approves
`apps/web/src/components/estimate-flow/Step3CustomerApproval.tsx`

"Hand device to customer" header instruction.
Hides tech UI (no nav bars, no back button).
Shows company branding header.
Large "✓ Approve" button (green, full width).
Tier selector if G/B/B mode.
Approval: calls `POST /api/v1/estimates/:id/approve`
Records timestamp + selected tier.
Tech view resumes automatically after approval.

### Step 4: Upsell
`apps/web/src/components/estimate-flow/Step4Upsell.tsx`

"✓ Estimate approved — $X" confirmation banner.
AI suggested upsells list (from recommendation engine).
Each upsell: title, description, ROI text, value, "Add to Job →" button.
Added upsells tracked in store.
"Next: Service Agreement →" or "Skip" button.

### Step 5: Service Agreement
`apps/web/src/components/estimate-flow/Step5ServiceAgreement.tsx`

Plan tier cards: Silver / Gold / Platinum.
Gold pre-highlighted as recommended.
Billing toggle: Annual / Monthly.
Price shown for selected billing cycle.
Stripe subscription note.
"Next: Customer Signs →" or "Skip" button.

### Step 6: E-Signature
`apps/web/src/components/estimate-flow/Step6ESignature.tsx`

Summary of what's being signed (approve list).
Signature pad: `react-signature-canvas`.
Clear + "Type Instead" toggle.
Legal terms (one paragraph).
"✓ Confirm All" → uploads signature PNG → calls approve/enroll APIs.

```typescript
import SignatureCanvas from 'react-signature-canvas';

const sigRef = useRef<SignatureCanvas>(null);

function handleConfirm() {
  const dataUrl = sigRef.current?.toDataURL('image/png');
  // Upload to R2 via /api/v1/attachments
  // then call approve endpoints
}
```

### Step 7: Invoice Created
`apps/web/src/components/estimate-flow/Step7InvoiceCreated.tsx`

"✓ Signed & Invoice Generated" success banner.
Invoice summary card (line items, total).
Send options: SMS | Email | Print.
"Send" calls `POST /api/v1/invoices/:id/send`.

### Step 8: Payment
`apps/web/src/components/estimate-flow/Step8Payment.tsx`

Amount due (large).
"💳 Pay by Card (via link)" → opens Stripe URL in browser.
"💵 Record Cash" → amount + confirmation.
"📝 Record Check" → amount + reference number.
"✓ Job Complete — Great work!" button → resets flow store → navigates to today's jobs.
AI follow-up note: "AI will send review request + monitor plan".

---

## Agent 4 Audit Checklist

- [ ] `pnpm build` passes clean
- [ ] No `any` types
- [ ] Flow store persists to localStorage
- [ ] Back button at each step decrements step correctly
- [ ] Step 3 hides all tech UI (nav bars, back button)
- [ ] Approval timestamp recorded on step 3 completion
- [ ] Signature canvas clears correctly
- [ ] Signature PNG uploaded to R2 before confirm APIs called
- [ ] Step 7 invoice shows correct line items from estimate
- [ ] Step 8 cash/check records payment via correct API
- [ ] Reset clears store and redirects to today's jobs
- [ ] Progress bar reflects correct step at all times

---

## Notes
- `react-signature-canvas` package must be added to deps
- Plan enrollment: `POST /api/v1/service-agreements` with linked job/estimate
- Git commit: "TICKET-023: Estimate to Payment Flow"

---

# TICKET-024: Online Booking — Public Page

**Phase:** 2C
**Assigned:** Agent 2
**Auditor:** Agent 4
**Priority:** P0 — Customer-facing. No auth. Must be polished.
**Dependencies:** TICKET-014e APPROVED (booking API)

---

## Figma Reference

**Export from figma.com/design/LNTOsgJ7D4blaFaTepQt3J:**
- 📅 Online Booking — Public Page (all 8 screens including zip states)

---

## Acceptance Criteria

5-step booking flow at `/book/[slug]`:
- [ ] Branded header with company logo and name
- [ ] 5-step progress bar: Location → Service → Schedule → Contact → Confirm
- [ ] Step 1a: Zip entry — large input, coverage area note
- [ ] Step 1b: Zip verified — full address form, property type
- [ ] Step 1c: Zip not served — email capture, graceful message
- [ ] Step 2: Service type (category tabs, service chips, urgency)
- [ ] Step 3: Schedule (First Available / All toggle, radio slot list)
- [ ] Step 4: Contact (name, phone, email, notes, property owner checkbox, two separate SMS consent checkboxes)
- [ ] Step 5: Confirm (booking summary, what to expect, confirm button)
- [ ] Confirmed screen (ref number, review CTA, source attribution)
- [ ] Source tracking: `?src=` param stored on booking record
- [ ] No auth required at any step
- [ ] Mobile-first layout (480px max card width, centered)

---

## Agent 2 Owns

### Route + layout
`apps/web/src/app/(public)/book/[slug]/`
```
layout.tsx     — branded header, neutral gray bg, no nav
page.tsx       — reads currentStep from URL or state, renders step
confirmed/page.tsx  — confirmation screen
```

### Booking flow store
`apps/web/src/stores/booking-flow.store.ts`

```typescript
interface BookingFlowStore {
  slug: string;
  source: string;         // from ?src= param
  currentStep: number;    // 1–5
  zip: string;
  zipVerified: boolean;
  addressLine1: string;
  city: string; state: string;
  propertyType: 'residential' | 'commercial';
  serviceCategory: string;
  serviceType: string;
  serviceDetail: string;
  urgency: 'emergency' | 'this_week' | 'flexible';
  preferredDate: string;
  preferredWindow: string;
  firstName: string; lastName: string;
  phone: string; email: string;
  notes: string;
  smsConsentAppointments: boolean; // pre-checked — TCPA appointment updates
  smsConsentMarketing: boolean;    // unchecked — TCPA marketing opt-in
  referenceNumber: string | null;
  setStep: (step: number) => void;
  reset: () => void;
}
```

### Branded header component
`apps/web/src/components/booking/BookingHeader.tsx`

Fetches company name/logo from `/api/v1/public/booking/:slug`.
Navy background, company logo (fallback to initials), name, phone.

### Step 1a: Location / Zip
`apps/web/src/components/booking/Step1Location.tsx`

Coverage area callout below input.
"Check My Area →" → calls `POST /api/v1/public/booking/:slug/check-zip`.
If covered → advance to 1b.
If not covered → render 1c state.

### Step 1b: Address form
`apps/web/src/components/booking/Step1AddressForm.tsx`

"✓ Great news — we serve [zip]! X technicians cover your area."
Full address form: street, apt, city, state, zip (pre-filled).
Property type: Residential / Commercial toggle.

### Step 1c: Not served
`apps/web/src/components/booking/Step1NotServed.tsx`

Email capture form. "Notify me when you expand" submit.
Calls `POST /api/v1/public/booking/:slug/email-capture`.
Lists served areas below.

### Step 2: Service
`apps/web/src/components/booking/Step2Service.tsx`

Category tabs from company `offeredServices` setting.
Service type chips (Repair / Maintenance / Install / Estimate).
Conditional sub-question: "What needs repair?"
Urgency radio: Emergency / This Week / Flexible (with sub-labels).

### Step 3: Schedule
`apps/web/src/components/booking/Step3Schedule.tsx`

Calls `GET /api/v1/public/booking/:slug/availability?zip=&date=`.
"First Available" / "All Times" toggle.
Radio list of available windows (formatted: "Tue, Apr 29 · Morning 8–12pm").
"~2hr window" note on each row.

### Step 4: Contact
`apps/web/src/components/booking/Step4Contact.tsx`

Booking summary chip at top (date + service — editable "✎ Change").
Form: firstName, lastName, phone*, email, notes.
Property owner checkbox: "I am the owner of this residential property *" (unchecked).

SMS consent section (two separate checkboxes — TCPA requires separate opt-ins):
1. "Receive texts about my appointment" — pre-checked (appointment reminders, confirmation, OTW)
2. "Receive texts about promotions & offers" — unchecked (optional marketing opt-in)

Legal note: "Standard message & data rates may apply. Appointment texts are required for service."

### Step 5: Confirm
`apps/web/src/components/booking/Step5Confirm.tsx`

Full booking summary card with left blue border.
5 rows: service, date, time, address, contact.
"What happens next" list (SMS / reminder / OTW / call).
No payment required note.
"✓ Confirm Booking" → `POST /api/v1/public/booking/:slug/submit`.
Back button.

### Confirmed screen
`apps/web/src/components/booking/BookingConfirmed.tsx`

Green circle check animation.
"Booking Requested!" heading.
Reference number.
Booking summary card.
Review CTA (links to Google/Yelp from settings).
Source attribution badge (if `?src=` was present).
"Add to Calendar" + "Back to [source platform]" buttons.

---

## Agent 4 Audit Checklist

- [ ] `pnpm build` passes clean
- [ ] No auth middleware runs on `/book/*` routes
- [ ] `?src=` param captured and stored in booking flow store
- [ ] Zip check shows loading state while API call in flight
- [ ] Zip not served shows email capture (not just an error)
- [ ] Schedule step only shows slots from techs covering that zip
- [ ] smsConsentAppointments pre-checked by default
- [ ] smsConsentMarketing unchecked by default
- [ ] Both stored as separate fields on booking submission
- [ ] Property owner checkbox stored on booking_requests record
- [ ] Confirm step shows all data from previous steps
- [ ] Submit calls correct API endpoint
- [ ] Reference number displayed on confirmed screen
- [ ] Review CTA links to company's review URL from settings
- [ ] Page renders correctly at 375px (iPhone SE width)
- [ ] No CLS (layout shift) on step transitions

---

## Notes
- Source tracking: read `?src=` from URL on mount, store in booking store
- Email capture endpoint: stub with 200 OK response in V1
- Git commit: "TICKET-024: Online Booking Public Page"

---

# TICKET-025: Online Booking — Admin + Dispatch

**Phase:** 2C
**Assigned:** Agent 2
**Auditor:** Agent 4
**Priority:** P1
**Dependencies:** TICKET-024 APPROVED, TICKET-016 APPROVED

---

## Figma Reference

**Export from figma.com/design/LNTOsgJ7D4blaFaTepQt3J:**
- 📅 Online Booking — Admin Settings
- 📅 Online Booking — Dispatch Queue

---

## Acceptance Criteria

### Settings (`/settings/booking/links`)
- [ ] Master booking URL with copy button
- [ ] Per-platform links (Google, Facebook, Instagram, Yelp, Direct)
- [ ] Copy link button per platform
- [ ] "How to set up" instructions per platform (collapsible)
- [ ] QR code download
- [ ] Booking performance stats (right panel)

### Settings (`/settings/booking/service-areas`)
- [ ] Tech list with zip code chips per tech
- [ ] Edit zips panel (add/remove chips)
- [ ] Routing rules toggles
- [ ] Booking demand by zip bar chart

### Dispatch Booking Queue (sub-tab of Dispatch Board)
- [ ] Already implemented in TICKET-016 but fully wired here
- [ ] Source filter chips (All/Google/Facebook/Instagram/Direct)
- [ ] NEW badge for requests < 2 hours old
- [ ] Confirm + Decline actions
- [ ] Right panel detail with assign tech + confirm date

---

## Agent 2 Owns

### Booking Links settings
`apps/web/src/app/(app)/settings/booking/links/page.tsx`

Master URL display card (blue bg, copy button).
Platform table: for each platform — icon, name, status badge,
tracking URL, copy button, instructions toggle.

Platform configs (static):
```typescript
const PLATFORMS = [
  { id: 'google', name: 'Google Business Profile', icon: '🔵',
    instructions: 'Google Business → Info → Appointments → Add booking link' },
  { id: 'facebook', name: 'Facebook Page', icon: '📘',
    instructions: 'Facebook Page → Edit → Add Action Button → Book Now' },
  { id: 'instagram', name: 'Instagram', icon: '📸',
    instructions: 'Instagram → Edit Profile → Link in Bio' },
  { id: 'yelp', name: 'Yelp', icon: '⭐',
    instructions: 'Yelp Business → Add booking button' },
  { id: 'direct', name: 'Direct / QR Code', icon: '🔗',
    instructions: 'Use on website, email signatures, printed materials' },
];
```

URL format: `${BOOKING_BASE_URL}/book/${slug}?src=${platform.id}`

Copy button: `navigator.clipboard.writeText(url)` + toast "Copied!"

QR code: use `qrcode.react` package.
`<QRCodeCanvas value={masterUrl} size={128} />`
Download button: canvas.toDataURL() → anchor download.

Booking performance stats:
`GET /api/v1/booking-requests/stats?days=30`
Shows: Total Bookings | By source breakdown | Confirmation Rate | Revenue.

### Service Areas settings
`apps/web/src/app/(app)/settings/booking/service-areas/page.tsx`

Two-column layout:
Left (760px): tech zip table + coverage overview
Right (219px): edit panel for selected tech

Tech table: avatar + name | zip chips (max 4 shown + "+N more") |
bookings count | toggle | Edit Zips button.

Edit Zips panel (right):
Lists current zips as green chips with ✕ remove.
Add zip input: type zip → Enter or + button adds chip.
Validates: 5-digit zip format.
"Save Changes" → `PATCH /api/v1/technicians/:id/service-areas`

Routing rules toggles:
Auto-assign | Balance workload | Allow zip overflow
Each is a toggle → `PATCH /api/v1/booking-settings`

Booking demand bar chart:
Top 5 zips by booking count.
Recharts BarChart.
`GET /api/v1/booking-requests/demand-by-zip?days=30`

### Dispatch booking requests
This is the `BookingRequestsPanel` from TICKET-016 — now fully wired
with real data and confirm/decline actions.

Confirm booking modal:
`apps/web/src/components/dispatch/ConfirmBookingModal.tsx`

Fields:
- Assign technician (dropdown of available techs for that zip)
- Confirm date (date picker)
- Confirm time window (Morning / Afternoon)
- SMS preview to customer (auto-generated, read-only)
"Confirm & Schedule Job" → `POST /api/v1/booking-requests/:id/confirm`

Decline dialog:
Reason field (optional).
"Decline" → `POST /api/v1/booking-requests/:id/decline`
Customer gets decline SMS automatically.

---

## Agent 4 Audit Checklist

- [ ] `pnpm build` passes clean
- [ ] Copy button writes correct URL to clipboard + shows toast
- [ ] URL includes correct `?src=` param per platform
- [ ] QR code renders correctly and downloads as PNG
- [ ] Zip input validates 5-digit format before adding
- [ ] Remove zip chip calls PATCH immediately (no pending state)
- [ ] Routing rule toggles save to API
- [ ] Booking demand chart fetches and renders correctly
- [ ] Confirm booking modal shows only techs covering that zip
- [ ] Confirm action creates job and sends customer SMS
- [ ] NEW badge correctly shows for requests < 2 hours old

---

## Notes
- Add `qrcode.react` to deps: `pnpm add qrcode.react`
- Booking stats endpoint: `GET /api/v1/booking-requests/stats`
- Git commit: "TICKET-025: Online Booking Admin + Dispatch"
