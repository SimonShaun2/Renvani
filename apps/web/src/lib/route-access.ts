export const USER_ROLES = ["owner", "admin", "dispatcher", "office", "technician"] as const;

export type UserRole = (typeof USER_ROLES)[number];

type DefaultRouteMap = Record<UserRole, string>;

const EXACT_PUBLIC_ROUTES = new Set(["/", "/login", "/signup", "/verify-email", "/product-tour", "/product", "/how-it-works", "/pricing", "/industries", "/industries/hvac", "/industries/plumbing", "/industries/electrical", "/portal", "/robots.txt", "/sitemap.xml"]);

const MARKETING_PRODUCT_PAGES = new Set(["growth", "revenue", "operations", "retention", "command-center", "online-booking", "estimates-approvals", "scheduling-dispatch"]);

const ROLE_ALLOWED_PREFIXES: Record<UserRole, string[]> = {
  owner: [
    "/onboarding",
    "/dashboard",
    "/dispatch",
    "/customers",
    "/jobs",
    "/estimates",
    "/invoices",
    "/payments",
    "/service-agreements",
    "/ai-revenue-center",
    "/command-center",
    "/products",
    "/review-requests",
    "/reporting",
    "/settings",
    "/growth",
    "/mobile"
  ],
  admin: [
    "/onboarding",
    "/dashboard",
    "/dispatch",
    "/customers",
    "/jobs",
    "/estimates",
    "/invoices",
    "/payments",
    "/service-agreements",
    "/ai-revenue-center",
    "/command-center",
    "/products",
    "/review-requests",
    "/reporting",
    "/settings",
    "/growth",
    "/mobile"
  ],
  dispatcher: [
    "/dispatch",
    "/customers",
    "/jobs",
    "/estimates",
    "/invoices",
    "/service-agreements",
    "/command-center",
    "/settings"
  ],
  office: [
    "/dispatch",
    "/customers",
    "/jobs",
    "/estimates",
    "/invoices",
    "/service-agreements",
    "/settings"
  ],
  technician: ["/mobile"]
};

export const ROLE_DEFAULT_ROUTES: DefaultRouteMap = {
  owner: "/dashboard",
  admin: "/dashboard",
  dispatcher: "/dispatch",
  office: "/dispatch",
  technician: "/mobile/jobs"
};

export function normalizeUserRole(role: unknown): UserRole | null {
  if (typeof role !== "string") {
    return null;
  }

  return USER_ROLES.includes(role as UserRole) ? (role as UserRole) : null;
}

export function getDefaultRouteForRole(role: UserRole): string {
  return ROLE_DEFAULT_ROUTES[role];
}

export function isPublicRoute(pathname: string): boolean {
  if (EXACT_PUBLIC_ROUTES.has(pathname)) {
    return true;
  }

  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] === "product" && segments.length === 2 && MARKETING_PRODUCT_PAGES.has(segments[1] ?? "")) {
    return true;
  }

  // Static marketing art in /public/marketing (Figma 171:2 home imagery).
  if (segments[0] === "marketing" && segments.length >= 2) {
    return true;
  }

  if (segments[0] === "book" && segments.length >= 2) {
    return true;
  }

  if (segments[0] === "site" && segments.length >= 2) {
    return true;
  }

  if (segments[0] === "approve" && segments.length === 2) {
    return true;
  }

  // Token-scoped customer pages. Tenant scoping and token validation stay server-side (API).
  if (segments[0] === "pay" && (segments.length === 2 || (segments.length === 3 && segments[2] === "receipt"))) {
    return true;
  }

  if (segments[0] === "vip" && segments[1] === "join" && segments.length === 3) {
    return true;
  }

  if (segments[0] === "portal" && segments[1] === "agreements" && segments.length === 3) {
    return true;
  }

  if (segments[0] === "review" && segments.length === 2) {
    return true;
  }

  return false;
}

export function canRoleAccessPath(role: UserRole, pathname: string): boolean {
  const allowedPrefixes = ROLE_ALLOWED_PREFIXES[role];

  return allowedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
