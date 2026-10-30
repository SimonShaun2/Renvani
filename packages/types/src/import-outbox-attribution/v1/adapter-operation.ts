import { z } from "zod";

import { UuidSchema } from "../../agent-control-plane/v1/zod-shared.js";

import { AttributionV1Schema } from "./attribution.js";

/**
 * Adapter operation kinds are an app-level registry (stored as varchar since 0051), so an add-on
 * registers its kind instead of shipping an enum migration.
 */
export const BUILTIN_ADAPTER_OPERATION_KINDS = [
  "csv_import",
  "public_booking",
  "sms_outbound",
  "email_outbound",
  "stripe_connect"
] as const;

export const ADAPTER_OPERATION_KIND_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

const registeredAdapterOperationKinds = new Set<string>(BUILTIN_ADAPTER_OPERATION_KINDS);

export function registerAdapterOperationKind(kind: string): void {
  if (!ADAPTER_OPERATION_KIND_PATTERN.test(kind)) {
    throw new Error(`Invalid adapter operation kind: ${kind}`);
  }
  registeredAdapterOperationKinds.add(kind);
}

export function isRegisteredAdapterOperationKind(kind: string): boolean {
  return registeredAdapterOperationKinds.has(kind);
}

export const AdapterOperationKindV1Schema = z
  .string()
  .regex(ADAPTER_OPERATION_KIND_PATTERN)
  .refine(isRegisteredAdapterOperationKind, { message: "Unknown adapter operation kind" });

export type AdapterOperationKindV1 = (typeof BUILTIN_ADAPTER_OPERATION_KINDS)[number] | (string & {});

export const AdapterOperationStatusV1Schema = z.enum(["pending", "processing", "succeeded", "dead"]);

export type AdapterOperationStatusV1 = z.infer<typeof AdapterOperationStatusV1Schema>;

export const AdapterOperationV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    companyId: UuidSchema,
    kind: AdapterOperationKindV1Schema,
    adapterId: z.string().min(1).max(64),
    idempotencyKey: z.string().min(1).max(255),
    correlationId: UuidSchema,
    attribution: AttributionV1Schema,
    payload: z.record(z.string(), z.unknown()),
    status: AdapterOperationStatusV1Schema,
    attemptCount: z.number().int().min(0),
    lastError: z.string().max(2000).nullable().optional()
  })
  .strict();

export type AdapterOperationV1 = z.infer<typeof AdapterOperationV1Schema>;
