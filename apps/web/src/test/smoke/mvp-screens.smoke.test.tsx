/**
 * MVP P0 web smoke: each screen on dev renders loading / empty / error / data with the API mocked.
 * Known gaps are marked it.todo (screen not on dev yet, or missing error state); see PR body.
 */
import { cleanup, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithClient, resolveMock, type RouteTable, type SmokeMode } from "./harness";

const m = vi.hoisted(() => ({ mode: "empty" as string, routes: {} as Record<string, { empty: unknown; data: unknown }> }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/"
}));
// happy-dom cancels framer-motion WAAPI animations on unmount; render motion.* as plain elements.
vi.mock("framer-motion", async () => {
  const React = await import("react");
  const MOTION_PROPS = ["initial", "animate", "exit", "transition", "layout", "whileHover", "whileTap", "variants"];
  const strip = (props: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(props).filter(([key]) => !MOTION_PROPS.includes(key)));
  const motion = new Proxy({}, { get: (_t, tag: string) => React.forwardRef((props: Record<string, unknown>, ref) => React.createElement(tag, { ...strip(props), ref })) });
  return { motion, AnimatePresence: ({ children }: { children: unknown }) => children, useReducedMotion: () => true };
});
vi.mock("@/src/lib/api", async (orig) => {
  const actual = await orig<typeof import("@/src/lib/api")>();
  const get = (path: string) => resolveMock(m.routes as RouteTable, m.mode as SmokeMode, path);
  return { ...actual, api: { get, post: get, patch: get, put: get, delete: get } };
});

import { CustomerTable } from "@/src/components/customers/CustomerTable";
import { DispatchBoardClient } from "@/src/components/dispatch/DispatchBoardClient";
import { EstimateListClient } from "@/src/components/estimates/EstimateListClient";
import { InvoiceListClient } from "@/src/components/invoices/InvoiceListClient";
import { ReportingDashboardClient } from "@/src/components/reporting/ReportingDashboardClient";

const page = <T,>(data: T[]) => ({ data, total: data.length, page: 1, limit: 25, totalPages: 1 });
const cust = { id: "c1", firstName: "Dana", lastName: "Smoke" };
const now = "2026-10-27T15:00:00.000Z";

const ROUTES: Record<string, RouteTable> = {
  dispatch: {
    "/api/v1/dispatch": {
      empty: { date: "2026-10-27", technicians: [], nextBestJobs: [] },
      data: {
        date: "2026-10-27",
        technicians: [
          {
            id: "t1", name: "Tess Tech", avatarUrl: null, serviceAreaIds: [], serviceZipCodes: [], utilization: 0.5,
            hoursAvailable: 8, hoursScheduled: 4, gaps: [],
            jobs: [{ id: "j1", jobNumber: "J-1", title: "AC tune-up", status: "scheduled", scheduledStart: now,
              scheduledEnd: "2026-10-27T16:00:00.000Z", customer: cust, property: null, estimatedValue: "100.00" }]
          }
        ],
        nextBestJobs: []
      }
    },
    "/api/v1/jobs/unscheduled": { empty: { jobs: [] }, data: { jobs: [] } },
    "/api/v1/estimates/approved-unconverted": { empty: { estimates: [] }, data: { estimates: [] } },
    "/api/v1/booking-requests": { empty: page([]), data: page([]) }
  },
  customers: {
    "/api/v1/customers": {
      empty: page([]),
      data: page([{ ...cust, displayName: null, email: null, phone: null, tags: [], lifetimeValue: "0.00", totalJobs: 1, lastServiceDate: null, doNotContact: false, createdAt: now }])
    },
    "/api/v1/service-agreements": { empty: page([]), data: page([]) },
    "/api/v1/invoices": { empty: page([]), data: page([]) }
  },
  estimates: {
    "/api/v1/estimates": {
      empty: page([]),
      data: page([{ id: "e1", estimateNumber: "EST-1", title: "Smoke furnace", status: "draft", tierLabel: null, tierGroupId: null, total: "250.00", subtotal: "250.00", customer: cust, sentAt: null, expiresAt: null, approvedAt: null, declinedAt: null, createdAt: now }])
    }
  },
  invoices: {
    "/api/v1/invoices": {
      empty: page([]),
      data: page([{ id: "i1", invoiceNumber: "INV-1", title: "Smoke repair", status: "sent", total: "300.00", amountPaid: "0.00", balanceDue: "300.00", dueAt: null, paidAt: null, customer: cust, createdAt: now }])
    },
    "/api/v1/customers": { empty: page([]), data: page([]) },
    "/api/v1/estimates": { empty: page([]), data: page([]) }
  },
  reporting: {
    "/api/v1/reporting/job-sources": {
      empty: {
        period: { startDate: "2026-10-01", endDate: "2026-10-31", timeZone: "America/Chicago", dateInterpretation: "job_created_at" },
        totals: { bookedJobCount: 0, revenue: "0.00", unknownAttributionCount: 0, unknownAttributionDefinition: "No source" },
        channels: []
      },
      data: {
        period: { startDate: "2026-10-01", endDate: "2026-10-31", timeZone: "America/Chicago", dateInterpretation: "job_created_at" },
        totals: { bookedJobCount: 7, revenue: "1234.00", unknownAttributionCount: 0, unknownAttributionDefinition: "No source" },
        channels: []
      }
    }
  }
};

type Case = {
  name: string;
  Comp: ComponentType;
  routes: RouteTable;
  empty: RegExp;
  data: RegExp;
  error?: RegExp;
};

const CASES: Case[] = [
  { name: "dispatch", Comp: DispatchBoardClient, routes: ROUTES.dispatch!, empty: /No smart queue items/, data: /Tess Tech/ },
  { name: "customers/CRM", Comp: CustomerTable, routes: ROUTES.customers!, empty: /No customers match this view/, data: /Dana Smoke/, error: /Customer records could not be loaded/ },
  { name: "estimates", Comp: EstimateListClient, routes: ROUTES.estimates!, empty: /No estimates match this view/, data: /EST-1/ },
  { name: "invoices", Comp: InvoiceListClient, routes: ROUTES.invoices!, empty: /No invoices match this view/, data: /INV-1/ },
  { name: "reports", Comp: ReportingDashboardClient, routes: ROUTES.reporting!, empty: /No recent activity/, data: /\$1234\.00/, error: /Unable to load job source summary/ }
];

async function renderIn(mode: SmokeMode, c: Case) {
  m.mode = mode;
  m.routes = c.routes;
  const utils = renderWithClient(<c.Comp />);
  await new Promise((resolve) => setTimeout(resolve, 100));
  return utils;
}

afterEach(() => cleanup());

describe.each(CASES)("MVP smoke: $name", (c) => {
  it("loading: renders without empty or data content", async () => {
    await renderIn("loading", c);
    expect(document.body.textContent ?? "").not.toMatch(c.empty);
    expect(document.body.textContent ?? "").not.toMatch(c.data);
  });

  it("empty: shows the empty state", async () => {
    await renderIn("empty", c);
    expect((await screen.findAllByText(c.empty)).length).toBeGreaterThan(0);
  });

  it("data: shows mocked records", async () => {
    await renderIn("data", c);
    expect((await screen.findAllByText(c.data)).length).toBeGreaterThan(0);
  });

  if (c.error) {
    it("error: shows an error message", async () => {
      await renderIn("error", c);
      expect((await screen.findAllByText(c.error!)).length).toBeGreaterThan(0);
    });
  } else {
    it("error: renders without crashing (no dedicated error state)", async () => {
      await renderIn("error", c);
      expect(document.body.textContent ?? "").not.toMatch(c.data);
    });
    it.todo(`error: ${c.name} should show an error message instead of the empty state (app gap)`);
  }
});

describe("MVP smoke: screens not on dev yet", () => {
  it.todo("jobs list/work orders: /jobs is ScaffoldPage on dev (PR #206)");
  it.todo("payments: /payments page not on dev (PR #208)");
  it.todo("reports import reconciliation section not on dev (PR #210)");
  it.todo("migrate saved-card consent step not on dev (feat/web-saved-card-consent, waits on #160 API)");
});
