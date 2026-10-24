export const MARKETING_BRAND = {
  name: "Renvani",
  tagline: "Grow your shop. Renvani runs the rest.",
  domain: "getrenvani.com"
} as const;

export const MARKETING_NAV_LINKS = [
  { label: "Why Renvani", href: "#why" },
  { label: "Features", href: "#features" },
  { label: "Switching", href: "#switching" },
  { label: "Get started", href: "#get-started" }
] as const;

export const HERO_COPY = {
  headline: "Grow your shop. Renvani runs the rest.",
  subhead:
    "AI that books, follows up and brings customers back. Dispatch, invoicing and QuickBooks sync run behind it.",
  primaryCta: "Get started",
  secondaryCta: "Book a demo"
} as const;

export const PILLARS = [
  {
    step: "01",
    title: "More booked jobs",
    body: "The Renvani Agent answers requests, books jobs and follows up by email. More channels coming."
  },
  {
    step: "02",
    title: "More repeat revenue",
    body: "Follow-ups, reminders and maintenance-plan outreach bring customers back."
  },
  {
    step: "03",
    title: "Room to grow",
    body: "Dispatch, scheduling and invoicing keep up in the background as you add techs and trucks. QuickBooks sync with no double entry."
  }
] as const;

export const FEATURE_TILES = [
  { title: "Online booking", description: "Customers book from your own booking page." },
  { title: "Automated follow-ups", description: "Email follow-ups on estimates and finished jobs." },
  { title: "Customer 360", description: "Every job, invoice, and conversation in one place." },
  { title: "Dispatch board", description: "Schedule and assign jobs to your techs." },
  { title: "Mobile tech app", description: "Quotes, photos, and payment from the truck." },
  { title: "Invoicing & payments", description: "Send invoices and take card payments." },
  { title: "QuickBooks sync", description: "Automatic sync, no double entry." },
  { title: "Permissions", description: "Role-based access for owners and crews." }
] as const;

export const SWITCHING_COPY = {
  headline: "Switching won't stall you.",
  body: "Bring your exports from any field-service tool. Assisted migration with your history, and saved cards move into Stripe."
} as const;

export const FOOTER_COLUMNS = [
  { title: "Product", links: ["Booking", "Dispatch", "Mobile", "Invoicing"] },
  { title: "Solutions", links: ["HVAC", "Plumbing", "Electrical", "Multi-trade"] },
  { title: "Company", links: ["About", "Contact"] }
] as const;

export const MARKETING_META = {
  title: "Renvani — Grow your shop. Renvani runs the rest.",
  description:
    "Renvani books jobs, follows up and brings customers back for HVAC, plumbing, and electrical shops, with dispatch, invoicing and QuickBooks sync running behind it."
} as const;
