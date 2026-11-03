/**
 * FS-MIGRATE — header aliases for vendor communications / message log exports.
 */

import type { ImportSourcePresetId } from "./import-source-presets.js";
import { buildPresetColumnMapping, inferImportSourcePresetFromHeaders } from "./import-source-presets.js";

export type CommunicationsPresetEntityHint = "communications";

const COMMUNICATIONS_HEADER_ALIASES: Record<string, string> = {
  "message id": "sourceId",
  id: "sourceId",
  "external id": "sourceId",
  "customer id": "customerSourceId",
  "client id": "customerSourceId",
  "job id": "jobSourceId",
  "work order id": "jobSourceId",
  channel: "channel",
  type: "channel",
  "message type": "channel",
  direction: "direction",
  status: "direction",
  to: "toAddress",
  "to address": "toAddress",
  recipient: "toAddress",
  email: "email",
  phone: "phone",
  "mobile phone": "phone",
  from: "fromAddress",
  "from address": "fromAddress",
  sender: "fromAddress",
  subject: "subject",
  body: "body",
  message: "body",
  content: "body",
  "sent at": "sentAt",
  "sent date": "sentAt",
  date: "sentAt",
  "created at": "sentAt",
  timestamp: "sentAt",
  "provider id": "providerMessageId",
  "provider message id": "providerMessageId",
  "delivery status": "providerStatus",
};

export function buildCommunicationsPresetColumnMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};

  for (const header of headers) {
    const normalized = header.trim().toLowerCase();
    const field = COMMUNICATIONS_HEADER_ALIASES[normalized];
    if (field) {
      mapping[header] = field;
    }
  }

  return mapping;
}

export function inferCommunicationsPresetFromHeaders(headers: string[]): ImportSourcePresetId | null {
  const vendorPreset = inferImportSourcePresetFromHeaders(headers, "customers");
  if (vendorPreset && vendorPreset !== "generic") {
    return vendorPreset;
  }

  const aliasHits = headers.filter((header) =>
    COMMUNICATIONS_HEADER_ALIASES[header.trim().toLowerCase()] !== undefined,
  ).length;

  return aliasHits >= 3 ? "generic" : null;
}

export function buildCommunicationsColumnMapping(
  headers: string[],
  presetId: ImportSourcePresetId | null,
): Record<string, string> {
  const communicationsMapping = buildCommunicationsPresetColumnMapping(headers);
  if (Object.keys(communicationsMapping).length >= 3) {
    return communicationsMapping;
  }

  if (presetId) {
    return { ...buildPresetColumnMapping(headers, presetId), ...communicationsMapping };
  }

  return communicationsMapping;
}
