/** One registry for the Industries overview and trade pages (Figma page 171:2). */
export type IndustryEntry = {
  slug: "hvac" | "plumbing" | "electrical";
  name: string;
  href: string;
  frames: { desktop: string; mobile: string };
  title: string;
  description: string;
};

export const INDUSTRIES_OVERVIEW = {
  href: "/industries",
  frames: { desktop: "176:417", mobile: "176:504" },
  title: "Industries · Renvani",
  description: "Your trade. Your next good job. Renvani for HVAC, plumbing and electrical businesses."
};

export const INDUSTRY_PAGES: IndustryEntry[] = [
  { slug: "hvac", name: "HVAC", href: "/industries/hvac", frames: { desktop: "175:4297", mobile: "175:4443" }, title: "HVAC · Renvani", description: "Connect the booking, approved repair, field work, and next visit." },
  { slug: "plumbing", name: "Plumbing", href: "/industries/plumbing", frames: { desktop: "175:4583", mobile: "175:4729" }, title: "Plumbing · Renvani", description: "Connect every request, completed repair, and return visit." },
  { slug: "electrical", name: "Electrical", href: "/industries/electrical", frames: { desktop: "175:4869", mobile: "175:5015" }, title: "Electrical · Renvani", description: "Keep property notes, photos, estimates, and field work together." }
];

export const INDUSTRY_PAGE_BY_SLUG: Record<string, IndustryEntry> = Object.fromEntries(INDUSTRY_PAGES.map((p) => [p.slug, p]));

/** Header industry menu (177:686 → 204:9052). */
export const INDUSTRY_MENU_FRAME = "204:9052";
