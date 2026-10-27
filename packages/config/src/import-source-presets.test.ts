import { describe, expect, it } from "vitest";

import { importSourceSystemFromPreset } from "./import-price-book-map.js";
import {
  buildPresetColumnMapping,
  inferImportSourcePresetForSession,
  inferImportSourcePresetFromHeaders
} from "./import-source-presets/index.js";

describe("import-source-presets", () => {
  it("infers Service Fusion from typical export headers", () => {
    expect(
      inferImportSourcePresetFromHeaders([
        "Customer Name",
        "Email Address",
        "Mobile Phone",
        "Service Address",
        "City",
        "State",
        "ZIP"
      ])
    ).toBe("service_fusion");
  });

  it("infers QuickBooks Desktop customer export", () => {
    expect(
      inferImportSourcePresetFromHeaders(
        ["Customer", "E-mail", "Main Phone", "Bill To 1", "Bill To City", "Bill To State"],
        "customers"
      )
    ).toBe("quickbooks_desktop_customers");
  });

  it("builds column mapping for matched headers", () => {
    const mapping = buildPresetColumnMapping(["Customer Email", "Customer Phone"], "housecall_pro");
    expect(mapping).toEqual({
      "Customer Email": "email",
      "Customer Phone": "phone"
    });
  });

  it("infers preset for import session entity type", () => {
    expect(
      inferImportSourcePresetForSession(
        ["Invoice No", "Customer Name", "Invoice Date", "Due Date", "Total", "Balance"],
        "invoices"
      )
    ).toBe("quickbooks_invoices");
  });

  it("infers ServiceTitan location export vs customer export", () => {
    expect(
      inferImportSourcePresetFromHeaders(
        ["Location ID", "Customer ID", "Location Name", "Street Address", "City", "State", "ZIP Code"],
        "customers"
      )
    ).toBe("service_titan_locations");

    expect(
      inferImportSourcePresetFromHeaders(
        ["Customer Name", "Email", "Phone Number", "Street Address", "City", "State", "ZIP"],
        "customers"
      )
    ).toBe("service_titan");
  });

  it("infers ServiceTitan invoices from invoice export headers", () => {
    expect(
      inferImportSourcePresetFromHeaders(
        ["Invoice Number", "Customer ID", "Invoice Date", "Total", "Balance"],
        "invoices"
      )
    ).toBe("service_titan_invoices");
  });

  it("prefers ServiceTitan invoices when Invoice Number is present (ST export shape)", () => {
    expect(
      inferImportSourcePresetFromHeaders(
        ["Invoice ID", "Invoice Number", "Customer ID", "Invoice Date", "Total", "Balance"],
        "invoices"
      )
    ).toBe("service_titan_invoices");
  });

  it("infers ServiceTitan jobs from job tags and business unit columns", () => {
    expect(
      inferImportSourcePresetForSession(
        ["Job ID", "Job Number", "Customer ID", "Job Status", "Completed On", "Business Unit", "Tags"],
        "jobs"
      )
    ).toBe("service_titan_jobs");
  });

  it("infers Housecall Pro jobs export", () => {
    expect(
      inferImportSourcePresetForSession(
        ["Job ID", "Customer UUID", "Scheduled Date", "Job Status", "Street", "City", "State", "ZIP"],
        "jobs"
      )
    ).toBe("housecall_pro_jobs");
  });

  it("infers Housecall Pro invoices export", () => {
    expect(
      inferImportSourcePresetForSession(
        ["Invoice ID", "Customer ID", "Invoice Date", "Total", "Balance"],
        "invoices"
      )
    ).toBe("housecall_pro_invoices");
  });

  it("infers QuickBooks Desktop items and invoices", () => {
    expect(
      inferImportSourcePresetFromHeaders(
        ["Item", "Description", "Type", "Sales Price", "Cost", "Account"],
        "products"
      )
    ).toBe("quickbooks_desktop_items");

    expect(
      inferImportSourcePresetForSession(
        ["Invoice #", "Customer", "Date", "Due Date", "Amount", "Open Balance"],
        "invoices"
      )
    ).toBe("quickbooks_desktop_invoices");
  });

  it("infers QuickBooks Desktop payments export", () => {
    expect(
      inferImportSourcePresetForSession(
        ["Payment ID", "Customer", "Payment Date", "Amount", "Invoice ID"],
        "payments"
      )
    ).toBe("quickbooks_desktop_payments");
  });

  it("infers QuickBooks Online payments export", () => {
    expect(
      inferImportSourcePresetForSession(
        ["Date", "Customer", "Amount", "Payment Method", "Invoice Number", "Ref"],
        "invoices"
      )
    ).toBe("quickbooks_payments");
  });

  it("infers Jobber jobs, invoices, and payments exports", () => {
    expect(
      inferImportSourcePresetForSession(
        ["Job ID", "Client ID", "Completed On", "Title", "Status"],
        "jobs"
      )
    ).toBe("jobber_jobs");

    expect(
      inferImportSourcePresetForSession(
        ["Invoice Number", "Client ID", "Invoice Date", "Total", "Balance"],
        "invoices"
      )
    ).toBe("jobber_invoices");

    expect(
      inferImportSourcePresetForSession(
        ["Payment ID", "Client ID", "Payment Date", "Amount", "Invoice Number", "Method"],
        "payments"
      )
    ).toBe("jobber_payments");
  });

  it("maps Jobber preset ids to jobber lineage source_system", () => {
    expect(importSourceSystemFromPreset("jobber_jobs")).toBe("jobber");
    expect(importSourceSystemFromPreset("jobber_payments")).toBe("jobber");
  });
});
