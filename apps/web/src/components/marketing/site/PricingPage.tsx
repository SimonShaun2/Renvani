import type { VNode } from "./FigmaNode";
import { FigmaNode } from "./FigmaNode";
import { ScaleToFrame } from "./ScaleToFrame";
import { pricingTokens } from "./pricing-config";
import { PRICING_TREES } from "./pricing-visuals";

function resolve(node: VNode, tokens: Record<string, string>): VNode {
  if (typeof node === "string") return node.replace(/\{\{([\w.]+)\}\}/g, (_, k: string) => tokens[k] ?? "");
  return node.k ? { ...node, k: node.k.map((k) => resolve(k, tokens)) } : node;
}

/** Pricing (Figma 203:15719 desktop scaled to the 1440 frame at lg+, 203:15720 mobile below lg). Figures come from pricing-config.ts. Server component. */
export function PricingFrames() {
  const tokens = pricingTokens();
  return (
    <>
      <div className="hidden lg:block">
        <ScaleToFrame>
          <FigmaNode node={resolve(PRICING_TREES.desktop, tokens)} className="w-full" />
        </ScaleToFrame>
      </div>
      <div className="lg:hidden">
        <FigmaNode node={resolve(PRICING_TREES.mobile, tokens)} className="w-full" />
      </div>
    </>
  );
}
