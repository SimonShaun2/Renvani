> **Historical instruction snapshot — clarified 2026-11-05 UTC.** The original text below is retained for traceability, including retired brand/Figma references, agent assignments, schema snapshots and milestone claims. It is not the current build queue or design authority. Current work follows [AGENTS.md](../../AGENTS.md), [TEAM.md](../../TEAM.md), the FS board, and the [Renvani Figma parity contract](../design/RENVANI_FIGMA_PARITY.md). Use canonical Figma file `jiGHTNUJNltWbHA4Il3hk7` and `packages/db/src/schema.ts`; do not implement old copy, use stale `fsm-schema.ts`, or rename persisted keys from this historical text.

# TICKET-014: Design System + Layout Shell

**Phase:** 2A
**Assigned:** Agent 2 (Frontend Engineer)
**Auditor:** Agent 4 (QA & Standards)
**Priority:** P0 — Every other frontend ticket depends on this.
**Dependencies:** None (first Phase 2 ticket)

---

## Agent Prompts

### Agent 2 — Read This First
You are Agent 2 (Frontend Engineer) on a professional 4-agent engineering
team building ServiceRev — an AI-native Field Service Management SaaS
platform. This is the first frontend ticket. You are building with Next.js 14
App Router, TypeScript, and Tailwind CSS. Before writing any code, read the
design system from Figma using the Figma MCP tool. The file key is
`LNTOsgJ7D4blaFaTepQt3J`. Read the 🎨 Design System page first.

This ticket implements:
1. Design tokens (CSS variables from Figma)
2. The root app shell (sidebar + header)
3. Role-based routing middleware
4. Base layout components

No screen-level UI in this ticket — only the foundation everything else
builds on. Follow all rules in AGENTS.md, CODEX.md, and WORKFLOW.md.
Commit and push to GitHub when complete. Output TASK COMPLETE when done.

### Agent 4 — Read This First
You are Agent 4 (QA & Standards). Run every item in the Agent 4 Audit
Checklist against Agent 2's output. Output TICKET-014 AUDIT: APPROVED
or CHANGES REQUIRED.

---

## Figma Reference

**File:** `figma.com/design/LNTOsgJ7D4blaFaTepQt3J`
**Read these pages:**
- 🎨 Design System — colors, typography, spacing tokens
- 📊 Dashboard — sidebar navigation pattern
- 🔐 Login + Signup — login page layout

**How to read Figma in Codex:**
Use the Figma MCP `get_design_context` tool with:
- `fileKey`: `LNTOsgJ7D4blaFaTepQt3J`
- Navigate to the relevant page and read the node

---

## Objective

Build the complete foundation for the ServiceRev frontend:
design tokens, app shell, sidebar navigation, role-based routing,
and base layout components. When this ticket is complete, any page
can be scaffolded inside the shell with correct navigation and theming.

---

## Acceptance Criteria

- [ ] CSS variables match Figma design tokens exactly
- [ ] Sidebar renders correctly for all 4 roles with correct nav items
- [ ] Role-based middleware redirects on login
- [ ] AppShell component wraps all authenticated pages
- [ ] Mobile layout uses bottom nav (no sidebar) on < 768px
- [ ] Tablet layout uses persistent sidebar on 768px+
- [ ] Dark sidebar with correct active state highlighting
- [ ] `pnpm build` passes clean

---

## Agent 2 Owns

### 1. Install dependencies

Add to `apps/web/package.json`:
```json
{
  "@tanstack/react-query": "^5.0.0",
  "zustand": "^4.5.0",
  "react-hook-form": "^7.51.0",
  "@hookform/resolvers": "^3.3.4",
  "class-variance-authority": "^0.7.0",
  "clsx": "^2.1.0",
  "tailwind-merge": "^2.2.0",
  "framer-motion": "^11.0.0",
  "lucide-react": "^0.368.0",
  "date-fns": "^3.6.0",
  "recharts": "^2.12.0",
  "@dnd-kit/core": "^6.1.0",
  "@dnd-kit/sortable": "^8.0.0"
}
```

### 2. Design tokens
**File:** `apps/web/src/styles/tokens.css`

```css
:root {
  /* Brand */
  --color-brand-primary: #102163;
  --color-brand-accent: #257AFA;
  --color-brand-accent-light: #DEEBff;

  /* Neutral */
  --color-neutral-900: #131521;
  --color-neutral-800: #1E222A;
  --color-neutral-700: #313641;
  --color-neutral-600: #565E6D;
  --color-neutral-500: #7F8897;
  --color-neutral-400: #AFB6C2;
  --color-neutral-300: #D6DAE1;
  --color-neutral-200: #EDEFF2;
  --color-neutral-100: #F6F7F9;

  /* Semantic */
  --color-success: #0FA570;
  --color-success-light: #E0F7EE;
  --color-warning: #F7A91E;
  --color-warning-light: #FEF2DC;
  --color-error: #EF414C;
  --color-error-light: #FDE5E6;

  /* AI */
  --color-ai: #7A37F2;
  --color-ai-light: #EEE0FF;

  /* Sidebar */
  --color-sidebar-bg: #131521;
  --color-sidebar-active: #257AFA;

  /* Spacing */
  --sidebar-width: 220px;
  --header-height: 64px;
}
```

**File:** `apps/web/tailwind.config.ts`

Extend Tailwind with all tokens using CSS variables:
```typescript
colors: {
  brand: {
    primary: 'var(--color-brand-primary)',
    accent: 'var(--color-brand-accent)',
    'accent-light': 'var(--color-brand-accent-light)',
  },
  neutral: {
    900: 'var(--color-neutral-900)',
    // ... all neutrals
  },
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  error: 'var(--color-error)',
  ai: 'var(--color-ai)',
  'ai-light': 'var(--color-ai-light)',
}
```

### 3. Utility functions
**File:** `apps/web/src/lib/utils.ts`

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: string | number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(typeof value === 'string' ? parseFloat(value) : value);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatRelativeTime(date: string | Date): string {
  // returns "2h ago", "3 days ago", etc.
}
```

### 4. Auth + session store
**File:** `apps/web/src/stores/auth.store.ts`

```typescript
interface AuthStore {
  user: AuthUser | null;
  company: Company | null;
  token: string | null;
  setAuth: (user: AuthUser, company: Company, token: string) => void;
  clearAuth: () => void;
}
```

### 5. Role-based middleware
**File:** `apps/web/src/middleware.ts`

```typescript
const ROLE_DEFAULT_ROUTES = {
  owner:       '/dashboard',
  admin:       '/dashboard',
  dispatcher:  '/dispatch',
  technician:  '/mobile/jobs',
};

const PUBLIC_ROUTES = ['/login', '/book', '/estimates', '/pay', '/review'];
```

- Unauthenticated → `/login`
- Wrong role for route → redirect to role's default
- Public routes bypass auth check

### 6. App shell layout
**File:** `apps/web/src/components/layout/AppShell.tsx`

```typescript
interface AppShellProps {
  children: React.ReactNode;
  role: UserRole;
}
```

- Desktop (768px+): fixed sidebar left + scrollable main content
- Mobile (<768px): no sidebar, bottom nav bar (technician routes only)
- Header: 64px tall, white background, border bottom

### 7. Sidebar component
**File:** `apps/web/src/components/layout/Sidebar.tsx`

Nav items per role:

**Owner / Admin:**
```
Dashboard, Dispatch, Customers, Jobs, Estimates,
Invoices, Service Agreements, AI Revenue Center
── GROWTH separator ──
Settings
```

**Dispatcher:**
```
Dispatch, Customers, Jobs, Estimates, Invoices
── separator ──
Settings
```

**Technician:**
Mobile bottom nav only:
```
Home (Today's Jobs), Messages, Profile
```

Design spec:
- Background: `#131521` (Sidebar/Background token)
- Active item: `#257AFA` background, 6px border radius, white text
- Inactive text: `#AFB6C2`
- Logo: "SR" box in blue + "ServiceRev" text
- User avatar + name at bottom

### 8. Header component
**File:** `apps/web/src/components/layout/Header.tsx`

- Company name or page title on left
- Date display on right (owner dashboard)
- Search on dispatch
- User menu on right

### 9. Mobile bottom nav
**File:** `apps/web/src/components/layout/MobileNav.tsx`

Only renders on /mobile/* routes and < 768px:
```
Home | Jobs | Messages | Profile
```
Active tab: blue icon + label + 3px blue top border

### 10. Page layout wrapper
**File:** `apps/web/src/components/layout/PageLayout.tsx`

```typescript
interface PageLayoutProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}
```

Renders the 64px header area with title + subtitle + action buttons
slot, then the children below.

### 11. Base route structure
```
apps/web/src/app/
  layout.tsx              — root layout, QueryClientProvider, font
  (auth)/
    login/page.tsx        — login page (scaffold only)
    layout.tsx            — no shell wrapper
  (app)/
    layout.tsx            — AppShell wrapper
    dashboard/page.tsx    — scaffold (TICKET-015)
    dispatch/page.tsx     — scaffold
    customers/page.tsx    — scaffold
    jobs/page.tsx         — scaffold
    estimates/page.tsx    — scaffold
    invoices/page.tsx     — scaffold
    service-agreements/page.tsx
    ai-revenue-center/page.tsx
    products/page.tsx
    review-requests/page.tsx
    reporting/page.tsx
    settings/
      layout.tsx
      page.tsx
  (mobile)/
    layout.tsx            — mobile layout, bottom nav
    mobile/
      jobs/page.tsx
  (public)/
    book/[slug]/page.tsx  — public booking
    estimates/[token]/page.tsx
    pay/[token]/page.tsx
    review/[token]/page.tsx
```

All page files scaffold with:
```typescript
export default function PageName() {
  return <div>TODO: TICKET-0XX</div>;
}
```

### 12. API client
**File:** `apps/web/src/lib/api.ts`

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options?.headers,
    },
  });
  if (!res.ok) throw new ApiError(res.status, await res.json());
  return res.json();
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) =>
    apiFetch<T>(path, { method: 'DELETE' }),
};
```

---

## Login Page (basic scaffold)
**File:** `apps/web/src/app/(auth)/login/page.tsx`

Read Figma page: 🔐 Login + Signup

Implement the full login page (not a scaffold):
- Split panel: left dark navy brand panel + right white form panel
- Left: "SR" logo, "ServiceRev" name, tagline "Thinner system. Smarter brain."
- Right: Email + password form, Sign In button, "Start free trial" link
- Form validation with react-hook-form + zod
- On submit: POST /api/v1/auth/login → store token → redirect by role
- Error states: wrong credentials, network error

---

## Agent 4 Audit Checklist

- [ ] `pnpm build` passes clean
- [ ] No `any` types
- [ ] CSS variables defined and match Figma tokens exactly
- [ ] Tailwind config extends tokens via CSS variables
- [ ] Sidebar renders correct nav items per role
- [ ] Middleware redirects unauthenticated users to /login
- [ ] Middleware redirects by role to correct default route
- [ ] Public routes bypass auth check
- [ ] AppShell responsive: sidebar on 768px+, hidden on mobile
- [ ] MobileNav renders only on /mobile/* routes
- [ ] Login page fully implemented (not a scaffold)
- [ ] API client handles auth token and errors
- [ ] All page files scaffold with TODO comment
- [ ] Route structure matches PHASE2-MASTER-PLAN.md

---

## Agent 4 Output Format

```
TICKET-014 AUDIT: [APPROVED / CHANGES REQUIRED]

If CHANGES REQUIRED:
  Agent 2:
    File: [path]
    Rule: [rule]
    Fix: [fix]
```

---

## Notes

- Run `pnpm dlx shadcn-ui@latest init` to set up shadcn
- Use `next/font/google` for Inter — do not import from CDN
- The `apps/web` package should already exist from TICKET-001 scaffold
- Git commit: "TICKET-014: Design System + Layout Shell"
