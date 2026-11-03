import type { QboRuntimeConfig } from "../qbo-env.js";

export interface QboCustomerPayload {
  DisplayName: string;
  PrimaryEmailAddr?: { Address: string };
  PrimaryPhone?: { FreeFormNumber: string };
}

export interface QboCdcChange {
  entityType: "Customer" | "Invoice" | "Payment";
  id: string;
  lastUpdated: string;
}

export interface QboApiClient {
  upsertCustomer(accessToken: string, realmId: string, customer: QboCustomerPayload): Promise<string>;
  fetchCdcChanges(
    accessToken: string,
    realmId: string,
    entities: string[],
    changedSince: string
  ): Promise<QboCdcChange[]>;
}

export function createQboApiClient(config: QboRuntimeConfig): QboApiClient {
  const base = config.apiBaseUrl;

  return {
    async upsertCustomer(accessToken, realmId, customer) {
      const response = await fetch(`${base}/v3/company/${realmId}/customer`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(customer)
      });
      if (!response.ok) {
        throw new Error(`QBO customer upsert failed (${response.status})`);
      }
      const body = (await response.json()) as { Customer?: { Id?: string } };
      const id = body.Customer?.Id;
      if (!id) {
        throw new Error("QBO customer upsert missing Id");
      }
      return id;
    },
    async fetchCdcChanges(accessToken, realmId, entities, changedSince) {
      const params = new URLSearchParams({
        entities: entities.join(","),
        changedSince
      });
      const response = await fetch(`${base}/v3/company/${realmId}/cdc?${params.toString()}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json"
        }
      });
      if (!response.ok) {
        throw new Error(`QBO CDC pull failed (${response.status})`);
      }
      const body = (await response.json()) as {
        CDCResponse?: Array<{
          QueryResponse?: Array<Record<string, Array<{ Id?: string; MetaData?: { LastUpdatedTime?: string } }>>>;
        }>;
      };
      const changes: QboCdcChange[] = [];
      const responses = body.CDCResponse ?? [];
      for (const block of responses) {
        for (const queryResponse of block.QueryResponse ?? []) {
          for (const [entityName, rows] of Object.entries(queryResponse)) {
            for (const row of rows) {
              if (!row.Id) {
                continue;
              }
              changes.push({
                entityType: entityName as QboCdcChange["entityType"],
                id: row.Id,
                lastUpdated: row.MetaData?.LastUpdatedTime ?? changedSince
              });
            }
          }
        }
      }
      return changes;
    }
  };
}
