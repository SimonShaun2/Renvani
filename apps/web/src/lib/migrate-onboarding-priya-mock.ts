import type {
  LinkMigrateOnboardingFilesBody,
  MigrateOnboardingBundle,
  MigrateOnboardingSourceCatalogEntry,
  SetMigrateOnboardingSourceBody
} from "@fsm/types";

import { MIGRATE_ONBOARDING_SOURCE_CATALOG } from "@fsm/types";

import { migrateOnboardingRealClient } from "./migrate-onboarding-client";

/**
 * Steps 1–2 placeholder until Priya's onboarding wizard UI merges.
 * Uses real backend endpoints when available; falls back to in-memory bundle for local UI dev.
 */
export function isPriyaOnboardingMockEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MIGRATE_ONBOARDING_MOCK_PRIYA !== "0";
}

let memoryBundle: MigrateOnboardingBundle | null = null;

function newMockBundle(step: MigrateOnboardingBundle["wizardStep"]): MigrateOnboardingBundle {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    companyId: "00000000-0000-4000-8000-000000000001",
    createdById: null,
    status: "active",
    wizardStep: step,
    stepState: { files: [], sourceSystem: "manual_csv" },
    dedupeDecisions: {},
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    abandonedAt: null
  };
}

export const migrateOnboardingPriyaMockClient = {
  listSources: async (): Promise<{ sources: MigrateOnboardingSourceCatalogEntry[] }> => ({
    sources: MIGRATE_ONBOARDING_SOURCE_CATALOG
  }),

  createSession: async (): Promise<MigrateOnboardingBundle> => {
    try {
      return await migrateOnboardingRealClient.createSession({ resumeActive: false });
    } catch {
      memoryBundle = newMockBundle(1);
      return memoryBundle;
    }
  },

  getActiveSession: async (): Promise<MigrateOnboardingBundle | null> => {
    try {
      return await migrateOnboardingRealClient.getActiveSession();
    } catch {
      return memoryBundle;
    }
  },

  setSource: async (
    bundleId: string,
    body: SetMigrateOnboardingSourceBody
  ): Promise<MigrateOnboardingBundle> => {
    try {
      return await migrateOnboardingRealClient.setSource(bundleId, body);
    } catch {
      const base = memoryBundle?.id === bundleId ? memoryBundle : newMockBundle(1);
      memoryBundle = {
        ...base,
        wizardStep: 2,
        stepState: { ...base.stepState, sourceSystem: body.sourceSystem, files: base.stepState.files ?? [] }
      };
      return memoryBundle;
    }
  },

  linkFiles: async (
    bundleId: string,
    body: LinkMigrateOnboardingFilesBody
  ): Promise<MigrateOnboardingBundle> => {
    try {
      return await migrateOnboardingRealClient.linkFiles(bundleId, body);
    } catch {
      const base = memoryBundle?.id === bundleId ? memoryBundle : newMockBundle(2);
      memoryBundle = {
        ...base,
        wizardStep: 3,
        stepState: { ...base.stepState, files: body.files }
      };
      return memoryBundle;
    }
  }
};
