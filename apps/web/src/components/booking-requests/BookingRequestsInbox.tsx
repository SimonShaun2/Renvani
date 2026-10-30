"use client";

import Link from "next/link";
import { useState } from "react";

import { useBookingRequest, useBookingRequests } from "@/src/hooks/dispatch.hooks";

import { isEmergency, sortInbox, sourceLabel, STATUS_LABEL, type InboxItem } from "./booking-requests.utils";

const COPY = {
  title: "Booking requests",
  subtitle: "Emergency requests are flagged and shown first",
  priceBook: "Open price book",
  list: "Incoming requests",
  empty: "No booking requests yet.",
  badge: "EMERGENCY",
  emergencyHelp: "Emergency requests are flagged and shown first to your team.",
  assign: "Assign technician",
  review: "Review request"
} as const;

function EmergencyBadge() {
  return <span className="rounded-full bg-[#b42318] px-2 py-0.5 font-mono text-[10px] font-medium text-white">{COPY.badge}</span>;
}

function formatWhen(value: string | Date) {
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Booking requests inbox with EMERGENCY badge (Figma 309:3791, detail panel 309:3792). */
export function BookingRequestsInbox() {
  const listQuery = useBookingRequests();
  const items = sortInbox((listQuery.data?.data ?? []) as InboxItem[]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeId = selectedId ?? items[0]?.id ?? null;
  const detailQuery = useBookingRequest(activeId);
  const detail = detailQuery.data?.bookingRequest;
  const active = items.find((item) => item.id === activeId);
  const activeEmergency = detail ? detail.urgency === "emergency" : active ? isEmergency(active) : false;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold text-[#0f1530]">{COPY.title}</h1>
          <p className="mt-1 text-[13px] text-[#5e6684]">{COPY.subtitle}</p>
        </div>
        <Link href="/products" className="rounded-[10px] border border-[#e6dccb] bg-white px-4 py-2.5 text-sm font-semibold text-[#0f1530]">
          {COPY.priceBook}
        </Link>
      </header>
      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-[14px] border border-[#e6dccb] bg-white p-4">
          <h2 className="mb-3 text-[15px] font-semibold text-[#0f1530]">{COPY.list}</h2>
          {items.length === 0 ? <p className="text-[13px] text-[#5e6684]">{COPY.empty}</p> : null}
          <ul className="flex flex-col gap-2" data-testid="booking-requests-list">
            {items.map((item) => {
              const emergency = isEmergency(item);
              const selected = item.id === activeId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    data-emergency={emergency ? "true" : "false"}
                    aria-pressed={selected}
                    onClick={() => setSelectedId(item.id)}
                    className={`flex w-full flex-col gap-1 rounded-[10px] border p-3 text-left ${
                      emergency && selected ? "border-[#b42318] bg-[#fff6dc]" : selected ? "border-[#f6b400] bg-[#fff6dc]" : "border-[#e6dccb] bg-white"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[14px] font-semibold text-[#0f1530]">
                        {item.firstName} {item.lastName}
                      </span>
                      {emergency ? (
                        <EmergencyBadge />
                      ) : (
                        <span className="rounded-full bg-[#f3eadc] px-2 py-0.5 font-mono text-[10px] text-[#2a3360]">
                          {STATUS_LABEL[item.status] ?? item.status}
                        </span>
                      )}
                    </span>
                    <span className="text-[13px] text-[#2a3360]">{item.serviceType ?? item.serviceCategory ?? "Service request"}</span>
                    <span className="font-mono text-[10px] text-[#5e6684]">
                      {sourceLabel(item.source)} · {formatWhen(item.createdAt)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
        {active ? (
          <section className="h-fit rounded-[14px] border border-[#e6dccb] bg-white p-5" data-testid="booking-request-panel">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[20px] font-semibold text-[#0f1530]">
                {active.firstName} {active.lastName}
              </h2>
              {activeEmergency ? <EmergencyBadge /> : null}
            </div>
            <p className="mt-2 font-mono text-[11px] text-[#5e6684]">
              {[active.referenceNumber, active.serviceType ?? active.serviceCategory].filter(Boolean).join(" · ")}
            </p>
            {detail?.customerNotes ? <p className="mt-3 text-[13px] text-[#2a3360]">{detail.customerNotes}</p> : null}
            {activeEmergency ? <p className="mt-3 text-[12px] text-[#5e6684]">{COPY.emergencyHelp}</p> : null}
            <div className="mt-4 flex gap-3">
              <Link href="/dispatch" className="rounded-[10px] bg-[#f6b400] px-4 py-2.5 text-sm font-semibold text-[#0f1530]">
                {COPY.assign}
              </Link>
              <Link href="/dispatch" className="rounded-[10px] border border-[#e6dccb] bg-white px-4 py-2.5 text-sm font-semibold text-[#0f1530]">
                {COPY.review}
              </Link>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
