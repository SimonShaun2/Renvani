import { QBO_SYNC_CONTRACT_VERSION, type QboCatalogV1, type QboMappingKind } from "@fsm/types";

/**
 * Kai's sync engine implements catalog fetches against Intuit sandbox APIs.
 * Ruby's API uses this port so QBO HTTP stays in the worker layer.
 */
export interface QboSyncCatalogPort {
  fetchCatalog(companyId: string, kind: QboMappingKind): Promise<QboCatalogV1>;
}

export const stubQboSyncCatalogPort: QboSyncCatalogPort = {
  async fetchCatalog(_companyId, kind) {
    return {
      contractVersion: QBO_SYNC_CONTRACT_VERSION,
      kind,
      items: []
    };
  }
};
