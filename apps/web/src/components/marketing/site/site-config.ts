/** Marketing website config. Figma jiGHTNUJNltWbHA4Il3hk7, section "11 Website" (171:2), Home / Desktop 171:3. */

export type SiteLink = { label: string; href: string };

export const SITE_NAV: { links: SiteLink[]; cta: SiteLink; signIn: SiteLink } = {
  links: [
    { label: "Products", href: "/product" },
    { label: "Industries", href: "/industries/hvac" },
    { label: "How it works", href: "/how-it-works" },
    { label: "Pricing", href: "/pricing" }
  ],
  cta: { label: "Get a free demo", href: "/signup" },
  signIn: { label: "Sign in", href: "/login" }
};

export const SITE_FOOTER = {
  links: [
    { label: "Products", href: "/product" },
    { label: "Industries", href: "/industries/hvac" },
    { label: "Pricing", href: "/pricing" },
    { label: "Get a free demo", href: "/signup" }
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
  /** No Growth Check intake route exists yet; the website is carried into sign-up. */
  action: "/signup",
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
      { label: "Plumbing →", href: "/industries/hvac#plumbing" }
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
      { eyebrow: "PLUMBING", title: "Keep good jobs flowing.", image: "/marketing/home/plumbing-work.jpg", href: "/industries/hvac#plumbing" }
    ]
  },
  capture: {
    eyebrow: "YOUR NEXT STEP",
    headline: ["See what your website", "could do better."],
    body: "A few clear opportunities. A useful place to start."
  }
} as const;
