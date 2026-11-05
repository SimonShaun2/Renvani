> **Historical instruction snapshot — clarified 2026-11-05 UTC.** The original text below is retained for traceability, including retired brand/Figma references, agent assignments, schema snapshots and milestone claims. It is not the current build queue or design authority. Current work follows [AGENTS.md](../../AGENTS.md), [TEAM.md](../../TEAM.md), the FS board, and the [Renvani Figma parity contract](../design/RENVANI_FIGMA_PARITY.md). Use canonical Figma file `jiGHTNUJNltWbHA4Il3hk7` and `packages/db/src/schema.ts`; do not implement old copy, use stale `fsm-schema.ts`, or rename persisted keys from this historical text.

# TICKET-029: Technician Profiles

**Phase:** 2D
**Assigned:** Agent 2
**Auditor:** Agent 4
**Priority:** P1
**Dependencies:** TICKET-028 APPROVED

---

## Figma Reference

**Export from figma.com/design/LNTOsgJ7D4blaFaTepQt3J:**
- 👤 Technician Profile page

---

## Acceptance Criteria

- [ ] `/settings/users` or `/team` — tech list with stats
- [ ] Tech profile: avatar, name, role, stats row, skills, schedule,
      service areas (zip codes), recent jobs
- [ ] Edit profile form: name, email, phone, role, skills, certifications
- [ ] Schedule editor: day toggles + hours per day
- [ ] Service area editor: add/remove zip codes
  (same component as booking service-areas settings)
- [ ] Stats: Jobs This Month | Avg Rating | Revenue | Utilization |
      Estimate Conversion
- [ ] Invite new technician (sends email invite)
- [ ] Deactivate technician with confirmation

---

## Agent 2 Owns

### API hooks
`apps/web/src/hooks/technicians.hooks.ts`

```typescript
export function useTechnicians()
export function useTechnician(techId: string)
export function useUpdateTechnician(techId: string)
export function useUpdateTechSchedule(techId: string)
export function useUpdateTechServiceAreas(techId: string)
export function useInviteTechnician()
export function useDeactivateTechnician(techId: string)
export function useTechStats(techId: string)
```

### Team list page
`apps/web/src/app/(app)/settings/users/page.tsx`

Table: Avatar | Name | Role | Jobs MTD | Rating | Utilization | Status.
"+ Invite Technician" button → email invite modal.
Click row → tech profile page.

### Tech Profile page
`apps/web/src/app/(app)/settings/users/[id]/page.tsx`

Follow Figma design exactly:
- Header: avatar initials circle (colored), name, role, phone, email,
  Active badge, Edit + Deactivate buttons
- 5 stats cards
- Skills & Certifications: checkmark list + "+ Add Skill" button
- Schedule & Availability: day toggles (Mon-Sun) + 8am-5pm hours
- Service Areas: zip code chips (same ZipChipEditor component from TICKET-025)
- Recent Jobs table (last 4)

### ZipChipEditor (reusable)
`apps/web/src/components/shared/ZipChipEditor.tsx`

Shared between TICKET-025 (booking service areas) and this ticket.
Props: `zips: string[]`, `onChange: (zips: string[]) => void`, `color?: string`
Input: type zip → Enter adds chip. ✕ removes.
Validates 5-digit US zip format.

---

## Agent 4 Audit Checklist

- [ ] `pnpm build` passes clean
- [ ] No `any` types
- [ ] ZipChipEditor validates 5-digit format
- [ ] ZipChipEditor reused from TICKET-025 (not duplicated)
- [ ] Schedule day toggles save correctly
- [ ] Stats cards show correct data
- [ ] Deactivate shows confirmation with impact warning
- [ ] Invite sends to correct API endpoint

---

## Notes
- `GET /api/v1/technicians`
- `PATCH /api/v1/technicians/:id`
- `PATCH /api/v1/technicians/:id/service-areas`
- Git commit: "TICKET-029: Technician Profiles"

---