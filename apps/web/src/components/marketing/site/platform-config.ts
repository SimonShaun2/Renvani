/** Products (176:204 / 176:313) and How it works (176:585 / 176:664) config. Figma jiGHTNUJNltWbHA4Il3hk7, page 171:2. */

/** A tool link. `href: null` = the tool's page is not built yet; it renders as text, never as a dead or redirecting link. */
export type ToolLink = { label: string; href: string | null };

export const FLAGSHIP_HREF = {
  growth: "/product/growth",
  revenue: "/product/revenue",
  operations: "/product/operations",
  retention: "/product/retention",
  commandCenter: "/product/command-center"
} as const;

export const PLATFORM = {
  command: {
    title: "Command Center",
    eyebrow: "YOUR RULES ACROSS THE WORK",
    rules: [
      { label: "Scope changes", value: "Require approval" },
      { label: "Discount limit", value: "10%" },
      { label: "Customer emails", value: "Review drafts" }
    ],
    open: { label: "Open owner view →", href: FLAGSHIP_HREF.commandCenter }
  },
  flagships: {
    growth: { title: "Growth", href: FLAGSHIP_HREF.growth, tools: [{ label: "Website →", href: null }, { label: "Online Booking →", href: null }] },
    revenue: { title: "Revenue", href: FLAGSHIP_HREF.revenue, tools: [{ label: "Price Book →", href: null }, { label: "Estimates & Approvals →", href: null }] },
    operations: { title: "Operations", href: FLAGSHIP_HREF.operations, tools: [{ label: "Scheduling & Dispatch →", href: null }, { label: "Technician App →", href: null }, { label: "Payments →", href: null }] },
    retention: { title: "Retention", href: FLAGSHIP_HREF.retention, tools: [{ label: "Service Agreements →", href: null }, { label: "Reminders & Win-backs →", href: null }] }
  },
  record: { eyebrow: "ONE CONNECTED RECORD", items: ["Jordan Lee", "Job #1042", "Property + equipment", "Visit history"] },
  caption: "Illustrative job · Example data"
} as const satisfies Record<string, unknown>;

export type ToolGroup = { key: string; title: string; href: string; tagline: string; tools: ToolLink[] };

const t = (label: string): ToolLink => ({ label, href: null });

export const TOOL_GROUPS: { left: ToolGroup[]; right: ToolGroup[] } = {
  left: [
    { key: "growth", title: "Growth", href: FLAGSHIP_HREF.growth, tagline: "Get found. Get booked.", tools: [t("Websites →"), t("Online Booking →"), t("Job Source Reporting →"), t("Local Search · Preview →")] },
    {
      key: "operations",
      title: "Operations",
      href: FLAGSHIP_HREF.operations,
      tagline: "Deliver the work. Get paid.",
      tools: [
        t("Scheduling & Dispatch →"),
        t("Jobs & Work Orders →"),
        t("Technician App & On-the-Way →"),
        t("Invoices & Payments →"),
        t("Customer Portal · Preview →"),
        t("Price Book & Service Catalog →"),
        t("Time Tracking & Job Photos →")
      ]
    }
  ],
  right: [
    { key: "revenue", title: "Revenue", href: FLAGSHIP_HREF.revenue, tagline: "Turn an inquiry into approved work.", tools: [t("Inquiry Response & Follow-up →"), t("Estimates & Approvals →")] },
    { key: "retention", title: "Retention", href: FLAGSHIP_HREF.retention, tagline: "Make the next visit happen.", tools: [t("Service Agreements →"), t("Reminders & Win-backs →")] },
    {
      key: "command-center",
      title: "Command Center",
      href: FLAGSHIP_HREF.commandCenter,
      tagline: "See the work. Set the rules.",
      tools: [t("Owner App & Approval Rules →"), t("Reporting & Job Sources →"), t("Customers, Properties & Assets →"), t("Onboarding & Data Import →"), t("AI Revenue Intelligence →")]
    }
  ]
};

export const PRODUCTS_PAGE = {
  meta: { title: "Products · Renvani", description: "Five connected products for HVAC, plumbing and electrical businesses: Growth, Revenue, Operations, Retention and Command Center." },
  eyebrow: "THE RENVANI PLATFORM",
  headline: ["Five products.", "Every part of the job."],
  primary: { label: "See how it all works", href: "/how-it-works" },
  secondary: { label: "Find your next tool ↓", href: "#tools" },
  toolsEyebrow: "THE TOOLS BEHIND THE WORK",
  toolsHeadline: "Find your next tool.",
  cta: { headline: "See your business in Renvani.", primary: { label: "Get a free demo", href: "/signup" }, secondary: { label: "See the initial industries →", href: null as string | null } }
};

export const HOW_PAGE = {
  meta: { title: "How it works · Renvani", description: "One business, every handoff connected: from the first booking to the next tune-up, for HVAC, plumbing and electrical work." },
  eyebrow: "HOW RENVANI WORKS",
  headline: ["One business.", "Every handoff connected."],
  body: "Five products. The tools to move every job forward.",
  primary: { label: "Watch a job from start to finish", href: "/product-tour" },
  secondary: { label: "Explore the tools →", href: "/product#tools" },
  tradesHeadline: ["Your work.", "One connected flow."],
  trades: [
    { eyebrow: "HVAC", title: "No heat. Approved repair. Next tune-up.", image: "/marketing/home/hvac-tech.jpg", link: { label: "See the full workflow →", href: "/industries/hvac" as string | null } },
    { eyebrow: "PLUMBING", title: "A leak. A repair. A customer for next time.", image: "/marketing/home/plumbing-work.jpg", link: { label: "See the full workflow →", href: null as string | null } }
  ],
  cta: { headline: "See your business in Renvani.", primary: { label: "Get a free demo", href: "/signup" }, secondary: { label: "Bring your existing records →", href: null as string | null } }
};
