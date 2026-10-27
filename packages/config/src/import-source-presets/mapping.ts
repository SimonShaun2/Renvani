import { IMPORT_SOURCE_PRESETS } from "./catalog.js";
import { normalizeHeader } from "./normalize.js";
import type { ImportPresetEntityHint, ImportSourcePresetId } from "./types.js";

export function buildPresetColumnMapping(
  headers: string[],
  presetId: ImportSourcePresetId,
  entityHint?: ImportPresetEntityHint,
): Record<string, string> {
  const preset =
    IMPORT_SOURCE_PRESETS.find(
      (entry) => entry.id === presetId && (!entityHint || entry.entity === entityHint),
    ) ??
    IMPORT_SOURCE_PRESETS.find(
      (entry) => entry.id === "generic" && (!entityHint || entry.entity === entityHint),
    );

  if (!preset) {
    return {};
  }

  const mapping: Record<string, string> = {};

  for (const header of headers) {
    const field = preset.headerAliases[normalizeHeader(header)];
    if (field) {
      mapping[header] = field;
    }
  }

  return mapping;
}
