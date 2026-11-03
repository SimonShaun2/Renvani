import { MarketingShell } from "@/src/components/marketing/site/MarketingShell";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <MarketingShell>{children}</MarketingShell>;
}
