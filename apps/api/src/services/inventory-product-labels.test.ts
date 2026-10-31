import { describe, expect, it, vi } from "vitest";

vi.mock("drizzle-orm", () => ({
  and: (...parts: unknown[]) => ({ op: "and", parts }),
  eq: (field: unknown, value: unknown) => ({ op: "eq", field, value }),
  inArray: (field: unknown, values: unknown[]) => ({ op: "inArray", field, values }),
  asc: vi.fn(),
  desc: vi.fn(),
  isNull: vi.fn(),
  sql: vi.fn()
}));

vi.mock("@fsm/db", () => ({
  db: {},
  jobs: {},
  productCatalog: { id: "product_catalog.id", companyId: "product_catalog.company_id", name: "name", sku: "sku" },
  stockLevels: {},
  stockLocations: {},
  stockMovements: {},
  technicians: {}
}));

import { withProductLabels } from "./inventory.service.js";

function fakeExecutor(rows: Array<{ id: string; name: string; sku: string | null }>) {
  const where = vi.fn(async () => rows);
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return { executor: { select } as never, where, select };
}

const item = (productId: string) => ({ productId, productName: null as string | null, productSku: null as string | null });

describe("withProductLabels", () => {
  it("queries only the distinct product ids on the page, scoped to the company", async () => {
    const { executor, where } = fakeExecutor([{ id: "p1", name: "Filter", sku: "F-1" }]);
    const out = await withProductLabels(executor, "company-1", [item("p1"), item("p2"), item("p1")]);
    expect(where).toHaveBeenCalledTimes(1);
    const clause = (where.mock.calls[0] as unknown[])[0] as { op: string; parts: Array<{ op: string; field: string; value?: unknown; values?: unknown[] }> };
    expect(clause.op).toBe("and");
    expect(clause.parts).toContainEqual({ op: "eq", field: "product_catalog.company_id", value: "company-1" });
    expect(clause.parts).toContainEqual({ op: "inArray", field: "product_catalog.id", values: ["p1", "p2"] });
    expect(out.map((o) => o.productName)).toEqual(["Filter", null, "Filter"]);
  });

  it("does not query the catalog for an empty page", async () => {
    const { executor, select } = fakeExecutor([]);
    expect(await withProductLabels(executor, "company-1", [])).toEqual([]);
    expect(select).not.toHaveBeenCalled();
  });
});
