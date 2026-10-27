import { z } from "zod";

export const qboConnectStartResponseSchema = z.object({
  authorizeUrl: z.string().url()
});

export const qboConnectCallbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  realmId: z.string().min(1)
});

export const qboConnectionStatusResponseSchema = z.object({
  status: z.enum(["pending", "connected", "error", "disconnected"]),
  realmId: z.string().optional(),
  environment: z.literal("sandbox"),
  connected: z.boolean(),
  lastSyncAt: z.string().nullable().optional(),
  lastErrorMessage: z.string().nullable().optional()
});
