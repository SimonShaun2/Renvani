import { ChevronDown } from "lucide-react";

import { HeaderDisclosure } from "./HeaderDisclosure";
import { IndustriesMenuPanel } from "./IndustriesMenuPanel";

/** Figma 177:686 content, adapted to the founder-requested Products panel design. */
export function IndustryMenu({ label }: { label: string }) {
  return (
    <HeaderDisclosure nodeId="177:686" className="group/industries w-[90px] shrink-0" summary={<>{label}<ChevronDown size={12} aria-hidden="true" className="transition-transform group-open/industries:rotate-180 motion-reduce:transition-none" /></>} summaryClassName="flex items-center gap-1.5 hover:underline" panelClassName="absolute inset-x-8 top-[96px] z-30 mx-auto max-h-[calc(100dvh-112px)] max-w-[1184px] overflow-y-auto rounded-[24px] shadow-[0_20px_70px_rgba(15,21,48,0.16)]">
      <IndustriesMenuPanel />
    </HeaderDisclosure>
  );
}
