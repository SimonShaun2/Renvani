import { and, eq, isNull } from "drizzle-orm";

import type { ImportCommunicationsCommitContext } from "@fsm/types";

import { db } from "./client.js";
import { mapCommunicationsRow, type ParsedImportRow } from "./import-communications-rows.js";
import {
  commitImportedCommunicationRows,
  resolveSourceSystemForCommunicationsImport,
  type ImportCommunicationsEntityResolver,
} from "./import-communications-commit.service.js";
import { messageLogs } from "./schema.js";

export type { ParsedImportRow } from "./import-communications-rows.js";
export {
  mapCommunicationsRow,
  validateCommunicationsRows,
} from "./import-communications-rows.js";
export {
  commitImportedCommunicationRows,
  resolveSourceSystemForCommunicationsImport,
  type ImportCommunicationsEntityResolver,
} from "./import-communications-commit.service.js";
export {
  normalizeImportedMessageChannel,
  normalizeImportedMessageDirection,
  resolveImportedMessageToAddress,
} from "./import-communications-commit.logic.js";

export interface CommunicationsCommitResult {
  importedRows: number;
  skippedRows: number;
}

export async function commitCommunicationsRows(options: {
  companyId: string;
  importSessionId: string;
  sourceSystem: string;
  rows: ParsedImportRow[];
  columnMapping: Record<string, string | null>;
  invalidRowNumbers: Set<number>;
  resolver?: ImportCommunicationsEntityResolver;
  actorId?: string;
}): Promise<CommunicationsCommitResult> {
  const commitRows = [];
  let skippedRows = 0;

  for (const row of options.rows) {
    if (options.invalidRowNumbers.has(row.rowNumber)) {
      skippedRows += 1;
      continue;
    }

    const mapped = mapCommunicationsRow(row.values, options.columnMapping);
    if (!mapped) {
      skippedRows += 1;
      continue;
    }

    commitRows.push({
      rowNumber: row.rowNumber,
      ...mapped,
    });
  }

  const ctx: ImportCommunicationsCommitContext = {
    companyId: options.companyId,
    importSessionId: options.importSessionId,
    sourceSystem: options.sourceSystem,
    ...(options.actorId ? { actorId: options.actorId } : {}),
  };

  const resolver: ImportCommunicationsEntityResolver = options.resolver ?? {
    async resolveCustomerId() {
      return null;
    },
  };

  const result = await commitImportedCommunicationRows(ctx, commitRows, resolver);

  return {
    importedRows: result.messagesCommitted,
    skippedRows: skippedRows + result.rowsFailed,
  };
}

export async function softDeleteCommunicationsImport(
  companyId: string,
  importSessionId: string,
): Promise<number> {
  const now = new Date();
  const updated = await db
    .update(messageLogs)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(messageLogs.companyId, companyId),
        eq(messageLogs.importSessionId, importSessionId),
        isNull(messageLogs.deletedAt),
      ),
    )
    .returning({ id: messageLogs.id });

  return updated.length;
}
