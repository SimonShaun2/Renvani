import { FrameSwitch, type VNode } from "./FigmaNode";
import { pricingTokens } from "./pricing-config";
import { PRICING_TREES } from "./pricing-visuals";

function resolve(node: VNode, tokens: Record<string, string>): VNode {
  if (typeof node === "string") return node.replace(/\{\{([\w.]+)\}\}/g, (_, k: string) => tokens[k] ?? "");
  return node.k ? { ...node, k: node.k.map((k) => resolve(k, tokens)) } : node;
}

/** Pricing (Figma 203:15719 desktop scaled to the 1440 frame at xl+, 203:15720 mobile below xl, via FrameSwitch). Figures come from pricing-config.ts. Server component. */
export function PricingFrames() {
  const tokens = pricingTokens();
  return <FrameSwitch desktop={resolve(PRICING_TREES.desktop, tokens)} mobile={resolve(PRICING_TREES.mobile, tokens)} scaleDesktop />;
}
