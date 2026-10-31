/** Marketing website config. Figma jiGHTNUJNltWbHA4Il3hk7, section "11 Website" (171:2), Home / Desktop 171:3. */

import { productLinkFor } from "./flagship-registry";

export type SiteLink = { label: string; href: string };

export const SITE_NAV: { links: SiteLink[]; cta: SiteLink } = {
  links: [
    { label: "Products", href: "/product" },
    { label: "Industries", href: "/industries" },
    { label: "How it works", href: "/how-it-works" },
    { label: "Pricing", href: "/pricing" }
  ],
  cta: { label: "Get a free demo", href: "/demo" }
};

export const SITE_FOOTER = {
  links: [
    { label: "Products", href: "/product" },
    { label: "Industries", href: "/industries" },
    { label: "Pricing", href: "/pricing" },
    { label: "Get a free demo", href: "/demo" }
  ] satisfies SiteLink[],
  copyright: `© ${new Date().getFullYear()} Renvani`
};

export const HOME_META = {
  title: "Renvani — More direct jobs. More repeat customers.",
  description:
    "Website booking, job details and repeat-visit reminders for HVAC, plumbing and electrical businesses. Win the job. Run the work. Bring customers back."
};

export const GROWTH_CHECK_ENTRY = {
  label: "START WITH YOUR WEBSITE",
  placeholder: "yourbusiness.com",
  submit: "Get my growth report",
  /** The website is carried into the Growth Check request (/growth-check?website=…). */
  action: "/growth-check",
  secondary: { label: "Or see the product in action →", href: "/product-tour" }
};

export const HOME = {
  hero: {
    eyebrow: "FOR HOME & FIELD SERVICE BUSINESSES",
    headline: "More direct jobs.",
    accent: ["More repeat", "customers."],
    body: "Win the job. Run the work. Bring customers back.",
    caption: "Illustrative workflow · Example business and data"
  },
  site: {
    business: "Juniper",
    trade: "Heating & Plumbing",
    tagline: "Comfort starts at home.",
    area: "Tulsa + surrounding areas",
    services: [
      { name: "AC tune-up", price: "$89", selected: true },
      { name: "Plumbing diagnostic", price: "$99", selected: false }
    ],
    /** Non-date label (no fixed calendar date in the example). */
    day: "Next available day",
    slots: ["10:00–12:00", "14:00–16:00"],
    action: "Request this visit",
    /** Mobile-only compact booking preview (Figma 219:9474). */
    mobile: { service: { name: "AC diagnostic", price: "$89" } }
  },
  trades: {
    eyebrow: "BUILT AROUND YOUR WORK",
    links: [
      { label: "HVAC →", href: "/industries/hvac" },
      { label: "Plumbing →", href: "/industries/plumbing" },
      { label: "Electrical →", href: "/industries/electrical" }
    ]
  },
  journey: {
    headline: ["The first click is", "just the beginning."],
    more: { label: "Watch the whole workflow →", href: "/product-tour" }
  },
  /** Mobile-only focused opportunity (Figma 253:6779 "Website / Focused opportunity / Mobile"). */
  intelligenceMobile: {
    header: "Revenue opportunity",
    status: "Example",
    title: "Estimate #2063",
    meta: "Morgan Reed · Furnace tune-up",
    whyLabel: "Why this surfaced",
    why: "Sent 4 days ago · no reply recorded",
    review: "Owner review required",
    action: "Review email draft",
    link: "Open estimate →"
  },
  intelligence: {
    eyebrow: "YOUR RECORDS. YOUR NEXT MOVE.",
    headline: ["Good work", "creates more work."],
    body: "See the opportunity. Review the reason. Choose the action.",
    cta: { label: "Explore revenue intelligence", href: "/product/revenue" },
    stats: [
      { value: "8", label: "Booked jobs" },
      { value: "3", label: "In progress" },
      { value: "2", label: "Need your review" }
    ],
    decision: {
      title: "Open estimate worth a follow-up",
      status: "REVIEW",
      detail: "Estimate #2048 · Sent 4 days ago · No reply recorded",
      actions: ["Review email draft", "Edit", "Snooze"]
    },
    areas: [
      { label: "Growth →", href: "/product/growth" },
      { label: "Revenue →", href: "/product/revenue" },
      { label: "Operations →", href: "/product/operations" },
      { label: "Retention →", href: "/product/retention" },
      { label: "Command Center →", href: "/product/command-center" }
    ]
  },
  work: {
    headline: ["Built around", "the work you do."],
    trades: [
      { eyebrow: "HVAC", title: "From no heat to job complete.", image: "/marketing/home/hvac-tech.jpg", href: "/industries/hvac" },
      { eyebrow: "PLUMBING", title: "Keep good jobs flowing.", image: "/marketing/home/plumbing-work.jpg", href: "/industries/plumbing" }
    ]
  },
  capture: {
    eyebrow: "YOUR NEXT STEP",
    headline: ["See what your website", "could do better."],
    body: "A few clear opportunities. A useful place to start."
  }
} as const;

const p = (slug: string) => `/product/${slug}`;
/** Header products menu (177:640). Items link to their built page via productLinkFor; `null` = no frame/page (plain text). */
export const PRODUCTS_MENU = {
  headline: "Five products. One connected business.",
  all: { label: "All products", href: "/product" },
  cta: { label: "Get a free demo", href: "/demo" },
  groups: [
    { title: "Growth", href: p("growth"), items: [{ label: "Websites", href: productLinkFor("Websites") }, { label: "Online Booking", href: p("online-booking") }] },
    { title: "Revenue", href: p("revenue"), items: [{ label: "Inquiry Response & Follow-up", href: productLinkFor("Inquiry Response & Follow-up") }, { label: "Estimates & Approvals", href: p("estimates-approvals") }] },
    {
      title: "Operations",
      href: p("operations"),
      items: [
        { label: "Scheduling & Dispatch", href: p("scheduling-dispatch") },
        { label: "Jobs & Work Orders", href: productLinkFor("Jobs & Work Orders") },
        { label: "Technician App", href: productLinkFor("Technician App") },
        { label: "Invoices & Payments", href: productLinkFor("Invoices & Payments") },
        { label: "Customer Portal · Preview", href: productLinkFor("Customer Portal · Preview") },
        { label: "Price Book & Service Catalog", href: productLinkFor("Price Book & Service Catalog") },
        { label: "Time Tracking & Job Photos", href: productLinkFor("Time Tracking & Job Photos") }
      ]
    },
    { title: "Retention", href: p("retention"), items: [{ label: "Service Agreements", href: productLinkFor("Service Agreements") }, { label: "Reminders & Win-backs", href: productLinkFor("Reminders & Win-backs") }] },
    {
      title: "Command Center",
      href: p("command-center"),
      items: [
        { label: "Reporting & Job Sources", href: productLinkFor("Reporting & Job Sources") },
        { label: "Customers, Properties & Assets", href: productLinkFor("Customers, Properties & Assets") },
        { label: "Onboarding & Data Import", href: productLinkFor("Onboarding & Data Import") },
        { label: "AI Revenue Intelligence", href: productLinkFor("AI Revenue Intelligence") }
      ]
    }
  ] as { title: string; href: string; items: { label: string; href: string | null }[] }[]
};
