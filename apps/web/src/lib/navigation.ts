import type { LucideIcon } from "lucide-react";
import {
  BriefcaseBusiness,
  CalendarDays,
  Clock,
  CreditCard,
  Wallet,
  Crown,
  FileText,
  ClipboardCheck,
  Gauge,
  MessageSquareText,
  Package,
  PhoneCall,
  Settings,
  ShieldCheck,
  Inbox,
  Sparkles,
  UserRound,
  Upload,
  Users,
  BookOpenCheck
} from "lucide-react";

import type { UserRole } from "./route-access";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface RoleNavigation {
  primary: NavItem[];
  growth?: NavItem[];
  footer?: NavItem[];
}

const ownerAdminNavigation: RoleNavigation = {
  primary: [
    { label: "Dashboard", href: "/dashboard", icon: Gauge },
    { label: "Dispatch", href: "/dispatch", icon: CalendarDays },
    { label: "Customers", href: "/customers", icon: Users },
    { label: "Jobs", href: "/jobs", icon: BriefcaseBusiness },
    { label: "Estimates", href: "/estimates", icon: FileText },
    { label: "Invoices", href: "/invoices", icon: CreditCard },
    { label: "Payments", href: "/payments", icon: Wallet },
    { label: "Service Agreements", href: "/service-agreements", icon: ShieldCheck },
    { label: "Timesheets", href: "/timesheets", icon: Clock },
    { label: "AI Revenue Center", href: "/ai-revenue-center", icon: Sparkles },
    { label: "Command Center", href: "/command-center", icon: Inbox }
  ],
  growth: [
    { label: "Growth Check", href: "/growth/growth-check", icon: ClipboardCheck },
    { label: "Booking requests", href: "/booking-requests", icon: Inbox },
    { label: "Call tracking", href: "/growth/call-tracking", icon: PhoneCall },
    { label: "Settings", href: "/settings", icon: Settings }
  ]
};

const dispatcherNavigation: RoleNavigation = {
  primary: [
    { label: "Dispatch", href: "/dispatch", icon: CalendarDays },
    { label: "Customers", href: "/customers", icon: Users },
    { label: "Jobs", href: "/jobs", icon: BriefcaseBusiness },
    { label: "Estimates", href: "/estimates", icon: FileText },
    { label: "Invoices", href: "/invoices", icon: CreditCard },
    { label: "Timesheets", href: "/timesheets", icon: Clock },
    { label: "Command Center", href: "/command-center", icon: Inbox }
  ],
  growth: [
    { label: "Booking requests", href: "/booking-requests", icon: Inbox },
    { label: "Settings", href: "/settings", icon: Settings }
  ]
};

export function getSidebarNavigation(role: UserRole): RoleNavigation {
  if (role === "owner" || role === "admin") {
    return ownerAdminNavigation;
  }

  return dispatcherNavigation;
}

export const mobileNavigation: NavItem[] = [
  { label: "Home", href: "/mobile/jobs", icon: Gauge },
  { label: "Jobs", href: "/mobile/jobs", icon: BriefcaseBusiness },
  { label: "Messages", href: "/mobile/messages", icon: MessageSquareText },
  { label: "Profile", href: "/mobile/profile", icon: UserRound }
];

export const settingsNavigation: NavItem[] = [
  { label: "Data import", href: "/settings/import", icon: Upload },
  { label: "Migration wizard", href: "/settings/migrate", icon: Upload },
  { label: "General", href: "/settings/general", icon: Settings },
  { label: "Company trade", href: "/settings/company", icon: Settings },
  { label: "Payments", href: "/settings/payments", icon: CreditCard },
  { label: "QuickBooks", href: "/settings/quickbooks", icon: BookOpenCheck },
  { label: "VIP memberships", href: "/settings/vip", icon: Crown },
  { label: "Automation Rules", href: "/settings/automation", icon: Sparkles },
  { label: "Notifications", href: "/settings/notifications", icon: MessageSquareText },
  { label: "Booking", href: "/settings/booking/general", icon: CalendarDays },
  { label: "Review Links", href: "/settings/review-links", icon: MessageSquareText },
  { label: "Users", href: "/settings/users", icon: Users },
  { label: "Billing", href: "/settings/billing", icon: Package }
];

export const bookingSettingsNavigation: NavItem[] = [
  { label: "General", href: "/settings/booking/general", icon: CalendarDays },
  { label: "Services", href: "/settings/booking/services", icon: Package },
  { label: "Availability", href: "/settings/booking/availability", icon: CalendarDays },
  { label: "Booking Links", href: "/settings/booking/links", icon: MessageSquareText },
  { label: "Service Areas", href: "/settings/booking/service-areas", icon: Users },
  { label: "Service area & emergency", href: "/settings/booking/service-area-emergency", icon: Users },
  { label: "Notifications", href: "/settings/booking/notifications", icon: MessageSquareText },
  { label: "Appearance", href: "/settings/booking/appearance", icon: Settings }
];
