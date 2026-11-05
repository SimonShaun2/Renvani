/** Marketing industry inventory. Separate from the application's supported trade/catalog enum. */
export const INDUSTRY_SLUGS = [
  "hvac", "plumbing", "electrical", "appliance-repair", "garage-doors", "locksmith", "cleaning",
  "pest-control", "chimney", "pressure-washing", "tree-care", "alarm", "air-duct", "carpet-cleaning"
] as const;

export type IndustrySlug = (typeof INDUSTRY_SLUGS)[number];
export type FeaturedIndustrySlug = "hvac" | "plumbing" | "electrical";

export type IndustryExample = {
  request: string;
  requestDetails: readonly [string, string, string];
  capture: string;
  estimate: string;
  fieldWork: string;
  nextVisit: string;
};

export type IndustryEntry = {
  slug: IndustrySlug;
  name: string;
  href: string;
  frames?: { desktop: string; mobile: string };
  title: string;
  description: string;
  tagline: string;
  headline: string;
  example: IndustryExample;
};

export const INDUSTRIES_OVERVIEW = {
  href: "/industries",
  frames: { desktop: "580:5544", tablet: "580:5623", mobile: "580:5700" },
  title: "Industries · Renvani",
  description: "Explore connected service workflows for HVAC, refrigeration, plumbing, electrical and more home and field service businesses."
};

const industry = (entry: Omit<IndustryEntry, "href" | "title">): IndustryEntry => ({
  ...entry,
  href: `/industries/${entry.slug}`,
  title: `${entry.name} · Renvani`
});

/** New trade examples describe a proposed customer journey, not specialized app features already shipped. */
export const INDUSTRY_PAGES: IndustryEntry[] = [
  industry({
    slug: "hvac", name: "HVAC & Refrigeration", frames: { desktop: "175:4297", mobile: "175:4443" },
    description: "Connect the booking, approved repair, field work, and next visit.",
    tagline: "From no heat to next season.", headline: "From no heat to next season.",
    example: { request: "Heating or cooling service request", requestDetails: ["Equipment & model details","Photos of the issue","Service area & preferred visit"], capture: "Keep the equipment, issue and customer photos together.", estimate: "Review equipment details and the proposed repair.", fieldWork: "Keep job notes, photos and the approved work together.", nextVisit: "Plan the next maintenance conversation." }
  }),
  industry({
    slug: "plumbing", name: "Plumbing", frames: { desktop: "175:4583", mobile: "175:4729" },
    description: "Connect every request, completed repair, and return visit.",
    tagline: "Keep good jobs flowing.", headline: "Keep good jobs flowing.",
    example: { request: "Leaking fixture repair request", requestDetails: ["Property & fixture details","Photos of the issue","Service area & preferred visit"], capture: "Keep the property, fixture, issue and customer photos together.", estimate: "Review the problem and agree on the repair scope.", fieldWork: "Carry the approved scope into job notes and photos.", nextVisit: "Keep a useful history for the next call." }
  }),
  industry({
    slug: "electrical", name: "Electrical", frames: { desktop: "175:4869", mobile: "175:5015" },
    description: "Keep property notes, photos, estimates, and field work together.",
    tagline: "Every detail. One clear job.", headline: "Every detail. One clear job.",
    example: { request: "Electrical service assessment request", requestDetails: ["Property & equipment details","Photos of the issue","Service area & preferred visit"], capture: "Keep the property, requested work and customer photos together.", estimate: "Review property notes and the proposed work.", fieldWork: "Keep the approved scope, checklist and photos together.", nextVisit: "Use the service record for future work." }
  }),
  industry({
    slug: "appliance-repair", name: "Appliance Repair",
    description: "Keep the request, estimate, field notes and payment connected from the first call to the finished repair.",
    tagline: "Repair the appliance. Keep the customer.", headline: "Repair the appliance. Keep the customer.",
    example: { request: "Dishwasher will not drain", requestDetails: ["Appliance & model details","Photos of the issue","Service area & preferred visit"], capture: "Keep the appliance, model, issue and customer photos together.", estimate: "Prepare an email estimate or arrange an onsite estimate. Confirm the repair scope.", fieldWork: "Confirm the estimate, convert the work order, document the repair and take mobile payment.", nextVisit: "Carry completion notes into the service record and the next appropriate follow-up." }
  }),
  industry({
    slug: "garage-doors", name: "Overhead & Garage Door",
    description: "Keep the door service request, estimate, crew visit and next service conversation connected.",
    tagline: "Open the door to the next good job.", headline: "Open the door to the next good job.",
    example: { request: "Garage door will not open", requestDetails: ["Door & opener details","Photos of the issue","Service area & preferred visit"], capture: "Keep the door, opener, issue and customer photos together.", estimate: "Review the site details and agree on the work after assessment.", fieldWork: "Carry the approved scope into repair notes and job photos.", nextVisit: "Discuss a future service visit with the customer." }
  }),
  industry({
    slug: "locksmith", name: "Locksmith",
    description: "Keep a clear service record from the first lock repair inquiry through the visit and follow-up.",
    tagline: "The right details before the visit.", headline: "The right details before the visit.",
    example: { request: "Lock repair appointment request", requestDetails: ["Requested lock service","Appointment details","Service area & preferred visit"], capture: "Keep the requested service and appointment details together.", estimate: "Review the requested service and confirm the visit scope.", fieldWork: "Keep the approved work and service notes with the job.", nextVisit: "Make the next service conversation easier to pick up." }
  }),
  industry({
    slug: "cleaning", name: "Cleaning",
    description: "Connect the cleaning request, agreed scope, completed visit and next booking.",
    tagline: "A clean visit. A reason to return.", headline: "A clean visit. A reason to return.",
    example: { request: "Home cleaning appointment request", requestDetails: ["Property & room details","Requested cleaning tasks","Preferred visit"], capture: "Keep the rooms, requested tasks and preferred visit together.", estimate: "Review the rooms, requested tasks and preferred visit time.", fieldWork: "Keep the agreed checklist and completion notes together.", nextVisit: "Invite the customer to arrange their next clean." }
  }),
  industry({
    slug: "pest-control", name: "Pest Control",
    description: "Keep property notes, the proposed service visit and customer follow-up in one connected story.",
    tagline: "From the first call to the next visit.", headline: "From the first call to the next visit.",
    example: { request: "Pest service assessment request", requestDetails: ["Property & issue details","Photos from the customer","Service area & preferred visit"], capture: "Keep the property, reported issue and customer photos together.", estimate: "Review property details and the proposed visit scope.", fieldWork: "Keep the agreed work, visit notes and photos with the job.", nextVisit: "Arrange the follow-up conversation with the customer." }
  }),
  industry({
    slug: "chimney", name: "Chimney",
    description: "Keep the chimney service inquiry, assessment notes, approved work and next visit connected.",
    tagline: "One clear record for every visit.", headline: "One clear record for every visit.",
    example: { request: "Chimney service appointment request", requestDetails: ["Property details","Requested chimney service","Preferred visit"], capture: "Keep the property and requested chimney service together.", estimate: "Review the property details and proposed assessment visit.", fieldWork: "Record the approved work and relevant job photos.", nextVisit: "Keep the service history ready for the next season." }
  }),
  industry({
    slug: "pressure-washing", name: "Pressure Washing",
    description: "Connect property photos and the requested cleaning scope to the estimate, visit and follow-up.",
    tagline: "Make every property a good first impression.", headline: "Make every property a good first impression.",
    example: { request: "Driveway cleaning request", requestDetails: ["Surfaces & site details","Property photos","Preferred visit"], capture: "Keep the surfaces, property photos and requested scope together.", estimate: "Review the surfaces, site photos and agreed cleaning scope.", fieldWork: "Keep before-and-after photos with the completed job.", nextVisit: "Make it easy to discuss the next property visit." }
  }),
  industry({
    slug: "tree-care", name: "Tree Care",
    description: "Keep the site assessment, proposed scope, crew visit and customer follow-up together.",
    tagline: "From site assessment to a clear plan.", headline: "From site assessment to a clear plan.",
    example: { request: "Tree care assessment request", requestDetails: ["Tree & site details","Site photos","Preferred assessment visit"], capture: "Keep the site details, photos and assessment request together.", estimate: "Review site notes and confirm the proposed work after assessment.", fieldWork: "Keep the approved scope, crew notes and job photos together.", nextVisit: "Carry the property history into the next conversation." }
  }),
  industry({
    slug: "alarm", name: "Alarm",
    description: "Connect an alarm service request with equipment notes, approved work and a clear visit history.",
    tagline: "Keep the service details connected.", headline: "Keep the service details connected.",
    example: { request: "Alarm service appointment request", requestDetails: ["Equipment & model details","Requested service","Preferred visit"], capture: "Keep the equipment details and requested service together.", estimate: "Review equipment details and the requested service scope.", fieldWork: "Keep the approved work and technician notes with the visit.", nextVisit: "Keep the service history ready for future appointments." }
  }),
  industry({
    slug: "air-duct", name: "Air Duct",
    description: "Keep the air duct service request, property details, agreed scope and completed visit together.",
    tagline: "A clearer path from request to visit.", headline: "A clearer path from request to visit.",
    example: { request: "Air duct cleaning request", requestDetails: ["Property & access details","Photos from the customer","Preferred visit"], capture: "Keep the property, access details and requested service together.", estimate: "Review property notes, access details and the proposed service.", fieldWork: "Record the agreed work and relevant job photos.", nextVisit: "Keep a clear record for the next service conversation." }
  }),
  industry({
    slug: "carpet-cleaning", name: "Carpet Cleaning",
    description: "Connect room details, the cleaning estimate, completed work and the next booking.",
    tagline: "Good work worth booking again.", headline: "Good work worth booking again.",
    example: { request: "Carpet cleaning appointment request", requestDetails: ["Rooms & flooring details","Photos from the customer","Preferred visit"], capture: "Keep the rooms, photos and requested cleaning scope together.", estimate: "Review the rooms, photos and requested cleaning scope.", fieldWork: "Keep completion notes and job photos with the visit.", nextVisit: "Invite the customer to discuss their next clean." }
  })
];

export const INDUSTRY_PAGE_BY_SLUG: Record<string, IndustryEntry | undefined> = Object.fromEntries(INDUSTRY_PAGES.map((page) => [page.slug, page]));
export const FEATURED_INDUSTRIES = INDUSTRY_PAGES.filter((page) => page.slug === "hvac" || page.slug === "plumbing" || page.slug === "electrical");
export const ADDITIONAL_INDUSTRIES = INDUSTRY_PAGES.filter((page) => !FEATURED_INDUSTRIES.includes(page));

/** Exact expanded desktop menu reference; mobile retains the existing disclosure behavior. */
export const INDUSTRY_MENU_FRAME = "580:5967";

/** Shared design adapted with trade-specific illustrative copy for the eleven new destinations. */
export const INDUSTRY_WORKFLOW_TEMPLATE = { desktop: "580:5782", tablet: "580:5845", mobile: "580:5905" } as const;
