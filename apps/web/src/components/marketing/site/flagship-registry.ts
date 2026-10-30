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
export type ProductPageEntry = FlagshipEntry | ToolEntry;

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
    "fieldImage": "/marketing/flagship/example-job-photo.jpg",
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
    "fieldImage": "/marketing/flagship/illustrative-plumbing-field-use.jpg",
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
    "fieldImage": "/marketing/flagship/example-job-photo.jpg",
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
    "fieldImage": "/marketing/flagship/illustrative-plumbing-field-use.jpg",
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
    "fieldImage": "/marketing/flagship/illustrative-owner-field-use.jpg",
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
  dispatch: "scheduling-dispatch"
};

export function productLinkFor(label: string): string | null {
  const slug = LINK_SLUGS[label.trim().toLowerCase()];
  return slug ? productHref(slug) : null;
}
