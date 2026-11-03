import type {
  ApplyMigrateDedupeDecisionsBody,
  CreateMigrateOnboardingSessionBody,
  LinkMigrateOnboardingFilesBody,
  MigrateDedupePreviewResponse,
  MigrateOnboardingBundle,
  MigrateOnboardingCommitResponse,
  MigrateOnboardingSourceCatalogEntry,
  MigrateRelationalPreviewResponse,
  SetMigrateOnboardingSourceBody
} from "@fsm/types";

import { api, ApiError } from "@/src/lib/api";

const BASE = "/api/v1/migrate/onboarding";

export const migrateOnboardingRealClient = {
  listSources: () => api.get<{ sources: MigrateOnboardingSourceCatalogEntry[] }>(`${BASE}/sources`),
  createSession: (body: CreateMigrateOnboardingSessionBody) =>
    api.post<MigrateOnboardingBundle>(`${BASE}/sessions`, body),
  getActiveSession: async () => {
    try {
      return await api.get<MigrateOnboardingBundle>(`${BASE}/sessions/active`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        throw new Error("NO_ACTIVE_SESSION");
      }
      throw error;
    }
  },
  getBundle: (bundleId: string) => api.get<MigrateOnboardingBundle>(`${BASE}/sessions/${bundleId}`),
  setSource: (bundleId: string, body: SetMigrateOnboardingSourceBody) =>
    api.patch<MigrateOnboardingBundle>(`${BASE}/sessions/${bundleId}/source`, body),
  linkFiles: (bundleId: string, body: LinkMigrateOnboardingFilesBody) =>
    api.patch<MigrateOnboardingBundle>(`${BASE}/sessions/${bundleId}/files`, body),
  confirmMappings: (bundleId: string) =>
    api.post<MigrateOnboardingBundle>(`${BASE}/sessions/${bundleId}/confirm-mappings`, {}),
  getRelationalPreview: (bundleId: string) =>
    api.get<MigrateRelationalPreviewResponse>(`${BASE}/sessions/${bundleId}/relational-preview`),
  getDedupePreview: (bundleId: string) =>
    api.get<MigrateDedupePreviewResponse>(`${BASE}/sessions/${bundleId}/dedupe-preview`),
  applyDedupeDecisions: (bundleId: string, body: ApplyMigrateDedupeDecisionsBody) =>
    api.patch<MigrateOnboardingBundle>(`${BASE}/sessions/${bundleId}/dedupe-decisions`, body),
  acknowledgePreview: (bundleId: string) =>
    api.post<MigrateOnboardingBundle>(`${BASE}/sessions/${bundleId}/acknowledge-preview`, {}),
  commit: (bundleId: string) =>
    api.post<MigrateOnboardingCommitResponse>(`${BASE}/sessions/${bundleId}/commit`, {})
};
