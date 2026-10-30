import { FigmaNode } from "./FigmaNode";
import { INDUSTRY_TREES } from "./industry-visuals";

/** Renders an Industries frame: desktop tree at md+, the Figma mobile frame below md. Server component. */
export function IndustryFrames({ tree }: { tree: "industries" | "hvac" | "plumbing" | "electrical" }) {
  const t = INDUSTRY_TREES[tree]!;
  return (
    <>
      <div className="hidden md:block">
        <FigmaNode node={t.desktop} className="w-full" />
      </div>
      {t.mobile ? (
        <div className="md:hidden">
          <FigmaNode node={t.mobile} className="w-full" />
        </div>
      ) : null}
    </>
  );
}
