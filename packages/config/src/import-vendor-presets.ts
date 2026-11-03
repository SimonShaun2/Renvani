/** @deprecated Use `@fsm/config/import-source-presets` — re-export shim for M1 rename. */
export {
  buildPresetColumnMapping,
  inferImportSourcePresetForSession as inferImportVendorPresetForSession,
  inferImportSourcePresetFromHeaders as inferImportVendorPresetFromHeaders,
  IMPORT_SOURCE_PRESETS as IMPORT_VENDOR_PRESETS,
  type ImportSourcePreset as ImportVendorPreset,
  type ImportSourcePresetId as ImportVendorPresetId,
  type ImportPresetEntityHint
} from "./import-source-presets/index.js";
