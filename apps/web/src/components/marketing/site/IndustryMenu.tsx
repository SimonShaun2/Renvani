import type { ReactNode } from "react";

import { HeaderDisclosure } from "./HeaderDisclosure";
import { ScaleToFrame } from "./ScaleToFrame";

/** Header industry menu (Figma 177:686; panel 204:9052 rendered from the frame's layers). */
export function IndustryMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <HeaderDisclosure nodeId="177:686" summary={label} summaryClassName="hover:underline" panelClassName="absolute inset-x-0 top-[88px] z-30 bg-white">
      <ScaleToFrame>{children}</ScaleToFrame>
    </HeaderDisclosure>
  );
}
