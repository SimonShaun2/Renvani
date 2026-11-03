import type { ZodType } from "zod";

import type { runTransactionWithTenantSession } from "@fsm/db";
import { AppError, ErrorCode } from "@fsm/types";

export type PortalSectionTx = Parameters<Parameters<typeof runTransactionWithTenantSession>[1]>[0];

export interface PortalSectionContext {
  companyId: string;
  customerId: string;
  customer: { firstName: string; lastName: string; email: string | null; phone: string | null };
  tx: PortalSectionTx;
  appBaseUrl: string;
  now: Date;
}

export interface PortalSectionDefinition<T = unknown> {
  /** Text key (no enum); new sections plug in by registering a key. */
  key: string;
  load: (ctx: PortalSectionContext) => Promise<T>;
  /** Allowlist response schema; loader output is parsed through it (strict) before it leaves the API. */
  schema: ZodType<T>;
}

const sections = new Map<string, PortalSectionDefinition>();

/** Register (or override, last write wins) a customer portal section. */
export function registerPortalSection<T>(definition: PortalSectionDefinition<T>): void {
  if (!definition.key.trim()) {
    throw new Error("Portal section key is required");
  }
  sections.set(definition.key, definition as PortalSectionDefinition);
}

export function getPortalSection(key: string): PortalSectionDefinition {
  const section = sections.get(key);
  if (!section) {
    throw new AppError(ErrorCode.NOT_FOUND, "Portal section not found");
  }
  return section;
}

export function listPortalSectionKeys(): string[] {
  return [...sections.keys()];
}

/** Test helper. */
export function unregisterPortalSection(key: string): void {
  sections.delete(key);
}
