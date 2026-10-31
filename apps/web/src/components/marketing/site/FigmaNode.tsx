import Link from "next/link";
import type { ReactNode } from "react";
import { ScaleToFrame } from "./ScaleToFrame";

/** Renders a Figma layer tree (flagship-visuals.ts, industry-visuals.ts). Server component. */
export type VNode =
  | string
  | {
      t: "div" | "p" | "img" | "button" | "h1";
      c?: string;
      n?: string;
      id?: string;
      src?: string;
      label?: string;
      kind?: string;
      href?: string;
      /** Marks the link as the current page (aria-current). */
      current?: boolean;
      /** Rendered as the element id (in-page anchor target). */
      anchor?: string;
      /** Replaced by `slots[slot]` (interactive pieces such as forms). */
      slot?: string;
      k?: VNode[];
    };

export function FigmaNode({ node, className = "", inline = false, slots }: { node: VNode; className?: string; inline?: boolean; slots?: Record<string, ReactNode> | undefined }) {
  if (typeof node === "string") return <>{node}</>;
  if (node.slot) return <>{slots?.[node.slot] ?? null}</>;
  const cls = `${node.c ?? ""} ${className}`.trim();
  if (node.t === "img") return <img src={node.src} alt="" className={`${cls} object-cover`} loading="lazy" />;
  if (node.t === "button") {
    return node.href ? (
      <Link href={node.href} className={cls}>
        {node.label}
      </Link>
    ) : (
      <span className={cls}>{node.label}</span>
    );
  }
  const childInline = inline || node.t === "h1";
  const kids = node.k?.map((k, i) => <FigmaNode key={i} node={k} inline={childInline} slots={slots} />);
  if (node.href) {
    return (
      <Link href={node.href} aria-current={node.current ? "page" : undefined} className={/(^| )(flex|grid|inline-flex)( |$)/.test(cls) ? cls : `${cls} block`} data-node-id={node.id}>
        {kids}
      </Link>
    );
  }
  if (node.t === "h1") {
    return (
      <h1 className={cls} data-node-id={node.id}>
        {kids}
      </h1>
    );
  }
  if (inline) return <span className={`${cls} block`}>{kids}</span>;
  if (node.t === "p") return <p className={cls}>{kids}</p>;
  return (
    <div className={cls} data-node-id={node.id} id={node.anchor}>
      {kids}
    </div>
  );
}

/**
 * Desktop frame at xl+, the Figma mobile frame below xl. Desktop frames are laid out for 1440 and need ~1150px
 * (only Home and Demo have tablet frames), so from md up the mobile frame sits in a centred 600px column with 32px
 * gutters, keeping each section's full-width background.
 */
/** `scaleDesktop`: render the desktop tree at its 1440 frame width, zoomed to fit (product pages, review 5720582328). */
export function FrameSwitch({
  desktop,
  mobile,
  slots,
  scaleDesktop = false
}: {
  desktop: VNode;
  mobile?: VNode | undefined;
  slots?: Record<string, ReactNode>;
  scaleDesktop?: boolean;
}) {
  if (!mobile) return <FigmaNode node={desktop} className="w-full" slots={slots} />;
  return (
    <>
      <div className="hidden xl:block">
        {scaleDesktop ? (
          <ScaleToFrame>
            <FigmaNode node={desktop} className="w-full" slots={slots} />
          </ScaleToFrame>
        ) : (
          <FigmaNode node={desktop} className="w-full" slots={slots} />
        )}
      </div>
      <div className="xl:hidden md:[&>div>div]:px-8 md:[&>div>div>*]:mx-auto md:[&>div>div>*]:w-full md:[&>div>div>*]:max-w-[600px]">
        <FigmaNode node={mobile} className="w-full" slots={slots} />
      </div>
    </>
  );
}
