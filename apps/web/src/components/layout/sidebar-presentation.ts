/** Presentation only: retain the exact destinations supplied by role navigation. */
export interface SidebarDestination { href: string }
export type SidebarGroupLabel = "Workspace" | "Grow" | "Run" | "Manage";

export function groupSidebarItems<T extends SidebarDestination>(items: readonly T[]): Array<{ label: SidebarGroupLabel; items: T[] }> {
  const groups: Array<{ label: SidebarGroupLabel; items: T[] }> = [
    { label: "Workspace", items: [] }, { label: "Grow", items: [] },
    { label: "Run", items: [] }, { label: "Manage", items: [] }
  ];
  for (const item of items) {
    const path = item.href;
    const label: SidebarGroupLabel = path === "/dashboard" || path === "/command-center" || path.startsWith("/command-center/")
      ? "Workspace"
      : path.startsWith("/growth/") || path === "/booking-requests" || path === "/ai-revenue-center"
        ? "Grow"
        : path === "/settings" || path.startsWith("/settings/") || path === "/reporting" || path.startsWith("/reporting/")
          ? "Manage" : "Run";
    const group = groups.find((candidate) => candidate.label === label);
    if (group) group.items.push(item);
  }
  const workspace = groups[0];
  if (workspace) workspace.items.sort((a, b) => Number(b.href === "/command-center") - Number(a.href === "/command-center"));
  return groups.filter((group) => group.items.length > 0);
}

/** Longest route match avoids two active items and false prefixes such as /jobs-old. */
export function getActiveSidebarHref(pathname: string, items: readonly SidebarDestination[]): string | null {
  return items.filter(({ href }) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}
