"use client";

import type { ColumnMapping } from "@fsm/types";
import type { MigrateOnboardingBundle, MigrateOnboardingSourceCatalogEntry, MigrateSourceSystemId } from "@fsm/types";
import { useEffect, useState } from "react";

import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { useImportSession } from "@/src/hooks/imports.hooks";
import {
  uploadImportFileForMigrate,
  useCreateMigrateOnboardingSession,
  useLinkMigrateOnboardingFiles,
  useMigrateOnboardingSources,
  useSetMigrateOnboardingSource
} from "@/src/hooks/migrate-onboarding.hooks";
import { api, ApiError } from "@/src/lib/api";
import { mergeServerMappings } from "@/src/lib/csv-import";
import { showToast } from "@/src/stores/toast.store";

import { MigrateOnboardingStep1Source } from "./MigrateOnboardingStep1Source";
import {
  MigrateOnboardingStep2UploadMapping,
  type MigrateUploadedFile
} from "./MigrateOnboardingStep2UploadMapping";

function formatError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong.";
}

interface MigrateOnboardingStepsOneTwoProps {
  bundle: MigrateOnboardingBundle | null;
  onRefresh: () => void;
}

export function MigrateOnboardingStepsOneTwo({ bundle, onRefresh }: MigrateOnboardingStepsOneTwoProps) {
  const sourcesQuery = useMigrateOnboardingSources();
  const createSession = useCreateMigrateOnboardingSession();
  const bundleId = bundle?.id ?? null;
  const setSource = useSetMigrateOnboardingSource(bundleId);
  const linkFiles = useLinkMigrateOnboardingFiles(bundleId);

  const [localFiles, setLocalFiles] = useState<MigrateUploadedFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<MigrateSourceSystemId | null>(
    bundle?.stepState.sourceSystem ?? null
  );

  const wizardStep = bundle?.wizardStep ?? 1;

  useEffect(() => {
    if (!bundle && !createSession.isPending && !createSession.isSuccess) {
      createSession.mutate(true, {
        onSuccess: () => onRefresh(),
        onError: (error) => {
          showToast({ tone: "error", title: "Could not start migration", description: formatError(error) });
        }
      });
    }
  }, [bundle, createSession, onRefresh]);

  useEffect(() => {
    if (bundle?.stepState.sourceSystem) {
      setSelectedSourceId(bundle.stepState.sourceSystem);
    }
  }, [bundle?.stepState.sourceSystem]);

  const sources: MigrateOnboardingSourceCatalogEntry[] = sourcesQuery.data?.sources ?? [];
  const sourceLabel =
    sources.find((entry) => entry.id === bundle?.stepState.sourceSystem)?.label ?? "Generic export";

  async function handleSelectSource(sourceId: MigrateSourceSystemId) {
    setSelectedSourceId(sourceId);

    try {
      await setSource.mutateAsync(sourceId);
      onRefresh();
      showToast({
        tone: "success",
        title: "Source saved",
        description: "Upload your export files in the next step."
      });
    } catch (error: unknown) {
      showToast({ tone: "error", title: "Could not save source", description: formatError(error) });
    }
  }

  async function handleUpload(file: File, entityType: MigrateUploadedFile["ref"]["entityType"]) {
    setIsUploading(true);

    try {
      const { importSession } = await uploadImportFileForMigrate(file, entityType);
      const headers = Object.keys(importSession.columnMappings);
      const mappingOverrides = mergeServerMappings(headers, {}, importSession.columnMappings);

      const ref = {
        importSessionId: importSession.id,
        entityType,
        fileName: importSession.fileName,
        label: importSession.fileName
      };

      setLocalFiles((current) => {
        const next = [
          ...current.filter((item) => item.ref.importSessionId !== importSession.id),
          { ref, session: importSession, mappingOverrides }
        ];
        return next;
      });
      setActiveFileId(importSession.id);
    } catch (error: unknown) {
      showToast({ tone: "error", title: "Upload failed", description: formatError(error) });
    } finally {
      setIsUploading(false);
    }
  }

  function handleUpdateMapping(importSessionId: string, header: string, fieldName: string | null) {
    setLocalFiles((current) =>
      current.map((file) => {
        if (file.ref.importSessionId !== importSessionId) {
          return file;
        }

        const mappingOverrides: ColumnMapping = {
          ...file.mappingOverrides,
          [header]: fieldName
        };

        return { ...file, mappingOverrides };
      })
    );
  }

  const activeSessionQuery = useImportSession(activeFileId, {
    enabled: Boolean(activeFileId) && wizardStep === 2,
    refetchInterval: wizardStep === 2 ? 1500 : false
  });

  useEffect(() => {
    const importSession = activeSessionQuery.data?.importSession;
    if (!importSession || !activeFileId) {
      return;
    }

    setLocalFiles((current) =>
      current.map((file) => {
        if (file.ref.importSessionId !== activeFileId) {
          return file;
        }

        const headers = Object.keys(importSession.columnMappings);
        const merged = mergeServerMappings(headers, file.mappingOverrides, importSession.columnMappings);
        const mappingOverrides =
          Object.keys(file.mappingOverrides).length > 0 ? file.mappingOverrides : merged;

        return {
          ...file,
          session: importSession,
          mappingOverrides
        };
      })
    );
  }, [activeFileId, activeSessionQuery.data?.importSession]);

  async function handleCompleteStep2() {
    if (!bundle || localFiles.length === 0) {
      showToast({
        tone: "error",
        title: "Add at least one file",
        description: "Upload a CSV export before continuing."
      });
      return;
    }

    try {
      for (const file of localFiles) {
        await api.post(`/api/v1/imports/${file.ref.importSessionId}/confirm-mapping`, {
          mappingOverrides: file.mappingOverrides
        });
      }

      await linkFiles.mutateAsync({
        files: localFiles.map((file) => file.ref)
      });

      onRefresh();
      showToast({
        tone: "success",
        title: "Mappings saved",
        description: "Continue with mapping review and preview in the next steps."
      });
    } catch (error: unknown) {
      showToast({ tone: "error", title: "Could not finish upload step", description: formatError(error) });
    }
  }

  if (!bundle || sourcesQuery.isLoading || createSession.isPending) {
    return <SkeletonCard className="min-h-[320px]" />;
  }

  if (wizardStep === 2) {
    return (
      <MigrateOnboardingStep2UploadMapping
        sourceLabel={sourceLabel}
        files={localFiles}
        activeFileId={activeFileId}
        isUploading={isUploading}
        isLinking={linkFiles.isPending}
        onSelectFile={setActiveFileId}
        onUpload={handleUpload}
        onUpdateMapping={handleUpdateMapping}
        onBack={() => {
          showToast({
            tone: "info",
            title: "Source locked for this bundle",
            description: "Start a new onboarding session to change the source system."
          });
        }}
        onCompleteStep2={() => void handleCompleteStep2()}
      />
    );
  }

  return (
    <MigrateOnboardingStep1Source
      sources={sources}
      selectedSourceId={selectedSourceId}
      isSubmitting={setSource.isPending}
      onSelectSource={(sourceId) => void handleSelectSource(sourceId)}
    />
  );
}
