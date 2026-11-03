import Link from "next/link";

import { AgentInbox } from "@/src/components/agent-actions/AgentInbox";

export default function ApprovalsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
        <Link href="/command-center" className="inline-flex min-h-11 items-center text-sm text-neutral-500 hover:text-neutral-800">
          ← Command Center
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-900">Approvals</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Nothing reaches a customer until it passes policy, consent and — where your rules say so — you.
        </p>
        </div>
        {/* Figma 10:288 Button/secondary/Policy & limits */}
        <Link
          href="/settings/automation"
          className="inline-flex min-h-11 items-center rounded-[10px] border border-[#e6dccb] bg-white px-3 py-1.5 text-sm font-medium text-[#0f1530] hover:border-[#d4c6ad]"
        >
          Policy &amp; limits
        </Link>
      </div>
      <AgentInbox />
    </div>
  );
}
