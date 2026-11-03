"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/src/lib/route-access";
import { getSidebarNavigation } from "@/src/lib/navigation";
import { cn } from "@/src/lib/utils";
import { BrandMark } from "./BrandMark";
import { OwnerSignOut } from "./OwnerSignOut";
import { getActiveSidebarHref, groupSidebarItems, withoutOwnerHomeAlias } from "./sidebar-presentation";
import styles from "./workspace-shell.module.css";

interface SidebarProps { companyName: string; role: UserRole; userName: string; onNavigate?: () => void }

export function Sidebar({ companyName, role, userName, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const navigation = getSidebarNavigation(role);
  // /dashboard is a redirect, not a second owner-home destination. Other role links are retained.
  const items = withoutOwnerHomeAlias([...navigation.primary, ...(navigation.growth ?? []), ...(navigation.footer ?? [])], role);
  const groups = groupSidebarItems(items);
  const activeHref = getActiveSidebarHref(pathname, items);
  return (
    <div className={styles.sidebar}>
      <div className={styles.logo}><BrandMark compact light variant="sidebar" showTagline={false} /></div>
      <div className={styles.workspace}><p className={styles.workspaceLabel}>Workspace</p><p className={styles.company}>{companyName}</p></div>
      <nav className={styles.navigation} aria-label="Workspace navigation">
        {groups.map((group) => <div className={styles.section} key={group.label}>
          {group.label !== "Workspace" ? <p className={styles.sectionLabel}>{group.label}</p> : null}
          {group.items.map((item) => {
            const Icon = item.icon;
            const active = activeHref === item.href;
            return <Link key={item.href} href={item.href} onClick={onNavigate} className={cn(styles.navItem, active && styles.active)} aria-current={active ? "page" : undefined}><Icon aria-hidden="true" /><span>{item.label}</span></Link>;
          })}
        </div>)}
      </nav>
      <div className={styles.user}>
        <div className={styles.avatar} aria-hidden="true">{userName.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("")}</div>
        <div className={styles.userCopy}><p className={styles.userName}>{userName}</p><p className={styles.role}>{role === "office" ? "Office" : role}</p></div>
        <OwnerSignOut />
      </div>
    </div>
  );
}
