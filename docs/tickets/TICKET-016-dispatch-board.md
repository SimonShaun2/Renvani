> **Historical instruction snapshot — clarified 2026-11-05 UTC.** The original text below is retained for traceability, including retired brand/Figma references, agent assignments, schema snapshots and milestone claims. It is not the current build queue or design authority. Current work follows [AGENTS.md](../../AGENTS.md), [TEAM.md](../../TEAM.md), the FS board, and the [Renvani Figma parity contract](../design/RENVANI_FIGMA_PARITY.md). Use canonical Figma file `jiGHTNUJNltWbHA4Il3hk7` and `packages/db/src/schema.ts`; do not implement old copy, use stale `fsm-schema.ts`, or rename persisted keys from this historical text.

# TICKET-016: Dispatch Board

**Phase:** 2B
**Assigned:** Agent 2 (Frontend Engineer)
**Auditor:** Agent 4 (QA & Standards)
**Priority:** P0 — Dispatcher's primary workspace. Most complex UI in the product.
**Dependencies:** TICKET-015 APPROVED

---

## Agent Prompts

### Agent 2 — Read This First
You are Agent 2 (Frontend Engineer) building ServiceRev. This ticket
implements the Dispatch Board — the most complex screen in the product.
It has three panels: Next Best Jobs sidebar, a Gantt-style technician
schedule grid, and a job detail right panel. It uses @dnd-kit for
drag-and-drop scheduling. Read the Figma designs attached carefully —
every detail of the three-panel layout, the gap indicators, the job
blocks, and the Next Best Jobs queue is specified in the design.

Follow all rules in AGENTS.md, CODEX.md, WORKFLOW.md.
Commit and push to GitHub when complete. Output TASK COMPLETE when done.

### Agent 4 — Read This First
You are Agent 4 (QA & Standards). Run every item in the Audit Checklist.
Output TICKET-016 AUDIT: APPROVED or CHANGES REQUIRED.

---

## Figma Reference

**Export from figma.com/design/LNTOsgJ7D4blaFaTepQt3J:**
- 🚀 Dispatch Board — full three-panel Gantt design

**Attach exported PNG to this Codex session.**

---

## Objective

Build the full Dispatch Board at `/dispatch`. Three panels:
1. Left: Next Best Jobs queue (AI-prioritized)
2. Center: Gantt grid (technicians × time slots)
3. Right: Job detail panel (opens on job click)

Drag a job from the queue onto a technician's slot to schedule it.
Click any job block to open detail. Auto-Fit button to accept AI suggestion.

---

## Acceptance Criteria

- [ ] Three-panel layout renders correctly
- [ ] Day/Week view toggle (Week view is V2 — stub it)
- [ ] Date navigation (< prev day | date | next day >)
- [ ] Tech rows with utilization bar and hours available
- [ ] Job blocks render with correct color by status
- [ ] Open gaps shown as amber dashed drop targets
- [ ] Drag job from Next Best Jobs queue → drop on tech slot schedules it
- [ ] Click job block → opens right detail panel
- [ ] Next Best Jobs: Now / Today / This Week sections
- [ ] Auto-Fit button suggests best slot + tech
- [ ] Booking Requests sub-tab shows pending online bookings
- [ ] "Convert estimate to job" queue (approved estimates)
- [ ] Inline quick-create job (click empty slot)
- [ ] Keyboard: Escape closes detail panel
- [ ] Loading state while fetching dispatch data

---

## Agent 2 Owns

### 1. API hooks
**File:** `apps/web/src/hooks/dispatch.hooks.ts`

```typescript
export function useDispatchView(date: string) {
  return useQuery({
    queryKey: ['dispatch', date],
    queryFn: () => api.get<DispatchView>(`/api/v1/dispatch?date=${date}`),
    staleTime: 60 * 1000,
  });
}

export function useScheduleJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, technicianId, scheduledStart, scheduledEnd }: ScheduleJobInput) =>
      api.patch(`/api/v1/jobs/${jobId}`, { technicianId, scheduledStart, scheduledEnd }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dispatch'] });
    },
  });
}

export function useBookingRequests() {
  return useQuery({
    queryKey: ['booking-requests'],
    queryFn: () => api.get('/api/v1/booking-requests?status=pending'),
    refetchInterval: 30 * 1000, // poll every 30s for new bookings
  });
}

export function useConfirmBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ConfirmBookingInput }) =>
      api.post(`/api/v1/booking-requests/${id}/confirm`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-requests'] });
      queryClient.invalidateQueries({ queryKey: ['dispatch'] });
    },
  });
}
```

### 2. Dispatch page layout
**File:** `apps/web/src/app/(app)/dispatch/page.tsx`

Three-panel layout using CSS Grid:
```css
grid-template-columns: 240px 1fr 340px;
```

All three panels are fixed height (viewport height minus header).
Each panel scrolls independently.

### 3. Next Best Jobs sidebar
**File:** `apps/web/src/components/dispatch/NextBestJobs.tsx`

Header: "NEXT BEST JOBS" + count badge + Smart/List toggle

Filter chips: service type (HVAC / Plumb / Elec) + duration (2h)

Sections — NOW / TODAY / THIS WEEK:
- NOW: jobs that need scheduling urgently (overdue, high urgency)
- TODAY: jobs to fill today's gaps
- THIS WEEK: forward-looking opportunities

Each job card in queue:
```typescript
interface NextBestJobCardProps {
  job: NextBestJob;
  onAutoFit: (jobId: string) => void;
  isDragging?: boolean;
}
```

Card content:
- Customer name + estimated value
- Description (service type + time estimate)
- URGENT badge (red) if urgencyScore >= 85
- Auto-Fit button → calls auto-fit API → shows suggestion overlay
- AI reasoning tooltip: "why this fits" on hover

Cards are draggable via @dnd-kit `useDraggable`.
Dragging a card dims it and shows a ghost on the cursor.

### 4. Gantt Grid
**File:** `apps/web/src/components/dispatch/GanttGrid.tsx`

Time header:
- Hours 8am–6pm (10 columns)
- Each column = 60px wide
- Current time indicator: red vertical line

Tech rows:
```typescript
interface TechRowProps {
  technician: TechnicianSchedule;
  date: string;
  onJobClick: (jobId: string) => void;
  onSlotClick: (technicianId: string, time: string) => void;
}
```

Row layout:
- Left 100px: avatar initials + name + hours (e.g. "6h")
- Rest: droppable time grid

**Job blocks:**
**File:** `apps/web/src/components/dispatch/JobBlock.tsx`

Width = duration in pixels (1 hour = 60px).
Left offset = (startHour - 8) * 60px.

Colors by status:
- `in_progress` → blue
- `completed` → navy
- `scheduled` → blue (lighter)
- `lead` → gray

Block content: customer name (truncated) + duration.
Click → opens JobDetailPanel.
Draggable for rescheduling (drag within row to shift time).

**Gap indicators:**
Gaps between jobs are rendered as amber dashed rectangles.
Text: "X.Xh open · drop here"
These are @dnd-kit `useDroppable` targets.
When a job card is dragged over a gap → gap highlights blue.

### 5. Job Detail Panel
**File:** `apps/web/src/components/dispatch/JobDetailPanel.tsx`

Slides in from right when job is clicked.
Width: 340px fixed.
Left border: 1px neutral-200.

Content:
- Customer name + service type header
- SCHEDULED badge + time range + duration
- ✕ close button
- CUSTOMER: name, phone, email
- PROPERTY: address (placeholder box if none)
- ASSET: name + model + last service
- NOTES: freeform text
- ACTIONS row:
  - Reschedule (open date/time picker)
  - Complete (→ transitions job to completed)
  - Invoice (→ navigates to create invoice)
  - Message (→ opens SMS draft)

### 6. Inline Quick Create
**File:** `apps/web/src/components/dispatch/InlineJobCreate.tsx`

Clicking an empty slot on a tech row opens a small inline popover:
- Customer search (typeahead)
- Service type select
- Duration select (1h / 2h / 3h / 4h)
- "Create Job" button

On submit: creates job + immediately places on board.
Escape or click-outside dismisses.

### 7. Booking Requests sub-tab
**File:** `apps/web/src/components/dispatch/BookingRequestsPanel.tsx`

Sub-tabs: Schedule | Booking Requests 🔴{count} | Unscheduled

Booking requests table:
- NEW badge for requests < 2 hours old
- Customer name + phone
- Service requested
- Preferred date
- Source badge (Google/Facebook/Instagram/Direct)
- Status (Pending → Confirm/Decline buttons)

Right panel: booking request detail with full form.
Confirm button: assigns tech + creates job + sends SMS.

### 8. Approved Estimates Queue
Shows in the unscheduled panel at bottom.
`GET /api/v1/estimates/approved-unconverted`
Each estimate: customer + title + total + "Convert to Job →" button.

---

## Drag and Drop Implementation

Use `@dnd-kit/core` with `DndContext`.

```typescript
// In GanttGrid
const { isOver, setNodeRef } = useDroppable({
  id: `slot-${technicianId}-${timeSlot}`,
  data: { technicianId, timeSlot },
});

// In NextBestJobCard  
const { attributes, listeners, setNodeRef, transform } = useDraggable({
  id: job.id,
  data: { jobId: job.id, type: 'queue-job' },
});

// In DndContext onDragEnd
function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (!over) return;
  const { technicianId, timeSlot } = over.data.current;
  const { jobId } = active.data.current;
  scheduleJob.mutate({ jobId, technicianId, scheduledStart: timeSlot });
}
```

---

## State Management

Use Zustand for dispatch board local state:
**File:** `apps/web/src/stores/dispatch.store.ts`

```typescript
interface DispatchStore {
  selectedDate: string;
  selectedJobId: string | null;
  activeTab: 'schedule' | 'bookings' | 'unscheduled';
  setSelectedDate: (date: string) => void;
  setSelectedJob: (jobId: string | null) => void;
  setActiveTab: (tab: string) => void;
}
```

---

## Agent 4 Audit Checklist

- [ ] `pnpm build` passes clean
- [ ] No `any` types
- [ ] Three-panel layout renders without overflow
- [ ] Each panel scrolls independently
- [ ] Job blocks positioned correctly by start time
- [ ] Gap indicators render between jobs
- [ ] Drag-and-drop: job from queue lands on correct tech/slot
- [ ] `scheduleJob.mutate` called on drop with correct technicianId + time
- [ ] `useDispatchView` invalidated after schedule mutation
- [ ] Booking requests poll every 30 seconds
- [ ] NEW badge shows for requests < 2 hours old
- [ ] Confirm booking calls `POST /api/v1/booking-requests/:id/confirm`
- [ ] Detail panel opens on job click, closes on Escape or ✕
- [ ] Inline quick create submits correct payload
- [ ] Week view tab renders stub: "Week view coming soon"
- [ ] Loading state: skeleton rows while fetching

---

## Notes

- Time grid: 8am–6pm = 10 hours = 600px wide minimum
- On tablet: left sidebar collapses — only Gantt + detail panel
- On mobile: dispatch redirects to Today's Jobs mobile view
- Git commit: "TICKET-016: Dispatch Board"
