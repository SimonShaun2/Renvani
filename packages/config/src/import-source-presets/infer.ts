import { IMPORT_SOURCE_PRESETS } from "./catalog.js";
import { normalizeHeader } from "./normalize.js";
import type { ImportPresetEntityHint, ImportSourcePresetId } from "./types.js";

function entityHintFromImportEntityType(entityType: string): ImportPresetEntityHint {
  if (entityType === "invoices" || entityType === "payments") {
    return "invoices";
  }

  if (entityType === "notes") {
    return "notes";
  }

  if (entityType === "products" || entityType === "price_book" || entityType === "price_book_item") {
    return "products";
  }

  if (entityType === "estimates" || entityType === "jobs" || entityType === "properties") {
    return "customers";
  }

  return "customers";
}

export function inferImportSourcePresetFromHeaders(
  headers: string[],
  entityHint: ImportPresetEntityHint = "customers"
): ImportSourcePresetId | null {
  if (headers.length === 0) {
    return null;
  }

  const normalizedHeaders = new Set(headers.map(normalizeHeader));
  let best: { id: ImportSourcePresetId; score: number } | null = null;

  for (const preset of IMPORT_SOURCE_PRESETS) {
    if (preset.id === "generic" || preset.entity !== entityHint) {
      continue;
    }

    const aliasKeys = Object.keys(preset.headerAliases).map(normalizeHeader);
    const score = aliasKeys.filter((key) => normalizedHeaders.has(key)).length;

    if (score < 3) {
      continue;
    }

    if (!best || score > best.score) {
      best = { id: preset.id, score };
      continue;
    }

    if (
      score === best.score &&
      entityHint === "invoices" &&
      normalizedHeaders.has(normalizeHeader("invoice number")) &&
      preset.id === "service_titan_invoices"
    ) {
      best = { id: preset.id, score };
    }
  }

  return best?.id ?? null;
}

export function inferImportSourcePresetForSession(
  headers: string[],
  importEntityType: string
): ImportSourcePresetId | null {
  return inferImportSourcePresetFromHeaders(headers, entityHintFromImportEntityType(importEntityType));
}
