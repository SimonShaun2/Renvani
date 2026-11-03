import Link from "next/link";

import { MaybeLink } from "./MaybeLink";
import { TOOL_GROUPS, type ToolGroup } from "./platform-config";

const ink2 = "var(--color-mkt-ink2)";
const line = "var(--color-mkt-line)";

/** One flagship's tools (e.g. 225:7506): 27px title, 15px tagline, 14px links 18px apart, 138% line height. */
/** Mobile frame (225:7697–7757) lists the flagships in product order; desktop splits them into two columns. */
const MOBILE_ORDER: Record<string, string> = { growth: "order-1", revenue: "order-2", operations: "order-3", retention: "order-4", "command-center": "order-5" };

function Group({ g }: { g: ToolGroup }) {
  return (
    <div data-tool-group={g.key} className={`${MOBILE_ORDER[g.key] ?? ""} flex flex-col gap-[18px] rounded-2xl border p-6 leading-[1.38] md:order-none`} style={{ background: "var(--color-mkt-cream)", borderColor: line }}>
      <Link href={g.href} className="flex items-start justify-between gap-3 text-[27px] font-semibold">
        {g.title}
        <img src="/marketing/platform/icon-arrow.svg" alt="" width={22} height={22} />
      </Link>
      <p className="text-[15px]" style={{ color: ink2 }}>{g.tagline}</p>
      <div className="h-px w-full" style={{ background: line }} />
      <ul className="flex flex-col gap-[18px]">
        {g.tools.map((tl) => (
          <li key={tl.label}>
            <MaybeLink href={tl.href} className="block text-[14px] font-medium" style={{ color: ink2 }}>{tl.label}</MaybeLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Five connected product areas" (225:7467 desktop; 225:7697–7757 mobile). */
export function ToolDirectory() {
  return (
    <div data-node-id="225:7467" className="flex flex-col gap-8 md:grid md:grid-cols-2 md:items-start md:gap-6">
      <div className="contents md:flex md:flex-col md:gap-6">{TOOL_GROUPS.left.map((g) => <Group key={g.key} g={g} />)}</div>
      <div className="contents md:flex md:flex-col md:gap-6">{TOOL_GROUPS.right.map((g) => <Group key={g.key} g={g} />)}</div>
    </div>
  );
}
