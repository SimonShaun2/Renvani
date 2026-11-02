import { z } from "zod";

export const outboundConsentSubjectSchema = z.enum(["customer", "booking_request"]);
export const outboundConsentChannelSchema = z.enum(["email", "sms"]);
export const outboundConsentPurposeSchema = z.enum(["appointment", "marketing"]);
export const outboundConsentDecisionSchema = z.enum(["grant", "revoke"]);

const normalizedEmail = z.string().trim().toLowerCase().email().max(320);
const normalizedSms = z.string().regex(/^\+[1-9]\d{1,14}$/, "SMS destination must be E.164");

export const outboundConsentKeySchema = z.object({
  companyId: z.string().uuid(),
  subjectType: outboundConsentSubjectSchema,
  subjectId: z.string().uuid(),
  channel: outboundConsentChannelSchema,
  purpose: outboundConsentPurposeSchema,
  contact: z.string().min(1).max(320),
}).strict().transform((key, context) => {
  const parsed = (key.channel === "email" ? normalizedEmail : normalizedSms).safeParse(key.contact);
  if (!parsed.success) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["contact"], message: "Invalid destination for channel" });
    return z.NEVER;
  }
  return { ...key, contact: parsed.data };
});

/** Request intent carries no evidence or actor claims. The service must resolve those from trusted context. */
export const outboundConsentIntentSchema = z.object({
  key: outboundConsentKeySchema,
  decision: outboundConsentDecisionSchema,
  idempotencyKey: z.string().trim().min(1).max(128),
}).strict();

/** Internal, server-resolved decision shape; never parse a public request with this schema. */
export const outboundConsentDecisionInputSchema = z.object({
  key: outboundConsentKeySchema,
  decision: outboundConsentDecisionSchema,
  sourceKind: z.string().trim().min(1).max(64),
  sourceRecordId: z.string().uuid(),
  statementVersion: z.string().trim().min(1).max(64),
  evidenceRef: z.string().trim().min(1).max(2048),
  actorType: z.enum(["user", "system", "customer"]),
  actorId: z.string().uuid().nullable(),
  idempotencyKey: z.string().trim().min(1).max(128),
}).strict().superRefine((input, context) => {
  if (input.actorType !== "system" && !input.actorId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["actorId"], message: "Actor ID required" });
  }
});

export type OutboundConsentKey = z.output<typeof outboundConsentKeySchema>;
export type OutboundConsentIntent = z.output<typeof outboundConsentIntentSchema>;
export type OutboundConsentDecisionInput = z.output<typeof outboundConsentDecisionInputSchema>;

export type OutboundConsentCheck =
  | { eligible: true; version: number; eventId: string; checkedAt: Date }
  | { eligible: false; reason: "subject_unavailable" | "contact_restricted" | "grant_missing" | "grant_revoked" | "version_changed"; checkedAt: Date };
