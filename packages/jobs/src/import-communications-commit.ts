import { z } from "zod";

export const IMPORT_COMMUNICATIONS_COMMIT_JOB_NAME = "import-communications-commit";

export const ImportCommunicationsCommitPayloadSchema = z.object({
  companyId: z.string().uuid(),
  importSessionId: z.string().uuid(),
  importBundleId: z.string().uuid().optional(),
  sourceSystem: z.string().min(1).max(64),
  chunkIndex: z.number().int().nonnegative().default(0),
  chunksTotal: z.number().int().positive().default(1),
  rowWindow: z
    .object({
      start: z.number().int().nonnegative(),
      end: z.number().int().nonnegative(),
    })
    .optional(),
  lineageMaps: z
    .object({
      customers: z.record(z.string(), z.string().uuid()).optional(),
      jobs: z.record(z.string(), z.string().uuid()).optional(),
    })
    .optional(),
});

export type ImportCommunicationsCommitPayload = z.infer<typeof ImportCommunicationsCommitPayloadSchema>;
