"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { publicEnv } from "@fsm/config";
import type {
  ApplyMigrateDedupeDecisionsBody,
  LinkMigrateOnboardingFilesBody,
  MigrateSourceSystemId,
  SetMigrateOnboardingSourceBody,
  WizardImportEntityType
} from "@fsm/types";

import { clearBrowserAuthSession, getAuthToken } from "@/src/lib/auth";
import { ApiError, type ApiErrorPayload } from "@/src/lib/api";
import type { ImportSessionResponse } from "@/src/hooks/imports.hooks";
import { migrateOnboardingRealClient } from "@/src/lib/migrate-onboarding-client";
import {
  isPriyaOnboardingMockEnabled,
  migrateOnboardingPriyaMockClient
} from "@/src/lib/migrate-onboarding-priya-mock";
import { useMigrateOnboardingWizardStore } from "@/src/stores/migrate-onboarding-wizard.store";

const priyaClient = migrateOnboardingPriyaMockClient;

const migrateKeys = {
  all: ["migrate-onboarding"] as const,
  sources: ["migrate-onboarding", "sources"] as const,
  bundle: (id: string) => ["migrate-onboarding", "bundle", id] as const
};

function parseUploadError(responseText: string): ApiErrorPayload {
  try {
    return JSON.parse(responseText) as ApiErrorPayload;
  } catch {
    return {
      error: "NOT_IMPLEMENTED",
      message: responseText || "Import upload failed"
    };
  }
}

export async function uploadImportFileForMigrate(
  file: File,
  entityType: WizardImportEntityType
): Promise<ImportSessionResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("entityType", entityType);

  const token = getAuthToken();
  const uploadResponse = await fetch(`${publicEnv.NEXT_PUBLIC_API_URL}/api/v1/imports`, {
    method: "POST",
    body: formData,
    credentials: "include",
    ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {})
  });

  if (uploadResponse.status === 401) {
    clearBrowserAuthSession();
    if (typeof window !== "undefined") {
      window.location.assign("/login");
    }
  }

  if (!uploadResponse.ok) {
    throw new ApiError(uploadResponse.status, parseUploadError(await uploadResponse.text()));
  }

  return (await uploadResponse.json()) as ImportSessionResponse;
}

export function useMigrateOnboardingSources() {
  return useQuery({
    queryKey: migrateKeys.sources,
    queryFn: () => migrateOnboardingRealClient.listSources()
  });
}

export function useMigrateOnboardingBundle(bundleId: string | null) {
  const setBundle = useMigrateOnboardingWizardStore((state) => state.setBundle);

  return useQuery({
    queryKey: ["migrate-onboarding", "bundle", bundleId],
    enabled: Boolean(bundleId),
    refetchInterval: (query) => (query.state.data?.status === "committing" ? 2000 : false),
    queryFn: async () => {
      if (!bundleId) {
        throw new Error("Missing bundle id");
      }
      const bundle = await migrateOnboardingRealClient.getBundle(bundleId);
      setBundle(bundle.id, bundle.wizardStep);
      return bundle;
    }
  });
}

export function useCreateMigrateOnboardingSession() {
  const queryClient = useQueryClient();
  const setBundle = useMigrateOnboardingWizardStore((state) => state.setBundle);

  return useMutation({
    mutationFn: (resumeActive: boolean) =>
      migrateOnboardingRealClient.createSession({ resumeActive }),
    onSuccess: async (bundle) => {
      setBundle(bundle.id, bundle.wizardStep);
      queryClient.setQueryData(migrateKeys.bundle(bundle.id), bundle);
      await queryClient.invalidateQueries({ queryKey: migrateKeys.all });
    }
  });
}

export function useSetMigrateOnboardingSource(bundleId: string | null) {
  const queryClient = useQueryClient();
  const setBundle = useMigrateOnboardingWizardStore((state) => state.setBundle);

  return useMutation({
    mutationFn: (sourceSystem: MigrateSourceSystemId) => {
      if (!bundleId) {
        throw new Error("Bundle id is required");
      }
      const body: SetMigrateOnboardingSourceBody = { sourceSystem };
      return migrateOnboardingRealClient.setSource(bundleId, body);
    },
    onSuccess: async (bundle) => {
      setBundle(bundle.id, bundle.wizardStep);
      queryClient.setQueryData(migrateKeys.bundle(bundle.id), bundle);
      await queryClient.invalidateQueries({ queryKey: migrateKeys.all });
    }
  });
}

export function useLinkMigrateOnboardingFiles(bundleId: string | null) {
  const queryClient = useQueryClient();
  const setBundle = useMigrateOnboardingWizardStore((state) => state.setBundle);

  return useMutation({
    mutationFn: (body: LinkMigrateOnboardingFilesBody) => {
      if (!bundleId) {
        throw new Error("Bundle id is required");
      }
      return migrateOnboardingRealClient.linkFiles(bundleId, body);
    },
    onSuccess: async (bundle) => {
      setBundle(bundle.id, bundle.wizardStep);
      queryClient.setQueryData(migrateKeys.bundle(bundle.id), bundle);
      await queryClient.invalidateQueries({ queryKey: migrateKeys.all });
    }
  });
}

export function useResumeMigrateOnboardingSession() {
  const { bundleId: storedBundleId, setBundle } = useMigrateOnboardingWizardStore();

  return useQuery({
    queryKey: ["migrate-onboarding", "resume", storedBundleId],
    queryFn: async () => {
      if (storedBundleId) {
        try {
          const bundle = await migrateOnboardingRealClient.getBundle(storedBundleId);
          setBundle(bundle.id, bundle.wizardStep);
          return bundle;
        } catch {
          // fall through to active session
        }
      }

      try {
        const active = await migrateOnboardingRealClient.getActiveSession();
        setBundle(active.id, active.wizardStep);
        return active;
      } catch (error) {
        if (error instanceof Error && error.message === "NO_ACTIVE_SESSION") {
          // expected when no in-progress bundle
        } else if (!(error instanceof Error)) {
          throw error;
        }
        if (isPriyaOnboardingMockEnabled()) {
          const mockActive = await priyaClient.getActiveSession();
          if (mockActive) {
            setBundle(mockActive.id, mockActive.wizardStep);
            return mockActive;
          }
        }
        return null;
      }
    }
  });
}

export function useMigrateRelationalPreview(bundleId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["migrate-onboarding", "relational-preview", bundleId],
    enabled: Boolean(bundleId) && enabled,
    queryFn: () => migrateOnboardingRealClient.getRelationalPreview(bundleId as string)
  });
}

export function useMigrateDedupePreview(bundleId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["migrate-onboarding", "dedupe-preview", bundleId],
    enabled: Boolean(bundleId) && enabled,
    queryFn: () => migrateOnboardingRealClient.getDedupePreview(bundleId as string)
  });
}

export function useConfirmMigrateMappings(bundleId: string | null) {
  const queryClient = useQueryClient();
  const setBundle = useMigrateOnboardingWizardStore((state) => state.setBundle);

  return useMutation({
    mutationFn: () => {
      if (!bundleId) {
        throw new Error("Missing onboarding bundle");
      }
      return migrateOnboardingRealClient.confirmMappings(bundleId);
    },
    onSuccess: (bundle) => {
      setBundle(bundle.id, bundle.wizardStep);
      void queryClient.invalidateQueries({ queryKey: ["migrate-onboarding"] });
    }
  });
}

export function useAcknowledgeMigratePreview(bundleId: string | null) {
  const queryClient = useQueryClient();
  const setBundle = useMigrateOnboardingWizardStore((state) => state.setBundle);

  return useMutation({
    mutationFn: () => {
      if (!bundleId) {
        throw new Error("Missing onboarding bundle");
      }
      return migrateOnboardingRealClient.acknowledgePreview(bundleId);
    },
    onSuccess: (bundle) => {
      setBundle(bundle.id, bundle.wizardStep);
      void queryClient.invalidateQueries({ queryKey: ["migrate-onboarding"] });
    }
  });
}

export function useApplyMigrateDedupeDecisions(bundleId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: ApplyMigrateDedupeDecisionsBody) => {
      if (!bundleId) {
        throw new Error("Missing onboarding bundle");
      }
      return migrateOnboardingRealClient.applyDedupeDecisions(bundleId, body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["migrate-onboarding", "dedupe-preview", bundleId] });
    }
  });
}

export function useCommitMigrateBundle(bundleId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (!bundleId) {
        throw new Error("Missing onboarding bundle");
      }
      return migrateOnboardingRealClient.commit(bundleId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["migrate-onboarding", "bundle", bundleId] });
    }
  });
}
