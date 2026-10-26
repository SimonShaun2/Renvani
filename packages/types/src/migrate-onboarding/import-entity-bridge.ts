import { z } from "zod";

/** Generic migrate wizard uploads — aligned with import_entity_type history + catalog slices. */
export const importEntityTypeSchema = z.enum([
  "customers",
  "properties",
  "jobs",
  "estimates",
  "price_book"
]);

export type WizardImportEntityType = z.infer<typeof importEntityTypeSchema>;
