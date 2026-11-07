/** Search-only copy. Preserve approved Figma text and never treat illustrative workflows as proven results. */
export type SearchCopy = { title: string; description: string };
export const HOME_SEARCH_COPY: Readonly<SearchCopy> = {
  title: "Field Service Management Software | Renvani",
  description: "Renvani connects websites, booking requests, estimates, scheduling, field work, payments and follow-up for HVAC, plumbing and electrical businesses."
};

export const INDUSTRY_SEARCH_COPY: Readonly<Record<string, Readonly<SearchCopy>>> = {
  "hvac": {
    "title": "HVAC & Refrigeration Software | Renvani",
    "description": "Explore Renvani for HVAC and refrigeration: connect service requests, equipment details, estimates, field work and the next maintenance conversation."
  },
  "plumbing": {
    "title": "Plumbing Business Software | Renvani",
    "description": "Explore Renvani for plumbing shops: keep repair requests, property details, estimates, job notes and return visits connected from the first call."
  },
  "electrical": {
    "title": "Electrical Contractor Software | Renvani",
    "description": "Explore Renvani for electrical contractors: connect service requests, property notes, estimates, approved work and technician photos in one workflow."
  },
  "appliance-repair": {
    "title": "Appliance Repair Software | Renvani",
    "description": "Explore the appliance repair workflow in Renvani, from model details and repair requests to estimates, field notes, mobile payment and follow-up."
  },
  "garage-doors": {
    "title": "Garage Door Service Software | Renvani",
    "description": "Explore Renvani for garage door service: connect door and opener details, estimates, crew visits, repair notes and the next service conversation."
  },
  "locksmith": {
    "title": "Locksmith Business Software | Renvani",
    "description": "Explore Renvani for locksmith businesses: keep service requests, appointment details, approved work and visit notes connected through follow-up."
  },
  "cleaning": {
    "title": "Cleaning Business Software | Renvani",
    "description": "Explore Renvani for cleaning businesses: connect room details, requested tasks, estimates, visit checklists and the next customer booking."
  },
  "pest-control": {
    "title": "Pest Control Business Software | Renvani",
    "description": "Explore Renvani for pest control businesses: connect property details, assessment requests, agreed work, visit photos and customer follow-up."
  },
  "chimney": {
    "title": "Chimney Service Software | Renvani",
    "description": "Explore Renvani for chimney service: keep appointment requests, property details, assessment notes, approved work and service history connected."
  },
  "pressure-washing": {
    "title": "Pressure Washing Business Software | Renvani",
    "description": "Explore Renvani for pressure washing: connect site photos, surfaces, estimates, approved cleaning scope, before-and-after photos and follow-up."
  },
  "tree-care": {
    "title": "Tree Care Business Software | Renvani",
    "description": "Explore Renvani for tree care businesses: keep site assessments, photos, estimates, approved scope, crew notes and customer follow-up together."
  },
  "alarm": {
    "title": "Alarm Service Business Software | Renvani",
    "description": "Explore Renvani for alarm service businesses: connect appointment requests, equipment details, estimates, technician notes and future service visits."
  },
  "air-duct": {
    "title": "Air Duct Cleaning Software | Renvani",
    "description": "Explore Renvani for air duct cleaning: connect property and access details, service requests, estimates, agreed work and a clear visit history."
  },
  "carpet-cleaning": {
    "title": "Carpet Cleaning Business Software | Renvani",
    "description": "Explore Renvani for carpet cleaning: connect room details, customer photos, cleaning estimates, completed work and the next booking conversation."
  }
};

/** Product descriptions remain sourced from the approved page registry. */
export const PRODUCT_SEARCH_TITLES: Readonly<Record<string, string>> = {
  "growth": "Home Service Growth & Direct Bookings | Renvani",
  "revenue": "Estimate Follow-Up & Revenue Software | Renvani",
  "operations": "Field Service Operations Software | Renvani",
  "retention": "Home Service Customer Retention Software | Renvani",
  "command-center": "Field Service Command Center | Renvani",
  "online-booking": "Online Booking for Home Service Businesses | Renvani",
  "estimates-approvals": "Contractor Estimating & Approval Software | Renvani",
  "scheduling-dispatch": "Field Service Scheduling & Dispatch Software | Renvani",
  "technician-app": "Field Service Technician App | Renvani",
  "invoices-payments": "Contractor Invoicing & Payments Software | Renvani",
  "service-agreements": "Service Agreement Management Software | Renvani",
  "ai-revenue-intelligence": "Revenue Intelligence for Home Service Shops | Renvani",
  "customers-properties-assets": "Field Service CRM, Properties & Equipment | Renvani",
  "onboarding-data-import": "Field Service Data Import & Onboarding | Renvani",
  "inquiry-response-follow-up": "Home Service Inquiry Response & Follow-Up | Renvani",
  "jobs-work-orders": "Field Service Job & Work Order Software | Renvani",
  "time-tracking-job-photos": "Field Service Time Tracking & Job Photos | Renvani",
  "reminders-win-backs": "Service Reminders & Customer Win-Backs | Renvani",
  "reporting-job-sources": "Field Service Reporting & Job Sources | Renvani",
  "websites": "Websites for Home Service Businesses | Renvani",
  "price-book-service-catalog": "Contractor Price Book & Service Catalog | Renvani",
  "customer-portal": "Home Service Customer Portal Preview | Renvani"
};

export function industrySearchCopy(page: { slug: string; title: string; description: string }): SearchCopy {
  const copy = Object.hasOwn(INDUSTRY_SEARCH_COPY, page.slug) ? INDUSTRY_SEARCH_COPY[page.slug] : undefined;
  return copy ? { ...copy } : { title: page.title, description: page.description };
}

export function productSearchCopy(page: { slug: string; name: string; body: string }): SearchCopy {
  return {
    title: Object.hasOwn(PRODUCT_SEARCH_TITLES, page.slug) ? PRODUCT_SEARCH_TITLES[page.slug]! : `${page.name} · Renvani`,
    description: page.body
  };
}

/** Callers must supply publicSiteUrl(), never an unchecked environment variable or request hostname. */
function structuredDataOrigin(origin: string | null): string | null {
  if (!origin) return null;
  try {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        url.pathname !== '/' || url.search || url.hash) return null;
    return url.origin;
  } catch { return null; }
}

/** Homepage-only site identity; no fabricated ratings, offers, search actions or social profiles. */
export function websiteStructuredData(origin: string | null) {
  const base = structuredDataOrigin(origin);
  if (!base) return null;
  return {
    '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${base}/#website`,
    name: 'Renvani', url: base, inLanguage: 'en', publisher: { '@id': `${base}/#organization` }
  };
}

export type BreadcrumbItem = { name: string; path: string };
/** Use only a real, visible breadcrumb trail. Current consumer is the industry template. */
export function breadcrumbStructuredData(origin: string | null, items: readonly BreadcrumbItem[]) {
  const base = structuredDataOrigin(origin);
  if (!base || items.length < 2 || items.some(item => !item.name.trim() ||
      !/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/i.test(item.path))) return null;
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem', position: index + 1, name: item.name, item: new URL(item.path, base).href
    }))
  };
}
