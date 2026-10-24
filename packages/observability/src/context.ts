import { AsyncLocalStorage } from "node:async_hooks";

export interface ObservabilityTagContext {
  companyId?: string | null;
  importSessionId?: string | null;
  jobId?: string | null;
  requestId?: string | null;
}

const contextStorage = new AsyncLocalStorage<ObservabilityTagContext>();

export function mergeObservabilityContext(
  base: ObservabilityTagContext,
  patch: ObservabilityTagContext
): ObservabilityTagContext {
  return {
    companyId: patch.companyId ?? base.companyId ?? null,
    importSessionId: patch.importSessionId ?? base.importSessionId ?? null,
    jobId: patch.jobId ?? base.jobId ?? null,
    requestId: patch.requestId ?? base.requestId ?? null
  };
}

export function runWithObservabilityContext<T>(
  patch: ObservabilityTagContext,
  fn: () => T
): T {
  const parent = contextStorage.getStore() ?? {};
  return contextStorage.run(mergeObservabilityContext(parent, patch), fn);
}

export function getObservabilityContext(): ObservabilityTagContext {
  return contextStorage.getStore() ?? {};
}

export function observabilityTagsFromContext(
  context: ObservabilityTagContext
): Record<string, string> {
  const tags: Record<string, string> = {};

  if (context.companyId) {
    tags.companyId = context.companyId;
  }
  if (context.importSessionId) {
    tags.importSessionId = context.importSessionId;
  }
  if (context.jobId) {
    tags.jobId = context.jobId;
  }
  if (context.requestId) {
    tags.requestId = context.requestId;
  }

  return tags;
}

export function extractJobObservabilityContext(
  jobData: Record<string, unknown>,
  jobId: string | number | undefined
): ObservabilityTagContext {
  const companyId = typeof jobData.companyId === "string" ? jobData.companyId : null;
  const importSessionId =
    typeof jobData.importSessionId === "string" ? jobData.importSessionId : null;
  const normalizedJobId =
    jobId === undefined || jobId === null ? null : typeof jobId === "string" ? jobId : String(jobId);

  return {
    companyId,
    importSessionId,
    jobId: normalizedJobId
  };
}
