"use client";

import Link from "next/link";

import type { CustomerAgreementRecord, CustomerDetailRecord, CustomerJobRecord } from "@/src/hooks/customers.hooks";
import { useRecommendations } from "@/src/hooks/ai-revenue.hooks";

import { formatAddress } from "../customers.utils";
import { buildContactPills, formatEquipmentLine, formatMonthDay, jobStatePill } from "./customer-profile.utils";
import { ProfileCard, ProfilePillBadge, profileButtonClass } from "./ProfileUi";

/** Contact & property (144:134). */
export function ContactPropertyCard({ customer, agreements }: { customer: CustomerDetailRecord; agreements: CustomerAgreementRecord[] }) {
  const pills = buildContactPills(customer, agreements);
  return (
    <ProfileCard title="Contact & property">
      {customer.email ? <p className="text-[13px] text-[#0f1530]">{customer.email}</p> : null}
      {customer.phone ? <p className="text-[13px] text-[#0f1530]">{customer.phone}</p> : null}
      {customer.properties.map((property) => (
        <Link key={property.id} href={`/customers/${customer.id}/properties/${property.id}`} className="text-[13px] text-[#0f1530] hover:underline">
          {formatAddress(property)}
        </Link>
      ))}
      {pills.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {pills.map((pill) => (
            <ProfilePillBadge key={pill.key} label={pill.label} tone={pill.tone} />
          ))}
        </div>
      ) : null}
    </ProfileCard>
  );
}

/** Equipment (144:148). One line per asset across the customer's properties. */
export function EquipmentCard({ customer }: { customer: CustomerDetailRecord }) {
  const assets = customer.properties.flatMap((property) => property.assets ?? []);
  return (
    <ProfileCard title="Equipment">
      {assets.length === 0 ? (
        <p className="text-[13px] text-[#5e6684]">No equipment recorded yet.</p>
      ) : (
        assets.map((asset) => (
          <Link
            key={asset.id}
            href={`/customers/${customer.id}/assets/${asset.id}?propertyId=${asset.propertyId}`}
            className="text-[13px] text-[#0f1530] hover:underline"
          >
            {formatEquipmentLine(asset)}
          </Link>
        ))
      )}
    </ProfileCard>
  );
}

/** Jobs table (144:154). AMOUNT has no per-job total in the jobs API, so it shows "—". */
export function CustomerJobsTable({ jobs, limit = 5 }: { jobs: CustomerJobRecord[]; limit?: number }) {
  const rows = jobs.slice(0, limit);
  return (
    <section aria-label="Jobs" className="w-full overflow-hidden rounded-[14px] border border-[#e6dccb] bg-white">
      <table className="w-full text-left text-[13px] text-[#0f1530]">
        <thead className="bg-[#fbf6ef]">
          <tr className="font-mono text-[10px] font-medium uppercase text-[#5e6684]">
            {["Job", "Service", "Date", "Amount", "State"].map((heading) => (
              <th key={heading} scope="col" className="px-4 py-2.5 font-medium">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="border-t border-[#e6dccb] px-4 py-4 text-[#5e6684]">
                No jobs yet.
              </td>
            </tr>
          ) : (
            rows.map((job) => {
              const pill = jobStatePill(job.status);
              return (
                <tr key={job.id} className="border-t border-[#e6dccb]">
                  <td className="px-4 py-3 font-semibold">
                    <Link href={`/jobs/${job.id}`} className="hover:underline">
                      {job.jobNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{job.title}</td>
                  <td className="px-4 py-3">{formatMonthDay(job.scheduledStart ?? job.createdAt) ?? "—"}</td>
                  <td className="px-4 py-3 text-[#5e6684]">—</td>
                  <td className="px-4 py-3">
                    <ProfilePillBadge label={pill.label} tone={pill.tone} />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </section>
  );
}

/** Agent proposal strip (144:218): the top pending recommendation for this customer. */
export function AgentProposalCard({ customerId }: { customerId: string }) {
  const query = useRecommendations({ customerId, status: "pending", sortBy: "urgencyScore", sortOrder: "desc", page: 1, limit: 1 });
  const proposal = query.data?.data?.[0];
  if (!proposal) return null;
  return (
    <ProfileCard className="flex-row items-center gap-4">
      <ProfilePillBadge label="Proposed" tone="neutral" />
      <p className="flex-1 text-[13px] text-[#0f1530]">{proposal.body}</p>
      <Link href={`/ai-revenue-center?customerId=${customerId}`} className={profileButtonClass()}>
        Review
      </Link>
    </ProfileCard>
  );
}

