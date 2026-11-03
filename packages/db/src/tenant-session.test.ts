import { describe, expect, it } from "vitest";

import { buildTenantSessionSetLocal, readTenantCompanyIdFromGucRow } from "./tenant-session.js";

describe("tenant-session", () => {
  it("buildTenantSessionSetLocal produces parameterized set_config", () => {
    const companyId = "11111111-1111-4111-8111-111111111111";
    const built = buildTenantSessionSetLocal(companyId);
    expect(built.sql).toContain("set_config");
    expect(built.values).toEqual([companyId]);
  });

  it("rejects invalid company id", () => {
    expect(() => buildTenantSessionSetLocal("not-a-uuid")).toThrow();
  });

  it("readTenantCompanyIdFromGucRow parses setting", () => {
    const id = "22222222-2222-4222-8222-222222222222";
    expect(readTenantCompanyIdFromGucRow({ current_setting: id })).toBe(id);
    expect(readTenantCompanyIdFromGucRow({ current_setting: "" })).toBeNull();
  });
});
