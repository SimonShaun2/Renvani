import Link from "next/link";

import { RevenueProposalsInbox } from "@/src/components/revenue-agent/RevenueProposalsInbox";

export default function ApprovalsPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/command-center" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Command Center
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-900">Approvals</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Nothing reaches a customer until it passes policy, consent and — where your rules say so — you.
        </p>
      </div>
      <RevenueProposalsInbox />
    </div>
  );
}
