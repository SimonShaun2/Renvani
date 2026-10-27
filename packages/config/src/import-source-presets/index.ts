/**
 * FS-MIGRATE M1 — export presets for incumbent FSM + QuickBooks (CSV export only).
 * Vendor-specific modules live in this directory; the generic engine consumes presets only.
 */

export { IMPORT_SOURCE_PRESETS } from "./catalog.js";
export { buildPresetColumnMapping } from "./mapping.js";
export {
  entityHintFromImportEntityType,
  inferImportSourcePresetForSession,
  inferImportSourcePresetFromHeaders
} from "./infer.js";
export { HOUSECALL_PRO_PRESETS } from "./housecall-pro.js";
export { QUICKBOOKS_PRESETS } from "./quickbooks.js";
export { SERVICE_TITAN_PRESETS } from "./service-titan.js";
export type { ImportPresetEntityHint, ImportSourcePreset, ImportSourcePresetId } from "./types.js";
