/**
 * Marketing content module.
 *
 * Shaped for a later Webflow CMS fetch (field names TBD). For now every value
 * is a placeholder that matches Figma file jiGHTNUJNltWbHA4Il3hk7, page
 * "09 Product Visuals" (124:109). Swap `getMarketingContent` for a CMS fetch
 * and map the CMS fields onto these types; components read only these types.
 */

export type ChipKind = "agent" | "team" | "owner";

export type VisualRow = {
  title: string;
  meta: string;
  chip?: ChipKind;
};

export type VisualCard = {
  title: string;
  detail: string;
  chip: ChipKind;
  /** Card A on Revenue / Command Center carries the Approve button. */
  actionLabel?: string;
};

export type VisualCounter = {
  value: number;
  format: "currency" | "integer";
  label: string;
};

export type ProductVisualContent = {
  slug: "home" | "growth" | "revenue" | "operations" | "retention" | "command-center" | "hvac";
  eyebrow: string;
  heading: string;
  body: string;
  panelTitle?: string;
  rows: [VisualRow, VisualRow, VisualRow];
  cardA: VisualCard;
  cardB: VisualCard;
  counter: VisualCounter;
  /** Revenue and Command Center play the Approve click-through. */
  clickThrough: boolean;
  /** Optional CMS image; when absent the coded visual is shown. */
  imageUrl?: string;
};

export type PricingPlan = {
  id: "flex" | "flat" | "founding" | "startup";
  name: string;
  monthlyPrice: number;
  blurb: string;
};

export type MarketingContent = {
  visuals: ProductVisualContent[];
  plans: PricingPlan[];
  pricing: { heading: string; annualNote: string };
};

export const CHIP_LABELS: Record<ChipKind, string> = {
  agent: "Handled by agent",
  team: "Completed by team",
  owner: "Awaiting owner approval"
};

/** Annual billing is 2 months free: 10 x the monthly price. */
export const ANNUAL_MONTHS_BILLED = 10;

export function annualPrice(monthlyPrice: number): number {
  return monthlyPrice * ANNUAL_MONTHS_BILLED;
}

export function formatUsd(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

export function formatCounter(value: number, format: VisualCounter["format"]): string {
  const whole = Math.round(value);
  return format === "currency" ? formatUsd(whole) : whole.toLocaleString("en-US");
}

export const PLACEHOLDER_CONTENT: MarketingContent = {
  visuals: [
    {
      slug: "home",
      eyebrow: "Renvani",
      heading: "Grow your shop. Renvani runs the rest.",
      body: "The Renvani Agent books jobs, follows up and brings customers back while dispatch and invoicing run behind it.",
      rows: [
        { title: "New request · Furnace tune-up", meta: "Booked 11:42 PM", chip: "agent" },
        { title: "Estimate · AC replacement", meta: "Sent", chip: "agent" },
        { title: "First job → VIP member", meta: "Summit Comfort Club", chip: "team" }
      ],
      cardA: { title: "Booked while you slept", detail: "Furnace tune-up · Thu 9:00 AM", chip: "agent" },
      cardB: { title: "Customer journey", detail: "First job → Estimate → Paid → VIP", chip: "team" },
      counter: { value: 1240, format: "currency", label: "booked overnight" },
      clickThrough: false
    },
    {
      slug: "growth",
      eyebrow: "Growth",
      heading: "More booked jobs",
      body: "Online booking and automatic follow-ups fill the calendar.",
      panelTitle: "Online booking · summitheatingair.example",
      rows: [
        { title: "Furnace tune-up", meta: "Thu 9:00 AM · Booked", chip: "agent" },
        { title: "AC check", meta: "Fri 1:00 PM · Open" },
        { title: "Duct cleaning", meta: "Sat 10:00 AM · Open" }
      ],
      cardA: { title: "Booked while you slept", detail: "Online booking at 11:42 PM", chip: "agent" },
      cardB: { title: "Review request sent automatically", detail: "Emailed after the job closed", chip: "agent" },
      counter: { value: 12, format: "integer", label: "new bookings this month" },
      clickThrough: false
    },
    {
      slug: "revenue",
      eyebrow: "Revenue",
      heading: "Estimates that get approved",
      body: "Estimates, invoices and reminders move on their own. You approve what matters.",
      panelTitle: "Approvals inbox",
      rows: [
        { title: "Estimate · AC replacement", meta: "$8,400 · Ready", chip: "owner" },
        { title: "Invoice #1042", meta: "$425 · Paid online", chip: "team" },
        { title: "Follow-up email", meta: "Estimate reminder queued", chip: "agent" }
      ],
      cardA: { title: "Approve estimate?", detail: "AC replacement · $8,400", chip: "owner", actionLabel: "Approve" },
      cardB: { title: "Invoice paid online", detail: "$425 · Paid online by card", chip: "team" },
      counter: { value: 8400, format: "currency", label: "estimate ready to approve" },
      clickThrough: true
    },
    {
      slug: "operations",
      eyebrow: "Operations",
      heading: "Dispatch that keeps up",
      body: "Jobs land on the board, techs get their day, and nothing waits on you.",
      panelTitle: "Dispatch board · Today",
      rows: [
        { title: "Marco · HVAC tech", meta: "3 jobs · next 2:00 PM", chip: "agent" },
        { title: "Dana · HVAC tech", meta: "4 jobs · on site", chip: "team" },
        { title: "Unassigned", meta: "1 job · needs a slot", chip: "owner" }
      ],
      cardA: { title: "Job auto-scheduled", detail: "Marco · 2:00 PM · no-heat repair", chip: "agent" },
      cardB: { title: "Job completed", detail: "Photos and notes attached", chip: "team" },
      counter: { value: 14, format: "integer", label: "jobs dispatched today" },
      clickThrough: false
    },
    {
      slug: "retention",
      eyebrow: "Retention",
      heading: "Customers who come back",
      body: "Memberships, renewals and reminders keep repeat work on the calendar.",
      panelTitle: "Summit Comfort Club · Members",
      rows: [
        { title: "R. Alvarez", meta: "Renews Nov 2 · Reminder sent", chip: "agent" },
        { title: "J. Chen", meta: "Spring tune-up booked", chip: "team" },
        { title: "M. Patel", meta: "Paused · resumes Jan" }
      ],
      cardA: { title: "Renewal reminder emailed", detail: "30 days before renewal", chip: "agent" },
      cardB: { title: "Member rebooked", detail: "Spring tune-up · Apr 8", chip: "team" },
      counter: { value: 42, format: "integer", label: "active members" },
      clickThrough: false
    },
    {
      slug: "command-center",
      eyebrow: "Command Center",
      heading: "Your week at a glance",
      body: "See what the agent handled, what the team finished, and what needs you.",
      panelTitle: "Command Center · This week",
      rows: [
        { title: "Booked this week", meta: "$12,480", chip: "agent" },
        { title: "Awaiting owner approval", meta: "2 items", chip: "owner" },
        { title: "Completed by team", meta: "31 jobs", chip: "team" }
      ],
      cardA: { title: "2 items need you", detail: "Estimate $8,400 · Discount 10%", chip: "owner", actionLabel: "Approve" },
      cardB: { title: "Agent handled 18 tasks", detail: "Bookings, reminders, follow-ups", chip: "agent" },
      counter: { value: 12480, format: "currency", label: "booked this week" },
      clickThrough: true
    },
    {
      slug: "hvac",
      eyebrow: "HVAC",
      heading: "Built for your HVAC week",
      body: "No-heat calls, tune-up season and maintenance plans, handled.",
      rows: [
        { title: "Tune-up reminders", meta: "Emailed to 120 customers", chip: "agent" },
        { title: "No-heat request", meta: "Booked online 6:10 AM", chip: "agent" },
        { title: "Maintenance visits", meta: "18 completed", chip: "team" }
      ],
      cardA: { title: "No-heat request booked online", detail: "6:10 AM · Dana, 8:30 AM", chip: "agent" },
      cardB: { title: "Tune-up reminders emailed", detail: "120 Summit Comfort Club members", chip: "agent" },
      counter: { value: 9, format: "integer", label: "no-heat jobs booked" },
      clickThrough: false
    }
  ],
  plans: [
    { id: "flex", name: "Flex", monthlyPrice: 399, blurb: "Everything included. Cancel anytime." },
    { id: "flat", name: "Flat", monthlyPrice: 999, blurb: "One flat price as you add techs and trucks." },
    { id: "founding", name: "Founding", monthlyPrice: 199, blurb: "For early shops growing with us." },
    { id: "startup", name: "Startup", monthlyPrice: 99, blurb: "For new shops getting started." }
  ],
  pricing: { heading: "Simple pricing. Everything included.", annualNote: "Annual billing: 2 months free" }
};

/** Later: fetch from the Renvani Webflow CMS and map fields here. */
export async function getMarketingContent(): Promise<MarketingContent> {
  return PLACEHOLDER_CONTENT;
}

export function getVisual(content: MarketingContent, slug: ProductVisualContent["slug"]): ProductVisualContent {
  const visual = content.visuals.find((v) => v.slug === slug);
  if (!visual) throw new Error(`Unknown visual: ${slug}`);
  return visual;
}
