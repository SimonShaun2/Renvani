/**
 * One registry for every flagship and product-detail page (Figma jiGHTNUJNltWbHA4Il3hk7, page 171:2 "Current").
 * Routes: /product/<slug>. Illustrations live in flagship-visuals.ts; tool/pill hrefs resolve through PRODUCT_PAGE_LINKS
 * so a label only becomes a link once its page exists (no dead or redirecting links).
 */
type Step = { node: string; title: string; card: string; tools: string[] };
type Handoff = { node: string; suite: string; record: string; title: string; evidence: string };
type Base = { slug: string; name: string; frames: { desktop: string; mobile: string }; eyebrow: string; headline: string; body: string; heroCta: string; heroVisual: string; heroNode: string; flowNode: string; flowHeadline: string; ctaNode: string };
export type FlagshipEntry = Base & { template: "flagship"; steps: Step[]; fieldNode: string; fieldHeadline: string; fieldImage: string | null; fieldCard: string };
export type ToolEntry = Base & { template: "tool"; caption: string; flowEyebrow: string; moments: string[]; ctaEyebrow: string; ctaHeadline: string; handoffNode: string; handoff: Handoff[] };
/** Tool pages whose whole layout comes from the frame trees (FLAGSHIP_TREES); registry only carries routing + metadata. */
export type FramePageEntry = { slug: string; name: string; frames: { desktop: string; mobile: string }; template: "page"; headline: string; body: string };
export type ProductPageEntry = FlagshipEntry | ToolEntry | FramePageEntry;

export const PRODUCT_PAGES: ProductPageEntry[] = [
  {
    "slug": "growth",
    "name": "Growth",
    "frames": {
      "desktop": "175:3",
      "mobile": "175:150"
    },
    "template": "flagship",
    "eyebrow": "GROWTH",
    "headline": "More jobs, booked direct.",
    "body": "Turn website visits into direct booking requests.",
    "heroCta": "See a booking",
    "heroVisual": "growth/hero",
    "heroNode": "203:9152",
    "flowNode": "203:9196",
    "flowHeadline": "From your website to the work.",
    "steps": [
      {
        "node": "234:7268",
        "title": "01 Website visit",
        "card": "growth/step1",
        "tools": [
          "Websites",
          "Job Sources"
        ]
      },
      {
        "node": "234:7295",
        "title": "02 Booking request",
        "card": "growth/step2",
        "tools": [
          "Online Booking"
        ]
      },
      {
        "node": "234:7324",
        "title": "03 Ready for Revenue",
        "card": "growth/step3",
        "tools": [
          "Inquiry Response",
          "Revenue",
          "Dispatch"
        ]
      }
    ],
    "fieldNode": "203:9320",
    "fieldHeadline": "Your name on every booking.",
    "fieldImage": null,
    "fieldCard": "growth/field",
    "ctaNode": "203:9364"
  },
  {
    "slug": "revenue",
    "name": "Revenue",
    "frames": {
      "desktop": "175:291",
      "mobile": "175:437"
    },
    "template": "flagship",
    "eyebrow": "REVENUE",
    "headline": "Turn more inquiries into booked work.",
    "body": "Respond, prepare estimates, and follow up using your prices and rules.",
    "heroCta": "See an estimate",
    "heroVisual": "revenue/hero",
    "heroNode": "203:9621",
    "flowNode": "203:9680",
    "flowHeadline": "From inquiry to approved work.",
    "steps": [
      {
        "node": "234:7535",
        "title": "01 Respond with context",
        "card": "revenue/step1",
        "tools": [
          "Inquiry Response"
        ]
      },
      {
        "node": "234:7567",
        "title": "02 Price the work",
        "card": "revenue/step2",
        "tools": [
          "Price Book",
          "Estimates"
        ]
      },
      {
        "node": "234:7603",
        "title": "03 Hand over the job",
        "card": "revenue/step3",
        "tools": [
          "Jobs & Work Orders",
          "Operations"
        ]
      }
    ],
    "fieldNode": "203:9810",
    "fieldHeadline": "Work worth saying yes to.",
    "fieldImage": null,
    "fieldCard": "revenue/field",
    "ctaNode": "203:9854"
  },
  {
    "slug": "operations",
    "name": "Operations",
    "frames": {
      "desktop": "175:577",
      "mobile": "175:723"
    },
    "template": "flagship",
    "eyebrow": "OPERATIONS",
    "headline": "Keep the whole job moving.",
    "body": "Connect the schedule, the technician, and the completed job.",
    "heroCta": "Tour the workflow",
    "heroVisual": "operations/hero",
    "heroNode": "203:10132",
    "flowNode": "203:10183",
    "flowHeadline": "From approved work to next visit.",
    "steps": [
      {
        "node": "234:7835",
        "title": "01 Assign the approved job",
        "card": "operations/step1",
        "tools": [
          "Jobs & Work Orders",
          "Dispatch"
        ]
      },
      {
        "node": "234:7868",
        "title": "02 Complete the visit",
        "card": "operations/step2",
        "tools": [
          "Technician App",
          "Time & Job Photos"
        ]
      },
      {
        "node": "234:7907",
        "title": "03 Invoice the work",
        "card": "operations/step3",
        "tools": [
          "Invoices & Payments",
          "Retention"
        ]
      }
    ],
    "fieldNode": "203:10330",
    "fieldHeadline": "Built for the work outside.",
    "fieldImage": null,
    "fieldCard": "operations/field",
    "ctaNode": "203:10376"
  },
  {
    "slug": "retention",
    "name": "Retention",
    "frames": {
      "desktop": "175:863",
      "mobile": "175:1009"
    },
    "template": "flagship",
    "eyebrow": "RETENTION",
    "headline": "Make the next visit easier.",
    "body": "Keep maintenance, renewals, and rebooking moving after the first visit.",
    "heroCta": "See the next visit",
    "heroVisual": "retention/hero",
    "heroNode": "203:10665",
    "flowNode": "203:10712",
    "flowHeadline": "From finished job to return visit.",
    "steps": [
      {
        "node": "234:8232",
        "title": "01 Keep the service history",
        "card": "retention/step1",
        "tools": [
          "Jobs & Work Orders",
          "Service Agreements"
        ]
      },
      {
        "node": "234:8266",
        "title": "02 Review the reminder",
        "card": "retention/step2",
        "tools": [
          "Reminders & Win-backs"
        ]
      },
      {
        "node": "234:8298",
        "title": "03 Book the next visit",
        "card": "retention/step3",
        "tools": [
          "Online Booking",
          "Dispatch"
        ]
      }
    ],
    "fieldNode": "203:10837",
    "fieldHeadline": "The relationship outlasts the repair.",
    "fieldImage": null,
    "fieldCard": "retention/field",
    "ctaNode": "203:10883"
  },
  {
    "slug": "command-center",
    "name": "Command Center",
    "frames": {
      "desktop": "175:1149",
      "mobile": "175:1295"
    },
    "template": "flagship",
    "eyebrow": "COMMAND CENTER",
    "headline": "Know what needs you.",
    "body": "See the work, review exceptions, and decide what happens next.",
    "heroCta": "Tour your day",
    "heroVisual": "command-center/hero",
    "heroNode": "203:12248",
    "flowNode": "203:12290",
    "flowHeadline": "Your rules. One shared record.",
    "steps": [
      {
        "node": "234:8506",
        "title": "01 Set the boundaries",
        "card": "command-center/step1",
        "tools": []
      },
      {
        "node": "234:8533",
        "title": "02 Keep the context",
        "card": "command-center/step2",
        "tools": [
          "Customers & Assets",
          "Data Import"
        ]
      },
      {
        "node": "234:8573",
        "title": "03 Trace the work",
        "card": "command-center/step3",
        "tools": [
          "Reporting & Sources",
          "Revenue Intelligence"
        ]
      }
    ],
    "fieldNode": "203:12418",
    "fieldHeadline": "Your business. A clearer view.",
    "fieldImage": null,
    "fieldCard": "command-center/field",
    "ctaNode": "203:12466"
  },
  {
    "slug": "online-booking",
    "name": "Online Booking",
    "frames": {
      "desktop": "175:1436",
      "mobile": "175:1582"
    },
    "template": "tool",
    "eyebrow": "ONLINE BOOKING",
    "headline": "Your next job starts here.",
    "body": "Let customers choose a service and request a real opening.",
    "heroCta": "Try the booking flow",
    "heroVisual": "online-booking/hero",
    "heroNode": "203:8088",
    "flowNode": "203:8133",
    "flowHeadline": "See the work happen.",
    "caption": "EXAMPLE BUSINESS · JUNIPER",
    "flowEyebrow": "EXAMPLE WORKFLOW",
    "moments": [
      "online-booking/moment1",
      "online-booking/moment2",
      "online-booking/moment3"
    ],
    "ctaNode": "203:8214",
    "ctaEyebrow": "WORKS ACROSS YOUR BUSINESS",
    "ctaHeadline": "One job. Connected all the way.",
    "handoffNode": "219:9970",
    "handoff": [
      {
        "node": "219:9981",
        "suite": "Growth",
        "record": "Inquiry #1042",
        "title": "Websites",
        "evidence": "Service selected"
      },
      {
        "node": "219:9995",
        "suite": "Growth",
        "record": "Job #1042 · Jordan Lee",
        "title": "Online booking",
        "evidence": "Visit requested"
      },
      {
        "node": "219:10009",
        "suite": "Operations",
        "record": "Job #1042 · Jordan Lee",
        "title": "Scheduling & dispatch",
        "evidence": "Assigned to Maya"
      }
    ]
  },
  {
    "slug": "estimates-approvals",
    "name": "Estimates & Approvals",
    "frames": {
      "desktop": "175:1722",
      "mobile": "175:1868"
    },
    "template": "tool",
    "eyebrow": "ESTIMATES & APPROVALS",
    "headline": "Your prices. A clear path to yes.",
    "body": "Build from your price book. Review exceptions before customers see them.",
    "heroCta": "See an estimate",
    "heroVisual": "estimates-approvals/hero",
    "heroNode": "203:11146",
    "flowNode": "203:11206",
    "flowHeadline": "See the work happen.",
    "caption": "EXAMPLE BUSINESS · JUNIPER",
    "flowEyebrow": "EXAMPLE WORKFLOW",
    "moments": [
      "estimates-approvals/moment1",
      "estimates-approvals/moment2",
      "estimates-approvals/moment3"
    ],
    "ctaNode": "203:11269",
    "ctaEyebrow": "WORKS ACROSS YOUR BUSINESS",
    "ctaHeadline": "One job. Connected all the way.",
    "handoffNode": "219:10054",
    "handoff": [
      {
        "node": "219:10065",
        "suite": "Operations",
        "record": "Estimate #2048",
        "title": "Price Book & Catalog",
        "evidence": "Your prices applied"
      },
      {
        "node": "219:10079",
        "suite": "Revenue",
        "record": "Estimate #2048",
        "title": "Estimates & approvals",
        "evidence": "Customer accepted"
      },
      {
        "node": "219:10093",
        "suite": "Operations",
        "record": "Job #1042 · Jordan Lee",
        "title": "Jobs & work orders",
        "evidence": "Approved scope received"
      }
    ]
  },
  {
    "slug": "scheduling-dispatch",
    "name": "Scheduling & Dispatch",
    "frames": {
      "desktop": "175:2008",
      "mobile": "175:2154"
    },
    "template": "tool",
    "eyebrow": "SCHEDULING & DISPATCH",
    "headline": "A clear plan for every visit.",
    "body": "Match jobs with technician availability and keep changes visible.",
    "heroCta": "See the schedule",
    "heroVisual": "scheduling-dispatch/hero",
    "heroNode": "203:11425",
    "flowNode": "203:11477",
    "flowHeadline": "See the work happen.",
    "caption": "EXAMPLE BUSINESS · JUNIPER",
    "flowEyebrow": "EXAMPLE WORKFLOW",
    "moments": [
      "scheduling-dispatch/moment1",
      "scheduling-dispatch/moment2",
      "scheduling-dispatch/moment3"
    ],
    "ctaNode": "203:11538",
    "ctaEyebrow": "WORKS ACROSS YOUR BUSINESS",
    "ctaHeadline": "One job. Connected all the way.",
    "handoffNode": "219:10138",
    "handoff": [
      {
        "node": "219:10149",
        "suite": "Revenue",
        "record": "Estimate #2048",
        "title": "Estimates & approvals",
        "evidence": "Scope accepted"
      },
      {
        "node": "219:10163",
        "suite": "Operations",
        "record": "Job #1042 · Jordan Lee",
        "title": "Scheduling & dispatch",
        "evidence": "Visit assigned"
      },
      {
        "node": "219:10177",
        "suite": "Operations",
        "record": "Job #1042 · Jordan Lee",
        "title": "Technician App",
        "evidence": "Details ready for the field"
      }
    ]
  },
  {
    "slug": "technician-app",
    "name": "Technician App",
    "frames": {
      "desktop": "175:2294",
      "mobile": "175:2440"
    },
    "template": "page",
    "headline": "Everything for the job. Right here.",
    "body": "Put equipment, tasks, photos, and job history in the technician’s hand."
  },
  {
    "slug": "invoices-payments",
    "name": "Invoices & Payments",
    "frames": {
      "desktop": "175:2580",
      "mobile": "175:2726"
    },
    "template": "page",
    "headline": "Finish the job. Send the invoice.",
    "body": "Create the invoice from completed work and track payment."
  },
  {
    "slug": "service-agreements",
    "name": "Service Agreements",
    "frames": {
      "desktop": "175:2866",
      "mobile": "175:3012"
    },
    "template": "page",
    "headline": "Turn today’s visit into a relationship.",
    "body": "Keep covered visits, agreement terms, and upcoming renewals together."
  },
  {
    "slug": "ai-revenue-intelligence",
    "name": "AI Revenue Intelligence",
    "frames": {
      "desktop": "175:3152",
      "mobile": "175:3298"
    },
    "template": "page",
    "headline": "See the next opportunity in your records.",
    "body": "Review open opportunities and choose the next action using your own records."
  },
  {
    "slug": "customers-properties-assets",
    "name": "Customers, Properties & Assets",
    "frames": {
      "desktop": "175:3438",
      "mobile": "175:3584"
    },
    "template": "page",
    "headline": "Know the home before you arrive.",
    "body": "Bring each customer, property, equipment record, and service visit together."
  },
  {
    "slug": "onboarding-data-import",
    "name": "Onboarding & Data Import",
    "frames": {
      "desktop": "175:4010",
      "mobile": "175:4156"
    },
    "template": "page",
    "headline": "Bring the business you’ve already built.",
    "body": "Upload your export, review the mapping, and check what comes across."
  },
  {
    "slug": "inquiry-response-follow-up",
    "name": "Inquiry Response & Follow-up",
    "frames": {
      "desktop": "215:6308",
      "mobile": "215:6309"
    },
    "template": "page",
    "headline": "Respond while the opportunity is fresh.",
    "body": "Review every reply and keep follow-up connected to the inquiry."
  },
  {
    "slug": "jobs-work-orders",
    "name": "Jobs & Work Orders",
    "frames": {
      "desktop": "215:6310",
      "mobile": "215:6311"
    },
    "template": "page",
    "headline": "One job. Every detail.",
    "body": "Keep the approved work, crew, tasks, and files together."
  },
  {
    "slug": "time-tracking-job-photos",
    "name": "Time Tracking & Job Photos",
    "frames": {
      "desktop": "215:6312",
      "mobile": "215:6313"
    },
    "template": "page",
    "headline": "Show the work behind the job.",
    "body": "Keep time entries and job photos attached to the visit."
  },
  {
    "slug": "reminders-win-backs",
    "name": "Reminders & Win-backs",
    "frames": {
      "desktop": "215:6314",
      "mobile": "215:6315"
    },
    "template": "page",
    "headline": "Give good customers a reason to return.",
    "body": "Review consented reminders and make the next visit easy to request."
  },
  {
    "slug": "reporting-job-sources",
    "name": "Reporting & Job Sources",
    "frames": {
      "desktop": "215:6316",
      "mobile": "215:6317"
    },
    "template": "page",
    "headline": "See where the work comes from.",
    "body": "Follow recorded sources from the booking to the paid invoice."
  },
  {
    "slug": "websites",
    "name": "Websites",
    "frames": {
      "desktop": "216:6308",
      "mobile": "216:6309"
    },
    "template": "page",
    "headline": "Your business. Your own website.",
    "body": "Show your services, earn trust, and turn local visits into service requests."
  },
  {
    "slug": "price-book-service-catalog",
    "name": "Price Book & Service Catalog",
    "frames": {
      "desktop": "216:6310",
      "mobile": "216:6311"
    },
    "template": "page",
    "headline": "One price book. Connected work.",
    "body": "Use your services, labor, and materials across estimates and jobs."
  },
  {
    "slug": "customer-portal",
    "name": "Customer Portal",
    "frames": {
      "desktop": "216:6312",
      "mobile": "216:6313"
    },
    "template": "page",
    "headline": "Give customers a clearer next step.",
    "body": "Preview visits, approved estimates, payments, and reschedule requests in one place."
  }
];

export const PRODUCT_PAGE_BY_SLUG: Record<string, ProductPageEntry> = Object.fromEntries(PRODUCT_PAGES.map((p) => [p.slug, p]));

export const productHref = (slug: string) => `/product/${slug}`;

/** Label (as written in the frames, case-insensitive) -> built page. Anything not listed renders as plain text. */
const LINK_SLUGS: Record<string, string> = {
  growth: "growth",
  revenue: "revenue",
  operations: "operations",
  retention: "retention",
  "command center": "command-center",
  "online booking": "online-booking",
  "online booking →": "online-booking",
  "estimates & approvals": "estimates-approvals",
  "estimates & approvals →": "estimates-approvals",
  estimates: "estimates-approvals",
  "scheduling & dispatch": "scheduling-dispatch",
  "scheduling & dispatch →": "scheduling-dispatch",
  dispatch: "scheduling-dispatch",
  "websites": "websites",
  "website": "websites",
  "inquiry response & follow-up": "inquiry-response-follow-up",
  "inquiry response": "inquiry-response-follow-up",
  "jobs & work orders": "jobs-work-orders",
  "technician app": "technician-app",
  "technician app & on-the-way": "technician-app",
  "invoices & payments": "invoices-payments",
  "payments": "invoices-payments",
  "customer portal": "customer-portal",
  "customer portal · preview": "customer-portal",
  "price book & service catalog": "price-book-service-catalog",
  "price book": "price-book-service-catalog",
  "time tracking & job photos": "time-tracking-job-photos",
  "time & job photos": "time-tracking-job-photos",
  "service agreements": "service-agreements",
  "reminders & win-backs": "reminders-win-backs",
  "reporting & job sources": "reporting-job-sources",
  "reporting & sources": "reporting-job-sources",
  "job sources": "reporting-job-sources",
  "customers, properties & assets": "customers-properties-assets",
  "customers & assets": "customers-properties-assets",
  "onboarding & data import": "onboarding-data-import",
  "data import": "onboarding-data-import",
  "ai revenue intelligence": "ai-revenue-intelligence",
  "revenue intelligence": "ai-revenue-intelligence",
  "inquiry & follow-up": "inquiry-response-follow-up",
  jobs: "jobs-work-orders",
  "time & photos": "time-tracking-job-photos",
  "reminder emails": "reminders-win-backs"
};

export function productLinkFor(label: string): string | null {
  const slug = LINK_SLUGS[label.trim().replace(/\s*→$/, "").toLowerCase()];
  return slug ? productHref(slug) : null;
}
