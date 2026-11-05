> **Historical instruction snapshot — clarified 2026-11-05 UTC.** The original text below is retained for traceability, including retired brand/Figma references, agent assignments, schema snapshots and milestone claims. It is not the current build queue or design authority. Current work follows [AGENTS.md](../../AGENTS.md), [TEAM.md](../../TEAM.md), the FS board, and the [Renvani Figma parity contract](../design/RENVANI_FIGMA_PARITY.md). Use canonical Figma file `jiGHTNUJNltWbHA4Il3hk7` and `packages/db/src/schema.ts`; do not implement old copy, use stale `fsm-schema.ts`, or rename persisted keys from this historical text.

# TICKET-028: Review Requests Dashboard

**Phase:** 2D
**Assigned:** Agent 2
**Auditor:** Agent 4
**Priority:** P1
**Dependencies:** TICKET-027 APPROVED

---

## Figma Reference

**Export from figma.com/design/LNTOsgJ7D4blaFaTepQt3J:**
- ⭐ Review Requests page

---

## Acceptance Criteria

- [ ] `/review-requests` funnel dashboard
- [ ] 4 stat cards: Requests Sent | Clicked | Completed | Avg Rating
- [ ] Table: Customer | Job | Sent | Status | Channel | Rating | Action
- [ ] Status badges: Sent / Clicked / Completed / Declined
- [ ] Resend button for Sent/Clicked status
- [ ] Review link settings panel: Google/Yelp/Facebook URLs + status
- [ ] "Send Review Request" button on completed jobs (manual trigger)
- [ ] Public review landing page at `/review/:token` (no auth)

---

## Agent 2 Owns

### API hooks
`apps/web/src/hooks/review-requests.hooks.ts`

```typescript
export function useReviewRequests(query: ListReviewRequestsQuery)
export function useReviewStats()
export function useResendReviewRequest(requestId: string)
export function useSendReviewRequest()   // manual trigger
export function useReviewSettings()
export function useUpdateReviewSettings()
// Public:
export function usePublicReview(token: string)
export function useCompleteReview(token: string)
```

### Dashboard page
`apps/web/src/app/(app)/review-requests/page.tsx`

Funnel stats row (4 cards).
Table with resend action.
Review Link Settings panel (right side or bottom):
- Per-platform: URL input + status badge + copy link button
- Platforms: Google / Yelp / Facebook / Custom

### Public review page
`apps/web/src/app/(public)/review/[token]/page.tsx`

No auth. Fetches company name + tech name + review links from token.
Shows: "How was your service with [Tech] from [Company]?"
Star rating (1–5).
Optional comment field.
Submit → redirects to selected review platform URL.
Already-completed state: "Thanks for your review!"

---

## Agent 4 Audit Checklist

- [ ] `pnpm build` passes clean
- [ ] No `any` types
- [ ] Funnel stats correctly show conversion rates
- [ ] Resend disabled if already completed
- [ ] Public review page requires no auth
- [ ] Token expiry handled gracefully (show expired message)
- [ ] Star rating submits correct integer value
- [ ] Review platform redirect opens in new tab

---

## Notes
- `GET /api/v1/review-requests`
- `POST /api/v1/review-requests/:id/resend`
- `GET /api/v1/public/reviews/:token`
- Git commit: "TICKET-028: Review Requests Dashboard"

---