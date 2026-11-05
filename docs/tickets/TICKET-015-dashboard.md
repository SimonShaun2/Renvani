> **Historical instruction snapshot — clarified 2026-11-05 UTC.** The original text below is retained for traceability, including retired brand/Figma references, agent assignments, schema snapshots and milestone claims. It is not the current build queue or design authority. Current work follows [AGENTS.md](../../AGENTS.md), [TEAM.md](../../TEAM.md), the FS board, and the [Renvani Figma parity contract](../design/RENVANI_FIGMA_PARITY.md). Use canonical Figma file `jiGHTNUJNltWbHA4Il3hk7` and `packages/db/src/schema.ts`; do not implement old copy, use stale `fsm-schema.ts`, or rename persisted keys from this historical text.

# TICKET-015: Dashboard + AI Revenue Center

**Phase:** 2B
**Assigned:** Agent 2 (Frontend Engineer)
**Auditor:** Agent 4 (QA & Standards)
**Priority:** P0 — Primary owner landing screen. The demo lives here.
**Dependencies:** TICKET-014 APPROVED

---

## Agent Prompts

### Agent 2 — Read This First
You are Agent 2 (Frontend Engineer) building ServiceRev. This ticket
implements the owner Dashboard and AI Revenue Center — the two screens
that show where the money is hiding. These are the first screens an
owner sees after login and the primary product differentiator.

Read the Figma designs attached to this session before writing any code.
Use the design tokens, spacing, and component patterns from TICKET-014.
Follow all rules in AGENTS.md, CODEX.md, WORKFLOW.md.
Commit and push to GitHub when complete. Output TASK COMPLETE when done.

### Agent 4 — Read This First
You are Agent 4 (QA & Standards). Run every item in the Agent 4 Audit
Checklist. Output TICKET-015 AUDIT: APPROVED or CHANGES REQUIRED.

---

## Figma Reference

**Export these pages from figma.com/design/LNTOsgJ7D4blaFaTepQt3J:**
- 📊 Dashboard — full owner dashboard (Image 3 — the most refined version)
- 💡 AI Revenue Center — recommendations feed

**Attach exported PNGs to this Codex session.**

---

## Objective

Build the owner Dashboard and AI Revenue Center screens. When complete,
an owner logs in and immediately sees their total revenue opportunity,
today's schedule snapshot, alerts, AI suggested actions, and can take
one-click action on any recommendation.

---

## Acceptance Criteria

### Dashboard (`/dashboard`)
- [ ] Revenue opportunity cards (4 cards: Dormant, Estimates, Invoices, Agreements)
- [ ] Today's Schedule Snapshot (tech list with gap badges)
- [ ] Alerts section (urgent jobs, overdue invoices, overdue customers)
- [ ] Quick Pipeline (5 metrics with dollar values)
- [ ] Recent Activity feed (5 most recent events)
- [ ] Top Revenue Opportunities ranked list
- [ ] Jobs by Status donut chart
- [ ] AI Suggested Actions right rail (3 recommendations with actions)
- [ ] Quick Actions grid (6 buttons)
- [ ] Your Goal Progress bar
- [ ] All data fetched from API, loading skeletons shown while fetching
- [ ] Empty states for all sections

### AI Revenue Center (`/ai-revenue-center`)
- [ ] Total opportunity banner
- [ ] 5 category cards with counts and estimated revenue
- [ ] Filter chips by type and source
- [ ] Sort by urgency score (default), revenue, date
- [ ] Recommendation list with urgency score, type badge, headline, body
- [ ] Action button per recommendation (Schedule / Send Follow-Up / etc.)
- [ ] Dismiss + Snooze actions
- [ ] "Why this?" expandable reasoning
- [ ] Pagination (25 per page)
- [ ] Empty state when no recommendations

---

## Agent 2 Owns

### 1. API hooks
**File:** `apps/web/src/hooks/dashboard.hooks.ts`

```typescript
export function useRevenueSummary() {
  return useQuery({
    queryKey: ['revenue-summary'],
    queryFn: () => api.get<RevenueSummary>('/api/v1/ai/revenue-summary'),
    staleTime: 5 * 60 * 1000, // 5 minutes — matches backend cache
    refetchOnWindowFocus: false,
  });
}

export function useDispatchWorkload(date: string) {
  return useQuery({
    queryKey: ['dispatch-workload', date],
    queryFn: () => api.get(`/api/v1/dispatch/workload?date=${date}`),
  });
}

export function useRecentActivity() {
  return useQuery({
    queryKey: ['recent-activity'],
    queryFn: () => api.get('/api/v1/activity-events?limit=5'),
    refetchInterval: 60 * 1000, // poll every minute
  });
}
```

**File:** `apps/web/src/hooks/ai-revenue.hooks.ts`

```typescript
export function useRecommendations(filters: ListRecommendationsQuery) {
  return useQuery({
    queryKey: ['recommendations', filters],
    queryFn: () => api.get('/api/v1/ai/recommendations?' + new URLSearchParams(filters)),
  });
}

export function useActionRecommendation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ActionRecommendationInput }) =>
      api.post(`/api/v1/ai/recommendations/${id}/action`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['revenue-summary'] });
    },
  });
}

export function useDismissRecommendation() { /* same pattern */ }
export function useSnoozeRecommendation() { /* same pattern */ }
```

### 2. Dashboard page
**File:** `apps/web/src/app/(app)/dashboard/page.tsx`

Layout: 3-column grid on desktop
- Left + Center (width: calc(100% - 408px)): all main content
- Right rail (width: 408px): AI Suggested Actions

**Revenue Opportunity Cards component:**
**File:** `apps/web/src/components/dashboard/RevenueOpportunityCards.tsx`

```typescript
interface RevenueOpportunityCardsProps {
  summary: RevenueSummary;
  isLoading: boolean;
}
```

4 cards in a row:
- Dormant Customers — purple accent
- Unsold Estimates — orange accent
- Unpaid Invoices — red accent
- Missing Agreements — blue accent

Each card: icon circle (colored), label, dollar value (bold), count,
"View →" link. Click navigates to AI Revenue Center filtered by type.
Loading state: skeleton cards.

**Today's Schedule Snapshot:**
**File:** `apps/web/src/components/dashboard/ScheduleSnapshot.tsx`

List of technicians with:
- Avatar initials circle
- Name
- Job count
- Gap badge (orange) or "On track" badge (green)
- "Open Dispatch Board →" link

**Alerts:**
**File:** `apps/web/src/components/dashboard/AlertsSection.tsx`

Colored dot + alert text + "View all alerts →" link.
Priority order: red (urgent) → orange (warning).

**Quick Pipeline:**
**File:** `apps/web/src/components/dashboard/QuickPipeline.tsx`

5 metrics in a row: count (large bold) + dollar value (green) + label.
"Go to reports →" link.

**Recent Activity:**
**File:** `apps/web/src/components/dashboard/RecentActivity.tsx`

Feed of last 5 activity events. Each: colored left border,
event text, time ago, value if applicable.
"View all activity →" link.

**Jobs by Status:**
**File:** `apps/web/src/components/dashboard/JobsDonutChart.tsx`

Recharts PieChart with 4 segments. Center total number.
Legend: Completed (navy) / In Progress (blue) / Scheduled (gray) / Unscheduled (red).

**Goal Progress:**
**File:** `apps/web/src/components/dashboard/GoalProgress.tsx`

Revenue goal progress bar. Text: "$48,300 / $75,000 · 64% · 19 days left".
Only shows if company has set a monthly revenue goal in settings.

### 3. AI Suggested Actions Rail
**File:** `apps/web/src/components/dashboard/AISuggestedActions.tsx`

Right rail — fixed width 408px.
Header: sparkle icon + "AI Suggested Actions" + info tooltip.
Tabs: Suggestions | Watchlist (count badge).

Recommendation card:
- Number badge (1/2/3)
- Title (semi-bold)
- Urgent badge (red) if urgencyScore >= 85
- Description text
- Estimated value
- Action button (full width, blue) — label varies by recommendation type:
  - `reactivation` → "Schedule Now"
  - `unsold_estimate` → "Send Follow Up"
  - `unpaid_invoice` → "Send Payment Link"
  - `aging_asset` → "Create Estimate"
  - `maintenance_plan_offer` → "Offer Plan"
- "Why this? ∨" expandable — shows AI reasoning text
- "View all suggestions →" link at bottom
- Quick Actions grid (6 buttons): Create Job, New Estimate, New Invoice,
  Add Customer, New Agreement, Send Message

### 4. AI Revenue Center page
**File:** `apps/web/src/app/(app)/ai-revenue-center/page.tsx`

**Total Opportunity Banner:**
**File:** `apps/web/src/components/ai/TotalOpportunityBanner.tsx`

Navy background banner spanning full width:
- "Total Revenue Opportunity" label
- Large dollar value
- "Last scanned: Today at 2:00 AM" 
- "Run AI Scan" button (purple outlined)

**Category Cards:**
5 cards in a row. Click filters the recommendation list below.
Selected card gets highlighted border.

**Filter + Sort Bar:**
Type chips (All / Dormant / Estimates / Invoices / Assets / Agreements)
+ "Sort by: Urgency Score ∨" dropdown on right.

**Recommendation List:**
**File:** `apps/web/src/components/ai/RecommendationCard.tsx`

Each row:
- Urgency score circle (colored: red 80+, orange 60-79, gray <60)
- Type badge + urgency level badge
- Headline (semi-bold) + body text
- Customer name (links to customer profile)
- Action button (right-aligned)
- Dismiss | Snooze | "Why this?" buttons (smaller, right of action)

**Dismiss modal:** confirmation dialog with optional reason field.
**Snooze modal:** date picker — snooze until selected date.
**Why this? panel:** inline expansion showing AI reasoning text.

### 5. Shared components needed

**SkeletonCard:**
`apps/web/src/components/ui/SkeletonCard.tsx`
— animated shimmer placeholder, accepts width/height props

**EmptyState:**
`apps/web/src/components/ui/EmptyState.tsx`
— icon + title + subtitle + optional CTA button

**StatBadge:**
`apps/web/src/components/ui/StatBadge.tsx`
— colored badge for status/urgency/type labels

**CurrencyDisplay:**
`apps/web/src/components/ui/CurrencyDisplay.tsx`
— formats string decimal from API as $X,XXX.XX

**TimeAgo:**
`apps/web/src/components/ui/TimeAgo.tsx`
— converts ISO timestamp to "2h ago", "3 days ago"

---

## Route Guards

Dashboard and AI Revenue Center are owner/admin only.
If a technician somehow navigates here, redirect to `/mobile/jobs`.
If a dispatcher navigates here, redirect to `/dispatch`.

Implement in the `(app)/layout.tsx` route group using role from auth store.

---

## Loading + Error States

Every data-fetching section must have:
1. Loading skeleton (shimmer animation)
2. Error state with retry button
3. Empty state (no data yet)

Never show blank white space while loading.

---

## Agent 4 Audit Checklist

- [ ] `pnpm build` passes clean
- [ ] No `any` types
- [ ] All monetary values formatted via `CurrencyDisplay` component — never raw strings
- [ ] Loading skeletons present for all data sections
- [ ] Empty states present for all data sections
- [ ] Dashboard redirects non-owner/admin roles
- [ ] Revenue opportunity cards link to AI Revenue Center with correct filter
- [ ] AI recommendation action/dismiss/snooze call correct API endpoints
- [ ] `useQuery` staleTime set to 5 min for revenue summary (matches backend cache)
- [ ] Recent activity polls every 60 seconds
- [ ] Donut chart renders correctly (not blank on first load)
- [ ] "Why this?" expands inline without page jump
- [ ] Snooze date picker validates future date only
- [ ] Responsive: cards stack to 2-column on tablet, 1-column on mobile

---

## Notes

- Revenue summary endpoint: `GET /api/v1/ai/revenue-summary`
- Recommendations endpoint: `GET /api/v1/ai/recommendations`
- Action endpoint: `POST /api/v1/ai/recommendations/:id/action`
- Dispatch workload: `GET /api/v1/dispatch/workload?date=`
- Recent activity: use `GET /api/v1/jobs` with recent sort as proxy until
  a dedicated activity endpoint is built
- Git commit: "TICKET-015: Dashboard + AI Revenue Center"
