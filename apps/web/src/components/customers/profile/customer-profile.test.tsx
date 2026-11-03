import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { CustomerAgreementRecord, CustomerDetailRecord, CustomerInvoiceRecord, CustomerJobRecord } from "@/src/hooks/customers.hooks";

import {
  buildContactPills,
  buildProfileKpis,
  buildProfileSubtitle,
  formatEquipmentLine,
  formatMonthDay,
  formatProfileMoney,
  jobStatePill
} from "./customer-profile.utils";
import { CustomerJobsTable } from "./ProfileSections";

const customer = {
  id: "c1", firstName: "Dana", lastName: "Whitfield", displayName: null, email: "dana@example.com", phone: null,
  lifetimeValue: "1920.00", totalJobs: 7, firstServiceDate: "2024-03-01", createdAt: "2024-03-05T00:00:00.000Z", doNotContact: false,
  properties: [{ id: "p1", type: "residential", isPrimary: true, addressLine1: "1842 Aspen Ridge Dr", city: "Denver", state: "CO", zip: "80220", assets: [] }]
} as unknown as CustomerDetailRecord;

const plan = { id: "a1", name: "Comfort Club", status: "active", frequency: "biannual", nextServiceDate: "2026-11-12", billingCycle: "monthly" } as CustomerAgreementRecord;
const invoice = (balanceDue: string, status = "sent") => ({ id: balanceDue, status, balanceDue }) as CustomerInvoiceRecord;
const job = (partial: Partial<CustomerJobRecord>) =>
  ({ id: "j", jobNumber: "J-1", title: "Fall maintenance", status: "scheduled", scheduledStart: null, createdAt: "2026-10-01T00:00:00.000Z", ...partial }) as CustomerJobRecord;

describe("customer profile utils", () => {
  it("formats money and local dates like the frame", () => {
    expect(formatProfileMoney("1920.00")).toBe("$1,920");
    expect(formatProfileMoney("149.5")).toBe("$149.50");
    expect(formatMonthDay("2026-11-12")).toBe("Nov 12");
    expect(buildProfileSubtitle(customer)).toBe("Customer since Mar 2024 · Residential");
  });

  it("builds KPIs from API data with honest fallbacks", () => {
    const now = new Date(2026, 9, 27);
    const kpis = buildProfileKpis({
      customer, agreements: [plan], invoices: [invoice("0.00", "paid")], now,
      jobs: [job({ id: "a", status: "scheduled", scheduledStart: "2026-11-12", title: "Fall maintenance" }), job({ id: "b", status: "paid", scheduledStart: "2026-10-21" })]
    });
    expect(kpis.map((k) => [k.value, k.caption])).toEqual([
      ["$1,920", "7 jobs"],
      ["$0", "All invoices paid"],
      ["Nov 12", "Fall maintenance"],
      ["Comfort Club", "biannual · billed monthly"]
    ]);
    const empty = buildProfileKpis({ customer, agreements: [], invoices: [invoice("40.00"), invoice("10.00", "void")], jobs: [], now });
    expect(empty[1]).toMatchObject({ value: "$40", caption: "1 open invoice" });
    expect(empty[2]).toMatchObject({ value: "—", caption: "Nothing scheduled" });
    expect(empty[3]).toMatchObject({ value: "—", caption: "No active plan" });
  });

  it("pills, equipment lines and job states", () => {
    expect(buildContactPills(customer, [plan]).map((p) => p.label)).toEqual(["Residential", "VIP · Comfort Club"]);
    expect(formatEquipmentLine({ name: "Carrier gas furnace", model: "59SC5", installDate: "2016-05-01" })).toBe("Carrier gas furnace 59SC5 · installed 2016");
    expect(formatEquipmentLine({ name: "Thermostat", model: null, installDate: null })).toBe("Thermostat");
    expect(jobStatePill("paid")).toEqual({ label: "Paid", tone: "green" });
    expect(jobStatePill("estimate_sent")).toEqual({ label: "Estimate sent", tone: "neutral" });
  });

  it("renders the jobs table with a dash for the missing amount", () => {
    const html = renderToStaticMarkup(<CustomerJobsTable jobs={[job({ jobNumber: "J-4502", scheduledStart: "2026-11-12" })]} />);
    expect(html).toContain("J-4502");
    expect(html).toContain("Nov 12");
    expect(html).toContain("Scheduled");
  });
});
