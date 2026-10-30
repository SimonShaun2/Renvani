/** Renders a product-illustration tree from flagship-visuals.ts. Server component; decorative (aria-hidden by the caller). */
export type VNode =
  | string
  | { t: "div" | "p" | "img" | "button"; c?: string; n?: string; id?: string; src?: string; label?: string; kind?: string; k?: VNode[] };

export function FigmaNode({ node, className = "" }: { node: VNode; className?: string }) {
  if (typeof node === "string") return <>{node}</>;
  const cls = `${node.c ?? ""} ${className}`.trim();
  if (node.t === "img") return <img src={node.src} alt="" className={`${cls} object-cover`} loading="lazy" />;
  if (node.t === "button") return <span className={cls}>{node.label}</span>;
  const kids = node.k?.map((k, i) => <FigmaNode key={i} node={k} />);
  if (node.t === "p") return <p className={cls}>{kids}</p>;
  return (
    <div className={cls} data-node-id={node.id}>
      {kids}
    </div>
  );
}
