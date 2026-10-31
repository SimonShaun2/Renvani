import { z } from "zod";
import { afterEach, describe, expect, it } from "vitest";

import {
  getPortalSection,
  listPortalSectionKeys,
  registerPortalSection,
  unregisterPortalSection
} from "./customer-portal-sections.registry.js";

const ctx = {} as never;

describe("customer portal section registry", () => {
  afterEach(() => unregisterPortalSection("test-section"));

  it("registers a section by text key", async () => {
    registerPortalSection({ key: "test-section", schema: z.object({ n: z.number() }).strict(), load: async () => ({ n: 1 }) });
    expect(listPortalSectionKeys()).toContain("test-section");
    const section = getPortalSection("test-section");
    expect(section.schema.parse(await section.load(ctx))).toEqual({ n: 1 });
  });

  it("override: last registration wins", async () => {
    registerPortalSection({ key: "test-section", schema: z.number(), load: async () => 1 });
    registerPortalSection({ key: "test-section", schema: z.number(), load: async () => 2 });
    expect(await getPortalSection("test-section").load(ctx)).toBe(2);
  });

  it("unknown key throws NOT_FOUND; blank key rejected", () => {
    expect(() => getPortalSection("nope-unknown")).toThrow(/not found/i);
    expect(() => registerPortalSection({ key: " ", schema: z.number(), load: async () => 1 })).toThrow();
  });

  it("strict allowlist schema rejects extra fields", async () => {
    registerPortalSection({
      key: "test-section",
      schema: z.object({ n: z.number() }).strict() as never,
      load: async () => ({ n: 1, internalNotes: "x" })
    });
    const section = getPortalSection("test-section");
    expect(() => section.schema.parse({ n: 1, internalNotes: "x" })).toThrow();
  });
});
