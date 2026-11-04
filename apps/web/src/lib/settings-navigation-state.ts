/** Exact settings navigation matching for General and nested Booking pages.
 * Keep links as they are; never treat /settings/generalized as /settings/general.
 */
export function isSettingsNavigationActive(pathname: string, href: string): boolean {
  if (href === "/settings/booking/general") {
    return pathname.startsWith("/settings/booking/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
