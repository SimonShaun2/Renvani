import Link from "next/link";

import { MaybeLink } from "./MaybeLink";
import { PLATFORM } from "./platform-config";
import styles from "./site.module.css";

const ink = "var(--color-mkt-ink)";
const ink2 = "var(--color-mkt-ink2)";
const line = "var(--color-mkt-line)";
const eyebrow = "text-[11px] font-medium tracking-[1.1px]";
const inter = { fontFamily: "Inter, system-ui, sans-serif" } as const;

function Chip({ children, bg }: { children: React.ReactNode; bg: string }) {
  return (
    <span className="inline-flex h-[27px] items-center rounded-xl px-[10px] text-[12px] font-medium" style={{ background: bg, color: ink, ...inter }}>
      {children}
    </span>
  );
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-[12px]" style={{ color: ink2, ...inter }}>
      <img src="/marketing/platform/icon-check.svg" alt="" width={18} height={18} />
      {children}
    </p>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-[10px] text-[12px]" style={inter}>
      <span className="w-[132px]" style={{ color: ink2 }}>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

const divider = <div className="h-px w-full" style={{ background: line }} />;

function Flagship({ title, href, tools, children, node }: { title: string; href: string; tools: readonly { label: string; href: string | null }[]; children: React.ReactNode; node: string }) {
  return (
    <div data-node-id={node} className={`${styles.lift} flex flex-col gap-4 rounded-2xl border p-5`} style={{ background: "var(--color-mkt-cream)", borderColor: line }}>
      <Link href={href} className="flex items-start justify-between gap-3 text-[23px] font-semibold">
        {title}
        <img src="/marketing/platform/icon-arrow.svg" alt="" width={22} height={22} />
      </Link>
      <div className="flex flex-col gap-3 rounded-xl bg-white p-[14px]">{children}</div>
      <div className="flex flex-wrap gap-x-6 gap-y-4">
        {tools.map((tl) => (
          <MaybeLink key={tl.label} href={tl.href} className="text-[12px] font-medium" style={{ color: ink2 }}>
            {tl.label}
          </MaybeLink>
        ))}
      </div>
    </div>
  );
}

/** "Website / Connected platform / Desktop" (218:*; instances 225:7343 and the How it works 02 section). Server component. */
export function ConnectedPlatform() {
  const { command, flagships: f, record, caption } = PLATFORM;
  return (
    <div className="flex flex-col gap-5" style={{ color: ink }}>
      <div data-node-id="218:12" className="flex flex-col gap-6 rounded-2xl p-5 text-white lg:flex-row lg:items-center" style={{ background: ink }}>
        <div className="flex flex-col gap-[6px] lg:w-[240px]">
          <Link href={command.open.href} className="text-[22px] font-semibold">{command.title}</Link>
          <p className={eyebrow} style={{ color: "var(--color-mkt-amber)" }}>{command.eyebrow}</p>
        </div>
        <div className="grid flex-1 gap-4 sm:grid-cols-3" style={inter}>
          {command.rules.map((r) => (
            <div key={r.label} className="flex flex-col gap-[6px] rounded-xl p-3" style={{ background: ink2 }}>
              <span className="text-[12px]">{r.label}</span>
              <span className="text-[13px] font-semibold">{r.value}</span>
            </div>
          ))}
        </div>
        <Link href={command.open.href} className="text-[12px] font-medium lg:w-[200px]">{command.open.label}</Link>
      </div>

      <div data-node-id="218:27" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Flagship node="218:28" {...f.growth}>
          <p className="text-[12px] font-bold" style={inter}>JUNIPER</p>
          <img src="/marketing/platform/hvac-website.jpg" alt="" width={480} height={168} className="h-[84px] w-full rounded-2xl object-cover" />
          <p className="text-[17px] font-semibold" style={inter}>AC diagnostic</p>
          <div><Chip bg="var(--color-mkt-amber-soft)">Thu 10–12</Chip></div>
          <span className="flex h-[38px] items-center justify-center rounded-xl text-[12px] font-medium text-white" style={{ background: ink, ...inter }}>Request visit</span>
        </Flagship>
        <Flagship node="218:43" {...f.revenue}>
          <p className={eyebrow} style={{ color: ink2 }}>ESTIMATE #2048</p>
          <p className="text-[17px] font-semibold" style={inter}>Jordan Lee</p>
          {divider}
          <Field label="Diagnostic" value="$89" />
          <Field label="Repair" value="$185" />
          {divider}
          <Field label="Service total" value="$274" />
          <div><Chip bg="var(--color-mkt-green-soft)">Customer accepted</Chip></div>
        </Flagship>
        <Flagship node="218:66" {...f.operations}>
          <p className={eyebrow} style={{ color: ink2 }}>JOB #1042</p>
          <p className="text-[17px] font-semibold" style={inter}>Maya R. · 10–12</p>
          <div><Chip bg="var(--color-mkt-amber-soft)">Assigned</Chip></div>
          <Check>Repair checklist complete</Check>
          <Check>Job photos attached</Check>
          {divider}
          <div><Chip bg="var(--color-mkt-green-soft)">Invoice paid</Chip></div>
        </Flagship>
        <Flagship node="218:89" {...f.retention}>
          <p className={eyebrow} style={{ color: ink2 }}>HOME COMFORT PLAN</p>
          <p className="text-[17px] font-semibold" style={inter}>Jordan’s next visit</p>
          <div className="flex items-start gap-4 rounded-xl p-3" style={{ background: "var(--color-mkt-amber-soft)", ...inter }}>
            <p className="text-[26px] font-bold leading-[1.08]"><span className="block">NOV</span><span className="block">12</span></p>
            <p className="text-[12px] font-medium">Heating tune-up</p>
          </div>
          <div><Chip bg="var(--color-mkt-green-soft)">Email draft ready</Chip></div>
        </Flagship>
      </div>

      <div data-node-id="218:104" className="flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center" style={{ background: "var(--color-mkt-sand)" }}>
        <p className={`${eyebrow} sm:w-[200px]`} style={{ color: ink2 }}>{record.eyebrow}</p>
        <ul className="grid flex-1 grid-cols-2 gap-4 text-[13px] font-medium sm:grid-cols-4">
          {record.items.map((i) => <li key={i}>{i}</li>)}
        </ul>
        <img src="/marketing/platform/icon-open.svg" alt="" width={22} height={22} />
      </div>
      <p className="text-[11px]" style={{ color: ink2 }}>{caption}</p>
    </div>
  );
}
