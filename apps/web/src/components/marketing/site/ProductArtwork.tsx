import { FigmaNode, type VNode } from "./FigmaNode";
import { FLAGSHIP_TREES } from "./flagship-visuals";
import { ScaleToFrame } from "./ScaleToFrame";
import styles from "./subpage.module.css";

type Layer = Exclude<VNode, string>;
function findVisual(node: VNode): Layer | undefined {
  if (typeof node === "string") return undefined;
  if (/^(Product demonstration|Marketing visual|Editable product visual|Product example|Complementary product view)\s*\//i.test(node.n ?? "")) return node;
  for (const child of node.k ?? []) { const found = findVisual(child); if (found) return found; }
  return undefined;
}

/** Only the illustrative product canvas is fitted. Page copy, controls and layout are always native responsive DOM. */
export function productArtwork(slug: string, variant: "desktop" | "mobile") {
  const tree = FLAGSHIP_TREES[slug]?.[variant];
  if (!tree) throw new Error(`Missing product artwork: ${slug}/${variant}`);
  const hero = typeof tree === "string" ? tree : (tree.k?.[0] ?? tree);
  const visual = findVisual(hero);
  if (!visual) throw new Error(`Missing isolated product visual: ${slug}/${variant}`);
  const explicitWidth = visual.c?.match(/(?:^|\s)w-\[([\d.]+)px\]/)?.[1];
  return { node: visual, width: explicitWidth ? Number(explicitWidth) : variant === "desktop" ? 720 : 342 };
}

export function ProductArtwork({ slug }: { slug: string }) {
  const desktop = productArtwork(slug, "desktop");
  const mobile = productArtwork(slug, "mobile");
  return <div className={styles.artwork} aria-hidden="true" data-product-artwork={slug}>
    <div className={styles.artworkDesktop}><ScaleToFrame width={desktop.width}><FigmaNode node={desktop.node} /></ScaleToFrame></div>
    <div className={styles.artworkMobile}><ScaleToFrame width={mobile.width}><FigmaNode node={mobile.node} /></ScaleToFrame></div>
  </div>;
}
