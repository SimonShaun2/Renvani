import Link from "next/link";

import { MaybeLink } from "./MaybeLink";
import { TOOL_GROUPS, type ToolGroup } from "./platform-config";

const ink2 = "var(--color-mkt-ink2)";
const line = "var(--color-mkt-line)";

function Group({ g }: { g: ToolGroup }) {
  return (
    <div data-tool-group={g.key} className="flex flex-col gap-[18px] rounded-2xl border p-6" style={{ background: "var(--color-mkt-cream)", borderColor: line }}>
      <Link href={g.href} className="flex items-start justify-between gap-3 text-[23px] font-semibold">
        {g.title}
        <img src="/marketing/platform/icon-arrow.svg" alt="" width={22} height={22} />
      </Link>
      <p className="text-[13px]" style={{ color: ink2 }}>{g.tagline}</p>
      <div className="h-px w-full" style={{ background: line }} />
      <ul className="flex flex-col gap-4">
        {g.tools.map((tl) => (
          <li key={tl.label}>
            <MaybeLink href={tl.href} className="text-[13px] font-medium">{tl.label}</MaybeLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Five connected product areas" (225:7467 desktop; 225:7697–7757 mobile). */
export function ToolDirectory() {
  return (
    <div data-node-id="225:7467" className="grid items-start gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-6">{TOOL_GROUPS.left.map((g) => <Group key={g.key} g={g} />)}</div>
      <div className="flex flex-col gap-6">{TOOL_GROUPS.right.map((g) => <Group key={g.key} g={g} />)}</div>
    </div>
  );
}
