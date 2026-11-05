/** Exact operator landing routes with their own page-level heading.
 * Do not suppress the shared header on detail/sub-routes or the field tech app.
 * Approved source: Figma jiGHTNUJNltWbHA4Il3hk7, 03 Operator App – Desktop.
 */
export const OPERATOR_HEADING_ROUTES = new Set([
  "/ai-revenue-center",
  "/growth/growth-check",
  "/dispatch",
  "/customers",
  "/jobs",
  "/estimates",
  "/invoices",
  "/payments",
  "/service-agreements",
  "/timesheets",
  "/inventory"
]);

export function hasDedicatedOperatorHeading(pathname: string): boolean {
  return pathname === "/settings" || pathname.startsWith("/settings/") || OPERATOR_HEADING_ROUTES.has(pathname);
}
