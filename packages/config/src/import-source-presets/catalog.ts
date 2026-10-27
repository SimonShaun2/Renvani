import {
  GENERIC_CUSTOMER_PRESET,
  GENERIC_NOTES_PRESET,
  GENERIC_SERVICE_AGREEMENTS_PRESET,
} from "./generic.js";
import { HOUSECALL_PRO_PRESETS } from "./housecall-pro.js";
import { JOBBER_PRESETS } from "./jobber.js";
import { QUICKBOOKS_PRESETS } from "./quickbooks.js";
import { SERVICE_FUSION_PRESETS } from "./service-fusion.js";
import { SERVICE_TITAN_PRESETS } from "./service-titan.js";
import type { ImportSourcePreset } from "./types.js";

export const IMPORT_SOURCE_PRESETS: ImportSourcePreset[] = [
  ...JOBBER_PRESETS,
  ...HOUSECALL_PRO_PRESETS,
  ...SERVICE_TITAN_PRESETS,
  ...SERVICE_FUSION_PRESETS,
  ...QUICKBOOKS_PRESETS,
  GENERIC_CUSTOMER_PRESET,
  GENERIC_NOTES_PRESET,
  GENERIC_SERVICE_AGREEMENTS_PRESET,
];
